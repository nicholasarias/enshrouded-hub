// app/api/discord/route.ts

import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import type { BadgeParts } from "@/lib/discordSessionEmbed";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

// =======================================================
// Lazy loaders (reduce cold start so Discord ACK is fast)
// =======================================================
let _supabaseAdmin: any = null;
async function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;
  const mod = await import("@/lib/supabaseAdmin");
  _supabaseAdmin = mod.supabaseAdmin;
  return _supabaseAdmin;
}

let _luxon: any = null;
async function getLuxon() {
  if (_luxon) return _luxon;
  _luxon = await import("luxon");
  return _luxon;
}

let _embedMod: any = null;
async function getEmbedBuilder() {
  if (_embedMod) return _embedMod;
  _embedMod = await import("@/lib/discordSessionEmbed");
  return _embedMod;
}

// =======================================================
// Discord request verification
// =======================================================
function verifyDiscordRequest(req: Request, body: string, signature: string, timestamp: string) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

// =======================================================
// Permission helpers (Discord built-in permissions)
// Works without BigInt / ES2020
// =======================================================
const PERM_ADMINISTRATOR = 8; // 0x8
const PERM_MANAGE_GUILD = 32; // 0x20

function hasManagePerms(body: any) {
  const permStr = body?.member?.permissions;
  if (!permStr) return false;

  const perms = Number(permStr);
  if (!Number.isFinite(perms)) return false;

  return (perms & PERM_ADMINISTRATOR) !== 0 || (perms & PERM_MANAGE_GUILD) !== 0;
}

// =======================================================
// Small utils
// =======================================================
function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function cleanBaseUrl(url: string) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getPublicBaseUrl() {
  const explicit =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "";

  const base = cleanBaseUrl(explicit);
  return base || "http://localhost:3000";
}

function hubLink(path: string, guildId: string) {
  const base = getPublicBaseUrl();
  const qs = guildId ? `?guildId=${encodeURIComponent(guildId)}` : "";
  return `${base}${path}${qs}`;
}

function optionValue(body: any, name: string) {
  const opt = body?.data?.options?.find((o: any) => o.name === name);
  return opt?.value;
}

// =======================================================
// Icons + helpers
// =======================================================
function normalizeGroupKey(groupKey: string) {
  let g = String(groupKey || "").toLowerCase().trim();
  if (g.startsWith("logistics_")) g = g.slice("logistics_".length);
  return g;
}

function groupIcon(groupKey: string) {
  const g = normalizeGroupKey(groupKey);

  // Combat
  if (g === "strength") return "🛡";
  if (g === "intelligence") return "🧙";
  if (g === "dexterity") return "🏹";

  // Logistics
  if (g === "architect") return "🏗️";
  if (g === "agronomist") return "🌾";
  if (g === "quartermaster") return "📦";
  if (g === "provisioner") return "🍲";
  if (g === "excavator") return "⛏️";

  if (g === "logistics") return "🧰";
  return "❔";
}

const CHI_ZONE = "America/Chicago";

