import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireOfficer } from "@/lib/requireOfficer";
import { buildSessionEmbedPayload, type BadgeParts } from "@/lib/discordSessionEmbed";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_TITLE = 80;
const MAX_NOTES = 2000;

function asInt(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeText(v: any, max: number) {
  return String(v ?? "").trim().slice(0, max);
}

function pickGuildId(body: any) {
  const fromBody = safeText(body?.guildId, 64);
  if (fromBody) return fromBody;

  const fromEnv = safeText(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID, 64);
  if (fromEnv) return fromEnv;

  return "";
}

async function postChannelMessageAsBot(params: { channelId: string; payload: any }) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN missing");

  const res = await fetch(`https://discord.com/api/v10/channels/${params.channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });

  const txt = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Discord post failed: ${res.status} ${txt}`);

  let json: any = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = null;
  }

  const id = String(json?.id || "").trim();
  if (!id) throw new Error("Discord did not return a message id.");

  return { id };
}

export async function POST(req: Request) {
  const officer = await requireOfficer(req);
  if (!officer.ok) {
    return NextResponse.json({ error: officer.error || "Unauthorized" }, { status: officer.status || 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const guildId = pickGuildId(body);
  const title = safeText(body?.title, MAX_TITLE);
  const startLocal = safeText(body?.startLocal, 64);
  const durationMinutes = asInt(body?.durationMinutes, 0);
  const notes = safeText(body?.notes, MAX_NOTES);

  if (!guildId) return NextResponse.json({ error: "Missing guildId (body.guildId or NEXT_PUBLIC_DISCORD_GUILD_ID)" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "Missing title" }, { status: 400 });
  if (!startLocal) return NextResponse.json({ error: "Missing startLocal" }, { status: 400 });

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return NextResponse.json({ error: "durationMinutes must be > 0" }, { status: 400 });
  }

  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) {
    return NextResponse.json({ error: "startLocal must be a valid date string" }, { status: 400 });
  }

  // 1) Insert session
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("sessions")
    .insert({
      guild_id: guildId,
      title,
      start_local: startLocal,
      duration_minutes: durationMinutes,
      notes,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("sessions create failed:", insErr);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }

  const sessionId = String((inserted as any)?.id || "").trim();

  // 2) Find configured Discord channel
  const { data: serverRow, error: serverErr } = await supabaseAdmin
    .from("discord_servers")
    .select("channel_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (serverErr || !serverRow?.channel_id) {
    return NextResponse.json({
      ok: true,
      id: sessionId,
      guildId,
      posted: false,
      warning: "No Discord channel configured. Run /setup in Discord.",
    });
  }

  const channelId = String((serverRow as any).channel_id || "").trim();
  if (!channelId) {
    return NextResponse.json({
      ok: true,
      id: sessionId,
      guildId,
      posted: false,
      warning: "No Discord channel configured. Run /setup in Discord.",
    });
  }

  // 3) Post rich embed and save message ids
  try {
    const badgeParts = new Map<string, BadgeParts>();

    const payload = buildSessionEmbedPayload({
      sessionId,
      title,
      startLocal,
      durationMinutes,
      notes,
      guildId,
      inUsers: [],
      maybeUsers: [],
      outUsers: [],
      badgeParts,
    });

    const msg = await postChannelMessageAsBot({ channelId, payload });

    const { error: updErr } = await supabaseAdmin
      .from("sessions")
      .update({
        discord_channel_id: channelId,
        discord_message_id: String(msg.id),
      })
      .eq("id", sessionId);

    if (updErr) console.error("Failed to save discord ids to sessions:", updErr);

    return NextResponse.json({ ok: true, id: sessionId, guildId, posted: true });
  } catch (e) {
    console.error("Discord post failed:", e);

    return NextResponse.json({
      ok: true,
      id: sessionId,
      guildId,
      posted: false,
      warning: "Session created but failed to post to Discord. Check server logs.",
    });
  }
}
