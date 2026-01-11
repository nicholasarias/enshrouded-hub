"use client";

import { useEffect, useState } from "react";

type Session = {
  id: string;
  guild_id?: string;
  title: string;
  start_local?: string;
  startLocal?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  notes: string;
  created_at?: string;
  createdAt?: string;
  discord_channel_id?: string;
  discord_message_id?: string;
};

type RsvpCounts = Record<string, { in: number; maybe: number; out: number }>;

type FormState = {
  title: string;
  startLocal: string;
  durationMinutes: number;
  notes: string;
};

export default function SchedulePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [rsvpCounts, setRsvpCounts] = useState<RsvpCounts>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});


  const [form, setForm] = useState<FormState>({
    title: "",
    startLocal: "",
    durationMinutes: 60,
    notes: "",
  });

  function getGuildId() {
    return String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "");
  }

  function normalizeSession(s: Session) {
    return {
      id: s.id,
      title: s.title,
      startLocal: String((s as any).startLocal ?? (s as any).start_local ?? ""),
      durationMinutes: Number(
        (s as any).durationMinutes ?? (s as any).duration_minutes ?? 0
      ),
      notes: s.notes ?? "",
      createdAt: String((s as any).createdAt ?? (s as any).created_at ?? ""),
    };
  }
  function formatWhen(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
}


  async function loadSessions() {
  try {
    setLoadError(null);
    setLoading(true);

    const res = await fetch(
      `/api/sessions?guildId=${encodeURIComponent(getGuildId() || "")}`
    );

    const data = await res.json();

    if (!res.ok) {
      setLoadError(data?.error || `Failed to load sessions (${res.status})`);
      setSessions([]);
      return;
    }

    setSessions(data.sessions ?? []);
  } catch (e: any) {
    setLoadError(e?.message || "Failed to load sessions");
    setSessions([]);
  } finally {
    setLoading(false);
  }
}


  async function loadRsvps() {
    const guildId = getGuildId();
    if (!guildId) return;

    const res = await fetch(`/api/rsvps?guildId=${encodeURIComponent(guildId)}&t=${Date.now()}`);
    const data = await res.json();
    setRsvpCounts((data.counts ?? {}) as RsvpCounts);
  }

  async function submit() {
    setMessage("Creating...");

    const guildId = getGuildId();
    if (!guildId) {
      setMessage("Missing NEXT_PUBLIC_DISCORD_GUILD_ID in .env.local");
      return;
    }

    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: {
  "Content-Type": "application/json",
  "x-api-key": String(process.env.NEXT_PUBLIC_SESSIONS_API_KEY || ""),

},

      body: JSON.stringify({
  ...(form as any),
  startLocal: new Date(form.startLocal).toISOString(),
  guildId,
}),

    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data?.error || "Failed");
      return;
    }

    setMessage("Created");
    setForm({ title: "", startLocal: "", durationMinutes: 60, notes: "" });

    await loadSessions();
    await loadRsvps();
  }

  useEffect(() => {
  loadSessions();
  loadRsvps();

  const id = setInterval(() => {
    loadSessions();
    loadRsvps();
  }, 5000);

  return () => clearInterval(id);
}, []);

{loading ? (
  <div style={{ opacity: 0.8 }}>Loading sessions...</div>
) : loadError ? (
  <div style={{ color: "crimson" }}>{loadError}</div>
) : sessions.length === 0 ? (
  <div style={{ opacity: 0.8 }}>
    No sessions yet. Create one above and it will post to Discord.
  </div>
) : null}

  return (
    <div style={{ padding: 16, maxWidth: 900 }}>
      <h1>Schedule</h1>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <label>
            Title
            <input
              style={{ display: "block", width: "100%", padding: 8 }}
              value={form.title}
              onChange={(e) =>
                setForm((p) => ({ ...p, title: e.target.value }))
              }
            />
          </label>

          <label>
            Start (local)
            <input
  type="datetime-local"
  style={{ display: "block", width: "100%", padding: 8 }}
  value={form.startLocal}
  onChange={(e) => setForm((p) => ({ ...p, startLocal: e.target.value }))}
 />

          </label>

          <label>
            Duration (minutes)
            <input
              type="number"
              style={{ display: "block", width: "100%", padding: 8 }}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  durationMinutes: Number(e.target.value || 0),
                }))
              }
            />
          </label>

          <label>
            Notes
            <textarea
              style={{ display: "block", width: "100%", padding: 8 }}
              value={form.notes}
              onChange={(e) =>
                setForm((p) => ({ ...p, notes: e.target.value }))
              }
              rows={3}
            />
          </label>

          <button
            onClick={submit}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #333",
              cursor: "pointer",
            }}
          >
            Create session
          </button>

          {message ? <div>{message}</div> : null}
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Sessions</h2>

      <div style={{ display: "grid", gap: 12 }}>
  {sessions.map((s) => {
    const counts = rsvpCounts[s.id] ?? { in: 0, maybe: 0, out: 0 };

    return (
      <div
        key={s.id}
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 16 }}>{s.title}</div>

        <div style={{ marginTop: 6, opacity: 0.8 }}>
          {formatWhen(String(s.startLocal || ""))} • {s.durationMinutes} min
        </div>

        {s.notes ? (
          <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
            {s.notes}
          </div>
        ) : null}

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            In: {counts.in}
          </span>
          <span
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            Maybe: {counts.maybe}
          </span>
          <span
            style={{
              border: "1px solid #ddd",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            Out: {counts.out}
          </span>
        </div>
      </div>
    );
  })}
</div>

    </div>
  );
}
