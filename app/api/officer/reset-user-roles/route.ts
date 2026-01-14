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
 * POST /api/officer/reset-user-roles
 * Body: { guildId: string, discordUserId: string }
 *
 * Deletes all hub role selections for the target user in this guild.
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

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!targetDiscordUserId || !isSnowflake(targetDiscordUserId)) {
    return NextResponse.json({ error: "Missing or invalid discordUserId" }, { status: 400 });
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

  const { error: delErr } = await supabaseAdmin
    .from("user_hub_roles")
    .delete()
    .eq("guild_id", guildId)
    .eq("user_id", targetUserId);

  if (delErr) {
    console.error("user_hub_roles delete failed:", delErr);
    return NextResponse.json({ error: "Failed to reset user hub roles" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, guildId, discordUserId: targetDiscordUserId, userId: targetUserId },
    { status: 200 }
  );
}
