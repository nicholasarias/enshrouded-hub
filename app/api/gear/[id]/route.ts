import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireWriteAccess } from "@/lib/requireWriteAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Single gear item endpoint:
 * - PUT /api/gear/:id    updates a gear item (officer or api key)
 * - DELETE /api/gear/:id deletes a gear item (officer or api key)
 *
 * Supabase table expected: gear_items (see /api/gear route.ts comment)
 */

function isUuid(input: any): boolean {
  const s = String(input || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function sanitizeString(input: any, maxLen: number): string | null {
  if (input == null) return null;
  const s = typeof input === "string" ? input : String(input);
  const trimmed = s.trim().slice(0, maxLen);
  return trimmed.length ? trimmed : null;
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Write gate: valid API key OR logged-in officer
  const gate = await requireWriteAccess(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const idStr = String(id || "");

  if (!isUuid(idStr)) {
    return NextResponse.json({ error: "Invalid gear id" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Only allow updating known fields
  const name = sanitizeString(body?.name, 120);
  const slot = sanitizeString(body?.slot, 40);
  const rarity = sanitizeString(body?.rarity, 40);
  const notes = sanitizeString(body?.notes, 1500);

  const update: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== null) update.name = name;
  if (slot !== null) update.slot = slot;
  if (rarity !== null) update.rarity = rarity;
  if (notes !== null) update.notes = notes;

  // Nothing to update
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("gear_items")
    .update(update)
    .eq("id", idStr)
    .select("*")
    .single();

  if (error) {
    console.error("gear_items update failed:", error);
    return NextResponse.json({ error: "Failed to update gear item" }, { status: 500 });
  }

  return NextResponse.json({ gear: data }, { status: 200 });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Write gate: valid API key OR logged-in officer
  const gate = await requireWriteAccess(req);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { id } = await ctx.params;
  const idStr = String(id || "");

  if (!isUuid(idStr)) {
    return NextResponse.json({ error: "Invalid gear id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("gear_items").delete().eq("id", idStr);

  if (error) {
    console.error("gear_items delete failed:", error);
    return NextResponse.json({ error: "Failed to delete gear item" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
