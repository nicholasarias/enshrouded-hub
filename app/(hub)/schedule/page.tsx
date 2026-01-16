"use client";

import { useEffect, useMemo, useState } from "react";
import OfficerOnly from "../../components/OfficerOnly";

type Session = {
  id: string;
  guild_id: string;
  title: string;
  start_local: string | null;
  duration_minutes: number;
  notes: string | null;
};

type RsvpCounts = Record<string, { in: number; maybe: number; out: number }>;

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const MAX_DURATION_MINUTES = 24 * 60;

function clampInt(v: unknown, min = 0, max = 9999) {
  const n = Math.floor(safeNumber(v, min));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function clampDurationMinutes(total: number) {
  if (!Number.isFinite(total)) return 0;
  return Math.min(Math.max(Math.floor(total), 0), MAX_DURATION_MINUTES);
}

function totalMinutesFromParts(hoursRaw: unknown, minutesRaw: unknown) {
  const hours = clampInt(hoursRaw, 0, 24);
  const minutes = clampInt(minutesRaw, 0, 59);
  return clampDurationMinutes(hours * 60 + minutes);
}

function formatWhen(isoLike: string) {
  if (!isoLike) return "Unknown";
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike;

  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function minutesToLabel(mins: number) {
  const m = safeNumber(mins, 0);
  if (m <= 0) return "Unknown";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (r === 0) return `${h} hr`;
  return `${h} hr ${r} min`;
}

function Chip({ label, tone }: { label: string; tone: "in" | "maybe" | "out" }) {
  const cls =
    tone === "in"
      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
      : tone === "maybe"
      ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-100"
      : "border-rose-400/25 bg-rose-400/10 text-rose-100";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default function SchedulePage() {
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";

  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [rsvpCounts, setRsvpCounts] = useState<RsvpCounts>({});

  const [form, setForm] = useState({
    title: "",
    startLocal: "",
    durationHours: 1,
    durationMinutes: 30,
    notes: "",
  });

  const canPost = useMemo(() => {
    const totalMinutes = totalMinutesFromParts(form.durationHours, form.durationMinutes);
    return (
      !!guildId &&
      form.title.trim().length > 0 &&
      form.startLocal.trim().length > 0 &&
      totalMinutes > 0
    );
  }, [guildId, form.durationHours, form.durationMinutes, form.startLocal, form.title]);

  async function loadAll() {
    try {
      if (!guildId) {
        setError("Missing NEXT_PUBLIC_DISCORD_GUILD_ID");
        return;
      }

      setError(null);

      const sRes = await fetch(`/api/sessions?guildId=${encodeURIComponent(guildId)}`, {
        cache: "no-store",
      });

      if (!sRes.ok) {
        const t = await sRes.text().catch(() => "");
        throw new Error(`Failed sessions fetch: ${sRes.status} ${t}`);
      }

      const sJson = await sRes.json();
      const list: Session[] = Array.isArray(sJson?.sessions) ? sJson.sessions : Array.isArray(sJson) ? sJson : [];
      setSessions(list);

      const ids = list.map((x) => x.id).filter(Boolean);
      if (ids.length === 0) {
        setRsvpCounts({});
        return;
      }

      const cRes = await fetch(
        `/api/rsvps?guildId=${encodeURIComponent(guildId)}&sessionIds=${encodeURIComponent(ids.join(","))}`,
        { cache: "no-store" }
      );

      if (!cRes.ok) {
        setRsvpCounts({});
        return;
      }

      const cJson = await cRes.json();
      const counts: RsvpCounts = cJson?.counts && typeof cJson.counts === "object" ? cJson.counts : {};
      setRsvpCounts(counts);
    } catch (e: any) {
      setError(e?.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (!alive) return;
      await loadAll();
    };

    run();

    const id = window.setInterval(() => {
      run();
    }, 5000);

    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  async function createSession() {
    if (!canPost) return;

    setPosting(true);
    setError(null);

    try {
      const durationMinutes = totalMinutesFromParts(form.durationHours, form.durationMinutes);
      const payload = {
        guildId,
        title: form.title.trim(),
        startLocal: new Date(form.startLocal).toISOString(),
        durationMinutes,
        notes: form.notes.trim() || null,
      };

      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`Create failed: ${res.status} ${t}`);
      }

      setForm({ title: "", startLocal: "", durationHours: 1, durationMinutes: 30, notes: "" });
      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Create failed");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">Schedule</div>
            <div className="mt-1 text-2xl font-bold tracking-wide">Rally the Flameborn</div>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              Create a session, auto post to Discord, and track RSVPs live.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Guild: {guildId ? "Linked" : "Missing"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Auth: Required
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>

      {/* Create + List */}
      <div className="grid gap-4 lg:grid-cols-5">
        <OfficerOnly>
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">Create Session</div>
              <span className="text-xs text-zinc-500">Posts to Discord</span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  maxLength={120}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                  placeholder="Boss run, farming, base build"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Start</label>
                <input
                  type="datetime-local"
                  value={form.startLocal}
                  onChange={(e) => setForm((p) => ({ ...p, startLocal: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                />
                <div className="mt-1 text-[11px] text-zinc-500">Stored as ISO string and shown in your local time.</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300">Duration</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={form.durationHours}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, durationHours: clampInt(e.target.value, 0, 24) }))
                      }
                      min={0}
                      max={24}
                      placeholder="Hours"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                    />
                    <input
                      type="number"
                      value={form.durationMinutes}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, durationMinutes: clampInt(e.target.value, 0, 59) }))
                      }
                      min={0}
                      max={59}
                      placeholder="Minutes"
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-500">Max 24 hours total.</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <div className="text-xs text-zinc-400">Preview</div>
                  <div className="mt-1 text-sm font-semibold text-zinc-100">
                    {form.startLocal ? formatWhen(new Date(form.startLocal).toISOString()) : "Pick a time"}
                  </div>
                  <div className="mt-1 text-xs text-zinc-400">
                    {minutesToLabel(totalMinutesFromParts(form.durationHours, form.durationMinutes))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  maxLength={1500}
                  rows={4}
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                  placeholder="Bring mats, set waypoint, gear requirements, etc."
                />
              </div>

              <button
                onClick={createSession}
                disabled={!canPost || posting}
                className="w-full rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400/40 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {posting ? "Posting to Discord…" : "Create and Post"}
              </button>

              <div className="text-[11px] text-zinc-500">
                Officers only. If this fails, make sure you are logged in and have officer permissions.
              </div>
            </div>
          </div>
        </OfficerOnly>

        {/* List */}
        <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold tracking-wide">Upcoming Sessions</div>
              <div className="text-xs text-zinc-500">Auto refresh every 5 seconds</div>
            </div>

            <div className="flex items-center gap-2">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                Total: {sessions.length}
              </span>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                Loading sessions…
              </div>
            ) : sessions.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center">
                <div className="text-sm font-semibold text-zinc-200">No sessions yet</div>
                <div className="mt-1 text-sm text-zinc-400">Create one and it will post to Discord.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => {
                  const counts = rsvpCounts[s.id] || { in: 0, maybe: 0, out: 0 };

                  return (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-emerald-400/20 hover:bg-black/30"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 h-9 w-9 flex-none rounded-xl border border-emerald-400/20 bg-emerald-400/10" />
                            <div className="min-w-0">
                              <div className="truncate text-base font-bold tracking-wide">{s.title}</div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                  {formatWhen(String(s.start_local || ""))}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                  {minutesToLabel(s.duration_minutes)}
                                </span>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                                  Session ID: {s.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {s.notes ? (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300">
                              {s.notes}
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <Chip tone="in" label={`In ${safeNumber(counts.in)}`} />
                          <Chip tone="maybe" label={`Maybe ${safeNumber(counts.maybe)}`} />
                          <Chip tone="out" label={`Out ${safeNumber(counts.out)}`} />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/25" />
                          Live updates are reflected in Discord and here.
                        </div>
                        <div className="text-zinc-600">RSVP by clicking buttons in Discord.</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 text-[11px] text-zinc-500">
            Note: this page expects an RSVP counts endpoint at <span className="text-zinc-300">/api/rsvps</span>. If your counts are
            already being fetched differently, tell me the current route shape and I will wire it in.
          </div>
        </div>
      </div>
    </div>
  );
}
