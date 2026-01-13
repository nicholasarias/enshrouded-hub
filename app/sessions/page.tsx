export const dynamic = "force-dynamic";
export const revalidate = 0;

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
};

function getBaseUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (fromEnv) {
    return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  }
  return "http://localhost:3000";
}

async function getSessions(): Promise<SessionItem[]> {
  const guildId = "1391117470676287518";
  const baseUrl = getBaseUrl();

  const res = await fetch(
    `${baseUrl}/api/sessions/list?guildId=${encodeURIComponent(guildId)}&limit=50`,
    { cache: "no-store" }
  );

  if (!res.ok) return [];
  const json = (await res.json()) as { sessions: SessionItem[] };
  return json.sessions || [];
}

function sessionDiscordUrl(s: SessionItem) {
  if (!s.discordChannelId || !s.discordMessageId) return null;
  // Works for most cases. If your server is private, Discord might require login.
  return `https://discord.com/channels/${s.guildId}/${s.discordChannelId}/${s.discordMessageId}`;
}

function fmtWhen(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return startLocal || "Unknown time";
  return new Date(ms).toLocaleString();
}

export default async function SessionsPage() {
  const sessions = await getSessions();

  const upcoming = sessions.filter((s) => s.upcoming);
  const past = sessions.filter((s) => !s.upcoming);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900 }}>Sessions</div>
          <div style={{ opacity: 0.8, marginTop: 4 }}>
            Upcoming and recent posts from Discord RSVP
          </div>
        </div>

        <a
          href="/roles"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(10,14,18,0.55)",
            textDecoration: "none",
            color: "inherit",
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          Set my roles →
        </a>
      </div>

      <Section title={`Upcoming (${upcoming.length})`}>
        <Cards items={upcoming} />
      </Section>

      <Section title={`Past (${past.length})`}>
        <Cards items={past} />
      </Section>
    </div>
  );
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 900, marginBottom: 10, opacity: 0.95 }}>{props.title}</div>
      {props.children}
    </div>
  );
}

function Cards(props: { items: SessionItem[] }) {
  const items = props.items || [];
  if (!items.length) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(10,14,18,0.45)",
          opacity: 0.8,
        }}
      >
        Nothing here yet.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((s) => {
        const discordUrl = sessionDiscordUrl(s);

        return (
          <div
            key={s.id}
            style={{
              padding: 14,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,18,0.55)",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 16, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.title || "Untitled"}
                </div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  {fmtWhen(s.startLocal)} · {Number(s.durationMinutes || 0)} min
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
                <a
                  href={`/sessions/${s.id}`}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(0,0,0,0.15)",
                    textDecoration: "none",
                    color: "inherit",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  View
                </a>

                {discordUrl ? (
                  <a
                    href={discordUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(0,0,0,0.15)",
                      textDecoration: "none",
                      color: "inherit",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Open in Discord
                  </a>
                ) : (
                  <span style={{ opacity: 0.65, fontSize: 12, alignSelf: "center" }}>
                    No Discord link saved
                  </span>
                )}
              </div>
            </div>

            {s.notes ? (
              <div
                style={{
                  opacity: 0.9,
                  lineHeight: 1.4,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.12)",
                }}
              >
                {s.notes}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, opacity: 0.75, fontSize: 12, flexWrap: "wrap" }}>
              <span>Session id: {s.id}</span>
              {s.discordChannelId && s.discordMessageId ? (
                <span>Discord msg: {s.discordMessageId}</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
