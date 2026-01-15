import type { CSSProperties } from "react";
import { headers } from "next/headers";

import AuthButton from "@/app/components/AuthButton";
import SyncRolesButton from "@/app/components/SyncRolesButton";
import OfficerOnly from "@/app/components/OfficerOnly";
import TopBar from "@/app/components/TopBar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Flameborn palette
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

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

function getGuildId(sp: Record<string, string | string[] | undefined>) {
  const raw = Array.isArray(sp.guildId) ? sp.guildId[0] : sp.guildId;
  const fromUrl = String(raw || "").trim();
  if (fromUrl && isSnowflake(fromUrl)) return fromUrl;

  const fromEnv = String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || process.env.DISCORD_GUILD_ID || "").trim();
  if (fromEnv && isSnowflake(fromEnv)) return fromEnv;

  return "";
}

function fmtWhen(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return startLocal || "Unknown time";
  return new Date(ms).toLocaleString();
}

type SessionItem = {
  id: string;
  title: string;
  startLocal: string;
  durationMinutes: number;
  upcoming: boolean;
};

async function getOriginFromRequestHeaders() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore
  }
  return "";
}

async function getCookieHeader() {
  try {
    const h = await headers();
    return String(h.get("cookie") || "");
  } catch {
    return "";
  }
}

async function getNextUpcomingSession(guildId: string) {
  if (!guildId) return null;

  const origin = await getOriginFromRequestHeaders();
  const base = origin || (process.env.NEXT_PUBLIC_BASE_URL ? String(process.env.NEXT_PUBLIC_BASE_URL) : "");
  const url = base
    ? `${base}/api/sessions/list?guildId=${encodeURIComponent(guildId)}&limit=50`
    : `/api/sessions/list?guildId=${encodeURIComponent(guildId)}&limit=50`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  const json = (await res.json()) as { sessions?: any[] };
  const sessions = Array.isArray(json.sessions) ? json.sessions : [];

  const upcoming = sessions
    .map((s) => ({
      id: String(s?.id || ""),
      title: String(s?.title || ""),
      startLocal: String(s?.startLocal || ""),
      durationMinutes: Number(s?.durationMinutes || 0),
      upcoming: Boolean(s?.upcoming),
    }))
    .filter((s) => s.id && s.upcoming);

  if (!upcoming.length) return null;

  upcoming.sort((a, b) => {
    const am = Date.parse(a.startLocal);
    const bm = Date.parse(b.startLocal);
    return (Number.isFinite(am) ? am : 0) - (Number.isFinite(bm) ? bm : 0);
  });

  return upcoming[0] as SessionItem;
}

async function getRoleSelectionStatus(guildId: string) {
  if (!guildId) return { combat: false, logistics: false };

  const origin = await getOriginFromRequestHeaders();
  const cookie = await getCookieHeader();

  const base = origin || (process.env.NEXT_PUBLIC_BASE_URL ? String(process.env.NEXT_PUBLIC_BASE_URL) : "");
  const url = base
    ? `${base}/api/me/selected-roles?guildId=${encodeURIComponent(guildId)}`
    : `/api/me/selected-roles?guildId=${encodeURIComponent(guildId)}`;

  // IMPORTANT: forward cookies so the API can identify the logged-in user
  const res = await fetch(url, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });

  if (!res.ok) return { combat: false, logistics: false };

  const json = (await res.json()) as { combatRoleId?: string | null; logisticsRoleId?: string | null };

  return {
    combat: Boolean(String(json?.combatRoleId || "").trim()),
    logistics: Boolean(String(json?.logisticsRoleId || "").trim()),
  };
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

