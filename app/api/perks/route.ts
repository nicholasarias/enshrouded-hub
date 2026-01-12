import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireWriteAccess } from "@/lib/requireWriteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Perk catalog endpoint.
 *
 * - GET /api/perks            returns all perks (catalog)
 * - POST /api/perks           creates a perk (officer or api key)
 *
 * Supabase table expected: perks
 * Minimum columns:
 *   id uuid pk default gen_random_uuid()
 *   key text unique not null
 *   name text not null
 *   description text null
 *   icon text null
 *   created_at timestamptz default now()
 *   updated_at timestamptz default now()
 */

function sanitizeString(input: any, maxLen: number): string | null {
  if (input == null) return null;
  const s = typeof input === "string" ? input : String(input);
  const trimmed = s.trim().slice(0, maxLen);
  return trimmed.length ? trimmed : null;
}

function sanitizeKey(input: any): string | null {
  const raw = sanitizeString(input, 50);
  if (!raw) return null;

  // lowercase, letters/numbers/underscore only
  const key = raw.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
  if (!key) return null;

  // keep it from starting with a number
  if (!/^[a-z_]/.test(key)) return null;

  return key;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("perks")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("perks select failed:", error);
    return NextResponse.json({ error: "Failed to load perks" }, { status: 500 });
  }

  return NextResponse.json({ perks: data ?? [] }, { status: 200 });
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

  const key = sanitizeKey(body?.key);
  const name = sanitizeString(body?.name, 80);
  const description = sanitizeString(body?.description, 500);
  const icon = sanitizeString(body?.icon, 120);

  if (!key || !name) {
    return NextResponse.json({ error: "Missing or invalid key/name" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("perks")
    .insert({
      key,
      name,
      description: description || null,
      icon: icon || null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    console.error("perks insert failed:", error);
    // Likely unique constraint on key
    return NextResponse.json({ error: "Failed to create perk (duplicate key?)" }, { status: 500 });
  }

  return NextResponse.json({ perk: data }, { status: 201 });
}
