export const dynamic = "force-dynamic";
export const revalidate = 0;


import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId" }, { status: 400 });
  }

  // Get recent sessions for this guild
  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("sessions")
    .select("id")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (sessionsError) {
    console.error("Sessions lookup failed:", sessionsError);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) {
    return NextResponse.json({ counts: {} });
  }

  // Fetch RSVPs for those sessions
  const { data: rsvps, error: rsvpsError } = await supabaseAdmin
    .from("session_rsvps")
    .select("session_id,status")
    .in("session_id", sessionIds);

  if (rsvpsError) {
    console.error("RSVP lookup failed:", rsvpsError);
    return NextResponse.json({ error: "Failed to load rsvps" }, { status: 500 });
  }

  // Aggregate counts per session
  const counts: Record<string, { in: number; maybe: number; out: number }> = {};

  for (const id of sessionIds) {
    counts[id] = { in: 0, maybe: 0, out: 0 };
  }

  for (const r of rsvps ?? []) {
    const sid = String((r as any).session_id);
    const status = String((r as any).status);
    if (!counts[sid]) counts[sid] = { in: 0, maybe: 0, out: 0 };
    if (status === "in") counts[sid].in += 1;
    if (status === "maybe") counts[sid].maybe += 1;
    if (status === "out") counts[sid].out += 1;
  }

  return NextResponse.json({ counts });
}
