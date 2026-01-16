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
  dangerText: "#fecaca",
};

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

function getGuildIdFromSearchParams(sp: Record<string, string | string[] | undefined>) {
  const raw = sp.guildId;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const s = String(v || "").trim();
  if (s && isSnowflake(s)) return s;
  return "";
}

function TopBar(props: { guildId: string }) {
  const gid = props.guildId;

  const dashboardHref = buildUrl("/dashboard", { guildId: gid });
  const rolesHref = buildUrl("/roles", { guildId: gid });
  const sessionsHref = buildUrl("/sessions", { guildId: gid });
  const setupHref = buildUrl("/setup", { guildId: gid });

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
          maxWidth: 1100,
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
                Enshrouded Hub
              </div>
              <div style={{ color: THEME.textAsh, fontSize: 12 }}>Setup guide</div>
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
              Roles
            </a>

            <a
              href={setupHref}
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
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${THEME.stoneBorder}`,
            background: "rgba(12,14,18,0.6)",
            color: THEME.textAsh,
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
          title="Guild context"
        >
          {gid ? `Guild: ${gid}` : "Guild: optional"}
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

function StoneSection(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
        border: `2px solid ${THEME.stoneBorder}`,
        borderRadius: 6,
        padding: 18,
        boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          borderBottom: `1px solid ${THEME.stoneBorder}`,
          paddingBottom: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ color: THEME.flameGold, textTransform: "uppercase", letterSpacing: 3, fontSize: 12, fontWeight: 950 }}>
          {props.title}
        </div>
      </div>

      {props.children}
    </div>
  );
}

function CodeBlock(props: { children: string }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 12,
        borderRadius: 6,
        border: `1px solid ${THEME.stoneBorder}`,
        background: "rgba(0,0,0,0.25)",
        overflowX: "auto",
        color: THEME.textSilver,
        fontSize: 13,
        fontWeight: 800,
        lineHeight: 1.5,
      }}
    >
      <code>{props.children}</code>
    </pre>
  );
}

function Note(props: { children: React.ReactNode; kind?: "info" | "warn" }) {
  const warn = props.kind === "warn";
  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 6,
        border: `1px solid ${warn ? THEME.dangerBorder : THEME.stoneBorder}`,
        background: warn ? "rgba(127,29,29,0.15)" : "rgba(12,14,18,0.55)",
        color: warn ? THEME.dangerText : THEME.textSilver,
        fontWeight: 900,
      }}
    >
      {props.children}
    </div>
  );
}

function H2(props: { children: React.ReactNode }) {
  return <div style={{ marginTop: 14, fontSize: 16, fontWeight: 950, color: "#fff" }}>{props.children}</div>;
}

function P(props: { children: React.ReactNode }) {
  return <div style={{ marginTop: 8, color: THEME.textSilver, fontWeight: 850, lineHeight: 1.55 }}>{props.children}</div>;
}

function Li(props: { children: React.ReactNode }) {
  return (
    <li style={{ marginTop: 6, color: THEME.textSilver, fontWeight: 850, lineHeight: 1.55 }}>
      {props.children}
    </li>
  );
}

export default async function SetupPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await (props.searchParams ?? Promise.resolve({}));
  const guildId = getGuildIdFromSearchParams(sp);

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
      <TopBar guildId={guildId} />

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

      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 10 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: THEME.flameGold, textTransform: "uppercase", letterSpacing: 3, fontSize: 12, fontWeight: 950 }}>
            Enshrouded Hub
          </div>
          <h1 style={{ margin: "10px 0 0", fontSize: 34, fontWeight: 950, color: "#fff" }}>Guild Setup Guide</h1>
          <div style={{ marginTop: 10, color: THEME.textAsh, fontSize: 13, fontWeight: 900 }}>
            Built for Discord server owners and officers
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <StoneSection title="Read This First">
            <P>Sign in with Discord on the exact domain you will use for the hub.</P>
            <P>Mixing domains can break the login handshake and block officer checks.</P>

            <Note kind="warn">
              If Discord will not link or you get stuck in a login loop, clear cookies/site data for this hub domain and for
              discord.com, then sign in again.
            </Note>
          </StoneSection>

          <StoneSection title="What Enshrouded Hub Does">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Members pick one Combat role and one Logistics role</Li>
              <Li>Logistics stays locked until Combat is selected</Li>
              <Li>Selections are saved in the hub database</Li>
              <Li>Officers can reset or manage member selections</Li>
              <Li>Discord role syncing can be enabled when configured</Li>
            </ul>

            <Note kind="info">
              Officer access is role based per guild. Discord Administrator permission by itself does not grant officer access in the hub.
            </Note>
          </StoneSection>

          <StoneSection title="Requirements">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>You are a Discord server admin or you can manage roles</Li>
              <Li>Developer Mode is enabled in Discord</Li>
              <Li>The Enshrouded Hub bot is added to your server</Li>
              <Li>You can sign into the hub with Discord on this domain</Li>
            </ul>
          </StoneSection>

          <StoneSection title="Step 1 Create an Officer Role in Discord">
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Open Server Settings then Roles</Li>
              <Li>Create a role named Officer or Leadership</Li>
              <Li>Assign that role to yourself and any officers</Li>
            </ol>

            <Note kind="warn">Do not rely on Discord Administrator permission. The hub checks a specific configured role ID.</Note>
          </StoneSection>

          <StoneSection title="Step 2 Copy IDs (Officer Role + Guild)">
            <H2>Officer role ID</H2>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Open Discord User Settings then Advanced then enable Developer Mode</Li>
              <Li>Right click the Officer role</Li>
              <Li>Click Copy Role ID</Li>
              <Li>Save this value</Li>
            </ol>

            <H2>Guild (Server) ID</H2>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Right click your server icon in the left sidebar</Li>
              <Li>Click Copy Server ID</Li>
              <Li>Save this value</Li>
            </ol>
          </StoneSection>

          <StoneSection title="Step 3 Run Initial Setup">
            <P>You must tell the hub which Discord role is the Officer role for your guild.</P>
            <P>Set a post channel now if you want to use the RSVP command.</P>

            <H2>Option A Use the setup command</H2>
            <P>In Discord, run:</P>
            <CodeBlock>{`/setup channel:#sessions officer_role:<ROLE_ID>`}</CodeBlock>

            <Note kind="info">
              You can re-run `/setup` at any time to update the officer role or post channel.
            </Note>
          </StoneSection>

          <StoneSection title="Step 4 Verify Officer Access">
            <P>Open this page with your guildId in the URL:</P>
            <CodeBlock>{`/roles/manage-users?guildId=YOUR_GUILD_ID`}</CodeBlock>

            <P>If setup is correct you will see the user list and reset buttons.</P>
            <P>If you have not synced roles yet, go to the dashboard and click Sync Roles first.</P>

            <H2>If you see 403 Forbidden</H2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Officer role is not configured for this guild</Li>
              <Li>You do not currently have the Officer role in Discord</Li>
              <Li>Roles have not synced into the hub yet</Li>
            </ul>
          </StoneSection>

          <StoneSection title="Step 5 Sync Roles">
            <P>Sync pulls guild roles and member role mappings into the hub so officer checks can work.</P>
            <P>Open /dashboard and click Sync Roles in the top right.</P>

            <H2>Bot permissions needed</H2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Read Members</Li>
              <Li>Read Roles</Li>
              <Li>Manage Roles only if you enable Discord role syncing</Li>
            </ul>

            <Note kind="info">
              If role syncing is disabled, the hub can still store selections. Discord role updates just will not occur.
            </Note>
          </StoneSection>

          <StoneSection title="How Officer Permissions Work">
            <P>Officer access is granted only if all are true:</P>
            <ol style={{ margin: 0, paddingLeft: 18 }}>
              <Li>The guild has an Officer role configured</Li>
              <Li>You have that role in Discord</Li>
              <Li>The hub has synced your role mapping for this guild</Li>
            </ol>

            <P>This prevents cross server leakage and keeps multi guild support clean.</P>
          </StoneSection>

          <StoneSection title="Common Issues and Fixes">
            <H2>Discord will not link</H2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Clear cookies/site data for this hub domain and for discord.com</Li>
              <Li>Sign in again on the exact domain you will use long term</Li>
              <Li>Avoid switching between localhost, preview, and production</Li>
            </ul>

            <H2>403 Forbidden</H2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Officer role ID not set for the guild</Li>
              <Li>You do not have the officer role</Li>
              <Li>Role sync has not been run</Li>
            </ul>

            <H2>401 Unauthorized</H2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>You are not logged in</Li>
              <Li>Your session expired</Li>
              <Li>You mixed hosts like localhost and an ngrok URL</Li>
              <Li>Clear cookies/site data if auth gets stuck</Li>
            </ul>

            <H2>Roles not showing</H2>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Bot lacks permission to read roles or members</Li>
              <Li>Role sync has not been run</Li>
            </ul>
          </StoneSection>

          <StoneSection title="Officer Tools">
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <Li>Role selection page for members is at /roles</Li>
              <Li>Role metadata and perks editor is at /roles/manage</Li>
              <Li>User selection reset tool is at /roles/manage-users</Li>
            </ul>

            <Note kind="info">Hub selections are separate from Discord permissions. Discord role syncing only happens when explicitly enabled.</Note>
          </StoneSection>
        </div>
      </div>
    </div>
  );
}
