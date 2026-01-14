import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOfficer } from "@/lib/requireOfficer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function cleanStr(v: any, max = 500) {
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

  const { error: rsvpErr } = await supabaseAdmin
    .from("session_rsvps")
    .delete()
    .eq("session_id", sessionId);

  if (rsvpErr) {
    console.error("delete rsvps failed:", rsvpErr);
    return NextResponse.json({ error: "Failed to delete RSVPs" }, { status: 500 });
  }

  const { error: sessErr } = await supabaseAdmin
    .from("sessions")
    .delete()
    .eq("id", sessionId);

  if (sessErr) {
    console.error("delete session failed:", sessErr);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
