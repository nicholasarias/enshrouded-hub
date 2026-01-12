// web/app/api/discord/sync-roles/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOfficer } from "@/lib/requireOfficer";

type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

type DiscordGuild = {
  id: string;
  owner_id: string;
};

type DiscordGuildMember = {
  roles: string[];
};

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

export async function POST() {
  // 1) Officer-only gate (server authoritative)
  const gate = await requireOfficer();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  // 2) We still use the user session to know which profiles.id to sync into
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id; // profiles.id (uuid)
  const discordUserId = (session as any).discordUserId as string | null;

  if (!discordUserId || !isSnowflake(discordUserId)) {
    return NextResponse.json({ error: "Missing discord user id" }, { status: 400 });
  }

  // 3) Server-only env vars (no NEXT_PUBLIC here)
  const guildId = process.env.DISCORD_GUILD_ID || "";
  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid DISCORD_GUILD_ID" }, { status: 500 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  if (!botToken) {
    return NextResponse.json({ error: "Missing DISCORD_BOT_TOKEN" }, { status: 500 });
  }

  // 4) Fetch guild (owner id)
  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!guildRes.ok) {
    const text = await guildRes.text();
    return NextResponse.json(
      { error: `Discord guild fetch failed: HTTP ${guildRes.status}: ${text}` },
      { status: 502 }
    );
  }

  const guild = (await guildRes.json()) as DiscordGuild;

  // 5) Fetch roles catalog
  const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!rolesRes.ok) {
    const text = await rolesRes.text();
    return NextResponse.json(
      { error: `Discord roles fetch failed: HTTP ${rolesRes.status}: ${text}` },
      { status: 502 }
    );
  }

  const roles = (await rolesRes.json()) as DiscordRole[];

  // Meaningful roles = anything besides @everyone (role id == guild id)
  const meaningfulRoles = roles.filter((r) => r.id !== guildId);
  const rolesEnabled = meaningfulRoles.length > 0;

  // 6) Upsert roles catalog into Supabase
  const rolesRows = roles.map((r) => ({
    guild_id: guildId,
    role_id: r.id,
    name: r.name,
    color_int: r.color ?? 0,
    position: r.position ?? 0,
    is_managed: !!r.managed,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertRolesError } = await supabaseAdmin
    .from("discord_guild_roles")
    .upsert(rolesRows, { onConflict: "guild_id,role_id" });

  if (upsertRolesError) {
    console.error("Upsert discord_guild_roles failed:", upsertRolesError);
    return NextResponse.json({ error: "Failed to upsert roles catalog" }, { status: 500 });
  }

  // 7) Fetch THIS user’s guild member roles
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );

  if (!memberRes.ok) {
    const text = await memberRes.text();
    return NextResponse.json(
      { error: `Discord member fetch failed: HTTP ${memberRes.status}: ${text}` },
      { status: 502 }
    );
  }

  const member = (await memberRes.json()) as DiscordGuildMember;
  const memberRoleIds = Array.isArray(member.roles) ? member.roles : [];

  // 8) Replace user roles rows for this guild (delete then insert)
  const { error: deleteError } = await supabaseAdmin
    .from("user_guild_roles")
    .delete()
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (deleteError) {
    console.error("Delete user_guild_roles failed:", deleteError);
    return NextResponse.json({ error: "Failed to clear existing user roles" }, { status: 500 });
  }

  const userRoleRows = memberRoleIds.map((roleId) => ({
    user_id: userId,
    guild_id: guildId,
    role_id: roleId,
    synced_at: new Date().toISOString(),
  }));

  if (userRoleRows.length > 0) {
    const { error: insertError } = await supabaseAdmin.from("user_guild_roles").insert(userRoleRows);
    if (insertError) {
      console.error("Insert user_guild_roles failed:", insertError);
      return NextResponse.json({ error: "Failed to save user roles" }, { status: 500 });
    }
  }

  // 9) Save guild settings fields the sync controls
  const { error: settingsError } = await supabaseAdmin.from("guild_settings").upsert(
    {
      guild_id: guildId,
      roles_enabled: rolesEnabled,
      guild_owner_id: guild.owner_id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "guild_id" }
  );

  if (settingsError) {
    console.error("Upsert guild_settings failed:", settingsError);
    return NextResponse.json({ error: "Failed to update guild settings" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      guildId,
      rolesEnabled,
      rolesCount: roles.length,
      memberRolesCount: memberRoleIds.length,
    },
    { status: 200 }
  );
}
