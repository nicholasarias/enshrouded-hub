import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  // 1) Roles catalog (synced from Discord)
  const { data: roles, error: rolesErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("guild_id, role_id, name, color_int, position, is_managed, updated_at")
    .eq("guild_id", guildId)
    .order("position", { ascending: false });

  if (rolesErr) {
    console.error("discord_guild_roles select failed:", rolesErr);
    return NextResponse.json({ error: "Failed to load discord roles" }, { status: 500 });
  }

  // 2) Hub role metadata (your grouping info)
  const { data: metaRows, error: metaErr } = await supabaseAdmin
    .from("guild_role_meta")
    .select("guild_id, role_id, role_kind, group_key, display_name, description, updated_at")
    .eq("guild_id", guildId);

  if (metaErr) {
    console.error("guild_role_meta select failed:", metaErr);
    return NextResponse.json({ error: "Failed to load role metadata" }, { status: 500 });
  }

  // 3) Role -> perk mapping (join-ish via separate query)
  const { data: rolePerkRows, error: rpErr } = await supabaseAdmin
    .from("role_perks")
    .select("role_id, perk_id")
    .eq("guild_id", guildId);

  if (rpErr) {
    console.error("role_perks select failed:", rpErr);
    return NextResponse.json({ error: "Failed to load role perks mapping" }, { status: 500 });
  }

  const perkIds = Array.from(new Set((rolePerkRows ?? []).map((r: any) => r.perk_id))).filter(
    Boolean
  );

  let perksById = new Map<string, any>();
  if (perkIds.length > 0) {
    const { data: perks, error: perksErr } = await supabaseAdmin
      .from("perks")
      .select("id, key, name, description, icon, updated_at")
      .in("id", perkIds);

    if (perksErr) {
      console.error("perks select failed:", perksErr);
      return NextResponse.json({ error: "Failed to load perks" }, { status: 500 });
    }

    perksById = new Map((perks ?? []).map((p: any) => [p.id, p]));
  }

  // Index meta by role_id
  const metaByRoleId = new Map<string, any>();
  for (const m of metaRows ?? []) {
    metaByRoleId.set(m.role_id, m);
  }

  // Index perks by role_id
  const perkIdsByRoleId = new Map<string, string[]>();
  for (const row of rolePerkRows ?? []) {
    const rid = String(row.role_id || "");
    const pid = String(row.perk_id || "");
    if (!rid || !pid) continue;
    const arr = perkIdsByRoleId.get(rid) || [];
    arr.push(pid);
    perkIdsByRoleId.set(rid, arr);
  }

  // Shape final roles payload
  const out = (roles ?? []).map((r: any) => {
    const roleId = String(r.role_id);
    const meta = metaByRoleId.get(roleId) || null;

    const pids = perkIdsByRoleId.get(roleId) || [];
    const rolePerks = pids.map((id) => perksById.get(id)).filter(Boolean);

    return {
      guildId: r.guild_id,
      roleId,
      name: r.name,
      colorInt: r.color_int,
      position: r.position,
      isManaged: r.is_managed,
      updatedAt: r.updated_at,

      meta, // { role_kind, group_key, display_name, description, ... } or null
      perks: rolePerks, // [{ id, key, name, description, icon, ... }]
    };
  });

  return NextResponse.json({ guildId, roles: out }, { status: 200 });
}