function StoneCard(props: { children: React.ReactNode; active?: boolean }) {
  return (
    <div
      style={{
        background: props.active ? `linear-gradient(180deg, ${THEME.stoneCard}, #0f1218)` : "rgba(0,0,0,0.30)",
        border: `2px solid ${THEME.stoneBorder}`,
        borderRadius: 6,
        padding: 20,
        boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0, borderRadius: 6, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>{props.children}</div>
    </div>
  );
}

function Pill(props: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${THEME.stoneBorder}`,
        background: props.active ? "rgba(242,153,74,0.12)" : "rgba(0,0,0,0.35)",
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

export default async function DashboardPage(props: {
  searchParams?: Record<string, string | string[] | undefined> | Promise<Record<string, string | string[] | undefined>>;
}) {
  let sp: Record<string, string | string[] | undefined> = {};
  const spRaw = props.searchParams as any;

  if (spRaw && typeof spRaw.then === "function") sp = (await spRaw) as any;
  else sp = (spRaw || {}) as any;

  const guildId = getGuildId(sp);

  const nextSession = await getNextUpcomingSession(guildId);
  const roles = await getRoleSelectionStatus(guildId);
  const rolesConfigured = roles.combat || roles.logistics;

  const rolesUrl = `/roles?guildId=${encodeURIComponent(guildId)}`;
  const sessionsUrl = `/sessions?guildId=${encodeURIComponent(guildId)}`;
  const dashboardUrl = `/dashboard?guildId=${encodeURIComponent(guildId)}`;

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: THEME.shroudDeep,
        background: `radial-gradient(circle, ${THEME.shroudMist} 0%, ${THEME.shroudDeep} 78%, #000 100%)`,
        color: THEME.textSilver,
        padding: "110px 20px 70px 20px",
        fontFamily: "'Segoe UI', Roboto, serif",
        position: "relative",
      }}
    >
      <TopBar
        subtitle="Command console"
        guildId={guildId}
        current="dashboard"
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "end" }}>
            <SyncRolesButton />
            <AuthButton />
          </div>
        }
      />

      <ShroudFog />

      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          background: "radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)",
          zIndex: 0,
        }}
      />

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <StoneCard active>
          <div
            style={{
              display: "flex",
              alignItems: "end",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              borderBottom: `1px solid ${THEME.stoneBorder}`,
              paddingBottom: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ color: THEME.flameGold, textTransform: "uppercase", letterSpacing: 3, fontSize: 12, fontWeight: 950 }}>
                Dashboard
              </div>
              <div style={{ marginTop: 8, fontSize: "2rem", fontWeight: 950, letterSpacing: 0.4, color: "#fff" }}>
                Flameborn Command Console
              </div>
              <div style={{ marginTop: 8, maxWidth: 760, color: THEME.textAsh, fontSize: 14, lineHeight: 1.45 }}>
                Manage your guild state, upcoming activity, and access core tools.
              </div>
            </div>
          </div>

          <OfficerOnly>
            <div
              style={{
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(242,153,74,0.08)",
                borderRadius: 6,
                padding: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 0.5, textTransform: "uppercase", fontSize: 12 }}>
                  Officer tools
                </div>
                <div style={{ marginTop: 4, color: THEME.textAsh, fontSize: 12 }}>Visible only to officers or the server owner.</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
                <a
                  href={sessionsUrl}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${THEME.stoneBorder}`,
                    background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
                    color: "#111",
                    textDecoration: "none",
                    fontWeight: 950,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontSize: 12,
                    boxShadow: `0 0 18px rgba(242, 153, 74, 0.25)`,
                    whiteSpace: "nowrap",
                  }}
                >
                  Post session
                </a>
              </div>
            </div>
          </OfficerOnly>
        </StoneCard>

        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {/* Next Session */}
          <StoneCard active>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>Next Session</div>

                {nextSession ? (
                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 950, color: THEME.textSilver }}>{nextSession.title || "Untitled"}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Pill active>🕒 {fmtWhen(nextSession.startLocal)}</Pill>
                      <Pill active>⏱ {Number(nextSession.durationMinutes || 0)} min</Pill>
                      <Pill active>🔥 Scheduled</Pill>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 10, color: THEME.textAsh, fontWeight: 900 }}>No session currently scheduled.</div>
                )}
              </div>

              <a
                href={sessionsUrl}
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
                {nextSession ? "Manage sessions" : "Create session"}
              </a>
            </div>

            <div style={{ marginTop: 12, color: THEME.textAsh, fontSize: 12, fontWeight: 900 }}>RSVP flow handled via Discord</div>
          </StoneCard>

          {/* Roles */}
          <StoneCard active>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>Hub Roles</div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill active>{roles.combat ? "✅ Combat set" : "⚠️ Combat not set"}</Pill>
                  <Pill active>{roles.logistics ? "✅ Logistics set" : "⚠️ Logistics not set"}</Pill>
                  <Pill active>{rolesConfigured ? "🔥 Configured" : "🪨 Incomplete"}</Pill>
                </div>

                <div style={{ marginTop: 10, color: THEME.textAsh, fontSize: 12, fontWeight: 900, maxWidth: 760 }}>
                  These badges display in RSVP rosters and on the hub experience once you enable more modules.
                </div>
              </div>

              <a
                href={rolesUrl}
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
                Edit roles
              </a>
            </div>
          </StoneCard>

          {/* Status */}
          <StoneCard>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase" }}>Hub Status</div>

                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>🟢 Online</Pill>
                  <Pill>Role sync available</Pill>
                  <Pill>More modules soon</Pill>
                </div>

                <div style={{ marginTop: 10, color: THEME.textAsh, fontSize: 12, fontWeight: 900 }}>
                  System nominal. Patch tracking and members will come later.
                </div>
              </div>

              <a
                href={dashboardUrl}
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
                Refresh
              </a>
            </div>
          </StoneCard>
        </div>

        <div
          style={{
            marginTop: 18,
            border: `1px solid ${THEME.stoneBorder}`,
            borderRadius: 6,
            padding: 12,
            background: "rgba(0,0,0,0.20)",
            color: THEME.textAsh,
            fontSize: 12,
            fontWeight: 900,
            textAlign: "center",
          }}
        >
          This hub is designed to grow without rewriting core systems.
        </div>
      </div>
    </div>
  );
}
