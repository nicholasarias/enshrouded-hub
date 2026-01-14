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
    session?.discordUserId,
    session?.providerAccountId,
  ];

  for (const c of candidates) {
    const v = String(c || "").trim();
    if (isSnowflake(v)) return v;
  }
  return null;
}

async function assertOfficerOrOwner(params: { guildId: string; sessionDiscordId: string }) {
  const { guildId, sessionDiscordId } = params;

  const { data: prof, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", sessionDiscordId)
    .maybeSingle();

  if (profErr) {
    console.error("profiles lookup failed:", profErr);
    return { ok: false as const, status: 500, error: "Failed to resolve officer profile" };
  }
  if (!prof?.id) {
    return { ok: false as const, status: 401, error: "Profile not found. Sign out and sign in again." };
  }

  const officerUserId = String(prof.id);

  const { data: gs, error: gsErr } = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id, owner_discord_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (gsErr) {
    console.error("guild_settings lookup failed:", gsErr);
    return { ok: false as const, status: 500, error: "Failed to load guild settings" };
  }

  const ownerDiscordId = String((gs as any)?.owner_discord_id || "").trim();
  if (ownerDiscordId && ownerDiscordId === sessionDiscordId) {
    return { ok: true as const, officerUserId };
  }

  const officerRoleId = String((gs as any)?.officer_role_id || "").trim();
  if (!officerRoleId) {
    return { ok: false as const, status: 403, error: "Officer role is not configured for this guild." };
  }

  const { data: link, error: linkErr } = await supabaseAdmin
    .from("user_guild_roles")
    .select("role_id")
    .eq("guild_id", guildId)
    .eq("user_id", officerUserId)
    .eq("role_id", officerRoleId)
    .maybeSingle();

  if (linkErr) {
    console.error("user_guild_roles lookup failed:", linkErr);
    return { ok: false as const, status: 500, error: "Failed to validate officer role" };
  }

  if (!link) {
    return { ok: false as const, status: 403, error: "Forbidden: officer access required" };
  }

  return { ok: true as const, officerUserId };
}

/**
 * POST /api/officer/set-user-role
 * Body: { guildId: string, discordUserId: string, roleId: string }
 *
 * Sets ONE hub role (combat or logistics) for the target user.
 * It replaces any existing selection for that same role_kind.
 * This does not edit Discord roles, only hub selections.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const guildId = String(body?.guildId || "").trim();
  const targetDiscordUserId = String(body?.discordUserId || "").trim();
  const roleId = String(body?.roleId || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!targetDiscordUserId || !isSnowflake(targetDiscordUserId)) {
    return NextResponse.json({ error: "Missing or invalid discordUserId" }, { status: 400 });
  }
  if (!roleId || !isSnowflake(roleId)) {
    return NextResponse.json({ error: "Missing or invalid roleId" }, { status: 400 });
  }

  const officerDiscordId = pickDiscordUserId(session);
  if (!officerDiscordId) {
    return NextResponse.json({ error: "Unauthorized: missing discord user id in session" }, { status: 401 });
  }

  const officerCheck = await assertOfficerOrOwner({ guildId, sessionDiscordId: officerDiscordId });
  if (!officerCheck.ok) {
    return NextResponse.json({ error: officerCheck.error }, { status: officerCheck.status });
  }

  // Resolve target profiles.id from discord_user_id
  const { data: targetProf, error: targetErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", targetDiscordUserId)
    .maybeSingle();

  if (targetErr) {
    console.error("target profile lookup failed:", targetErr);
    return NextResponse.json({ error: "Failed to resolve target profile" }, { status: 500 });
  }
  if (!targetProf?.id) {
    return NextResponse.json({ error: "Target profile not found" }, { status: 404 });
  }

  const targetUserId = String(targetProf.id);

  // Validate role exists and is selectable
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("role_id, name, is_managed")
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

  // Load hub metadata to know if this is combat vs logistics
  const { data: meta, error: metaErr } = await supabaseAdmin
    .from("guild_role_meta")
    .select("role_kind, group_key, display_name, description, enabled")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (metaErr) {
    console.error("guild_role_meta lookup failed:", metaErr);
    return NextResponse.json({ error: "Failed to read role metadata" }, { status: 500 });
  }
  if (!meta) {
    return NextResponse.json({ error: "This role is not configured in the hub yet." }, { status: 400 });
  }
  if ((meta as any).enabled !== true) {
    return NextResponse.json({ error: "This role is disabled in the hub." }, { status: 400 });
  }

  const roleKind = String((meta as any).role_kind || "").trim();
  if (roleKind !== "combat" && roleKind !== "logistics") {
    return NextResponse.json({ error: "Invalid role kind configuration" }, { status: 500 });
  }

  // Enforce same rule as normal selection: logistics requires combat first
  if (roleKind === "logistics") {
    const { data: combatSel, error: combatSelErr } = await supabaseAdmin
      .from("user_hub_roles")
      .select("role_id")
      .eq("user_id", targetUserId)
      .eq("guild_id", guildId)
      .eq("role_kind", "combat")
      .maybeSingle();

    if (combatSelErr) {
      console.error("combat selection check failed:", combatSelErr);
      return NextResponse.json({ error: "Failed to validate combat selection" }, { status: 500 });
    }

    if (!combatSel?.role_id) {
      return NextResponse.json({ error: "Target must have a combat role before logistics." }, { status: 400 });
    }
  }

  // Replace existing selection for that role_kind
  const { error: delErr } = await supabaseAdmin
    .from("user_hub_roles")
    .delete()
    .eq("user_id", targetUserId)
    .eq("guild_id", guildId)
    .eq("role_kind", roleKind);

  if (delErr) {
    console.error("user_hub_roles delete failed:", delErr);
    return NextResponse.json({ error: "Failed to replace previous selection" }, { status: 500 });
  }

  const insertPayload: any = {
    user_id: targetUserId,
    guild_id: guildId,
    role_id: roleId,
    role_kind: roleKind,
    selected_at: new Date().toISOString(),
    discord_user_id: targetDiscordUserId,
  };

  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("user_hub_roles")
    .insert(insertPayload)
    .select("*")
    .single();

  if (insErr) {
    console.error("user_hub_roles insert failed:", insErr);
    return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      guildId,
      discordUserId: targetDiscordUserId,
      selection: inserted,
      role: {
        roleId,
        name: (roleRow as any).name,
        roleKind,
        groupKey: (meta as any).group_key,
        displayName: (meta as any).display_name,
        description: (meta as any).description,
      },
    },
    { status: 200 }
  );
}
