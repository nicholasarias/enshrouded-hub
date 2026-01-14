import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

function pickDiscordUserId(session: any): string | null {
  const user = session?.user;
  if (!user) return null;

  const candidates = [
    user.discord_user_id,
    user.discordUserId,
    user.discordId,
    user.providerAccountId,
    session.discordUserId,
    session.providerAccountId,
  ];

  for (const c of candidates) {
    const v = String(c || "").trim();
    if (isSnowflake(v)) return v;
  }
  return null;
}

export async function requireOfficer(req: Request) {

  const session = await auth();
  if (!session?.user) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }

  const guildId = String(
    process.env.DISCORD_GUILD_ID ||
      process.env.NEXT_PUBLIC_DISCORD_GUILD_ID ||
      ""
  ).trim();

  if (!guildId || !isSnowflake(guildId)) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  // Pull settings once
  const settings = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id, roles_enabled, fallback_officer_mode, guild_owner_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (settings.error) {
    console.error("requireOfficer guild_settings error:", settings.error);
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const rolesEnabled = !!settings.data?.roles_enabled;
  const officerRoleId = String(settings.data?.officer_role_id || "").trim() || null;
  const fallbackMode = String(settings.data?.fallback_officer_mode || "owner");
  const ownerId = String(settings.data?.guild_owner_id || "").trim() || null;

  // Long term best: owner fallback (no dependency on session.user.id)
  if (fallbackMode === "owner" && ownerId && discordUserId === ownerId) {
    return {
      ok: true as const,
      status: 200 as const,
      userId: null,
      guildId,
      discordUserId,
      mode: "owner" as const,
    };
  }

  // If roles are enabled, require the officer role via Discord membership check.
  // This avoids profiles/user_guild_roles completely.
  if (rolesEnabled && officerRoleId) {
    const botToken = String(process.env.DISCORD_BOT_TOKEN || "").trim();
    if (!botToken) {
      return {
        ok: false as const,
        status: 403 as const,
        error: "Officer role required (bot token missing to verify membership)",
      };
    }

    const memberRes = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );

    if (!memberRes.ok) {
      const text = await memberRes.text().catch(() => "");
      console.error("requireOfficer member fetch failed:", memberRes.status, text);
      return { ok: false as const, status: 403 as const, error: "Officer required" };
    }

    const member = (await memberRes.json()) as { roles?: string[] };
    const roles = Array.isArray(member.roles) ? member.roles : [];

    if (roles.includes(officerRoleId)) {
      return {
        ok: true as const,
        status: 200 as const,
        userId: null,
        guildId,
        discordUserId,
        mode: "role" as const,
      };
    }

    return { ok: false as const, status: 403 as const, error: "Officer role required" };
  }

  return { ok: false as const, status: 403 as const, error: "Officer required" };
}
