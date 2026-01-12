// web/app/api/discord/route.ts

import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function verifyDiscordRequest(
  req: Request,
  body: string,
  signature: string,
  timestamp: string
) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

function groupIcon(groupKey: string) {
  const g = String(groupKey || "").toLowerCase();
  if (g === "strength") return "🛡";
  if (g === "intelligence") return "🧙";
  if (g === "dexterity") return "🏹";
  if (g === "logistics") return "🧰";
  return "❔";
}

function mention(discordId: string) {
  return `<@${discordId}>`;
}

function toUnixSeconds(iso: string) {
  const ms = Date.parse(String(iso));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Loads hub badges for a set of Discord user IDs using:
 * user_hub_roles(guild_id, discord_user_id, role_kind, role_id)
 * guild_role_meta(guild_id, role_id, group_key)
 *
 * Returns Map<discord_user_id, "🛡🧰"> (combat + logistics if present)
 */
async function loadUserBadgesForDiscordIds(params: {
  guildId: string;
  discordIds: string[];
}) {
  const { guildId, discordIds } = params;
  if (!discordIds.length) return new Map<string, string>();

  const { data: selections, error: selErr } = await supabaseAdmin
    .from("user_hub_roles")
    .select("discord_user_id, role_kind, role_id")
    .eq("guild_id", guildId)
    .in("discord_user_id", discordIds);

  if (selErr) {
    console.error("user_hub_roles lookup failed:", selErr);
    return new Map<string, string>();
  }

  const perDiscord = new Map<
    string,
    { combatRoleId: string | null; logisticsRoleId: string | null }
  >();

  for (const row of selections ?? []) {
    const did = String((row as any).discord_user_id || "");
    const kind = String((row as any).role_kind || "");
    const rid = String((row as any).role_id || "");
    if (!did || !rid) continue;

    const cur = perDiscord.get(did) || { combatRoleId: null, logisticsRoleId: null };
    if (kind === "combat") cur.combatRoleId = rid;
    if (kind === "logistics") cur.logisticsRoleId = rid;
    perDiscord.set(did, cur);
  }

  if (!perDiscord.size) return new Map<string, string>();

  const roleIds = Array.from(
    new Set(
      Array.from(perDiscord.values())
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

  const result = new Map<string, string>();

  for (const [discordId, sel] of perDiscord.entries()) {
    const combatGroup = sel.combatRoleId ? roleIdToGroup.get(sel.combatRoleId) : null;
    const logiGroup = sel.logisticsRoleId ? roleIdToGroup.get(sel.logisticsRoleId) : null;

    const icons: string[] = [];
    if (combatGroup) icons.push(groupIcon(combatGroup));
    if (logiGroup) icons.push(groupIcon(logiGroup));

    if (icons.length) result.set(discordId, icons.join(""));
  }

  return result;
}

function buildList(params: {
  discordIds: string[];
  badgeMap: Map<string, string>;
  maxShown: number;
  maxChars: number;
}) {
  const { discordIds, badgeMap, maxShown, maxChars } = params;

  const shown = discordIds.slice(0, maxShown);
  const remaining = discordIds.length - shown.length;

  const parts: string[] = [];
  for (const did of shown) {
    const badge = badgeMap.get(did) || "";
    parts.push(`${badge ? `${badge} ` : ""}${mention(did)}`);
  }

  let text = parts.join("  ");
  if (remaining > 0) text += `  … +${remaining} more`;

  if (text.length > maxChars) {
    text = text.slice(0, Math.max(0, maxChars - 3)) + "...";
  }

  return text || "—";
}

async function updateOriginalInteractionMessage(params: {
  token: string;
  sessionId: string;
  guildId: string;
}) {
  const { token, sessionId, guildId } = params;

  const appId = process.env.DISCORD_APPLICATION_ID;
  if (!appId) {
    console.error("DISCORD_APPLICATION_ID missing");
    return;
  }

  // Load session
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("sessions")
    .select("title,start_local,duration_minutes,notes,guild_id")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    console.error("Session lookup failed:", sessionErr);
    return;
  }

  // Load RSVPs
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

  const inCount = inUsers.length;
  const maybeCount = maybeUsers.length;
  const outCount = outUsers.length;

  const allIds = Array.from(new Set([...inUsers, ...maybeUsers, ...outUsers]));
  const badgeMap = guildId
    ? await loadUserBadgesForDiscordIds({ guildId, discordIds: allIds })
    : new Map<string, string>();

  const whenUnix = toUnixSeconds(String((session as any).start_local));
  const whenText = whenUnix
    ? `<t:${whenUnix}:F> (<t:${whenUnix}:R>)`
    : String((session as any).start_local);

  const inList = buildList({ discordIds: inUsers, badgeMap, maxShown: 10, maxChars: 900 });
  const maybeList = buildList({ discordIds: maybeUsers, badgeMap, maxShown: 10, maxChars: 900 });
  const outList = buildList({ discordIds: outUsers, badgeMap, maxShown: 10, maxChars: 900 });

  const payload = {
    embeds: [
      {
        title: `New Session: ${(session as any).title}`,
        description: (session as any).notes || "No notes.",
        timestamp: new Date().toISOString(),
        color: 0x2dd4bf,
        fields: [
          { name: "🕒 When", value: whenText, inline: false },
          {
            name: "⏱ Duration",
            value: `${Number((session as any).duration_minutes)} minutes`,
            inline: true,
          },
          {
            name: "📊 RSVPs",
            value: `**In:** ${inCount}  |  **Maybe:** ${maybeCount}  |  **Out:** ${outCount}`,
            inline: false,
          },
          { name: `✅ In (${inCount})`, value: inList, inline: false },
          { name: `❔ Maybe (${maybeCount})`, value: maybeList, inline: false },
          { name: `❌ Out (${outCount})`, value: outList, inline: false },
          {
            name: "Legend",
            value: "🛡 Strength  ·  🧙 Intelligence  ·  🏹 Dexterity  ·  🧰 Logistics",
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
          { type: 2, style: 3, label: `In (${inCount})`, custom_id: `rsvp:${sessionId}:in` },
          { type: 2, style: 1, label: `Maybe (${maybeCount})`, custom_id: `rsvp:${sessionId}:maybe` },
          { type: 2, style: 4, label: `Out (${outCount})`, custom_id: `rsvp:${sessionId}:out` },
        ],
      },
    ],
  };

  const url = `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("Discord PATCH failed:", res.status, text);
  }
}

export async function POST(req: Request) {
  console.log("INTERACTION HIT", new Date().toISOString());

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  console.log("sig header", !!signature);
  console.log("ts header", !!timestamp);
  console.log("has public key", !!process.env.DISCORD_PUBLIC_KEY);

  if (!signature || !timestamp) {
    console.log("MISSING SIGNATURE HEADERS");
    return new Response("Missing Discord signature headers", { status: 401 });
  }

  const rawBody = await req.text();

  console.log("rawBody length", rawBody?.length ?? 0);

  if (!rawBody || rawBody.length > 100_000) {
    console.log("BAD BODY");
    return new Response("Payload too large or empty", { status: 413 });
  }

  const isValid = verifyDiscordRequest(req, rawBody, signature, timestamp);
  console.log("signature valid?", isValid);

  if (!isValid) {
    console.log("SIGNATURE FAILED");
    return new Response("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);
  console.log("interaction type", body?.type);


  // 1️⃣ PING
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 2️⃣ SLASH COMMANDS
  if (body.type === 2) {
    const commandName = body.data?.name;

    if (commandName === "setup") {
      const channel = body.data?.options?.find((o: any) => o.name === "channel")?.value;

      if (!channel) {
        return NextResponse.json({
          type: 4,
          data: { content: "Missing channel option.", flags: 64 },
        });
      }

      const appId = process.env.DISCORD_APPLICATION_ID;
      if (!appId) {
        return NextResponse.json({
          type: 4,
          data: { content: "Server misconfig: DISCORD_APPLICATION_ID missing.", flags: 64 },
        });
      }

      void (async () => {
        try {
          await supabaseAdmin.from("discord_servers").upsert({
            guild_id: body.guild_id,
            channel_id: channel,
            updated_at: new Date().toISOString(),
          });

          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${body.token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "✅ Channel saved successfully.", flags: 64 }),
          });
        } catch (e) {
          console.error("Setup save failed:", e);

          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${body.token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: "❌ Failed to save channel. Check server logs.", flags: 64 }),
          });
        }
      })();

      return NextResponse.json({ type: 5, data: { flags: 64 } });
    }

    return NextResponse.json({ type: 4, data: { content: "Unknown command." } });
  }

  // 3️⃣ BUTTON CLICKS (RSVP)
  if (body.type === 3) {
    const customId = String(body.data?.custom_id || "");
    if (!customId.startsWith("rsvp:")) return NextResponse.json({ type: 6 });

    const [, sessionId, status] = customId.split(":");
    const discordUserId = String(body.member?.user?.id || body.user?.id || "");
    const token = String(body.token || "");

    if (!sessionId || !discordUserId || !token || !["in", "maybe", "out"].includes(status)) {
      return NextResponse.json({ type: 6 });
    }

    // ✅ Defer immediately (prevents "Interaction failed")
    // Then do work + patch @original in the background.
    void (async () => {
      try {
        // Save RSVP (session_rsvps.user_id is the Discord user id)
        await supabaseAdmin.from("session_rsvps").upsert(
          {
            session_id: sessionId,
            user_id: discordUserId,
            status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id,user_id" }
        );

        // Need guild_id for badge lookup
        const { data: sessionRow } = await supabaseAdmin
          .from("sessions")
          .select("guild_id")
          .eq("id", sessionId)
          .single();

        const guildId = String((sessionRow as any)?.guild_id || "");

        await updateOriginalInteractionMessage({ token, sessionId, guildId });
      } catch (e) {
        console.error("RSVP background update failed:", e);
      }
    })();

    return NextResponse.json({ type: 6 });
  }

  return NextResponse.json({ type: 6 });
}
