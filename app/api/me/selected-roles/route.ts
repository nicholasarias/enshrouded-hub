import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function pickDiscordUserId(session: any): string | null {
  const user = session?.user;

  const candidates = [
    user?.discord_user_id,
    user?.discordUserId,
    session?.discordUserId,
    user?.providerAccountId,
    session?.providerAccountId,
    session?.sub,
    user?.sub,
  ];

  for (const c of candidates) {
    const v = String(c || "").trim();
    if (isSnowflake(v)) return v;
  }
  return null;
}

export const GET = auth(async function GET(req: NextRequest) {
  const session = (req as any).auth;

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid guildId" }, { status: 400 });
  }

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized: missing discord user id" }, { status: 401 });
  }

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profErr) {
    console.error("profiles lookup failed:", profErr);
    return NextResponse.json({ ok: false, error: "Failed to resolve user profile" }, { status: 500 });
  }

  if (!prof?.id) {
    return NextResponse.json(
      { ok: false, error: "Profile not found. Try signing out and signing in again." },
      { status: 404 }
    );
  }

  const userId = String(prof.id);

  const { data, error } = await supabaseAdmin
    .from("user_hub_roles")
    .select("role_kind, role_id")
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (error) {
    console.error("user_hub_roles select failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load selections" }, { status: 500 });
  }

  let combatRoleId: string | null = null;
  let logisticsRoleId: string | null = null;

  for (const row of data ?? []) {
    if (row.role_kind === "combat") combatRoleId = row.role_id;
    if (row.role_kind === "logistics") logisticsRoleId = row.role_id;
  }

  return NextResponse.json({ ok: true, guildId, combatRoleId, logisticsRoleId }, { status: 200 });
});
