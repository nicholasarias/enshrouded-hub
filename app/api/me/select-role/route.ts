import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

async function discordAddRole(params: {
  botToken: string;
  guildId: string;
  discordUserId: string;
  roleId: string;
}) {
  const { botToken, guildId, discordUserId, roleId } = params;

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord add role failed: HTTP ${res.status} ${text}`);
  }
}

async function discordRemoveRole(params: {
  botToken: string;
  guildId: string;
  discordUserId: string;
  roleId: string;
}) {
  const { botToken, guildId, discordUserId, roleId } = params;

  const res = await fetch(
    `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord remove role failed: HTTP ${res.status} ${text}`);
  }
}

/**
 * POST /api/me/select-role
 * Body: { guildId: string, roleId: string }
 *
 * Saves hub selection and (optionally) syncs to Discord roles.
 * Also stores discord_user_id into user_hub_roles for RSVP badges later.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUserId = (session as any).userId as string | undefined;
  if (!appUserId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const discordUserId = (session as any).discordUserId as string | undefined;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const guildId = String((body as any)?.guildId || "").trim();
  const roleId = String((body as any)?.roleId || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!roleId || !isSnowflake(roleId)) {
    return NextResponse.json({ error: "Missing or invalid roleId" }, { status: 400 });
  }

  // Verify role exists in guild
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("role_id,name,is_managed")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (roleErr) {
    console.error("discord_guild_roles lookup failed:", roleErr);
    return NextResponse.json({ error: "Failed to validate role" }, { status: 500 });
  }
  if (!roleRow) {
    return NextResponse.json({ error: "Role not found for this guild" }, { status: 404 });
  }
  if ((roleRow as any).is_managed) {
    return NextResponse.json({ error: "Managed roles cannot be selected" }, { status: 400 });
  }

  // Load meta (combat vs logistics)
  const { data: meta, error: metaErr } = await supabaseAdmin
    .from("guild_role_meta")
    .select("role_kind, group_key, display_name, description")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (metaErr) {
    console.error("guild_role_meta lookup failed:", metaErr);
    return NextResponse.json({ error: "Failed to read role metadata" }, { status: 500 });
  }
  if (!meta) {
    return NextResponse.json(
      { error: "This role is not configured in the hub yet." },
      { status: 400 }
    );
  }

  const roleKind = String((meta as any).role_kind || "").trim();
  if (roleKind !== "combat" && roleKind !== "logistics") {
    return NextResponse.json({ error: "Invalid role kind configuration" }, { status: 500 });
  }

  // Existing selection (for Discord removal)
  const { data: existingSel, error: existingSelErr } = await supabaseAdmin
    .from("user_hub_roles")
    .select("role_id")
    .eq("user_id", appUserId)
    .eq("guild_id", guildId)
    .eq("role_kind", roleKind)
    .maybeSingle();

  if (existingSelErr) {
    console.error("user_hub_roles existing select failed:", existingSelErr);
    return NextResponse.json({ error: "Failed to load existing selection" }, { status: 500 });
  }

  const previousRoleId = existingSel?.role_id ? String(existingSel.role_id) : null;

  // Replace selection
  const { error: delErr } = await supabaseAdmin
    .from("user_hub_roles")
    .delete()
    .eq("user_id", appUserId)
    .eq("guild_id", guildId)
    .eq("role_kind", roleKind);

  if (delErr) {
    console.error("user_hub_roles delete failed:", delErr);
    return NextResponse.json({ error: "Failed to replace previous selection" }, { status: 500 });
  }

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("user_hub_roles")
    .insert({
      user_id: appUserId,
      discord_user_id: discordUserId || null, // ✅ key part for RSVP badges later
      guild_id: guildId,
      role_id: roleId,
      role_kind: roleKind,
      selected_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insErr) {
    console.error("user_hub_roles insert failed:", insErr);
    return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
  }

  // Discord sync (optional)
  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  let discordSyncOk = false;
  let discordSyncWarning: string | null = null;

  if (!botToken) {
    discordSyncWarning = "DISCORD_BOT_TOKEN missing. Hub selection saved but Discord was not updated.";
  } else if (!discordUserId) {
    discordSyncWarning = "discordUserId missing in session. Hub selection saved but Discord was not updated.";
  } else {
    try {
      if (previousRoleId && previousRoleId !== roleId) {
        await discordRemoveRole({ botToken, guildId, discordUserId, roleId: previousRoleId });
      }
      await discordAddRole({ botToken, guildId, discordUserId, roleId });
      discordSyncOk = true;
    } catch (e: any) {
      console.error("Discord role sync failed:", e);
      discordSyncWarning =
        e?.message ||
        "Discord role sync failed. Hub selection saved but Discord was not updated.";
    }
  }

  return NextResponse.json(
    {
      ok: true,
      selection: inserted,
      role: {
        roleId,
        name: (roleRow as any).name,
        roleKind,
        groupKey: (meta as any).group_key,
        displayName: (meta as any).display_name,
        description: (meta as any).description,
      },
      discord: {
        ok: discordSyncOk,
        warning: discordSyncWarning,
        previousRoleId,
      },
    },
    { status: 200 }
  );
}
