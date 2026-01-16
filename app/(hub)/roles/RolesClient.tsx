"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";

// --- Types ---
type RoleMeta = {
  role_id: string;
  role_kind: "combat" | "logistics";
  group_key: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  updated_at: string;
};

type SelectedRolesResp = {
  ok: boolean;
  guildId: string;
  combatRoleId: string | null;
  logisticsRoleId: string | null;
  error?: string;
};

type RoleMetaResp = {
  ok: boolean;
  guildId: string;
  roles: RoleMeta[];
  error?: string;
};

type IsOfficerResp = {
  ok: boolean;
  guildId: string;
  isOfficer: boolean;
  error?: string;
};

// Source of truth is ?guildId= then NEXT_PUBLIC_DISCORD_GUILD_ID.
// No hardcoded fallback in hub pages (it hides config bugs).
const DEFAULT_GUILD_ID = "";


// --- Enshrouded Theme Palette ---
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

// --- Helpers ---
function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function getGuildIdFromUrlEnvOrFallback() {
  if (typeof window === "undefined") return "";

  // 1) URL param
  try {
    const url = new URL(window.location.href);
    const raw = String(url.searchParams.get("guildId") || "").trim();
    if (raw && isSnowflake(raw)) return raw;
  } catch {
    // ignore
  }

  // 2) env fallback (client exposed only)
  const env = String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim();
  if (env && isSnowflake(env)) return env;

  // 3) no fallback in hub pages
  return "";
}


// Preserves any existing query in `path` and merges/overwrites with params
function buildUrl(path: string, params: Record<string, string | undefined | null>) {
  const base = new URL(path, "http://local");
  for (const [k, v] of Object.entries(params)) {
    const val = String(v || "").trim();
    if (val) base.searchParams.set(k, val);
  }
  const outPath = base.pathname;
  const qs = base.searchParams.toString();
  return qs ? `${outPath}?${qs}` : outPath;
}

function normalizeGroupKey(groupKey: string) {
  let g = String(groupKey || "").toLowerCase().trim();
  if (g.startsWith("logistics_")) g = g.slice("logistics_".length);
  return g;
}

function roleIcon(role: Pick<RoleMeta, "role_kind" | "group_key">) {
  const g = normalizeGroupKey(role.group_key);
  if (role.role_kind === "combat") {
    if (g === "strength") return "🛡️";
    if (g === "intelligence") return "🧙";
    if (g === "dexterity") return "🏹";
    return "⚔️";
  }
  if (g === "architect") return "🏗️";
  if (g === "agronomist") return "🌾";
  if (g === "quartermaster") return "📦";
  if (g === "provisioner") return "🍲";
  if (g === "excavator") return "⛏️";
  return "🧰";
}

function friendlyErrorMessage(message: unknown) {
  const text = String(message || "").trim();
  if (!text) return "";
  if (/^unauthorized/i.test(text)) {
    return "You need to sign in to access this page. Go to the Dashboard to sign in.";
  }
  return text;
}

