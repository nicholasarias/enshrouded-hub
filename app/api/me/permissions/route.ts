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

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { isAuthed: false, isOfficer: false, rolesEnabled: false },
      { status: 200 }
    );
  }

  const url = new URL(req.url);

  // Multi guild ready: prefer query, fallback to env for backward compatibility
  const guildId = String(
    url.searchParams.get("guildId") ||
      process.env.DISCORD_GUILD_ID ||
      process.env.NEXT_PUBLIC_DISCORD_GUILD_ID ||
      ""
  ).trim();

  const discordUserId = pickDiscordUserId(session);

  if (!guildId || !isSnowflake(guildId) || !discordUserId) {
    return NextResponse.json(
      { isAuthed: true, isOfficer: false, rolesEnabled: false },
      { status: 200 }
    );
  }

  const prof = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (prof.error || !prof.data?.id) {
    return NextResponse.json(
      { isAuthed: true, isOfficer: false, rolesEnabled: false },
      { status: 200 }
    );
  }

  const settings = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id, roles_enabled, fallback_officer_mode, guild_owner_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (settings.error) {
    return NextResponse.json(
      { isAuthed: true, isOfficer: false, rolesEnabled: false },
      { status: 200 }
    );
  }

  const officerRoleId = String(settings.data?.officer_role_id || "").trim() || null;
  const rolesEnabled = !!settings.data?.roles_enabled;
  const fallbackMode = String(settings.data?.fallback_officer_mode || "owner");
  const ownerId = String(settings.data?.guild_owner_id || "").trim() || null;

  // If roles exist and officer role is configured, use user_guild_roles
  if (rolesEnabled && officerRoleId) {
    const hasRole = await supabaseAdmin
      .from("user_guild_roles")
      .select("role_id")
      .eq("user_id", prof.data.id)
      .eq("guild_id", guildId)
      .eq("role_id", officerRoleId)
      .maybeSingle();

    return NextResponse.json(
      { isAuthed: true, isOfficer: !!hasRole.data, rolesEnabled: true, guildId },
      { status: 200 }
    );
  }

  // Otherwise fallback
  let isOfficer = false;
  if (fallbackMode === "owner" && ownerId && discordUserId === ownerId) {
    isOfficer = true;
  }

  return NextResponse.json(
    { isAuthed: true, isOfficer, rolesEnabled: false, guildId },
    { status: 200 }
  );
}
