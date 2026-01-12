import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireWriteAccess } from "@/lib/requireWriteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Role -> Perks mapping (per guild).
 *
 * GET  /api/role-perks?guildId=...&roleId=...   returns perks for a role
 * POST /api/role-perks                          replaces perks for a role (officer or api key)
 *
 * Supabase table: role_perks
 * Unique constraint: (guild_id, role_id, perk_id)
 */

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "");
  const roleId = String(url.searchParams.get("roleId") || "");

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!roleId || !isSnowflake(roleId)) {
    return NextResponse.json({ error: "Missing or invalid roleId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("role_perks")
    .select("perk_id, perks:perk_id ( id, key, name, description, icon )")
    .eq("guild_id", guildId)
    .eq("role_id", roleId);

  if (error) {
    console.error("role_perks select failed:", error);
    return NextResponse.json({ error: "Failed to load role perks" }, { status: 500 });
  }

  const perks = (data ?? []).map((row: any) => row.perks).filter(Boolean);

  return NextResponse.json({ guildId, roleId, perks }, { status: 200 });
}

export async function POST(req: Request) {
  const gate = await requireWriteAccess(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const guildId = String(body?.guildId || "");
  const roleId = String(body?.roleId || "");

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!roleId || !isSnowflake(roleId)) {
    return NextResponse.json({ error: "Missing or invalid roleId" }, { status: 400 });
  }

  // Allow empty array so you can clear perks from a role
  if (!Array.isArray(body?.perkKeys)) {
    return NextResponse.json({ error: "perkKeys must be an array" }, { status: 400 });
  }

  const cleanedKeys = (body.perkKeys as any[])
    .map((k) => String(k || "").trim().toLowerCase())
    .filter(Boolean);

  // Replace mapping always starts with deleting existing rows
  const { error: delErr } = await supabaseAdmin
    .from("role_perks")
    .delete()
    .eq("guild_id", guildId)
    .eq("role_id", roleId);

  if (delErr) {
    console.error("role_perks delete failed:", delErr);
    return NextResponse.json({ error: "Failed to clear existing role perks" }, { status: 500 });
  }

  // If empty, we're done (role has no perks now)
  if (cleanedKeys.length === 0) {
    return NextResponse.json({ ok: true, guildId, roleId, perkCount: 0 }, { status: 200 });
  }

  // Resolve perk ids by key
  const { data: perks, error: perksErr } = await supabaseAdmin
    .from("perks")
    .select("id,key")
    .in("key", cleanedKeys);

  if (perksErr) {
    console.error("perks lookup failed:", perksErr);
    return NextResponse.json({ error: "Failed to resolve perks" }, { status: 500 });
  }

  const perkIds = (perks ?? []).map((p: any) => p.id);
  if (perkIds.length === 0) {
    return NextResponse.json({ error: "No perks found for provided keys" }, { status: 400 });
  }

  const rows = perkIds.map((perkId: string) => ({
    guild_id: guildId,
    role_id: roleId,
    perk_id: perkId,
  }));

  const { error: insErr } = await supabaseAdmin.from("role_perks").insert(rows);

  if (insErr) {
    console.error("role_perks insert failed:", insErr);
    return NextResponse.json({ error: "Failed to save role perks" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, guildId, roleId, perkCount: perkIds.length },
    { status: 200 }
  );
}
