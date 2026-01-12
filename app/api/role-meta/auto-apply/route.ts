import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireWriteAccess } from "@/lib/requireWriteAccess";
import { findRolePreset } from "@/lib/rolePresets";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

/**
 * POST /api/role-meta/auto-apply
 * Body: { guildId: string, overwrite?: boolean }
 *
 * - Requires officer OR x-api-key
 * - Reads discord_guild_roles for guild
 * - Reads existing guild_role_meta for guild
 * - For roles missing meta (or overwrite=true), uses presets to upsert meta
 *
 * Returns: { ok, applied, skippedNoPreset, skippedHasMeta, totalRolesChecked }
 */

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

  const guildId = String(body?.guildId || "").trim();
  const overwrite = Boolean(body?.overwrite);

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  // 1) Load roles from Discord catalog
  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("role_id, name, is_managed, position")
    .eq("guild_id", guildId)
    .order("position", { ascending: false });

  if (rolesErr) {
    console.error("discord_guild_roles select failed:", rolesErr);
    return NextResponse.json({ error: "Failed to load discord roles" }, { status: 500 });
  }

  // 2) Load existing meta
  const { data: metaRows, error: metaErr } = await supabaseAdmin
    .from("guild_role_meta")
    .select("role_id")
    .eq("guild_id", guildId);

  if (metaErr) {
    console.error("guild_role_meta select failed:", metaErr);
    return NextResponse.json({ error: "Failed to load existing role metadata" }, { status: 500 });
  }

  const hasMeta = new Set((metaRows ?? []).map((m: any) => String(m.role_id)));

  let applied = 0;
  let skippedNoPreset = 0;
  let skippedHasMeta = 0;
  let totalRolesChecked = 0;

  const upserts: any[] = [];

  for (const r of roles ?? []) {
    const roleId = String(r.role_id || "");
    const name = String(r.name || "");
    const isManaged = Boolean(r.is_managed);

    if (!roleId) continue;

    // Skip @everyone (roleId equals guildId in Discord)
    if (roleId === guildId) continue;

    // Skip managed roles (bot roles, integrations, etc.)
    if (isManaged) continue;

    totalRolesChecked++;

    if (!overwrite && hasMeta.has(roleId)) {
      skippedHasMeta++;
      continue;
    }

    const preset = findRolePreset(name);
    if (!preset) {
      skippedNoPreset++;
      continue;
    }

    upserts.push({
      guild_id: guildId,
      role_id: roleId,
      role_kind: preset.roleKind,
      group_key: preset.groupKey,
      display_name: preset.displayName || null,
      description: preset.description || null,
      updated_at: new Date().toISOString(),
    });
  }

  if (upserts.length === 0) {
    return NextResponse.json(
      {
        ok: true,
        guildId,
        applied: 0,
        skippedNoPreset,
        skippedHasMeta,
        totalRolesChecked,
      },
      { status: 200 }
    );
  }

  const { error: upsertErr } = await supabaseAdmin
    .from("guild_role_meta")
    .upsert(upserts, { onConflict: "guild_id,role_id" });

  if (upsertErr) {
    console.error("guild_role_meta bulk upsert failed:", upsertErr);
    return NextResponse.json({ error: "Failed to auto-apply presets" }, { status: 500 });
  }

  applied = upserts.length;

  return NextResponse.json(
    {
      ok: true,
      guildId,
      applied,
      skippedNoPreset,
      skippedHasMeta,
      totalRolesChecked,
    },
    { status: 200 }
  );
}
