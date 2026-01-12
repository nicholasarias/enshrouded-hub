import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function requireOfficer() {
  const session = await auth();
  if (!session) {
    return { ok: false as const, status: 401 as const, error: "Unauthorized" };
  }

  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";
  const discordUserId = (session as any).discordUserId as string | null;

  if (!guildId || !discordUserId) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const prof = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .single();

  if (prof.error || !prof.data?.id) {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  const settings = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id, roles_enabled, fallback_officer_mode, guild_owner_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  const officerRoleId = settings.data?.officer_role_id || null;
  const rolesEnabled = !!settings.data?.roles_enabled;
  const fallbackMode = settings.data?.fallback_officer_mode || "owner";
  const ownerId = settings.data?.guild_owner_id || null;

  // Role based officer
  if (rolesEnabled && officerRoleId) {
    const hasRole = await supabaseAdmin
      .from("user_guild_roles")
      .select("role_id")
      .eq("user_id", prof.data.id)
      .eq("guild_id", guildId)
      .eq("role_id", officerRoleId)
      .maybeSingle();

    if (hasRole.data) {
      return { ok: true as const, status: 200 as const, userId: prof.data.id, guildId };
    }

    return { ok: false as const, status: 403 as const, error: "Officer role required" };
  }

  // Fallback officer
  if (fallbackMode === "owner" && ownerId && discordUserId === ownerId) {
    return { ok: true as const, status: 200 as const, userId: prof.data.id, guildId };
  }

  return { ok: false as const, status: 403 as const, error: "Officer required" };
}
