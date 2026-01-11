export const dynamic = "force-dynamic";
export const revalidate = 0;


import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Session = {
  id: string;
  title: string;
  startLocal: string;
  durationMinutes: number;
  notes: string;
  createdAt: string;
};

// ===== Rate limiting (in-memory) =====
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 creates per minute per IP
const rateMap = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: Request) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(req: Request) {
  const ip = getClientIp(req);
  const now = Date.now();

  const entry = rateMap.get(ip);
  if (!entry) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  rateMap.set(ip, entry);

  return entry.count > RATE_LIMIT_MAX;
}

// ===== Validation helpers =====
function sanitizeString(value: unknown, maxLen: number) {
  const s = String(value ?? "").trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function parsePositiveInt(value: unknown, fallback: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

function validateGuildId(guildId: unknown) {
  const s = String(guildId ?? "");
  return /^\d{15,25}$/.test(s) ? s : "";
}

// ===== Supabase helpers =====
async function getChannelIdForGuild(guildId: string) {
  const { data, error } = await supabaseAdmin
    .from("discord_servers")
    .select("channel_id")
    .eq("guild_id", guildId)
    .single();

  if (error) throw new Error(`Supabase lookup failed: ${error.message}`);
  if (!data?.channel_id) throw new Error("No channel saved for this server. Run /setup first.");

  return data.channel_id as string;
}
function toUnixSeconds(dateIsoOrText: string) {
  const ms = Date.parse(dateIsoOrText);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function discordTimeTag(unix: number, style: "F" | "R") {
  return `<t:${unix}:${style}>`;
}


export async function POST(req: Request) {
  // 1) API key check (lockdown)
  const key = req.headers.get("x-api-key");
  if (!process.env.SESSIONS_API_KEY || key !== process.env.SESSIONS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2) Rate limit
  if (isRateLimited(req)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  try {
    // 3) Parse + validate input
    const body = (await req.json()) as any;

    const guildId = validateGuildId(body?.guildId);
    if (!guildId) {
      return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
    }

    const title = sanitizeString(body?.title, 120);
    const startLocal = sanitizeString(body?.startLocal, 40);
    const notes = sanitizeString(body?.notes, 1500);
    const durationMinutes = parsePositiveInt(body?.durationMinutes, 60, 24 * 60);

    if (!title || !startLocal || !durationMinutes) {
      return NextResponse.json(
        { error: "Missing title, startLocal, or durationMinutes" },
        { status: 400 }
      );
    }

    // 4) Resolve Discord channel from Supabase mapping
    let channelId: string;
    try {
      channelId = await getChannelIdForGuild(guildId);
    } catch (e: any) {
      return NextResponse.json(
        { error: e?.message || "Failed to find Discord channel for this server." },
        { status: 400 }
      );
    }

    // 5) Build session
    const session: Session = {
      id: crypto.randomUUID(),
      title,
      startLocal,
      durationMinutes,
      notes,
      createdAt: new Date().toISOString(),
    };

    // 6) Insert into Supabase
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("sessions")
      .insert({
        id: session.id,
        guild_id: guildId,
        title: session.title,
        start_local: session.startLocal,
        duration_minutes: session.durationMinutes,
        notes: session.notes ?? "",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Supabase insert failed:", insertError);
      return NextResponse.json({ error: "Failed to save session" }, { status: 500 });
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;

if (botToken) {
  try {
    const discordRes = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title: `New Session: ${session.title}`,
              color: 0x2dd4bf,
              description: session.notes || "No notes.",
              timestamp: new Date().toISOString(),
              fields: [
  {
    name: "🕒 When",
    value: (() => {
      const unix = toUnixSeconds(session.startLocal);
      return unix
        ? `${discordTimeTag(unix, "F")} (${discordTimeTag(unix, "R")})`
        : session.startLocal;
    })(),
    inline: false,
  },
  {
    name: "⏱ Duration",
    value: `${session.durationMinutes} minutes`,
    inline: true,
  },
  {
    name: "📊 RSVPs",
    value: "**In:** 0  |  **Maybe:** 0  |  **Out:** 0",
    inline: false,
  },
],

              footer: { text: "Click a button to RSVP" },
            },
          ],
          components: [
            {
              type: 1,
              components: [
                { type: 2, style: 3, label: "In (0)", custom_id: `rsvp:${session.id}:in` },
                { type: 2, style: 1, label: "Maybe (0)", custom_id: `rsvp:${session.id}:maybe` },
                { type: 2, style: 4, label: "Out (0)", custom_id: `rsvp:${session.id}:out` },
              ],
            },
          ],
        }),
      }
    );

    if (!discordRes.ok) {
      const text = await discordRes.text();

      await supabaseAdmin
        .from("sessions")
        .update({
          discord_post_status: "failed",
          discord_post_error: `HTTP ${discordRes.status}: ${text}`,
        })
        .eq("id", session.id);

      console.error("Discord post failed:", discordRes.status, text);
    } else {
      const message = await discordRes.json();

      await supabaseAdmin
        .from("sessions")
        .update({
          discord_channel_id: channelId,
          discord_message_id: message.id,
          discord_post_status: "posted",
          discord_post_error: null,
        })
        .eq("id", session.id);
    }
  } catch (e: any) {
    await supabaseAdmin
      .from("sessions")
      .update({
        discord_post_status: "failed",
        discord_post_error: e?.message || "Unknown error",
      })
      .eq("id", session.id);

    console.error("Discord post exception:", e);
  }
}

    return NextResponse.json({ session: inserted }, { status: 201 });
  } catch (err) {
    console.error("Create session failed:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "");

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId query param" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select("*")
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Supabase select failed:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}
