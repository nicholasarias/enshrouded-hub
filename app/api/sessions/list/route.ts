import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUpcoming(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return true;
  return ms >= Date.now() - 60 * 60 * 1000; // keep 1 hour past
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

  return NextResponse.json({ sessions });
}
