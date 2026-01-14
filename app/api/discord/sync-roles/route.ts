// web/app/api/discord/sync-roles/route.ts

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOfficer } from "@/lib/requireOfficer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function pickGuildId() {
  // Prefer server-only env var, but allow fallback until you migrate
  return String(
    process.env.DISCORD_GUILD_ID || process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || ""
  ).trim();
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

export async function POST(req: Request) {
  // 1) Officer gate
  const gate: any = await requireOfficer(req);
  if (!gate?.ok) {
    return NextResponse.json(
      { ok: false, error: gate?.error || "Denied" },
      { status: Number(gate?.status) || 401 }
    );
  }

  // 2) We only need Discord user id from session
  const session = await auth();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return NextResponse.json({ ok: false, error: "Missing discord user id" }, { status: 400 });
  }

  // 3) Look up internal profile id (uuid) from profiles table
  const prof = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (prof.error) {
    console.error("profiles lookup failed:", prof.error);
    return NextResponse.json({ ok: false, error: "Failed to look up profile" }, { status: 500 });
  }

  if (!prof.data?.id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Profile not found for this Discord user. (profiles.discord_user_id must be set for your account.)",
      },
      { status: 404 }
    );
  }

  const userId = String(prof.data.id);

  // 4) Env vars
  const guildId = pickGuildId();
  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid DISCORD_GUILD_ID (or NEXT_PUBLIC_DISCORD_GUILD_ID fallback)" },
      { status: 500 }
    );
  }

  const botToken = String(process.env.DISCORD_BOT_TOKEN || "").trim();
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "Missing DISCORD_BOT_TOKEN" }, { status: 500 });
  }

  // 5) Fetch guild (owner id)
  const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!guildRes.ok) {
    const text = await guildRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Discord guild fetch failed: HTTP ${guildRes.status}: ${text}` },
      { status: 502 }
    );
  }

  const guild = (await guildRes.json()) as DiscordGuild;

  // 6) Fetch roles catalog
  const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${botToken}` },
  });

  if (!rolesRes.ok) {
    const text = await rolesRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Discord roles fetch failed: HTTP ${rolesRes.status}: ${text}` },
      { status: 502 }
    );
  }

  const roles = (await rolesRes.json()) as DiscordRole[];

  // Meaningful roles = anything besides @everyone (role id == guild id)
  const meaningfulRoles = roles.filter((r) => r.id !== guildId);
  const rolesEnabled = meaningfulRoles.length > 0;

  // 7) Upsert roles catalog into Supabase
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
    return NextResponse.json({ ok: false, error: "Failed to upsert roles catalog" }, { status: 500 });
  }

  // 8) Fetch THIS user’s guild member roles
  const memberRes = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
    { headers: { Authorization: `Bot ${botToken}` } }
  );

  if (!memberRes.ok) {
    const text = await memberRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: `Discord member fetch failed: HTTP ${memberRes.status}: ${text}` },
      { status: 502 }
    );
  }

  const member = (await memberRes.json()) as DiscordGuildMember;
  const memberRoleIds = Array.isArray(member?.roles) ? member.roles : [];

  // 9) Replace user roles rows for this guild (delete then insert)
  const { error: deleteError } = await supabaseAdmin
    .from("user_guild_roles")
    .delete()
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (deleteError) {
    console.error("Delete user_guild_roles failed:", deleteError);
    return NextResponse.json({ ok: false, error: "Failed to clear existing user roles" }, { status: 500 });
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
      return NextResponse.json({ ok: false, error: "Failed to save user roles" }, { status: 500 });
    }
  }

  // 10) Save guild settings fields the sync controls
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
    return NextResponse.json({ ok: false, error: "Failed to update guild settings" }, { status: 500 });
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
