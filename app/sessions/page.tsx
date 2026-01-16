export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { CSSProperties } from "react";
import { headers } from "next/headers";
import CreateSessionClient from "./create-session-client";
import TopBar from "@/app/components/TopBar";

type Counts = { in: number; maybe: number; out: number };

type SessionItem = {
  id: string;
  title: string;
  startLocal: string;
  durationMinutes: number;
  notes: string;
  guildId: string;
  discordChannelId: string | null;
  discordMessageId: string | null;
  createdAt: string;
  upcoming: boolean;
  counts?: Counts;
  missingCombatIn: number;
  missingLogisticsIn: number;
};

const DEFAULT_GUILD_ID = "1391117470676287518";

// Match Roles page palette
const THEME = {
  shroudDeep: "#06080a",
  shroudMist: "#1a2430",
  flameAmber: "#f2994a",
  flameGold: "#f2c94c",
  stoneCard: "#1c1f26",
  stoneBorder: "#3a4150",
  stoneEdge: "#232a36",
  textSilver: "#d1d5db",
  textAsh: "#6b7280",
};

type SearchParamsInput = Record<string, string | string[] | undefined>;

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || ""));
}

async function getBaseUrl() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore
  }

  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;

  return "http://localhost:3000";
}

function buildUrl(basePath: string, params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = String(v || "").trim();
    if (val) sp.set(k, val);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

async function getSessions(guildId: string): Promise<SessionItem[]> {
  const baseUrl = await getBaseUrl();

  const res = await fetch(
    `${baseUrl}/api/sessions/list?guildId=${encodeURIComponent(guildId)}&limit=50`,
    { cache: "no-store" }
  );

  if (!res.ok) return [];
  const json = (await res.json()) as { sessions: SessionItem[] };

  return (json.sessions || []).map((s) => ({
    ...s,
    counts: s.counts || { in: 0, maybe: 0, out: 0 },
  }));
}

function fmtWhen(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return startLocal || "Unknown time";
  return new Date(ms).toLocaleString();
}

function minutesToLabel(mins: number) {
  const m = Number(mins);
  if (!Number.isFinite(m) || m <= 0) return "Unknown";
  if (m < 60) return `${Math.floor(m)} min`;
  const h = Math.floor(m / 60);
  const r = Math.floor(m % 60);
  if (r === 0) return `${h} hr`;
  return `${h} hr ${r} min`;
}

function discordUrlForSession(s: SessionItem) {
  if (!s.guildId || !s.discordChannelId) return null;
  if (s.discordMessageId) {
    return `https://discord.com/channels/${s.guildId}/${s.discordChannelId}/${s.discordMessageId}`;
  }
  return `https://discord.com/channels/${s.guildId}/${s.discordChannelId}`;
}

function ShroudFog() {
  const blobStyleBase: CSSProperties = {
    position: "absolute",
    inset: 0,
    background: `radial-gradient(
      circle at center,
      rgba(35, 50, 75, 1) 0%,
      rgba(20, 30, 45, 0.6) 45%,
      transparent 75%
    )`,
    filter: "blur(100px)",
    opacity: 0.85,
    willChange: "transform, opacity",
    maskImage: `linear-gradient(
      to bottom,
      transparent 0%,
      black 15%,
      black 85%,
      transparent 100%
    )`,
    WebkitMaskImage: `linear-gradient(
      to bottom,
      transparent 0%,
      black 15%,
      black 85%,
      transparent 100%
    )`,
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...blobStyleBase,
          left: "-20%",
          top: "10%",
          width: "60%",
          height: "80%",
          animation: "driftUp 18s linear infinite",
          animationDelay: "-2s",
          opacity: 0.65,
        }}
      />
      <div
        style={{
          ...blobStyleBase,
          left: "25%",
          top: "20%",
          width: "70%",
          height: "90%",
          animation: "driftUp 22s linear infinite",
          animationDelay: "-9s",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          ...blobStyleBase,
          left: "55%",
          top: "15%",
          width: "55%",
          height: "85%",
          animation: "driftUp 20s linear infinite",
          animationDelay: "-14s",
          opacity: 0.5,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "-35%",
          height: "70%",
          background: `radial-gradient(
            ellipse at bottom,
            ${THEME.shroudMist} 0%,
            #1a2430cc 40%,
            transparent 80%
          )`,
          filter: "blur(12px)",
          opacity: 0.95,
          maskImage: `linear-gradient(
            to bottom,
            transparent 0%,
            black 15%,
            black 85%,
            transparent 100%
          )`,
          WebkitMaskImage: `linear-gradient(
            to bottom,
            transparent 0%,
            black 15%,
            black 85%,
            transparent 100%
          )`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          background: `linear-gradient(
            to top,
            ${THEME.shroudMist} 0%,
            #1a2430ee 45%,
            transparent 100%
          )`,
          opacity: 0.35,
          maskImage: `linear-gradient(
            to bottom,
            transparent 0%,
            black 15%,
            black 85%,
            transparent 100%
          )`,
          WebkitMaskImage: `linear-gradient(
            to bottom,
            transparent 0%,
            black 15%,
            black 85%,
            transparent 100%
          )`,
        }}
      />

      <style>{`
        @keyframes driftUp {
          0% { transform: translateY(100%) scale(1) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          50% { transform: translateY(15%) scale(1.5) rotate(3deg); }
          90% { opacity: 0.1; }
          100% { transform: translateY(-130%) scale(2) rotate(-3deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function StoneSection(props: { title: string; subtitle: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
        border: `2px solid ${THEME.stoneBorder}`,
        borderRadius: 6,
        padding: 24,
        boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 6,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          borderBottom: `1px solid ${THEME.stoneBorder}`,
          paddingBottom: 12,
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: THEME.flameGold,
              textTransform: "uppercase",
              letterSpacing: 3,
              fontSize: "1.05rem",
              fontWeight: 950,
            }}
          >
            {props.title}
          </h2>
          <p style={{ margin: "6px 0 0", color: THEME.textAsh, fontSize: "0.9rem", fontStyle: "italic" }}>
            {props.subtitle}
          </p>
        </div>

        {props.right}
      </div>

      {props.children}
    </div>
  );
}

function MiniPill(props: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tone = props.tone || "neutral";

  const border =
    tone === "good"
      ? "rgba(120,220,180,0.45)"
      : tone === "warn"
      ? "rgba(255,196,90,0.45)"
      : tone === "bad"
      ? "rgba(252,165,165,0.45)"
      : THEME.stoneBorder;

  const bg =
    tone === "good"
      ? "rgba(120,220,180,0.10)"
      : tone === "warn"
      ? "rgba(255,196,90,0.10)"
      : tone === "bad"
      ? "rgba(252,165,165,0.10)"
      : "rgba(0,0,0,0.35)";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background: bg,
        color: THEME.textSilver,
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </span>
  );
}

function ActionLink(props: { href: string; children: React.ReactNode; newTab?: boolean; primary?: boolean }) {
  return (
    <a
      href={props.href}
      target={props.newTab ? "_blank" : undefined}
      rel={props.newTab ? "noreferrer" : undefined}
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${THEME.stoneBorder}`,
        background: props.primary ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})` : "rgba(12,14,18,0.6)",
        color: props.primary ? "#111" : THEME.textSilver,
        textDecoration: "none",
        fontWeight: 950,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontSize: 12,
        boxShadow: props.primary ? `0 0 18px rgba(242, 153, 74, 0.25)` : "none",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </a>
  );
}

function SessionCard(props: { s: SessionItem; guildId: string }) {
  const s = props.s;
  const discordUrl = discordUrlForSession(s);

  const counts = s.counts || { in: 0, maybe: 0, out: 0 };
  const hasMsg = Boolean(s.discordMessageId);
  const hasChannel = Boolean(s.discordChannelId);

  return (
    <div
      style={{
        border: `1px solid ${THEME.stoneBorder}`,
        background: "#0c0e12",
        borderRadius: 6,
        padding: 16,
        display: "grid",
        gap: 10,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>
            {s.title || "Untitled"}
          </div>

          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <MiniPill>🕒 {fmtWhen(s.startLocal)}</MiniPill>
            <MiniPill>⏱ {minutesToLabel(s.durationMinutes || 0)}</MiniPill>
            {s.upcoming ? <MiniPill tone="good">🔥 Upcoming</MiniPill> : <MiniPill tone="warn">🪨 Past</MiniPill>}
          </div>

          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <MiniPill tone="good">✅ {counts.in}</MiniPill>
            <MiniPill tone="warn">❔ {counts.maybe}</MiniPill>
            <MiniPill tone="bad">❌ {counts.out}</MiniPill>
          </div>

          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {s.missingCombatIn ? <MiniPill tone="warn">⚠️ {s.missingCombatIn} missing combat</MiniPill> : null}
            {s.missingLogisticsIn ? <MiniPill tone="warn">⚠️ {s.missingLogisticsIn} missing logistics</MiniPill> : null}
            {!s.missingCombatIn && !s.missingLogisticsIn && counts.in ? <MiniPill tone="good">All In badges complete</MiniPill> : null}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "end" }}>
          <ActionLink href={buildUrl(`/sessions/${s.id}`, { guildId: props.guildId })} primary>
            View
          </ActionLink>

          {discordUrl ? (
            <ActionLink href={discordUrl} newTab>
              {hasMsg ? "Discord" : "Channel"}
            </ActionLink>
          ) : (
            <span style={{ opacity: 0.65, fontSize: 12, alignSelf: "center" }}>
              {hasChannel ? "No message saved" : "No Discord link saved"}
            </span>
          )}
        </div>
      </div>

      {s.notes ? (
        <div
          style={{
            border: `1px solid ${THEME.stoneBorder}`,
            background: "rgba(0,0,0,0.35)",
            borderRadius: 6,
            padding: 12,
            color: "rgba(209,213,219,0.92)",
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
          }}
        >
          {s.notes}
        </div>
      ) : null}
    </div>
  );
}

function stableTimeValue(s: SessionItem) {
  const ms = Date.parse(String(s.startLocal || ""));
  if (Number.isFinite(ms)) return ms;
  const created = Date.parse(String(s.createdAt || ""));
  if (Number.isFinite(created)) return created;
  return 0;
}

export default async function SessionsPage(props: { searchParams?: SearchParamsInput | Promise<SearchParamsInput> }) {
  let sp: SearchParamsInput = {};
  const spRaw = props.searchParams as any;

  if (spRaw && typeof spRaw.then === "function") {
    sp = (await spRaw) as SearchParamsInput;
  } else {
    sp = (spRaw || {}) as SearchParamsInput;
  }

  const rawGuild = String(firstParam(sp.guildId) || "").trim();
  const guildId = rawGuild && isSnowflake(rawGuild) ? rawGuild : DEFAULT_GUILD_ID;

  const rawQ = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const rawShow = Array.isArray(sp.show) ? sp.show[0] : sp.show;

  const q = String(rawQ || "").trim().slice(0, 80);
  const show = String(rawShow || "all").trim().toLowerCase();

  const sessions = await getSessions(guildId);

  const filtered = q
    ? sessions.filter((s) => {
        const hay = `${s.title || ""} ${s.notes || ""}`.toLowerCase();
        return hay.includes(q.toLowerCase());
      })
    : sessions;

  let upcoming = filtered.filter((s) => s.upcoming);
  let past = filtered.filter((s) => !s.upcoming);

  upcoming = upcoming.sort((a, b) => stableTimeValue(a) - stableTimeValue(b));
  past = past.sort((a, b) => stableTimeValue(b) - stableTimeValue(a));

  const showingUpcoming = show === "upcoming";
  const showingPast = show === "past";

  const listUpcoming = showingPast ? [] : upcoming;
  const listPast = showingUpcoming ? [] : past;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: THEME.shroudDeep,
        background: `radial-gradient(circle, ${THEME.shroudMist} 0%, ${THEME.shroudDeep} 78%, #000 100%)`,
        color: THEME.textSilver,
        padding: "110px 20px 60px 20px",
        fontFamily: "'Segoe UI', Roboto, serif",
        position: "relative",
      }}
    >
      <TopBar subtitle="Session registry" guildId={guildId} current="sessions" />
      <ShroudFog />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1020, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <CreateSessionClient />

        <header style={{ textAlign: "center", marginBottom: 34 }}>
          <div
            style={{
              color: THEME.flameAmber,
              fontSize: 13,
              letterSpacing: 5,
              textTransform: "uppercase",
              marginBottom: 12,
              fontWeight: 950,
            }}
          >
            Session Registry
          </div>

          <h1
            style={{
              fontSize: "3.1rem",
              margin: 0,
              color: "#fff",
              textShadow: `0 0 20px rgba(242, 153, 74, 0.55)`,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Enshrouded Hub
          </h1>

          <div style={{ width: 120, height: 2, background: THEME.flameAmber, margin: "22px auto 0 auto" }} />
        </header>

        <StoneSection
          title="Find Sessions"
          subtitle="Filter and search the altar records."
          right={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
              <a
                href={buildUrl("/sessions", { guildId, q, show: "all" })}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: show === "all" ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})` : "rgba(12,14,18,0.6)",
                  color: show === "all" ? "#111" : THEME.textSilver,
                  textDecoration: "none",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                All
              </a>

              <a
                href={buildUrl("/sessions", { guildId, q, show: "upcoming" })}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background:
                    show === "upcoming" ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})` : "rgba(12,14,18,0.6)",
                  color: show === "upcoming" ? "#111" : THEME.textSilver,
                  textDecoration: "none",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Upcoming
              </a>

              <a
                href={buildUrl("/sessions", { guildId, q, show: "past" })}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: show === "past" ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})` : "rgba(12,14,18,0.6)",
                  color: show === "past" ? "#111" : THEME.textSilver,
                  textDecoration: "none",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Past
              </a>
            </div>
          }
        >
          <form method="get" action="/sessions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input type="hidden" name="guildId" value={guildId} />
            <input type="hidden" name="show" value={show} />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search title or notes"
              style={{
                flex: "1 1 260px",
                padding: "12px 12px",
                borderRadius: 6,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "#0c0e12",
                color: THEME.textSilver,
                outline: "none",
              }}
            />
            <button
              type="submit"
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${THEME.stoneBorder}`,
                background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
                color: "#111",
                cursor: "pointer",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                boxShadow: `0 0 18px rgba(242, 153, 74, 0.25)`,
                whiteSpace: "nowrap",
              }}
            >
              Search
            </button>

            {q ? (
              <a
                href={buildUrl("/sessions", { guildId, show })}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "rgba(12,14,18,0.6)",
                  color: THEME.textSilver,
                  textDecoration: "none",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Clear
              </a>
            ) : null}
          </form>
        </StoneSection>

        <div style={{ display: "grid", gap: 28, marginTop: 24 }}>
          {show !== "past" ? (
            <StoneSection title="Upcoming Sessions" subtitle={`${listUpcoming.length} scheduled runs. Bind your RSVP in Discord.`}>
              {!listUpcoming.length ? (
                <div style={{ color: THEME.textAsh, fontWeight: 900, textAlign: "center", padding: 30 }}>Nothing here yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {listUpcoming.map((s) => (
                    <SessionCard key={s.id} s={s} guildId={guildId} />
                  ))}
                </div>
              )}
            </StoneSection>
          ) : null}

          {show !== "upcoming" ? (
            <StoneSection title="Past Sessions" subtitle={`${listPast.length} completed runs. Records etched in stone.`}>
              {!listPast.length ? (
                <div style={{ color: THEME.textAsh, fontWeight: 900, textAlign: "center", padding: 30 }}>Nothing here yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {listPast.map((s) => (
                    <SessionCard key={s.id} s={s} guildId={guildId} />
                  ))}
                </div>
              )}
            </StoneSection>
          ) : null}
        </div>

        <footer
          style={{
            marginTop: 64,
            textAlign: "center",
            color: THEME.textAsh,
            fontSize: "0.8rem",
            borderTop: `1px solid ${THEME.stoneBorder}`,
            paddingTop: 18,
            letterSpacing: 1,
          }}
        >
          Connected to the Ancient Flame • Hub Protocol 1.4.2
        </footer>
      </div>
    </div>
  );
}
