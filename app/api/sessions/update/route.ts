import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOfficer } from "@/lib/requireOfficer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanStr(v: any, max = 5000) {
  return String(v ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  const officer = await requireOfficer(req);
  if (!officer.ok) {
    return NextResponse.json(
      { error: officer.error || "Unauthorized" },
      { status: officer.status || 401 }
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sessionId = cleanStr(body?.sessionId, 200);
  if (!sessionId || sessionId === "undefined" || sessionId === "null") {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  const patch: any = {};

  if (body?.title !== undefined) patch.title = cleanStr(body.title, 140);
  if (body?.startLocal !== undefined) patch.start_local = cleanStr(body.startLocal, 80);
  if (body?.durationMinutes !== undefined) patch.duration_minutes = Number(body.durationMinutes) || 0;
  if (body?.notes !== undefined) patch.notes = cleanStr(body.notes, 5000);

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("sessions")
    .update(patch)
    .eq("id", sessionId);

  if (error) {
    console.error("session update failed:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
