import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

function pickDiscordUserId(session: any): string | null {
  const user = session?.user;
  const candidates = [
    user?.discord_user_id,
    user?.discordUserId,
    user?.discordId,
    user?.providerAccountId,
    session?.discordUserId,
    session?.providerAccountId,
  ];

  for (const c of candidates) {
    const v = String(c || "").trim();
    if (isSnowflake(v)) return v;
  }
  return null;
}

/**
 * GET /api/me/selected-roles?guildId=...
 *
 * Returns the user's current selection for:
 * - combat role (one)
 * - logistics role (one)
 *
 * Reads from: user_hub_roles (keyed by profiles.id uuid)
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  // We identify the user via Discord ID, then map to our internal profiles.id (uuid)
  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return NextResponse.json(
      { error: "Unauthorized: missing discord user id in session" },
      { status: 401 }
    );
  }

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profErr) {
    console.error("profiles lookup failed:", profErr);
    return NextResponse.json({ error: "Failed to resolve user profile" }, { status: 500 });
  }

  if (!prof?.id) {
    return NextResponse.json(
      { error: "Profile not found. Try signing out and signing in again." },
      { status: 404 }
    );
  }

  const userId = String(prof.id);

  const { data, error } = await supabaseAdmin
    .from("user_hub_roles")
    .select("role_kind, role_id, selected_at")
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (error) {
    console.error("user_hub_roles select failed:", error);
    return NextResponse.json({ error: "Failed to load selections" }, { status: 500 });
  }

  let combatRoleId: string | null = null;
  let logisticsRoleId: string | null = null;

  for (const row of data ?? []) {
    if (row.role_kind === "combat") combatRoleId = row.role_id;
    if (row.role_kind === "logistics") logisticsRoleId = row.role_id;
  }

  return NextResponse.json(
    {
      ok: true,
      guildId,
      combatRoleId,
      logisticsRoleId,
    },
    { status: 200 }
  );
}
