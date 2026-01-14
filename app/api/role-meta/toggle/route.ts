// web/app/api/role-meta/toggle/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOfficer } from "@/lib/requireOfficer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

function normKind(v: string) {
  const s = String(v || "").trim().toLowerCase();
  if (s === "combat" || s === "logistics") return s;
  return null;
}

export async function POST(req: Request) {
  // Officer gate (server authoritative)
  const gate = await requireOfficer(req);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const guildId = String(body?.guildId || "").trim();
  const roleId = String(body?.roleId || "").trim();
  const enabled = !!body?.enabled;

  const roleKind = body?.roleKind != null ? normKind(body.roleKind) : null;
  const roleGroup = body?.roleGroup != null ? String(body.roleGroup || "").trim() : null;

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!roleId || !isSnowflake(roleId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid roleId" }, { status: 400 });
  }

  // Make sure this role exists in our cached Discord roles table (prevents typos)
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("discord_guild_roles")
    .select("role_id,name,is_managed")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (roleErr) {
    console.error("discord_guild_roles lookup failed:", roleErr);
    return NextResponse.json({ ok: false, error: "Failed to validate role" }, { status: 500 });
  }
  if (!roleRow) {
    return NextResponse.json({ ok: false, error: "Role not found for this guild. Run Sync Roles first." }, { status: 404 });
  }
  if ((roleRow as any).is_managed) {
    return NextResponse.json({ ok: false, error: "Managed roles cannot be selected (bot/integration roles)." }, { status: 400 });
  }

  // Upsert catalog row.
  // If caller didn't send roleKind/roleGroup, keep existing values if present; otherwise default to logistics/general.
  const { data: existing, error: exErr } = await supabaseAdmin
    .from("guild_hub_role_catalog")
    .select("role_kind, role_group, enabled")
    .eq("guild_id", guildId)
    .eq("role_id", roleId)
    .maybeSingle();

  if (exErr) {
    console.error("guild_hub_role_catalog lookup failed:", exErr);
    return NextResponse.json({ ok: false, error: "Failed to read catalog" }, { status: 500 });
  }

  const finalKind = roleKind || (existing as any)?.role_kind || "logistics";
  const finalGroup = roleGroup || (existing as any)?.role_group || "general";

  if (!normKind(finalKind)) {
    return NextResponse.json({ ok: false, error: "roleKind must be 'combat' or 'logistics'" }, { status: 400 });
  }
  if (!finalGroup) {
    return NextResponse.json({ ok: false, error: "roleGroup missing" }, { status: 400 });
  }

  const { data: up, error: upErr } = await supabaseAdmin
    .from("guild_hub_role_catalog")
    .upsert(
      {
        guild_id: guildId,
        role_id: roleId,
        role_name: (roleRow as any).name,
        role_kind: finalKind,
        role_group: finalGroup,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "guild_id,role_id" }
    )
    .select("*")
    .single();

  if (upErr) {
    console.error("guild_hub_role_catalog upsert failed:", upErr);
    return NextResponse.json({ ok: false, error: "Failed to update catalog" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, row: up }, { status: 200 });
}
