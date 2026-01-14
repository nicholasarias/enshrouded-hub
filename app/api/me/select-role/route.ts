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

async function discordAddRole(params: { botToken: string; guildId: string; discordUserId: string; roleId: string }) {
  const { botToken, guildId, discordUserId, roleId } = params;

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord add role failed: HTTP ${res.status} ${text}`);
  }
}

async function discordRemoveRole(params: { botToken: string; guildId: string; discordUserId: string; roleId: string }) {
  const { botToken, guildId, discordUserId, roleId } = params;

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord remove role failed: HTTP ${res.status} ${text}`);
  }
}

/**
 * POST /api/me/select-role
 * body: { guildId, roleId }
 */
export const POST = auth(async function POST(req) {
  const session = (req as any).auth;
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const userGuildId = String(body?.guildId || "").trim();
  const selectedRoleId = String(body?.roleId || "").trim();

  if (!userGuildId || !isSnowflake(userGuildId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!selectedRoleId || !isSnowflake(selectedRoleId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid roleId" }, { status: 400 });
  }

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return NextResponse.json({ ok: false, error: "Unauthorized: missing discord user id in session" }, { status: 401 });
  }

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (profErr) {
    console.error("profiles lookup failed:", profErr);
    return NextResponse.json({ ok: false, error: "Failed to resolve user profile" }, { status: 500 });
  }

  if (!prof?.id) {
    return NextResponse.json(
      { ok: false, error: "Profile not found. Try signing out and signing in again." },
      { status: 404 }
    );
  }

  const userId = String(prof.id);

  // Verify role exists in guild
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("role_id,name,is_managed")
    .eq("guild_id", userGuildId)
    .eq("role_id", selectedRoleId)
    .maybeSingle();

  if (roleErr) {
    console.error("discord_guild_roles lookup failed:", roleErr);
    return NextResponse.json({ ok: false, error: "Failed to validate role" }, { status: 500 });
  }
  if (!roleRow) {
    return NextResponse.json({ ok: false, error: "Role not found for this guild" }, { status: 404 });
  }
  if ((roleRow as any).is_managed) {
    return NextResponse.json({ ok: false, error: "Managed roles cannot be selected" }, { status: 400 });
  }

  // Load meta (combat vs logistics)
  const { data: meta, error: metaErr } = await supabaseAdmin
    .from("guild_role_meta")
    .select("role_kind, group_key, display_name, description, enabled")
    .eq("guild_id", userGuildId)
    .eq("role_id", selectedRoleId)
    .maybeSingle();

  if (metaErr) {
    console.error("guild_role_meta lookup failed:", metaErr);
    return NextResponse.json({ ok: false, error: "Failed to read role metadata" }, { status: 500 });
  }
  if (!meta) {
    return NextResponse.json({ ok: false, error: "This role is not configured in the hub yet." }, { status: 400 });
  }
  if ((meta as any).enabled !== true) {
    return NextResponse.json({ ok: false, error: "This role is disabled in the hub." }, { status: 400 });
  }

  const roleKind = String((meta as any).role_kind || "").trim();
  if (roleKind !== "combat" && roleKind !== "logistics") {
    return NextResponse.json({ ok: false, error: "Invalid role kind configuration" }, { status: 500 });
  }

  // Server-side gating: logistics requires combat first
  if (roleKind === "logistics") {
    const { data: combatSel, error: combatSelErr } = await supabaseAdmin
      .from("user_hub_roles")
      .select("role_id")
      .eq("user_id", userId)
      .eq("guild_id", userGuildId)
      .eq("role_kind", "combat")
      .maybeSingle();

    if (combatSelErr) {
      console.error("combat selection check failed:", combatSelErr);
      return NextResponse.json({ ok: false, error: "Failed to validate combat selection" }, { status: 500 });
    }

    if (!combatSel?.role_id) {
      return NextResponse.json({ ok: false, error: "Choose a combat role first to unlock logistics." }, { status: 400 });
    }
  }

  // Existing selection (for Discord removal)
  const { data: existingSel, error: existingSelErr } = await supabaseAdmin
    .from("user_hub_roles")
    .select("role_id")
    .eq("user_id", userId)
    .eq("guild_id", userGuildId)
    .eq("role_kind", roleKind)
    .maybeSingle();

  if (existingSelErr) {
    console.error("user_hub_roles existing select failed:", existingSelErr);
    return NextResponse.json({ ok: false, error: "Failed to load existing selection" }, { status: 500 });
  }

  const previousRoleId = existingSel?.role_id ? String(existingSel.role_id) : null;

  // Replace selection
  const { error: delErr } = await supabaseAdmin
    .from("user_hub_roles")
    .delete()
    .eq("user_id", userId)
    .eq("guild_id", userGuildId)
    .eq("role_kind", roleKind);

  if (delErr) {
    console.error("user_hub_roles delete failed:", delErr);
    return NextResponse.json({ ok: false, error: "Failed to replace previous selection" }, { status: 500 });
  }

  const insertPayload = {
    user_id: userId,
    guild_id: userGuildId,
    role_id: selectedRoleId,
    role_kind: roleKind,
    selected_at: new Date().toISOString(),
    discord_user_id: discordUserId,
  };

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("user_hub_roles")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insErr) {
    console.error("user_hub_roles insert failed:", insErr);
    return NextResponse.json({ ok: false, error: "Failed to save selection" }, { status: 500 });
  }

  // Discord sync (best-effort)
  const botToken = process.env.DISCORD_BOT_TOKEN || "";
  let discordSyncOk = false;
  let discordSyncWarning: string | null = null;

  if (!botToken) {
    discordSyncWarning = "DISCORD_BOT_TOKEN missing. Hub selection saved but Discord was not updated.";
  } else {
    try {
      if (previousRoleId && previousRoleId !== selectedRoleId) {
        await discordRemoveRole({ botToken, guildId: userGuildId, discordUserId, roleId: previousRoleId });
      }
      await discordAddRole({ botToken, guildId: userGuildId, discordUserId, roleId: selectedRoleId });
      discordSyncOk = true;
    } catch (e: any) {
      console.error("Discord role sync failed:", e);
      discordSyncWarning = e?.message || "Discord role sync failed. Hub selection saved but Discord was not updated.";
    }
  }

  return NextResponse.json(
    {
      ok: true,
      selection: inserted,
      role: {
        roleId: selectedRoleId,
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
});
