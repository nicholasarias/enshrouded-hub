import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { isAuthed: false, isOfficer: false, rolesEnabled: false },
      { status: 200 }
    );
  }

  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";
  const discordUserId = (session as any).discordUserId as string | null;

  if (!guildId || !discordUserId) {
    return NextResponse.json(
      { isAuthed: true, isOfficer: false, rolesEnabled: false },
      { status: 200 }
    );
  }

  const prof = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .single();

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

  const officerRoleId = settings.data?.officer_role_id || null;
  const rolesEnabled = !!settings.data?.roles_enabled;
  const fallbackMode = settings.data?.fallback_officer_mode || "owner";
  const ownerId = settings.data?.guild_owner_id || null;

  // If roles exist AND officer role is configured, use it
  if (rolesEnabled && officerRoleId) {
    const hasRole = await supabaseAdmin
      .from("user_guild_roles")
      .select("role_id")
      .eq("user_id", prof.data.id)
      .eq("guild_id", guildId)
      .eq("role_id", officerRoleId)
      .maybeSingle();

    return NextResponse.json(
      { isAuthed: true, isOfficer: !!hasRole.data, rolesEnabled: true },
      { status: 200 }
    );
  }

  // Otherwise fallback
  let isOfficer = false;

  if (fallbackMode === "owner" && ownerId && discordUserId === ownerId) {
    isOfficer = true;
  }

  return NextResponse.json(
    { isAuthed: true, isOfficer, rolesEnabled: false },
    { status: 200 }
  );
}