// --- Top Bar ---
function TopBar(props: { discordName: string | null; level: number; guildId: string; isOfficer: boolean }) {
  const tierLabel = props.level === 2 ? "Flameborn" : props.level === 1 ? "Kindled" : "Unbound";
  const tierGlow = props.level === 2 ? THEME.flameGold : THEME.flameAmber;

  const dashboardHref = buildUrl("/dashboard", { guildId: props.guildId });
  const rolesHref = buildUrl("/roles", { guildId: props.guildId });
  const sessionsHref = buildUrl("/sessions", { guildId: props.guildId });
  const manageRolesHref = buildUrl("/roles/manage", { guildId: props.guildId });
  const setupHref = "/setup";


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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              <div style={{ color: THEME.textAsh, fontSize: 12 }}>Flameborn registry</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={dashboardHref}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(12,14,18,0.6)",
                color: THEME.textSilver,
                textDecoration: "none",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                backdropFilter: "blur(6px)",
                whiteSpace: "nowrap",
              }}
            >
              Dashboard
            </a>

            <a
              href={rolesHref}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
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
              title="You are here"
            >
              Roles
            </a>
            <a
  href={setupHref}
  style={{
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${THEME.stoneBorder}`,
    background: "rgba(12,14,18,0.6)",
    color: THEME.textSilver,
    textDecoration: "none",
    fontWeight: 950,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 12,
    backdropFilter: "blur(6px)",
    whiteSpace: "nowrap",
  }}
>
  Setup
</a>


            <a
              href={sessionsHref}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(12,14,18,0.6)",
                color: THEME.textSilver,
                textDecoration: "none",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                backdropFilter: "blur(6px)",
                whiteSpace: "nowrap",
              }}
            >
              Sessions
            </a>

            {props.isOfficer ? (
              <a
                href={manageRolesHref}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "rgba(12,14,18,0.6)",
                  color: THEME.textSilver,
                  textDecoration: "none",
                  fontWeight: 950,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  fontSize: 12,
                  backdropFilter: "blur(6px)",
                  whiteSpace: "nowrap",
                }}
                title="Officer only"
              >
                Manage
              </a>
            ) : null}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${THEME.stoneBorder}`,
              background: "rgba(12,14,18,0.6)",
              backdropFilter: "blur(6px)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: `linear-gradient(180deg, ${THEME.stoneEdge}, #0b0d11)`,
                border: `1px solid ${THEME.stoneBorder}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
              }}
              aria-hidden="true"
            >
              👤
            </div>

            <div style={{ display: "grid", lineHeight: 1.05 }}>
              <div
                style={{
                  color: THEME.textAsh,
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Discord
              </div>
              <div style={{ color: THEME.textSilver, fontWeight: 900, fontSize: 13 }}>
                {props.discordName || "Signed in"}
              </div>
            </div>

            <div
              style={{
                marginLeft: 6,
                padding: "4px 8px",
                borderRadius: 999,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(0,0,0,0.35)",
                color: THEME.textSilver,
                fontSize: 11,
                fontWeight: 950,
                letterSpacing: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
              title="Account attunement tier"
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: tierGlow,
                  boxShadow: `0 0 12px rgba(242, 153, 74, 0.4)`,
                  display: "inline-block",
                }}
              />
              {tierLabel}
            </div>
          </div>

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${THEME.stoneBorder}`,
              background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
              color: "#111",
              cursor: "pointer",
              fontWeight: 950,
              letterSpacing: 1,
              boxShadow: `0 0 18px rgba(242, 153, 74, 0.25)`,
              textTransform: "uppercase",
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${THEME.flameAmber}, transparent)`,
        }}
      />
    </div>
  );
}

// --- Fog System (Volumetric Shroud) ---
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
          0% {
            transform: translateY(100%) scale(1) rotate(0deg);
            opacity: 0;
          }
          10% { opacity: 0.8; }
          50% { transform: translateY(15%) scale(1.5) rotate(3deg); }
          90% { opacity: 0.1; }
          100% {
            transform: translateY(-130%) scale(2) rotate(-3deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

// --- Toast (Level 2) ---
function Toast(props: { show: boolean; title: string; message: string; onClose: () => void }) {
  if (!props.show) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 80,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        border: `1px solid ${THEME.stoneBorder}`,
        borderRadius: 8,
        background: "rgba(12,14,18,0.98)",
        color: THEME.textSilver,
        boxShadow: "0 18px 70px rgba(0,0,0,0.55)",
        padding: 14,
        display: "grid",
        gap: 10,
        backdropFilter: "blur(6px)",
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <div style={{ fontWeight: 950, color: THEME.flameGold, letterSpacing: 1 }}>{props.title}</div>
          <div style={{ fontSize: 13, color: "rgba(209,213,219,0.85)" }}>{props.message}</div>
        </div>

        <button
          type="button"
          onClick={props.onClose}
          style={{
            border: `1px solid ${THEME.stoneBorder}`,
            background: "transparent",
            color: THEME.textSilver,
            borderRadius: 6,
            padding: "4px 8px",
            cursor: "pointer",
            fontWeight: 950,
          }}
        >
          ✕
        </button>
      </div>

      <div
        style={{
          height: 7,
          borderRadius: 999,
          background: "rgba(255,255,255,0.10)",
          overflow: "hidden",
          border: `1px solid ${THEME.stoneBorder}`,
          boxShadow: "inset 0 0 10px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
            boxShadow: `0 0 18px ${THEME.flameAmber}`,
            animation: "toastbar 3.2s linear forwards",
            transformOrigin: "left",
          }}
        />
      </div>

      <style>{`
        @keyframes toastbar {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}

// --- Flame Progress (pulse on change) ---
function FlameProgress({ level, pulse }: { level: number; pulse: boolean }) {
  const titles = ["Unbound", "Kindled", "Flameborn"];
  const progress = (level / 2) * 100;

  return (
    <div style={{ maxWidth: 520, margin: "0 auto 42px auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: THEME.flameGold,
          fontSize: 12,
          letterSpacing: 2,
          fontWeight: 950,
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        <span>Strength of the Flame</span>
        <span>
          {titles[level]} · Tier {level}
        </span>
      </div>

      <div
        style={{
          height: 10,
          background: "#000",
          borderRadius: 999,
          border: `1px solid ${THEME.stoneBorder}`,
          overflow: "hidden",
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.85)",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
            boxShadow: `0 0 18px ${THEME.flameAmber}`,
            transition: "width 0.8s ease-out",
            animation: pulse ? "barpulse 650ms ease-out" : "none",
          }}
        />
      </div>

      <style>{`
        @keyframes barpulse {
          0% { filter: brightness(1); }
          40% { filter: brightness(1.35); }
          100% { filter: brightness(1); }
        }
      `}</style>
    </div>
  );
}

// --- Stone altar section ---
function StoneSection(props: { title: string; subtitle: string; children: React.ReactNode; locked?: boolean }) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
        border: `2px solid ${THEME.stoneBorder}`,
        borderRadius: 6,
        padding: 24,
        boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
        opacity: props.locked ? 0.6 : 1,
        transition: "opacity 0.3s ease",
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

      <div style={{ borderBottom: `1px solid ${THEME.stoneBorder}`, paddingBottom: 12, marginBottom: 18 }}>
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

      {props.children}
    </div>
  );
}