async function parseWhenToChicagoIso(inputRaw: string) {
  const { DateTime } = await getLuxon();

  const input = String(inputRaw || "").trim();
  if (!input) return { ok: false as const, error: "Missing when." };

  const now = DateTime.now().setZone(CHI_ZONE);

  // 1) ISO
  let dt = DateTime.fromISO(input, { setZone: true });
  if (dt.isValid) {
    dt = dt.setZone(CHI_ZONE);
    return { ok: true as const, iso: dt.toISO()! };
  }

  const s = input.toLowerCase().replace(/\s+/g, " ").trim();

  const parseTimeOnly = (timeStr: string) => {
    const cleaned = timeStr.replace(/\s/g, "");
    const m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
    if (!m) return null;

    let h = Number(m[1]);
    const min = Number(m[2] || "0");
    const ap = m[3] || null;

    if (min < 0 || min > 59) return null;

    if (ap) {
      if (h < 1 || h > 12) return null;
      if (ap === "am") h = h === 12 ? 0 : h;
      if (ap === "pm") h = h === 12 ? 12 : h + 12;
    } else {
      if (h < 0 || h > 23) return null;
    }

    return { hour: h, minute: min };
  };

  const applyTime = (base: any, t: { hour: number; minute: number }) =>
    base.set({ hour: t.hour, minute: t.minute, second: 0, millisecond: 0 });

  // 2) today/tomorrow
  {
    const m = s.match(/^(today|tomorrow)\s+(.+)$/);
    if (m) {
      const dayWord = m[1];
      const time = parseTimeOnly(m[2]);
      if (!time) return { ok: false as const, error: `Could not parse time: "${m[2]}"` };

      const base = dayWord === "tomorrow" ? now.plus({ days: 1 }) : now;
      const out = applyTime(base, time);
      return { ok: true as const, iso: out.toISO()! };
    }
  }

  // 3) weekday
  {
    const m = s.match(
      /^(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(.+)$/
    );
    if (m) {
      const dayStr = m[1];
      const time = parseTimeOnly(m[2]);
      if (!time) return { ok: false as const, error: `Could not parse time: "${m[2]}"` };

      const map: Record<string, number> = {
        sun: 7,
        sunday: 7,
        mon: 1,
        monday: 1,
        tue: 2,
        tues: 2,
        tuesday: 2,
        wed: 3,
        wednesday: 3,
        thu: 4,
        thur: 4,
        thurs: 4,
        thursday: 4,
        fri: 5,
        friday: 5,
        sat: 6,
        saturday: 6,
      };

      const target = map[dayStr] || 0;
      if (!target) return { ok: false as const, error: `Could not parse day: "${dayStr}"` };

      let base = now;
      const daysAhead = (target - base.weekday + 7) % 7;
      base = daysAhead === 0 ? base : base.plus({ days: daysAhead });

      let out = applyTime(base, time);
      if (daysAhead === 0 && out <= now) out = out.plus({ days: 7 });

      return { ok: true as const, iso: out.toISO()! };
    }
  }

  // 4) M/D time
  {
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
    if (m) {
      const month = Number(m[1]);
      const day = Number(m[2]);
      const time = parseTimeOnly(m[3]);
      if (!time) return { ok: false as const, error: `Could not parse time: "${m[3]}"` };

      const year = now.year;
      let base = DateTime.fromObject({ year, month, day, hour: 0, minute: 0 }, { zone: CHI_ZONE });
      if (!base.isValid) return { ok: false as const, error: `Invalid date: "${m[1]}/${m[2]}"` };

      let out = applyTime(base, time);

      if (out < now.minus({ minutes: 1 })) {
        base = base.plus({ years: 1 });
        out = applyTime(base, time);
      }

      return { ok: true as const, iso: out.toISO()! };
    }
  }

  // 5) YYYY-MM-DD time
  {
    const m = s.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (m) {
      const dateStr = m[1];
      const time = parseTimeOnly(m[2]);
      if (!time) return { ok: false as const, error: `Could not parse time: "${m[2]}"` };

      const base = DateTime.fromISO(dateStr, { zone: CHI_ZONE });
      if (!base.isValid) return { ok: false as const, error: `Invalid date: "${dateStr}"` };

      const out = applyTime(base, time);
      return { ok: true as const, iso: out.toISO()! };
    }
  }

  // 6) Time only
  {
    const time = parseTimeOnly(s);
    if (time) {
      let out = applyTime(now, time);
      if (out <= now) out = out.plus({ days: 1 });
      return { ok: true as const, iso: out.toISO()! };
    }
  }

  return {
    ok: false as const,
    error: `Could not parse when: "${input}". Try: "8:30pm", "tomorrow 7pm", "fri 9pm", "1/14 6pm", or ISO.`,
  };
}

// =======================================================
// Badge loading (Discord user id -> hub role icons)
// =======================================================
async function loadUserBadgePartsForDiscordIds(params: { guildId: string; discordIds: string[] }) {
  const supabaseAdmin = await getSupabaseAdmin();

  const { guildId, discordIds } = params;
  const result = new Map<string, BadgeParts>();

  for (const id of discordIds) result.set(id, { combat: "❔", logistics: "❔" });
  if (!discordIds.length) return result;

  const { data: profs, error: profErr } = await supabaseAdmin
    .from("profiles")
    .select("id, discord_user_id")
    .in("discord_user_id", discordIds);

  if (profErr) {
    console.error("profiles lookup failed:", profErr);
    return result;
  }

  const discordToProfile = new Map<string, string>();
  const profileIds: string[] = [];

  for (const p of profs ?? []) {
    const did = String((p as any).discord_user_id || "");
    const pid = String((p as any).id || "");
    if (!did || !pid) continue;
    discordToProfile.set(did, pid);
    profileIds.push(pid);
  }

  if (!profileIds.length) return result;

  const { data: selections, error: selErr } = await supabaseAdmin
    .from("user_hub_roles")
    .select("user_id, role_kind, role_id")
    .eq("guild_id", guildId)
    .in("user_id", profileIds);

  if (selErr) {
    console.error("user_hub_roles lookup failed:", selErr);
    return result;
  }

  const perProfile = new Map<string, { combatRoleId: string | null; logisticsRoleId: string | null }>();

  for (const row of selections ?? []) {
    const pid = String((row as any).user_id || "");
    const kind = String((row as any).role_kind || "");
    const rid = String((row as any).role_id || "");
    if (!pid || !rid) continue;

    const cur = perProfile.get(pid) || { combatRoleId: null, logisticsRoleId: null };
    if (kind === "combat") cur.combatRoleId = rid;
    if (kind === "logistics") cur.logisticsRoleId = rid;
    perProfile.set(pid, cur);
  }

  const roleIds = Array.from(
    new Set(
      Array.from(perProfile.values())
        .flatMap((x) => [x.combatRoleId, x.logisticsRoleId])
        .filter(Boolean) as string[]
    )
  );

  const roleIdToGroup = new Map<string, string>();

  if (roleIds.length) {
    const { data: meta, error: metaErr } = await supabaseAdmin
      .from("guild_role_meta")
      .select("role_id, group_key")
      .eq("guild_id", guildId)
      .in("role_id", roleIds);

    if (metaErr) {
      console.error("guild_role_meta lookup failed:", metaErr);
    } else {
      for (const m of meta ?? []) {
        const rid = String((m as any).role_id || "");
        const gk = String((m as any).group_key || "");
        if (rid) roleIdToGroup.set(rid, gk);
      }
    }
  }

  for (const [discordId, profileId] of discordToProfile.entries()) {
    const sel = perProfile.get(profileId) || { combatRoleId: null, logisticsRoleId: null };

    const combatGroup = sel.combatRoleId ? roleIdToGroup.get(sel.combatRoleId) : null;
    const logiGroup = sel.logisticsRoleId ? roleIdToGroup.get(sel.logisticsRoleId) : null;

    const combatIcon = combatGroup ? groupIcon(combatGroup) : "❔";
    const logiIcon = logiGroup ? groupIcon(logiGroup) : "❔";

    const safeCombat = combatIcon === "🛡" || combatIcon === "🧙" || combatIcon === "🏹" ? combatIcon : "❔";
    const safeLogi = logiIcon || "❔";

    result.set(discordId, { combat: safeCombat, logistics: safeLogi });
  }

  return result;
}

// =======================================================
// Discord HTTP helpers
// =======================================================
async function postToInteractionWebhook(params: { token: string; content: string; flags?: number }) {
  const appId = process.env.DISCORD_APPLICATION_ID;
  if (!appId) {
    throw new Error("DISCORD_APPLICATION_ID missing");
  }

  const url = `https://discord.com/api/v10/webhooks/${appId}/${params.token}?wait=true`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: params.content,
      flags: params.flags ?? 64,
      allowed_mentions: { parse: [] },
    }),
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    console.error("Interaction webhook failed", res.status, text);
    throw new Error(`Interaction webhook failed: HTTP ${res.status} ${text}`);
  }

  return text;
}


