import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireWriteAccess } from "@/lib/requireWriteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * This route is the server-side "database door" for gear.
 *
 * - GET: anyone can read gear (you can change later if you want)
 * - POST: only officers (or automation with x-api-key) can create gear
 *
 * Supabase table expected: gear_items
 * Minimum columns:
 *   id uuid pk default gen_random_uuid()
 *   guild_id text
 *   name text
 *   slot text
 *   rarity text nullable
 *   notes text nullable
 *   created_at timestamptz default now()
 *   updated_at timestamptz default now()
 */

function validateGuildId(input: any): string | null {
  const s = String(input || "").trim();
  if (!/^\d{10,25}$/.test(s)) return null;
  return s;
}

function sanitizeString(input: any, maxLen: number): string {
  const s = typeof input === "string" ? input : input == null ? "" : String(input);
  return s.trim().slice(0, maxLen);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId query param" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("gear_items")
    .select("*")
    .eq("guild_id", guildId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("gear_items select failed:", error);
    return NextResponse.json({ error: "Failed to load gear" }, { status: 500 });
  }

  return NextResponse.json({ gear: data ?? [] });
}

export async function POST(req: Request) {
  // Write gate: valid API key OR logged-in officer
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

  const guildId = validateGuildId(body?.guildId);
  if (!guildId) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  const name = sanitizeString(body?.name, 120);
  const slot = sanitizeString(body?.slot, 40);
  const rarity = sanitizeString(body?.rarity, 40);
  const notes = sanitizeString(body?.notes, 1500);

  if (!name || !slot) {
    return NextResponse.json({ error: "Missing name or slot" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("gear_items")
    .insert({
      guild_id: guildId,
      name,
      slot,
      rarity: rarity || null,
      notes: notes || null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("gear_items insert failed:", error);
    return NextResponse.json({ error: "Failed to create gear item" }, { status: 500 });
  }

  return NextResponse.json({ gear: data }, { status: 201 });
}
