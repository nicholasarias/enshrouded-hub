import { NextResponse } from "next/server";
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
    user?.discordId,
    user?.providerAccountId,
    user?.id,
    user?.sub,
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
 * GET /api/me/is-officer?guildId=...
 */
export const GET = auth(async function GET(req) {
  const session = (req as any).auth;
  if (!session) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid guildId" }, { status: 400 });
  }

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return NextResponse.json({ ok: false, error: "Missing discord user id in session" }, { status: 401 });
  }

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profErr) {
    console.error("profiles lookup failed:", profErr);
    return NextResponse.json({ ok: false, error: "Profile lookup failed" }, { status: 500 });
  }

  if (!prof?.id) {
    return NextResponse.json({ ok: true, guildId, isOfficer: false }, { status: 200 });
  }

  const { data: gs, error: gsErr } = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (gsErr) {
    console.error("guild_settings lookup failed:", gsErr);
    return NextResponse.json({ ok: false, error: "guild_settings lookup failed" }, { status: 500 });
  }

  const officerRoleId = String((gs as any)?.officer_role_id || "").trim();
  if (!officerRoleId || !isSnowflake(officerRoleId)) {
    return NextResponse.json({ ok: true, guildId, isOfficer: false }, { status: 200 });
  }

  const { data: link, error: linkErr } = await supabaseAdmin
    .from("user_guild_roles")
    .select("role_id")
    .eq("guild_id", guildId)
    .eq("user_id", String(prof.id))
    .eq("role_id", officerRoleId)
    .maybeSingle();

  if (linkErr) {
    console.error("user_guild_roles lookup failed:", linkErr);
    return NextResponse.json({ ok: false, error: "user_guild_roles lookup failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guildId, isOfficer: Boolean(link) }, { status: 200 });
});
