import React from "react";

const THEME = {
  flameAmber: "#f2994a",
  flameGold: "#f2c94c",
  stoneCard: "#1c1f26",
  stoneBorder: "#3a4150",
  textSilver: "#d1d5db",
  textAsh: "#6b7280",
};

function buildUrl(basePath: string, params: Record<string, string | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    const val = String(v || "").trim();
    if (val) sp.set(k, val);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export default function TopBar(props: {
  subtitle: string;
  guildId?: string | null;
  current?: "dashboard" | "roles" | "sessions";
  right?: React.ReactNode;
}) {
  const guildId = String(props.guildId || "").trim();

  const linkStyle = (active: boolean, primary?: boolean): React.CSSProperties => {
    if (primary) {
      return {
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
      };
    }

    return {
      padding: "10px 12px",
      borderRadius: 8,
      border: `1px solid ${THEME.stoneBorder}`,
      background: active ? "rgba(255,255,255,0.06)" : "rgba(12,14,18,0.6)",
      color: active ? "#fff" : THEME.textSilver,
      textDecoration: "none",
      fontWeight: 950,
      letterSpacing: 1,
      textTransform: "uppercase",
      fontSize: 12,
      backdropFilter: "blur(6px)",
      whiteSpace: "nowrap",
    };
  };

  const dashboardHref = buildUrl("/", { guildId });
  const rolesHref = buildUrl("/roles", { guildId });
  const sessionsHref = buildUrl("/sessions", { guildId });

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
            <div style={{ color: THEME.textAsh, fontSize: 12 }}>
              {props.subtitle}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "end",
          }}
        >
          <a href={rolesHref} style={linkStyle(props.current === "roles")}>
            Roles
          </a>

          <a href={sessionsHref} style={linkStyle(props.current === "sessions")}>
            Sessions
          </a>

          <a href={dashboardHref} style={linkStyle(false, true)}>
            Dashboard
          </a>

          {props.right || null}
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
