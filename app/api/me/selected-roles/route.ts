import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function pickDiscordUserId(session: any): string | null {
  const u = session?.user;
  const candidates = [u?.discord_user_id, u?.discordUserId, u?.id];
  for (const c of candidates) {
    const v = String(c || "").trim();
    if (v && isSnowflake(v)) return v;
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing guildId" }, { status: 400 });
  }

  // Require NextAuth session
  const session = await auth();
  const discordUserId = pickDiscordUserId(session);

  if (!discordUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Map discord_user_id -> profiles.id
  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id,discord_user_id")
    .eq("discord_user_id", discordUserId)
    .single();

  if (profErr || !prof?.id) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  // Fetch role selections for THIS user only
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("user_hub_roles")
    .select("role_kind,role_id")
    .eq("guild_id", guildId)
    .eq("user_id", String(prof.id));

  if (selErr) {
    return NextResponse.json(
      { error: "Failed to load selections" },
      { status: 500 }
    );
  }

  let combatRoleId: string | null = null;
  let logisticsRoleId: string | null = null;

  for (const r of rows || []) {
    const kind = String((r as any).role_kind || "").trim();
    const rid = String((r as any).role_id || "").trim();
    if (!rid) continue;
    if (kind === "combat") combatRoleId = rid;
    if (kind === "logistics") logisticsRoleId = rid;
  }

  return NextResponse.json({
    ok: true,
    guildId,
    combatRoleId,
    logisticsRoleId,
  });
}
