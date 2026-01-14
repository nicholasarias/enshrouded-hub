export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParamsInput = Record<string, string | string[] | undefined>;

const DEFAULT_GUILD_ID = "1391117470676287518";

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

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function buildUrl(basePath: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function TopBar(props: { guildId: string }) {
  const hubHref = buildUrl("/", { guildId: props.guildId });

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
              boxShadow: "0 0 14px rgba(242, 153, 74, 0.5)",
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
            <div style={{ color: THEME.textAsh, fontSize: 12 }}>Dashboard</div>
          </div>
        </div>

        <a
          href={buildUrl("/landing", { guildId: props.guildId })}
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
            backdropFilter: "blur(6px)",
            whiteSpace: "nowrap",
          }}
        >
          Landing
        </a>
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
          maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
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

function Card(props: { title: string; subtitle: string; href: string; guildId: string; icon: string; primary?: boolean }) {
  const url = buildUrl(props.href, { guildId: props.guildId });

  return (
    <a
      href={url}
      style={{
        display: "block",
        textDecoration: "none",
        color: THEME.textSilver,
        borderRadius: 6,
        border: `2px solid ${THEME.stoneBorder}`,
        background: props.primary
          ? `linear-gradient(180deg, rgba(242,153,74,0.12), rgba(17,20,26,1))`
          : `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
        padding: 22,
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

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 6,
            border: `1px solid ${THEME.stoneBorder}`,
            background: `linear-gradient(180deg, ${THEME.stoneEdge}, #0b0d11)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
          }}
          aria-hidden="true"
        >
          {props.icon}
        </div>

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 950,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: props.primary ? THEME.flameGold : "#fff",
              marginBottom: 6,
            }}
          >
            {props.title}
          </div>
          <div style={{ color: THEME.textAsh, lineHeight: 1.35 }}>{props.subtitle}</div>
        </div>
      </div>
    </a>
  );
}

export default async function Home(props: { searchParams?: SearchParamsInput | Promise<SearchParamsInput> }) {
  let sp: SearchParamsInput = {};
  const spRaw = props.searchParams as any;

  if (spRaw && typeof spRaw.then === "function") {
    sp = (await spRaw) as SearchParamsInput;
  } else {
    sp = (spRaw || {}) as SearchParamsInput;
  }

  const rawGuildId = String(firstParam(sp.guildId) || "").trim();
  const guildId = rawGuildId && isSnowflake(rawGuildId) ? rawGuildId : DEFAULT_GUILD_ID;

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
      <TopBar guildId={guildId} />
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
            Hub Dashboard
          </div>

          <h1
            style={{
              fontSize: "3.1rem",
              margin: 0,
              color: "#fff",
              textShadow: "0 0 20px rgba(242, 153, 74, 0.55)",
              fontWeight: 950,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Enshrouded Hub
          </h1>

          <div style={{ width: 120, height: 2, background: THEME.flameAmber, margin: "22px auto 0 auto" }} />
        </header>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          <Card
            title="Sessions"
            subtitle="Create runs, see RSVPs, open Discord posts."
            href="/sessions"
            guildId={guildId}
            icon="🗓️"
            primary
          />
          <Card
            title="Roles"
            subtitle="Bind combat and logistics badges for RSVP visibility."
            href="/roles"
            guildId={guildId}
            icon="🔥"
          />
          <Card
            title="Landing"
            subtitle="Cinematic entry page for the guild."
            href="/landing"
            guildId={guildId}
            icon="🌫️"
          />
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