async function postChannelMessageAsBot(params: { channelId: string; payload: any }) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN missing on server.");

  const url = `https://discord.com/api/v10/channels/${params.channelId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });

  const text = await res.text().catch(() => "");
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Discord post message returned non JSON: HTTP ${res.status} ${text}`);
  }

  if (!res.ok) throw new Error(`Discord post message failed: HTTP ${res.status} ${text}`);
  return json;
}

async function patchChannelMessageAsBot(params: { channelId: string; messageId: string; payload: any }) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) throw new Error("DISCORD_BOT_TOKEN missing on server.");

  const url = `https://discord.com/api/v10/channels/${params.channelId}/messages/${params.messageId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Discord PATCH message failed: HTTP ${res.status} ${text}`);

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// =======================================================
// RSVP message refresh (used for button clicks)
// =======================================================
async function updatePostedSessionMessage(params: { sessionId: string }) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { buildSessionEmbedPayload } = await getEmbedBuilder();

  const { sessionId } = params;

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("sessions")
    .select("title,start_local,duration_minutes,notes,guild_id,discord_channel_id,discord_message_id")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    console.error("Session lookup failed:", sessionErr);
    return;
  }

  const guildId = String((session as any).guild_id || "");
  const channelId = String((session as any).discord_channel_id || "");
  const messageId = String((session as any).discord_message_id || "");

  if (!channelId || !messageId) {
    console.error("Missing discord_channel_id or discord_message_id for session:", sessionId);
    return;
  }

  const { data: rsvps, error: rsvpsErr } = await supabaseAdmin
    .from("session_rsvps")
    .select("status,user_id")
    .eq("session_id", sessionId);

  if (rsvpsErr) {
    console.error("RSVP load failed:", rsvpsErr);
    return;
  }

  const inUsers: string[] = [];
  const maybeUsers: string[] = [];
  const outUsers: string[] = [];

  for (const r of rsvps ?? []) {
    const s = String((r as any).status || "");
    const did = String((r as any).user_id || "");
    if (!did) continue;

    if (s === "in") inUsers.push(did);
    if (s === "maybe") maybeUsers.push(did);
    if (s === "out") outUsers.push(did);
  }

  const allIds = Array.from(new Set([...inUsers, ...maybeUsers, ...outUsers]));
  const badgeParts = guildId
    ? await loadUserBadgePartsForDiscordIds({ guildId, discordIds: allIds })
    : new Map<string, BadgeParts>();

  const payload = buildSessionEmbedPayload({
    sessionId,
    title: String((session as any).title),
    startLocal: String((session as any).start_local),
    durationMinutes: Number((session as any).duration_minutes),
    notes: String((session as any).notes || ""),
    guildId,
    inUsers,
    maybeUsers,
    outUsers,
    badgeParts,
  });

  await patchChannelMessageAsBot({ channelId, messageId, payload });
}