// --- Rune card ---
function RuneCard(props: {
  role: RoleMeta;
  selected: boolean;
  disabled?: boolean;
  saving?: boolean;
  onClick?: () => void;
}) {
  const { role, selected, disabled, saving, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        height: "100%",
        textAlign: "left",
        background: selected ? "rgba(242, 153, 74, 0.06)" : "#0c0e12",
        border: `1px solid ${selected ? THEME.flameAmber : THEME.stoneBorder}`,
        borderRadius: 4,
        padding: 16,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 16,
        transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
        boxShadow: selected ? `inset 0 0 12px rgba(242, 153, 74, 0.25)` : "none",
        opacity: disabled ? 0.6 : 1,
        transform: "translateY(0px)",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = THEME.flameAmber;
        e.currentTarget.style.boxShadow =
          "0 0 18px rgba(242, 153, 74, 0.22), inset 0 0 12px rgba(242, 153, 74, 0.18)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0px)";
        e.currentTarget.style.borderColor = selected ? THEME.flameAmber : THEME.stoneBorder;
        e.currentTarget.style.boxShadow = selected ? "inset 0 0 12px rgba(242, 153, 74, 0.25)" : "none";
      }}
    >
      <div
        style={{
          fontSize: 24,
          width: 48,
          height: 48,
          flex: "0 0 48px",
          background: `linear-gradient(180deg, ${THEME.stoneCard}, #101318)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${selected ? THEME.flameAmber : THEME.stoneBorder}`,
          boxShadow: selected ? `0 0 12px ${THEME.flameAmber}` : "inset 0 0 0 1px rgba(0,0,0,0.6)",
        }}
      >
        {roleIcon(role)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 950, color: selected ? THEME.flameAmber : THEME.textSilver, letterSpacing: 1 }}>
          {saving ? "Binding..." : role.display_name.toUpperCase()}
        </div>

        <div
          style={{
            fontSize: "0.78rem",
            color: THEME.textAsh,
            marginTop: 3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            lineHeight: "1.15rem",
            maxHeight: "2.3rem",
          }}
        >
          {role.description || "A path revealed in the Flame."}
        </div>
      </div>

      {selected ? (
        <div
          style={{
            color: "#111",
            background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
            borderRadius: 999,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 1,
            boxShadow: `0 0 14px rgba(242, 153, 74, 0.35)`,
            flex: "0 0 auto",
          }}
        >
          SELECTED
        </div>
      ) : null}
    </button>
  );
}

