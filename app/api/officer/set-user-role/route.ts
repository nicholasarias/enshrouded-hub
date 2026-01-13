import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

async function requireOfficer(params: { guildId: string; requesterDiscordId: string }) {
  const { guildId, requesterDiscordId } = params;

  const { data: requesterProf } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", requesterDiscordId)
    .maybeSingle();

  const requesterProfileId = String((requesterProf as any)?.id || "");
  if (!requesterProfileId) return { ok: false, error: "Requester profile not found" };

  const { data: gs } = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  const officerRoleId = String((gs as any)?.officer_role_id || "").trim();
  if (!officerRoleId) return { ok: false, error: "Officer role not configured" };

  const { data: link } = await supabaseAdmin
    .from("user_guild_roles")
    .select("role_id")
    .eq("guild_id", guildId)
    .eq("user_id", requesterProfileId)
    .eq("role_id", officerRoleId)
    .maybeSingle();

  if (!link) return { ok: false, error: "Forbidden" };
  return { ok: true as const };
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requesterDiscordId = pickDiscordUserId(session);
  if (!requesterDiscordId) {
    return NextResponse.json({ error: "Missing discord user id in session" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const guildId = String(body?.guildId || "").trim();
  const discordUserId = String(body?.discordUserId || "").trim();
  const roleId = String(body?.roleId || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!discordUserId || !isSnowflake(discordUserId)) {
    return NextResponse.json({ error: "Missing or invalid discordUserId" }, { status: 400 });
  }
  if (!roleId || !isSnowflake(roleId)) {
    return NextResponse.json({ error: "Missing or invalid roleId" }, { status: 400 });
  }

  const gate = await requireOfficer({ guildId, requesterDiscordId });
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: 403 });

  // Target profile
  const { data: targetProf } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  const targetUserId = String((targetProf as any)?.id || "");
  if (!targetUserId) {
    return NextResponse.json({ error: "Target profile not found" }, { status: 404 });
  }

  // Validate role exists in guild
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("role_id,is_managed")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (roleErr) return NextResponse.json({ error: "Failed to validate role" }, { status: 500 });
  if (!roleRow) return NextResponse.json({ error: "Role not found in guild" }, { status: 404 });
  if ((roleRow as any).is_managed) {
    return NextResponse.json({ error: "Managed roles cannot be selected" }, { status: 400 });
  }

  // Load meta to know combat vs logistics
  const { data: meta, error: metaErr } = await supabaseAdmin
    .from("guild_role_meta")
    .select("role_kind")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (metaErr) return NextResponse.json({ error: "Failed to read role metadata" }, { status: 500 });
  if (!meta) return NextResponse.json({ error: "Role not configured in hub" }, { status: 400 });

  const roleKind = String((meta as any).role_kind || "").trim();
  if (roleKind !== "combat" && roleKind !== "logistics") {
    return NextResponse.json({ error: "Invalid role kind config" }, { status: 500 });
  }

  // Replace selection for that kind
  const { error: delErr } = await supabaseAdmin
    .from("user_hub_roles")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", targetUserId)
    .eq("role_kind", roleKind);

  if (delErr) return NextResponse.json({ error: "Failed to replace existing selection" }, { status: 500 });

  const { error: insErr } = await supabaseAdmin
    .from("user_hub_roles")
    .insert({
      user_id: targetUserId,
      discord_user_id: discordUserId,
      guild_id: guildId,
      role_id: roleId,
      role_kind: roleKind,
      selected_at: new Date().toISOString(),
    });

  if (insErr) return NextResponse.json({ error: "Failed to save selection" }, { status: 500 });

  return NextResponse.json({ ok: true, guildId, discordUserId, roleId, roleKind }, { status: 200 });
}
