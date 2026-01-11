export default function DashboardPage() {
  const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL;

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Enshrouded Hub</h1>
      <p style={{ marginTop: 8 }}>Dashboard</p>

      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <a href="/schedule">Go to Schedule</a>

        {discordInvite ? (
          <a href={discordInvite} target="_blank" rel="noreferrer">
            Open Discord
          </a>
        ) : null}
      </div>
    </main>
  );
}
