export const dynamic = "force-dynamic";
export const revalidate = 0;

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
};

function getBaseUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  return "http://localhost:3000";
}

function fmtWhen(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return startLocal || "Unknown time";
  return new Date(ms).toLocaleString();
}

function discordMessageUrl(guildId: string, channelId: string | null, messageId: string | null) {
  if (!guildId || !channelId || !messageId) return null;
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

async function getDetail(sessionId: string): Promise<DetailResponse | null> {
  const baseUrl = getBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/sessions/detail?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

function RosterBlock(props: { title: string; items: RsvpItem[] }) {
  const items = props.items || [];
  const count = items.length;

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(10,14,18,0.55)",
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10 }}>
        {props.title} ({count})
      </div>

      {!count ? (
        <div style={{ opacity: 0.7 }}>—</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {items.map((u) => (
            <div key={u.discordUserId} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 52, display: "flex", gap: 6, justifyContent: "flex-start" }}>
                <span title="Combat">{u.badges?.combat || "❔"}</span>
                <span title="Logistics">{u.badges?.logistics || "❔"}</span>
              </div>

              <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                {u.username || u.discordUserId}
              </div>

              <div style={{ marginLeft: "auto", opacity: 0.65, fontSize: 12 }}>
                {u.discordUserId}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function SessionDetailPage(props: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = (typeof (props.params as any)?.then === "function")
    ? await (props.params as Promise<{ id: string }>)
    : (props.params as { id: string });

  const sessionId = String(resolvedParams?.id || "").trim();
  const data = await getDetail(sessionId);


  if (!data) {
    return (
      <div style={{ padding: 18 }}>
        <a href="/sessions" style={{ textDecoration: "none" }}>← Back</a>
        <div style={{ marginTop: 12, fontWeight: 900 }}>Session not found</div>
      </div>
    );
  }

  const s = data.session;
  const discordUrl = discordMessageUrl(s.guildId, s.discordChannelId, s.discordMessageId);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <a href="/sessions" style={{ textDecoration: "none", opacity: 0.8 }}>← Back</a>
          <div style={{ marginTop: 10, fontSize: 24, fontWeight: 900 }}>{s.title}</div>
          <div style={{ opacity: 0.85, marginTop: 6 }}>
            {fmtWhen(s.startLocal)} · {s.durationMinutes} min
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "end" }}>
          {discordUrl ? (
            <a
              href={discordUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(10,14,18,0.55)",
                textDecoration: "none",
                color: "inherit",
                fontWeight: 800,
              }}
            >
              Open in Discord
            </a>
          ) : (
            <span style={{ opacity: 0.7, alignSelf: "center" }}>No Discord link saved</span>
          )}
        </div>
      </div>

      {s.notes ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.16)",
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Notes</div>
          <div style={{ opacity: 0.9, lineHeight: 1.4 }}>{s.notes}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", opacity: 0.85 }}>
        <span>✅ In: {data.counts.in}</span>
        <span>❔ Maybe: {data.counts.maybe}</span>
        <span>❌ Out: {data.counts.out}</span>
      </div>

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <RosterBlock title="✅ In" items={data.rosters.in} />
        <RosterBlock title="❔ Maybe" items={data.rosters.maybe} />
        <RosterBlock title="❌ Out" items={data.rosters.out} />
      </div>
    </div>
  );
}
