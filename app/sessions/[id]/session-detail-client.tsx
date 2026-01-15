"use client";

import React, { useState } from "react";

type BadgeParts = { combat: string; logistics: string };

type RsvpItem = {
  discordUserId: string;
  username: string;
  badges: BadgeParts;
};

type DetailResponse = {
  session: {
    id: string;
    title: string;
    startLocal: string;
    durationMinutes: number;
    notes: string;
    guildId: string;
    discordChannelId: string | null;
    discordMessageId: string | null;
    createdAt: string;
  };
  counts: { in: number; maybe: number; out: number };
  rosters: { in: RsvpItem[]; maybe: RsvpItem[]; out: RsvpItem[] };
} | null;

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
  dangerBg: "#2a0b0b",
  dangerBorder: "#7f1d1d",
  dangerText: "#fca5a5",
};

function fmtWhen(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return startLocal || "Unknown time";
  return new Date(ms).toLocaleString();
}

function discordMessageUrl(guildId: string, channelId: string | null, messageId: string | null) {
  if (!guildId || !channelId || !messageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

function hasMissingCombat(u: RsvpItem) {
  const v = String(u.badges?.combat || "").trim();
  return !v || v === "❔";
}

function hasMissingLogistics(u: RsvpItem) {
  const v = String(u.badges?.logistics || "").trim();
  return !v || v === "❔";
}

function coverageSummary(items: RsvpItem[]) {
  const counts = new Map<string, number>();
  for (const u of items) {
    const icon = String(u.badges?.logistics || "").trim();
    if (!icon || icon === "❔") continue;
    counts.set(icon, (counts.get(icon) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

async function copyText(text: string) {
  const t = String(text || "");
  if (!t) return false;

  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      // fall through
    }
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return Boolean(ok);
  } catch {
    return false;
  }
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
        fontWeight: 950,
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
        background: props.primary
          ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`
          : "rgba(12,14,18,0.6)",
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

function StoneSection(props: { title: string; subtitle: string; right?: React.ReactNode; children: React.ReactNode }) {
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

function TopBar() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #0b0d11)`,
        borderBottom: `1px solid ${THEME.stoneBorder}`,
        boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          maxWidth: 1020,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <a href="/sessions" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: THEME.flameAmber,
              boxShadow: `0 0 14px rgba(242, 153, 74, 0.5)`,
            }}
          />
          <div style={{ display: "grid", lineHeight: 1.05 }}>
            <div
              style={{
                color: "#fff",
                fontWeight: 950,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                fontSize: 12,
              }}
            >
              Ember Hub
            </div>
            <div style={{ color: THEME.textAsh, fontSize: 12 }}>Session detail</div>
          </div>
        </a>

        <a
          href="/roles"
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
          }}
        >
          Set roles
        </a>
      </div>

      <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${THEME.flameAmber}, transparent)` }} />
    </div>
  );
}

function ShroudFog() {
  const blobStyleBase: React.CSSProperties = {
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
    maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
    WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
  };

  return (
    <div aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none", overflow: "hidden" }}>
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
          background: `radial-gradient(ellipse at bottom, ${THEME.shroudMist} 0%, #1a2430cc 40%, transparent 80%)`,
          filter: "blur(12px)",
          opacity: 0.95,
          maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(to top, ${THEME.shroudMist} 0%, #1a2430ee 45%, transparent 100%)`,
          opacity: 0.35,
          maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
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

function rosterSortKey(u: RsvpItem) {
  const miss = (hasMissingCombat(u) ? 1 : 0) + (hasMissingLogistics(u) ? 1 : 0);
  const combat = String(u.badges?.combat || "❔");
  const logi = String(u.badges?.logistics || "❔");
  const name = String(u.username || u.discordUserId || "");
  return { miss: miss ? 0 : 1, combat, logi, name };
}

function RosterRow(props: { u: RsvpItem; showIds: boolean }) {
  const u = props.u;

  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  async function onCopy() {
    setFallback(false);
    const ok = await copyText(u.discordUserId);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1100);
    } else {
      setFallback(true);
    }
  }

  return (
    <div
      style={{
        border: `1px solid ${THEME.stoneBorder}`,
        background: "#0c0e12",
        borderRadius: 6,
        padding: 12,
        display: "flex",
        alignItems: "center",
        gap: 12,
        boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
      }}
    >
      <div style={{ width: 62, display: "flex", gap: 8, justifyContent: "flex-start", fontSize: 16 }}>
        <span title="Combat">{u.badges?.combat || "❔"}</span>
        <span title="Logistics">{u.badges?.logistics || "❔"}</span>
      </div>

      <div style={{ minWidth: 0, display: "grid", gap: 2 }}>
        <div style={{ fontWeight: 950, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {u.username || u.discordUserId}
        </div>

        {props.showIds ? (
          <div style={{ color: THEME.textAsh, fontSize: 12 }}>{u.discordUserId}</div>
        ) : fallback ? (
          <div style={{ color: "rgba(255,196,90,0.9)", fontSize: 12 }}>Copy blocked. ID: {u.discordUserId}</div>
        ) : (
          <div style={{ color: THEME.textAsh, fontSize: 12 }}>ID hidden</div>
        )}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
        {hasMissingCombat(u) ? <MiniPill tone="warn">Missing combat</MiniPill> : null}
        {hasMissingLogistics(u) ? <MiniPill tone="warn">Missing logistics</MiniPill> : null}

        <button
          type="button"
          onClick={onCopy}
          style={{
            padding: "8px 10px",
            borderRadius: 999,
            border: `1px solid ${THEME.stoneBorder}`,
            background: copied ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})` : "rgba(12,14,18,0.6)",
            color: copied ? "#111" : THEME.textSilver,
            cursor: "pointer",
            fontWeight: 950,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontSize: 12,
            whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied" : "Copy ID"}
        </button>
      </div>
    </div>
  );
}

function RosterList(props: { items: RsvpItem[]; showIds: boolean }) {
  const items = props.items || [];
  if (!items.length) return <div style={{ color: THEME.textAsh, fontWeight: 900, textAlign: "center", padding: 20 }}>—</div>;

  const sorted = [...items].sort((a, b) => {
    const A = rosterSortKey(a);
    const B = rosterSortKey(b);

    if (A.miss !== B.miss) return A.miss - B.miss;
    if (A.combat !== B.combat) return A.combat.localeCompare(B.combat);
    if (A.logi !== B.logi) return A.logi.localeCompare(B.logi);
    return A.name.localeCompare(B.name);
  });

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {sorted.map((u) => (
        <RosterRow key={u.discordUserId} u={u} showIds={props.showIds} />
      ))}
    </div>
  );
}

export default function SessionDetailClient(props: { data: DetailResponse }) {
  const data = props.data;
  const [showIds, setShowIds] = useState(false);

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(circle, ${THEME.shroudMist} 0%, ${THEME.shroudDeep} 78%, #000 100%)`,
          color: THEME.textSilver,
          padding: "110px 20px 60px 20px",
          fontFamily: "'Segoe UI', Roboto, serif",
          position: "relative",
        }}
      >
        <TopBar />
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
          <div
            style={{
              background: THEME.dangerBg,
              border: `1px solid ${THEME.dangerBorder}`,
              color: THEME.dangerText,
              padding: 12,
              borderRadius: 6,
              fontWeight: 950,
              marginBottom: 18,
            }}
          >
            Session not found
          </div>

          <ActionLink href="/sessions">Back</ActionLink>
        </div>
      </div>
    );
  }

  const s = data.session;
  const discordUrl = discordMessageUrl(s.guildId, s.discordChannelId, s.discordMessageId);

  const inRoster = data.rosters.in || [];
  const missingCombat = inRoster.filter(hasMissingCombat).length;
  const missingLogistics = inRoster.filter(hasMissingLogistics).length;
  const coverage = coverageSummary(inRoster);

  async function copyAllRosterIds(items: RsvpItem[]) {
    const ids = (items || []).map((u) => u.discordUserId).filter(Boolean);
    const text = ids.join("\n");
    await copyText(text);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(circle, ${THEME.shroudMist} 0%, ${THEME.shroudDeep} 78%, #000 100%)`,
        color: THEME.textSilver,
        padding: "110px 20px 60px 20px",
        fontFamily: "'Segoe UI', Roboto, serif",
        position: "relative",
      }}
    >
      <TopBar />
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
        <header style={{ textAlign: "center", marginBottom: 30 }}>
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
            Session Record
          </div>

          <h1
            style={{
              fontSize: "2.6rem",
              margin: 0,
              color: "#fff",
              textShadow: `0 0 20px rgba(242, 153, 74, 0.55)`,
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            {s.title}
          </h1>

          <div style={{ width: 120, height: 2, background: THEME.flameAmber, margin: "18px auto 0 auto" }} />
        </header>

        <StoneSection
          title="Session Details"
          subtitle={`${fmtWhen(s.startLocal)} • ${s.durationMinutes} minutes`}
          right={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
              <MiniPill tone="good">✅ In: {data.counts.in}</MiniPill>
              <MiniPill tone="warn">❔ Maybe: {data.counts.maybe}</MiniPill>
              <MiniPill tone="bad">❌ Out: {data.counts.out}</MiniPill>
            </div>
          }
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {discordUrl ? (
              <ActionLink href={discordUrl} newTab primary>
                Open in Discord
              </ActionLink>
            ) : (
              <span style={{ color: THEME.textAsh, fontWeight: 900 }}>No Discord link saved</span>
            )}

            <ActionLink href="/sessions">Back</ActionLink>

            <button
              type="button"
              onClick={() => setShowIds((v) => !v)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(12,14,18,0.6)",
                color: THEME.textSilver,
                cursor: "pointer",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                whiteSpace: "nowrap",
              }}
            >
              {showIds ? "Hide IDs" : "Show IDs"}
            </button>
          </div>

          {missingCombat || missingLogistics ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {missingCombat ? <MiniPill tone="warn">{missingCombat} missing combat</MiniPill> : null}
              {missingLogistics ? <MiniPill tone="warn">{missingLogistics} missing logistics</MiniPill> : null}
              <MiniPill>Fix this in Set roles</MiniPill>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <MiniPill tone="good">All In badges complete</MiniPill>
            </div>
          )}

          {s.notes ? (
            <div
              style={{
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(0,0,0,0.35)",
                borderRadius: 6,
                padding: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontWeight: 950,
                  color: THEME.flameGold,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  marginBottom: 8,
                }}
              >
                Notes
              </div>
              <div style={{ color: "rgba(209,213,219,0.92)" }}>{s.notes}</div>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 950, color: THEME.flameGold, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
              Logistics coverage (In)
            </div>

            {coverage.length ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {coverage.map(([icon, n]) => (
                  <MiniPill key={`${icon}:${n}`}>
                    <span style={{ fontSize: 14 }}>{icon}</span>
                    <span style={{ opacity: 0.9 }}>{n}</span>
                  </MiniPill>
                ))}
              </div>
            ) : (
              <MiniPill tone="warn">No logistics selected yet</MiniPill>
            )}
          </div>
        </StoneSection>

        <div style={{ marginTop: 24, display: "grid", gap: 18 }}>
          <StoneSection
            title="In"
            subtitle="Bound to the run."
            right={
              <button
                type="button"
                onClick={() => copyAllRosterIds(data.rosters.in)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "rgba(12,14,18,0.6)",
                  color: THEME.textSilver,
                  cursor: "pointer",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Copy all IDs
              </button>
            }
          >
            <RosterList items={data.rosters.in} showIds={showIds} />
          </StoneSection>

          <StoneSection
            title="Maybe"
            subtitle="The Flame wavers."
            right={
              <button
                type="button"
                onClick={() => copyAllRosterIds(data.rosters.maybe)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "rgba(12,14,18,0.6)",
                  color: THEME.textSilver,
                  cursor: "pointer",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Copy all IDs
              </button>
            }
          >
            <RosterList items={data.rosters.maybe} showIds={showIds} />
          </StoneSection>

          <StoneSection
            title="Out"
            subtitle="Absent from the altar."
            right={
              <button
                type="button"
                onClick={() => copyAllRosterIds(data.rosters.out)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "rgba(12,14,18,0.6)",
                  color: THEME.textSilver,
                  cursor: "pointer",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                }}
              >
                Copy all IDs
              </button>
            }
          >
            <RosterList items={data.rosters.out} showIds={showIds} />
          </StoneSection>
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
