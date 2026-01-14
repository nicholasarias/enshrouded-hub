import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUpcoming(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return true;
  return ms >= Date.now() - 60 * 60 * 1000; // keep 1 hour past
}

type Counts = { in: number; maybe: number; out: number };

function normalizeStatus(input: any): "in" | "maybe" | "out" | null {
  const s = String(input || "").toLowerCase().trim();
  if (s === "in" || s === "maybe" || s === "out") return s;
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId" }, { status: 400 });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "id,title,start_local,duration_minutes,notes,guild_id,discord_channel_id,discord_message_id,created_at"
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("sessions list failed:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  const sessions = (data ?? []).map((s: any) => ({
    id: String(s.id),
    title: String(s.title ?? ""),
    startLocal: String(s.start_local ?? ""),
    durationMinutes: Number(s.duration_minutes ?? 0),
    notes: String(s.notes ?? ""),
    guildId: String(s.guild_id ?? ""),
    discordChannelId: s.discord_channel_id ? String(s.discord_channel_id) : null,
    discordMessageId: s.discord_message_id ? String(s.discord_message_id) : null,
    createdAt: String(s.created_at ?? ""),
    upcoming: isUpcoming(String(s.start_local ?? "")),
  }));

  // RSVP counts in one pass
  const ids = sessions.map((s) => s.id).filter(Boolean);
  const countsBySession = new Map<string, Counts>();

  for (const id of ids) countsBySession.set(id, { in: 0, maybe: 0, out: 0 });

  if (ids.length) {
    const { data: rsvps, error: rsvpErr } = await supabaseAdmin
      .from("session_rsvps")
      .select("session_id,status")
      .in("session_id", ids);

    if (rsvpErr) {
      console.error("rsvp counts failed:", rsvpErr);
    } else {
      for (const row of rsvps ?? []) {
        const sid = String((row as any)?.session_id || "");
        const status = normalizeStatus((row as any)?.status);

        const cur = countsBySession.get(sid);
        if (!cur || !status) continue;

        if (status === "in") cur.in += 1;
        else if (status === "maybe") cur.maybe += 1;
        else if (status === "out") cur.out += 1;

        countsBySession.set(sid, cur);
      }
    }
  }

  const sessionsWithCounts = sessions.map((s) => ({
    ...s,
    counts: countsBySession.get(s.id) || { in: 0, maybe: 0, out: 0 },
  }));

  return NextResponse.json({ sessions: sessionsWithCounts });
}
