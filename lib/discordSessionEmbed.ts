// web/lib/discordSessionEmbed.ts

import { DateTime } from "luxon";

export type BadgeParts = {
  combat: string; // 🛡 | 🧙 | 🏹 | ❔
  logistics: string; // 🏗️ | 🌾 | 📦 | 🍲 | ⛏️ | 🧰 | ❔
};

// =======================================================
// Base URL
// =======================================================
function getBaseUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  return "http://localhost:3000";
}

// =======================================================
// Helpers
// =======================================================
function mention(discordId: string) {
  return `<@${discordId}>`;
}

function toUnixSeconds(isoOrText: string) {
  const ms = Date.parse(String(isoOrText));
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

const CHI_ZONE = "America/Chicago";

function formatChicagoPretty(startLocal: string) {
  const dt = DateTime.fromISO(String(startLocal || ""), { setZone: true }).setZone(CHI_ZONE);
  if (!dt.isValid) return String(startLocal || "");
  return dt.toFormat("LLL d, yyyy, h:mm a");
}

function isCombatIcon(icon: string) {
  return icon === "🛡" || icon === "🧙" || icon === "🏹";
}

// Sort order for combat
const COMBAT_SORT: Record<string, number> = {
  "🛡": 0,
  "🧙": 1,
  "🏹": 2,
  "❔": 3,
};

// Sort order for logistics
const LOGI_SORT: Record<string, number> = {
  "🏗️": 0,
  "🌾": 1,
  "📦": 2,
  "🍲": 3,
  "⛏️": 4,
  "🧰": 5,
  "❔": 6,
};

function getSortKey(parts: BadgeParts) {
  const a = COMBAT_SORT[parts.combat] ?? 9;
  const b = LOGI_SORT[parts.logistics] ?? 9;
  return `${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
}

function buildLogisticsBreakdown(params: {
  discordIds: string[];
  badgeParts: Map<string, BadgeParts>;
  maxChars: number;
}) {
  const { discordIds, badgeParts, maxChars } = params;

  const counts = new Map<string, number>();
  for (const id of discordIds) {
    const parts = badgeParts.get(id) || { combat: "❔", logistics: "❔" };
    const key = parts.logistics || "❔";
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const entries = Array.from(counts.entries()).sort((a, b) => {
    const aa = LOGI_SORT[a[0]] ?? 9;
    const bb = LOGI_SORT[b[0]] ?? 9;
    return aa - bb;
  });

  let text = entries.map(([icon, n]) => `${icon} x${n}`).join("  ·  ");
  if (!text) text = "—";

  if (text.length > maxChars) text = text.slice(0, Math.max(0, maxChars - 3)) + "...";
  return text;
}

function buildList(params: {
  discordIds: string[];
  badgeParts: Map<string, BadgeParts>;
  maxShown: number;
  maxChars: number;
  showBadges?: boolean;
}) {
  const { discordIds, badgeParts, maxShown, maxChars, showBadges = true } = params;

  const sortedIds = [...discordIds].sort((a, b) => {
    const pa = badgeParts.get(a) || { combat: "❔", logistics: "❔" };
    const pb = badgeParts.get(b) || { combat: "❔", logistics: "❔" };
    return getSortKey(pa).localeCompare(getSortKey(pb));
  });

  const groups: Record<string, string[]> = { "🛡": [], "🧙": [], "🏹": [], "❔": [] };

  for (const id of sortedIds) {
    const p = badgeParts.get(id) || { combat: "❔", logistics: "❔" };
    const combat = p.combat || "❔";
    if (!groups[combat]) groups["❔"].push(id);
    else groups[combat].push(id);
  }

  const order: Array<{ icon: string; label: string }> = [
    { icon: "🛡", label: "Strength" },
    { icon: "🧙", label: "Intelligence" },
    { icon: "🏹", label: "Dexterity" },
    { icon: "❔", label: "Unassigned" },
  ];

  const lines: string[] = [];
  let shownCount = 0;

  for (const g of order) {
    const ids = groups[g.icon];
    if (!ids || !ids.length) continue;

    lines.push(`${g.icon} **${g.label}**`);

    for (const id of ids) {
      if (shownCount >= maxShown) break;

      const p = badgeParts.get(id) || { combat: "❔", logistics: "❔" };
      const safeCombat = isCombatIcon(p.combat) ? p.combat : "❔";
      const safeLogi = p.logistics || "❔";

      lines.push(showBadges ? `${safeCombat}${safeLogi} ${mention(id)}` : `${mention(id)}`);
      shownCount++;
    }

    lines.push("");
    if (shownCount >= maxShown) break;
  }

  const remaining = discordIds.length - shownCount;
  if (remaining > 0) lines.push(`… +${remaining} more`);

  let text = lines.join("\n").trim();
  if (text.length > maxChars) text = text.slice(0, Math.max(0, maxChars - 3)) + "...";
  return text || "—";
}

export function buildSessionEmbedPayload(params: {
  sessionId: string;
  title: string;
  startLocal: string;
  durationMinutes: number;
  notes: string | null;
  guildId: string;
  inUsers: string[];
  maybeUsers: string[];
  outUsers: string[];
  badgeParts: Map<string, BadgeParts>;
}) {
  const {
    sessionId,
    title,
    startLocal,
    durationMinutes,
    notes,
    guildId,
    inUsers,
    maybeUsers,
    outUsers,
    badgeParts,
  } = params;

  const inCount = inUsers.length;
  const maybeCount = maybeUsers.length;
  const outCount = outUsers.length;

  const whenUnix = toUnixSeconds(startLocal);
  const whenText = whenUnix ? `<t:${whenUnix}:f>  •  <t:${whenUnix}:R>` : formatChicagoPretty(startLocal);

  const baseUrl = getBaseUrl();
  const hubUrl = `${baseUrl}/sessions/${encodeURIComponent(sessionId)}`;

  const inList = buildList({
    discordIds: inUsers,
    badgeParts,
    maxShown: 10,
    maxChars: 900,
    showBadges: true,
  });

  // FIX: show badges for Maybe too (so role icons show)
  const maybeList = buildList({
    discordIds: maybeUsers,
    badgeParts,
    maxShown: 10,
    maxChars: 900,
    showBadges: true,
  });

  // FIX: show badges for Out too (so role icons show)
  const outList = buildList({
    discordIds: outUsers,
    badgeParts,
    maxShown: 10,
    maxChars: 900,
    showBadges: true,
  });

  const logisticsBreakdown = buildLogisticsBreakdown({
    discordIds: inUsers,
    badgeParts,
    maxChars: 900,
  });

  const notesText = String(notes || "").trim();
  const hasNotes = notesText.length > 0;

  const headerLines: string[] = [];
  headerLines.push(`**When:** ${whenText}`);
  headerLines.push(`**Duration:** ${Math.max(0, Number(durationMinutes))} minutes`);
  headerLines.push(`**Hub:** ${hubUrl}`);
  if (hasNotes) headerLines.push(`**Notes:** ${notesText}`);

  const summaryLine = `✅ **In:** ${inCount}   ❔ **Maybe:** ${maybeCount}   ❌ **Out:** ${outCount}`;

  return {
    allowed_mentions: { parse: [] as string[] },

    embeds: [
      {
        title: `🕯️ Session: ${title}`,
        // Keep your big banner image
        image: {
          url: "https://cdn.discordapp.com/attachments/1391170867588894811/1460489545534406788/image.png",
        },
        description: `${headerLines.join("\n")}\n\n${summaryLine}`,
        timestamp: new Date().toISOString(),
        color: 0x1f9aa8,
        fields: [
          { name: "📦 Logistics (In only)", value: logisticsBreakdown, inline: false },
          { name: `✅ In (${inCount})`, value: inList, inline: false },
          { name: `❔ Maybe (${maybeCount})`, value: maybeList, inline: false },
          { name: `❌ Out (${outCount})`, value: outList, inline: false },
        ],
        footer: {
          text:
            "🛡 Strength · 🧙 Intelligence · 🏹 Dexterity  |  " +
            "🏗️ Architect · 🌾 Agronomist · 📦 Quartermaster · 🍲 Provisioner · ⛏️ Excavator" +
            `  •  Session ID: ${sessionId}`,
        },
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
}
