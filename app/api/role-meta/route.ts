import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireWriteAccess } from "@/lib/requireWriteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Role metadata for hub grouping.
 *
 * Stores your "combat vs logistics" and "primary stat group" info per Discord role.
 *
 * GET  /api/role-meta?guildId=...               -> returns all role metadata rows for guild
 * POST /api/role-meta                           -> upserts metadata for one role (officer or api key)
 *
 * Supabase table expected: guild_role_meta
 * Columns:
 *   guild_id text not null
 *   role_id text not null
 *   role_kind text not null          -- "combat" | "logistics"
 *   group_key text not null          -- "strength" | "intelligence" | "dexterity" | "logistics"
 *   display_name text null           -- optional override label shown in hub
 *   description text null            -- optional
 *   updated_at timestamptz not null default now()
 *
 * Unique: (guild_id, role_id)
 */

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

function cleanText(input: any, maxLen: number): string | null {
  if (input == null) return null;
  const s = typeof input === "string" ? input : String(input);
  const t = s.trim().slice(0, maxLen);
  return t.length ? t : null;
}

function cleanEnum(input: any): string {
  return String(input || "").trim().toLowerCase();
}

const ROLE_KINDS = new Set(["combat", "logistics"]);
const GROUP_KEYS = new Set(["strength", "intelligence", "dexterity", "logistics"]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "");

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("guild_role_meta")
    .select("*")
    .eq("guild_id", guildId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("guild_role_meta select failed:", error);
    return NextResponse.json({ error: "Failed to load role metadata" }, { status: 500 });
  }

  return NextResponse.json({ guildId, roles: data ?? [] }, { status: 200 });
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

  const roleKind = cleanEnum(body?.roleKind);
  const groupKey = cleanEnum(body?.groupKey);

  if (!ROLE_KINDS.has(roleKind)) {
    return NextResponse.json({ error: "roleKind must be combat or logistics" }, { status: 400 });
  }

  if (!GROUP_KEYS.has(groupKey)) {
    return NextResponse.json({
      error: "groupKey must be strength, intelligence, dexterity, or logistics",
    }, { status: 400 });
  }

  const displayName = cleanText(body?.displayName, 80);
  const description = cleanText(body?.description, 300);

  const row = {
    guild_id: guildId,
    role_id: roleId,
    role_kind: roleKind,
    group_key: groupKey,
    display_name: displayName,
    description,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("guild_role_meta")
    .upsert(row, { onConflict: "guild_id,role_id" })
    .select("*")
    .single();

  if (error) {
    console.error("guild_role_meta upsert failed:", error);
    return NextResponse.json({ error: "Failed to save role metadata" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, role: data }, { status: 200 });
}