// =======================================================
// Main handler
// =======================================================
export async function POST(req: Request) {
  try {
    console.log("DISCORD HIT", new Date().toISOString());

    const signature = req.headers.get("x-signature-ed25519");
    const timestamp = req.headers.get("x-signature-timestamp");

    if (!signature || !timestamp) {
      return new Response("Missing Discord signature headers", { status: 401 });
    }

    const rawBody = await req.text();

    if (!rawBody || rawBody.length > 100_000) {
      return new Response("Payload too large or empty", { status: 413 });
    }

    const isValid = verifyDiscordRequest(req, rawBody, signature, timestamp);
    if (!isValid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // 1) PING
    if (body.type === 1) {
      return NextResponse.json({ type: 1 });
    }

    // 2) SLASH COMMANDS
    if (body.type === 2) {
      // ACK immediately (Discord times out fast)
      const ack = NextResponse.json({ type: 5, data: { flags: 64 } });

      const commandName = body.data?.name;
      console.log("DISCORD COMMAND NAME:", commandName, "RAW DATA:", body.data);
      const token = String(body.token || "").trim();

      // Permission: always ACK, send message via webhook
      if ((commandName === "setup" || commandName === "rsvp") && !hasManagePerms(body)) {
        void postToInteractionWebhook({
          token,
          content: "You need Manage Server (or Admin) to use this command.",
          flags: 64,
        });
        return ack;
      }

            // /setup (RUN INLINE ON VERCEL, NO BACKGROUND ASYNC)
      if (commandName === "setup") {
        const supabaseAdmin = await getSupabaseAdmin();

        const guildId = String(body.guild_id || "").trim();

        const channelIdRaw = optionValue(body, "channel");
        const officerRoleIdRaw = optionValue(body, "officer_role");

        const channelId = channelIdRaw ? String(channelIdRaw).trim() : "";
        const officerRoleId = officerRoleIdRaw ? String(officerRoleIdRaw).trim() : "";

        if (!guildId || !isSnowflake(guildId)) {
          return NextResponse.json({
            type: 4,
            data: { content: "This command must be used inside a Discord server (guild).", flags: 64 },
          });
        }

        if (!channelId && !officerRoleId) {
          return NextResponse.json({
            type: 4,
            data: { content: "Missing options. Provide at least one: channel or officer_role.", flags: 64 },
          });
        }

        if (channelId && !isSnowflake(channelId)) {
          return NextResponse.json({
            type: 4,
            data: { content: "Invalid channel id provided.", flags: 64 },
          });
        }

        if (officerRoleId && !isSnowflake(officerRoleId)) {
          return NextResponse.json({
            type: 4,
            data: { content: "Invalid officer role id provided.", flags: 64 },
          });
        }

        if (channelId) {
          const { error } = await supabaseAdmin.from("discord_servers").upsert({
            guild_id: guildId,
            channel_id: channelId,
            updated_at: new Date().toISOString(),
          });

          if (error) {
            return NextResponse.json({
              type: 4,
              data: { content: `❌ Failed to save channel.\n${error.message}`, flags: 64 },
            });
          }
        }

        if (officerRoleId) {
          const { error } = await supabaseAdmin.from("guild_settings").upsert({
            guild_id: guildId,
            officer_role_id: officerRoleId,
            updated_at: new Date().toISOString(),
          });

          if (error) {
            return NextResponse.json({
              type: 4,
              data: { content: `❌ Failed to save officer role.\n${error.message}`, flags: 64 },
            });
          }
        }

        const lines: string[] = [];
        lines.push("✅ Setup saved.");
        if (channelId) lines.push(`• Post channel: <#${channelId}>`);
        if (officerRoleId) lines.push(`• Officer role: <@&${officerRoleId}>`);
        lines.push("");
        lines.push("Hub links:");
        lines.push(`• Roles: ${hubLink("/roles", guildId)}`);
        lines.push(`• Setup guide: ${hubLink("/setup", guildId)}`);
        lines.push(`• Manage users: ${hubLink("/roles/manage-users", guildId)}`);

        return NextResponse.json({
          type: 4,
          data: { content: lines.join("\n"), flags: 64 },
        });
      }


            // /rsvp (RUN INLINE ON VERCEL, NO BACKGROUND ASYNC)
      if (commandName === "rsvp") {
        const supabaseAdmin = await getSupabaseAdmin();
        const { buildSessionEmbedPayload } = await getEmbedBuilder();

        const guildId = String(body.guild_id || "").trim();

        const title = String(optionValue(body, "title") || "").trim();
        const whenInput = String(optionValue(body, "when") || "").trim();
        const parsedWhen = await parseWhenToChicagoIso(whenInput);
        const when = parsedWhen.ok ? parsedWhen.iso : "";

        const durationMinutes = Number(optionValue(body, "duration") || 0);
        const notesRaw = optionValue(body, "notes");
        const notes = String(notesRaw || "").trim();

        if (!guildId) {
          return NextResponse.json({
            type: 4,
            data: { content: "This command must be used in a server (guild).", flags: 64 },
          });
        }

        if (!title) {
          return NextResponse.json({ type: 4, data: { content: "Missing title.", flags: 64 } });
        }

        if (!whenInput) {
          return NextResponse.json({ type: 4, data: { content: "Missing when.", flags: 64 } });
        }

        if (!parsedWhen.ok) {
          return NextResponse.json({
            type: 4,
            data: { content: `Invalid when. ${parsedWhen.error}`, flags: 64 },
          });
        }

        if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
          return NextResponse.json({
            type: 4,
            data: { content: "Duration must be a positive number of minutes.", flags: 64 },
          });
        }

        // 1) Find configured channel
        const { data: serverRow, error: serverErr } = await supabaseAdmin
          .from("discord_servers")
          .select("channel_id")
          .eq("guild_id", guildId)
          .maybeSingle();

        if (serverErr) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ DB error loading setup.\n${serverErr.message}`, flags: 64 },
          });
        }

        const channelId = String((serverRow as any)?.channel_id || "").trim();
        if (!channelId) {
          return NextResponse.json({
            type: 4,
            data: { content: "❌ No channel configured. Run `/setup` first and choose the posting channel.", flags: 64 },
          });
        }

        // 2) Create session in Supabase
        const { data: inserted, error: insErr } = await supabaseAdmin
          .from("sessions")
          .insert({
            guild_id: guildId,
            title,
            start_local: when,
            duration_minutes: durationMinutes,
            notes: notes || "",
            created_at: new Date().toISOString(),
          } as any)
          .select("id,title,start_local,duration_minutes,notes,guild_id")
          .single();

        if (insErr || !inserted) {
          return NextResponse.json({
            type: 4,
            data: { content: `❌ Failed to create session.\n${insErr?.message || ""}`, flags: 64 },
          });
        }

        const sessionId = String((inserted as any).id);

        // 3) Build initial payload (no RSVPs yet)
        const badgeParts = new Map<string, BadgeParts>();
        const payload = buildSessionEmbedPayload({
          sessionId,
          title: String((inserted as any).title),
          startLocal: String((inserted as any).start_local),
          durationMinutes: Number((inserted as any).duration_minutes),
          notes: String((inserted as any).notes || ""),
          guildId,
          inUsers: [],
          maybeUsers: [],
          outUsers: [],
          badgeParts,
        });

        // 4) Post to channel as bot
        let postedMessageId = "";
        try {
          const posted = await postChannelMessageAsBot({ channelId, payload });
          postedMessageId = String((posted as any)?.id || "").trim();
        } catch (e: any) {
          // rollback session row so you don't get orphan rows
          await supabaseAdmin.from("sessions").delete().eq("id", sessionId);

          return NextResponse.json({
            type: 4,
            data: { content: `❌ Discord post failed.\n${e?.message || ""}`, flags: 64 },
          });
        }

        if (!postedMessageId) {
          await supabaseAdmin.from("sessions").delete().eq("id", sessionId);

          return NextResponse.json({
            type: 4,
            data: { content: "❌ Discord did not return a message id.", flags: 64 },
          });
        }

        // 5) Save message ids back to session
        const { error: updErr } = await supabaseAdmin
          .from("sessions")
          .update({ discord_channel_id: channelId, discord_message_id: postedMessageId } as any)
          .eq("id", sessionId);

        if (updErr) {
          return NextResponse.json({
            type: 4,
            data: {
              content: `⚠️ Session posted, but failed to save Discord ids.\nSession: \`${sessionId}\`\n${updErr.message}`,
              flags: 64,
            },
          });
        }

        return NextResponse.json({
          type: 4,
          data: {
            content: `✅ Session posted in <#${channelId}>.\nSession id: \`${sessionId}\``,
            flags: 64,
          },
        });
      }


      void postToInteractionWebhook({ token, content: "Unknown command.", flags: 64 });
      return ack;
    }

    // 3) BUTTON CLICKS
    if (body.type === 3) {
      const customId = String(body.data?.custom_id || "");
      if (!customId.startsWith("rsvp:")) return NextResponse.json({ type: 6 });

      const [, sessionId, status] = customId.split(":");
      const discordUserId = String(body.member?.user?.id || body.user?.id || "");
      const token = String(body.token || "");

      if (!sessionId || !discordUserId || !token || !["in", "maybe", "out"].includes(status)) {
        return NextResponse.json({ type: 6 });
      }

      void (async () => {
        try {
          const supabaseAdmin = await getSupabaseAdmin();

          await supabaseAdmin.from("session_rsvps").upsert(
            {
              session_id: sessionId,
              user_id: discordUserId,
              status,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "session_id,user_id" }
          );

          await updatePostedSessionMessage({ sessionId });
        } catch (e) {
          console.error("RSVP background update failed:", e);
        }
      })();

      return NextResponse.json({ type: 6 });
    }

    return NextResponse.json({ type: 6 });
  } catch (e: any) {
    console.error("POST crashed:", e);
    return NextResponse.json({
      type: 4,
      data: { content: "❌ Internal error. Check server logs.", flags: 64 },
    });
  }
}
