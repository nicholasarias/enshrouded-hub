import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(id || "").trim()
  );
}

function pickDiscordUserId(session: any): string | null {
  const user = session?.user;

  const candidates = [
    user?.discord_user_id,
    user?.discordUserId,
    user?.discordId,
    user?.providerAccountId,
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
export async function GET(req: Request) {
  const session: any = await auth();

  const discordUserIdForLog = pickDiscordUserId(session);
  console.log("IS_OFFICER session?", Boolean(session), "discordUserId:", discordUserIdForLog);

  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid guildId" }, { status: 400 });
  }

  // Prefer profile UUID from session (if you ever add it later)
  let profileId = String(session?.user?.id || "").trim();

  // If session.user.id is not a UUID, map discord id -> profiles.id
  if (!isUuid(profileId)) {
    const discordUserId = pickDiscordUserId(session);

    if (discordUserId) {
      const { data: prof, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("discord_user_id", discordUserId)
        .maybeSingle();

      if (profErr) {
        console.error("profiles lookup failed:", profErr);
        return NextResponse.json({ ok: false, error: "Profile lookup failed" }, { status: 500 });
      }

      profileId = String(prof?.id || "").trim();
    }
  }

  // Logged in but cannot resolve profile id -> not officer (no 401)
  if (!isUuid(profileId)) {
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

  const officerRoleId = String(gs?.officer_role_id || "").trim();
  if (!officerRoleId || !isSnowflake(officerRoleId)) {
    return NextResponse.json({ ok: true, guildId, isOfficer: false }, { status: 200 });
  }

  const { data: linkData, error: linkErr } = await supabaseAdmin
    .from("user_guild_roles")
    .select("role_id")
    .eq("guild_id", guildId)
    .eq("user_id", profileId)
    .eq("role_id", officerRoleId)
    .maybeSingle();

  if (linkErr) {
    console.error("user_guild_roles lookup failed:", linkErr);
    return NextResponse.json({ ok: false, error: "user_guild_roles lookup failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, guildId, isOfficer: Boolean(linkData) },
    { status: 200 }
  );
}