// --- Main Page ---
export default function RolesClient(props: { guildId: string; theme: any }) {
  const { guildId, theme: THEME } = props;


  const [loading, setLoading] = useState(true);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleMeta[]>([]);
  const [combatRoleId, setCombatRoleId] = useState<string | null>(null);
  const [logisticsRoleId, setLogisticsRoleId] = useState<string | null>(null);

  const [isOfficer, setIsOfficer] = useState(false);
  const [discordName, setDiscordName] = useState<string | null>(null);

  const prevLevelRef = useRef(0);
  const [barPulse, setBarPulse] = useState(false);

  const [toast, setToast] = useState<{ show: boolean; title: string; message: string }>({
    show: false,
    title: "",
    message: "",
  });
  const toastTimerRef = useRef<any>(null);

  function showToast(title: string, message: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ show: true, title, message });
    toastTimerRef.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3200);
  }

  const combatRoles = useMemo(() => roles.filter((r) => r.role_kind === "combat" && r.enabled), [roles]);
  const logisticsRoles = useMemo(() => roles.filter((r) => r.role_kind === "logistics" && r.enabled), [roles]);

  const peasantDutyRole = useMemo(
    () => ({
      role_id: "__peasant__",
      role_kind: "logistics",
      group_key: "peasant",
      display_name: "The Peasant",
      description: "Carries stones. Dreams of promotion. Promotion never comes.",
      enabled: true,
      updated_at: "",

    }),
    []
  );

  const combatSelected = combatRoles.find((r) => r.role_id === combatRoleId) || null;
  const logiSelected = logisticsRoles.find((r) => r.role_id === logisticsRoleId) || null;

  const currentLevel = (combatSelected ? 1 : 0) + (logiSelected ? 1 : 0);
  const logisticsLocked = !combatRoleId;

  async function loadAll() {
    setLoading(true);
    setError(null);
    if (!guildId) {
  setError("Missing guildId. Open the hub with ?guildId=YOUR_GUILD_ID or set NEXT_PUBLIC_DISCORD_GUILD_ID.");
  setLoading(false);
  return;
}


    try {
      const [metaRes, selectedRes, officerRes, sessionRes] = await Promise.all([
  fetch(`/api/guild/role-meta?guildId=${encodeURIComponent(guildId)}`, {
    cache: "no-store",
  }),

  fetch(`/api/me/selected-roles?guildId=${encodeURIComponent(guildId)}`, {
    cache: "no-store",
    credentials: "include",
  }),

  fetch(`/api/me/is-officer?guildId=${encodeURIComponent(guildId)}`, {
    cache: "no-store",
    credentials: "include",
  }),

  fetch(`/api/auth/session`, {
    cache: "no-store",
  }),
]);


      const metaJson = (await metaRes.json().catch(() => null)) as RoleMetaResp | null;
      const selectedJson = (await selectedRes.json().catch(() => null)) as SelectedRolesResp | null;
      const officerJson = (await officerRes.json().catch(() => null)) as IsOfficerResp | null;
      const sessionJson = await sessionRes.json().catch(() => null);

      if (!metaRes.ok) throw new Error(metaJson?.error || "The Shroud obscures your path. (Role load failed)");
      if (!selectedRes.ok) throw new Error(selectedJson?.error || "The Flame flickers. (Selection load failed)");

      setRoles(metaJson?.roles || []);
      setCombatRoleId(selectedJson?.combatRoleId ?? null);
      setLogisticsRoleId(selectedJson?.logisticsRoleId ?? null);

      setIsOfficer(Boolean(officerJson?.isOfficer));

      const name =
        String(sessionJson?.user?.name || "").trim() ||
        String(sessionJson?.user?.discord_username || "").trim() ||
        String(sessionJson?.user?.discordUsername || "").trim() ||
        null;

      setDiscordName(name);
    } catch (e: any) {
      setError(friendlyErrorMessage(e?.message) || "The Shroud obscures your path. (Failed to load)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;

    const prev = prevLevelRef.current;
    if (prev !== currentLevel) {
      setBarPulse(true);
      setTimeout(() => setBarPulse(false), 680);
    }

    if (prev < 2 && currentLevel === 2) {
      showToast("Flameborn unlocked", "You selected both roles. Your RSVP badges are now complete.");
    }

    prevLevelRef.current = currentLevel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLevel, loading]);

  async function selectRole(roleId: string) {
    setSavingRoleId(roleId);
    setError(null);

    try {
      const res = await fetch("/api/me/select-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, roleId }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "The Flame flickers. Selection failed.");

      await loadAll();
    } catch (e: any) {
      setError(friendlyErrorMessage(e?.message) || "The Flame flickers. Selection failed.");
    } finally {
      setSavingRoleId(null);
    }
  }

  // --- Officer tools actions ---
  const [targetDiscordId, setTargetDiscordId] = useState("");
  const [officerRoleId, setOfficerRoleId] = useState("");
  const enabledRolesForOfficer = useMemo(() => roles.filter((r) => r.enabled), [roles]);

  async function officerReset(discordUserId: string) {
    const did = discordUserId.trim();
    setError(null);

    if (!isSnowflake(did)) {
      setError("Officer Tools: invalid Discord user id.");
      return;
    }

    try {
      const res = await fetch("/api/officer/reset-user-roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, discordUserId: did }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Reset failed.");
      showToast("Roles reset", `Cleared hub roles for <@${did}>`);
    } catch (e: any) {
      setError(friendlyErrorMessage(e?.message) || "Reset failed.");
    }
  }

  async function officerSet(discordUserId: string, roleId: string) {
    const did = discordUserId.trim();
    setError(null);

    if (!isSnowflake(did)) {
      setError("Officer Tools: invalid Discord user id.");
      return;
    }
    if (!isSnowflake(roleId)) {
      setError("Officer Tools: invalid role id.");
      return;
    }

    try {
      const res = await fetch("/api/officer/set-user-role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, discordUserId: did, roleId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "Set role failed.");
      showToast("Role assigned", `Updated hub role for <@${did}>`);
    } catch (e: any) {
      setError(friendlyErrorMessage(e?.message) || "Set role failed.");
    }
  }

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
      <TopBar discordName={discordName} level={currentLevel} guildId={guildId} isOfficer={isOfficer} />
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

      <Toast
        show={toast.show}
        title={toast.title}
        message={toast.message}
        onClose={() => setToast((t) => ({ ...t, show: false }))}
      />

      <div style={{ maxWidth: 1020, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <header style={{ textAlign: "center", marginBottom: 46 }}>
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
            Flameborn Registry
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

        {!loading ? <FlameProgress level={currentLevel} pulse={barPulse} /> : null}

        {error ? (
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
            {error}
          </div>
        ) : null}

        {isOfficer ? (
          <div style={{ marginBottom: 34 }}>
            <StoneSection
              title="Officer Console"
              subtitle="Reset or override hub roles for a member. Requires Discord Developer Mode user id."
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: THEME.textAsh, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                    Target Discord user id
                  </div>
                  <input
                    value={targetDiscordId}
                    onChange={(e) => setTargetDiscordId(e.target.value)}
                    placeholder="Example: 446012345678901234"
                    style={{
                      padding: "12px 12px",
                      borderRadius: 6,
                      border: `1px solid ${THEME.stoneBorder}`,
                      background: "#0c0e12",
                      color: THEME.textSilver,
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ color: THEME.textAsh, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" }}>
                    Assign role (optional)
                  </div>
                  <select
                    value={officerRoleId}
                    onChange={(e) => setOfficerRoleId(e.target.value)}
                    style={{
                      padding: "12px 12px",
                      borderRadius: 6,
                      border: `1px solid ${THEME.stoneBorder}`,
                      background: "#0c0e12",
                      color: THEME.textSilver,
                      outline: "none",
                    }}
                  >
                    <option value="">Select a role</option>
                    {enabledRolesForOfficer.map((r) => (
                      <option key={r.role_id} value={r.role_id}>
                        {r.role_kind.toUpperCase()} {roleIcon(r)} {r.display_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => officerReset(targetDiscordId)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${THEME.stoneBorder}`,
                      background: `linear-gradient(180deg, ${THEME.stoneCard}, #0f1217)`,
                      color: THEME.textSilver,
                      cursor: "pointer",
                      fontWeight: 950,
                      letterSpacing: 1,
                    }}
                  >
                    Reset user roles
                  </button>

                  <button
                    type="button"
                    onClick={() => officerSet(targetDiscordId, officerRoleId)}
                    disabled={!officerRoleId}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${THEME.stoneBorder}`,
                      background: officerRoleId
                        ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`
                        : `linear-gradient(180deg, ${THEME.stoneCard}, #0f1217)`,
                      color: officerRoleId ? "#111" : THEME.textAsh,
                      cursor: officerRoleId ? "pointer" : "not-allowed",
                      fontWeight: 950,
                      letterSpacing: 1,
                      boxShadow: officerRoleId ? `0 0 18px rgba(242, 153, 74, 0.25)` : "none",
                    }}
                  >
                    Assign selected role
                  </button>
                </div>
              </div>
            </StoneSection>
          </div>
        ) : null}

        {loading ? (
          <div style={{ textAlign: "center", color: THEME.flameGold, padding: "100px", fontWeight: 950 }}>
            Communing with the Altar...
          </div>
        ) : (
          <div style={{ display: "grid", gap: 40 }}>
            <StoneSection title="Choose Thy Weapon" subtitle="A warrior is defined by their combat essence.">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                  gap: 12,
                  alignItems: "stretch",
                }}
              >
                {combatRoles.map((r) => (
                  <div key={r.role_id} style={{ display: "flex" }}>
                    <RuneCard
                      role={r}
                      selected={combatRoleId === r.role_id}
                      disabled={savingRoleId !== null}
                      saving={savingRoleId === r.role_id}
                      onClick={() => selectRole(r.role_id)}
                    />
                  </div>
                ))}
              </div>
            </StoneSection>

            <StoneSection
              title="Settlement Duty"
              subtitle={!combatSelected ? "Requires Combat Attunement" : "Contribute to the survival of Embervale."}
              locked={!combatSelected}
            >
              {!combatSelected ? (
                <div style={{ padding: 60, textAlign: "center", color: THEME.textAsh, letterSpacing: 1 }}>
                  Step into the Flame and choose a combat role to unlock these duties.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                    gap: 12,
                    alignItems: "stretch",
                  }}
                >
                  {logisticsRoles.map((r) => {
                    const isLocked = logisticsLocked;
                    const isSaving = savingRoleId !== null;
                    const isSelected = logisticsRoleId === r.role_id;

                    return (
                      <div
                        key={r.role_id}
                        style={{
                          position: "relative",
                          borderRadius: 16,
                          overflow: "hidden",
                          display: "flex",
                        }}
                        title={isLocked ? "Choose a combat role first to unlock logistics." : ""}
                      >
                        <RuneCard
                          role={r}
                          selected={isSelected}
                          disabled={isLocked || isSaving}
                          saving={savingRoleId === r.role_id}
                          onClick={() => {
                            if (isLocked) return;
                            selectRole(r.role_id);
                          }}
                        />

                        {isLocked ? (
                          <>
                            <div
                              style={{
                                position: "absolute",
                                inset: 0,
                                background:
                                  "radial-gradient(circle at 30% 20%, rgba(20,30,45,0.55) 0%, rgba(10,14,20,0.78) 55%, rgba(5,7,10,0.88) 100%)",
                                pointerEvents: "none",
                              }}
                            />

                            <div
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 10,
                                padding: "6px 10px",
                                borderRadius: 999,
                                border: "1px solid rgba(255,196,90,0.35)",
                                background: "rgba(10,14,20,0.70)",
                                color: "rgba(255,196,90,0.95)",
                                fontSize: 12,
                                fontWeight: 800,
                                letterSpacing: 0.2,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                pointerEvents: "none",
                              }}
                            >
                              <span style={{ fontSize: 13, lineHeight: 1 }}>🔒</span>
                              <span>Locked</span>
                            </div>

                            <div
                              style={{
                                position: "absolute",
                                left: "50%",
                                top: "50%",
                                transform: "translate(-50%, -50%)",
                                padding: "10px 12px",
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(10,14,20,0.65)",
                                color: "rgba(255,255,255,0.85)",
                                fontSize: 12,
                                fontWeight: 700,
                                textAlign: "center",
                                maxWidth: 220,
                                pointerEvents: "none",
                              }}
                            >
                              Choose a combat role first
                            </div>
                          </>
                        ) : null}
                      </div>
                    );
                  })}

                  <div
                    key="__peasant__"
                    style={{
                      position: "relative",
                      borderRadius: 16,
                      overflow: "hidden",
                      display: "flex",
                      cursor: "pointer",
                    }}
                    title="Promotion available after 4,000 stones delivered."
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <RuneCard role={peasantDutyRole as any} selected={false} onClick={() => {}} />
                  </div>
                </div>
              )}
            </StoneSection>
          </div>
        )}

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


