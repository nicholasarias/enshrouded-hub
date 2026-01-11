"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PinType = "resource" | "boss" | "poi" | "base" | "danger" | "route";
type Pin = {
  id: string;
  title: string;
  type: PinType;
  region?: string | null;
  coords?: { x: number; y: number } | null; // abstract coords (not real world lat/lng)
  notes?: string | null;
  tags?: string[];
  createdBy?: string | null;
  createdAt?: string | null;
};

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function typeTone(t: PinType) {
  if (t === "resource") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (t === "boss") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  if (t === "poi") return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  if (t === "base") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  if (t === "danger") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  return "border-white/10 bg-white/5 text-zinc-200";
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function IconBlock() {
  return (
    <div className="h-10 w-10 flex-none rounded-2xl border border-emerald-400/20 bg-emerald-400/10" />
  );
}

const seedPins: Pin[] = [
  {
    id: "pin_iron_01",
    title: "Iron Vein Cluster",
    type: "resource",
    region: "Revelwood",
    coords: { x: 42, y: 18 },
    notes: "Multiple nodes. Good loop route. Bring pickaxe and repair kit.",
    tags: ["iron", "mining"],
    createdBy: "Huntmaster",
    createdAt: "2025-02-02T00:00:00.000Z",
  },
  {
    id: "pin_shroud_01",
    title: "Shroud Pocket",
    type: "danger",
    region: "Nomad Highlands",
    coords: { x: 61, y: 33 },
    notes: "Visibility drops fast. Set waypoint before entering.",
    tags: ["shroud", "hazard"],
    createdBy: "Flameborn Captain",
    createdAt: "2025-03-12T00:00:00.000Z",
  },
  {
    id: "pin_boss_01",
    title: "Boss Arena",
    type: "boss",
    region: "Kindlewastes",
    coords: { x: 78, y: 44 },
    notes: "Bring fire resist and stamina food. Assign reviver.",
    tags: ["boss", "group"],
    createdBy: "Stonewright",
    createdAt: "2025-03-20T00:00:00.000Z",
  },
  {
    id: "pin_base_01",
    title: "Guild Base Site",
    type: "base",
    region: "Springlands",
    coords: { x: 28, y: 12 },
    notes: "Flat area near resources. Room for expansions.",
    tags: ["base", "build"],
    createdBy: "Stonewright",
    createdAt: "2025-01-29T00:00:00.000Z",
  },
];

export default function MapPage() {
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pins, setPins] = useState<Pin[]>(seedPins);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PinType | "all">("all");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>(seedPins[0]?.id || "");

  const selected = useMemo(() => pins.find((p) => p.id === selectedId) || null, [pins, selectedId]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const p of pins) {
      if (p.region) set.add(p.region);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pins]);

  useEffect(() => {
    let alive = true;

    async function tryLoad() {
      try {
        setError(null);

        // Optional future endpoint. If missing, we keep seed pins.
        // Expected shape: { pins: Pin[] }
        const res = await fetch(`/api/map?guildId=${encodeURIComponent(guildId)}`, {
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (Array.isArray(json?.pins)) {
          setPins(json.pins);
          if (json.pins[0]?.id) setSelectedId((prev) => prev || json.pins[0].id);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load map pins");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    tryLoad();

    return () => {
      alive = false;
    };
  }, [guildId]);

  const filteredPins = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = pins.slice();

    if (q) {
      list = list.filter((p) => {
        const inTitle = p.title.toLowerCase().includes(q);
        const inTags = (p.tags || []).some((t) => String(t).toLowerCase().includes(q));
        return inTitle || inTags;
      });
    }

    if (typeFilter !== "all") list = list.filter((p) => p.type === typeFilter);
    if (regionFilter !== "all") list = list.filter((p) => (p.region || "") === regionFilter);

    list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [pins, query, typeFilter, regionFilter]);

  useEffect(() => {
    if (!selectedId) return;
    const still = filteredPins.some((p) => p.id === selectedId);
    if (!still) setSelectedId(filteredPins[0]?.id || "");
  }, [filteredPins, selectedId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">
              Map
            </div>
            <div className="mt-1 text-2xl font-bold tracking-wide">
              Guild Pins and Routes
            </div>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              Shared locations for resources, bosses, base sites, and danger zones. Start with an embed, then upgrade to interactive pins.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Pins: {pins.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Guild: {guildId ? "Linked" : "Missing"}
            </span>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: pins */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold tracking-wide">Pins</div>
              <div className="text-xs text-zinc-500">Search and filter</div>
            </div>
            <span className="text-xs text-zinc-500">{filteredPins.length} shown</span>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-zinc-300">Search</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title or tag"
                className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs font-semibold text-zinc-300">Type</div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="all">All</option>
                  <option value="resource">Resource</option>
                  <option value="boss">Boss</option>
                  <option value="poi">POI</option>
                  <option value="base">Base</option>
                  <option value="danger">Danger</option>
                  <option value="route">Route</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-300">Region</div>
                <select
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="all">All</option>
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                Loading pins…
              </div>
            ) : filteredPins.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center">
                <div className="text-sm font-semibold text-zinc-200">No results</div>
                <div className="mt-1 text-sm text-zinc-400">Try different filters.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPins.map((p) => {
                  const isSelected = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      className={
                        "w-full rounded-2xl border p-3 text-left transition " +
                        (isSelected
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : "border-white/10 bg-black/25 hover:border-emerald-400/20 hover:bg-black/30")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <IconBlock />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold tracking-wide text-zinc-100">
                            {p.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge label={p.type.toUpperCase()} cls={typeTone(p.type)} />
                            {p.region ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                                {p.region}
                              </span>
                            ) : null}
                            {p.coords ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                                ({safeNumber(p.coords.x)},{safeNumber(p.coords.y)})
                              </span>
                            ) : null}
                          </div>
                          {p.tags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {p.tags.slice(0, 4).map((t) => (
                                <span
                                  key={t}
                                  className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 text-[11px] text-zinc-500">
            Future: let officers approve pins, add pin layers per purpose, and sync “route runs” to schedule sessions.
          </div>
        </div>

        {/* Right: map + detail */}
        <div className="lg:col-span-3 space-y-4">
          {/* Map embed */}
          <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold tracking-wide">Map View</div>
                <div className="text-xs text-zinc-500">
                  MVP embed placeholder (swap to your map source)
                </div>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
                {selected ? selected.title : "No selection"}
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/25">
              {/* Replace this iframe src with your map url later. */}
              <div className="flex h-[420px] items-center justify-center p-6 text-center text-sm text-zinc-400">
                <div>
                  <div className="text-base font-semibold text-zinc-200">
                    Map Embed Goes Here
                  </div>
                  <div className="mt-2 text-sm text-zinc-400">
                    Drop in an iframe or a real interactive map component later.
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    Tip: simplest MVP is an embed, then add pin overlay + Supabase.
                  </div>
                </div>
              </div>

              {/* Example iframe (commented). Put a real URL when you have one.
              <iframe
                src="https://example.com/map"
                className="h-[420px] w-full"
                loading="lazy"
              />
              */}
            </div>
          </div>

          {/* Pin detail */}
          <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">Pin Detail</div>
              <span className="text-xs text-zinc-500">
                {selected?.createdAt ? `Added ${fmtDate(selected.createdAt)}` : ""}
              </span>
            </div>

            {!selected ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                Select a pin to view details.
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xl font-bold tracking-wide text-zinc-100">
                      {selected.title}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge label={selected.type.toUpperCase()} cls={typeTone(selected.type)} />
                      {selected.region ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                          {selected.region}
                        </span>
                      ) : null}
                      {selected.coords ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                          Coords: ({safeNumber(selected.coords.x)},{safeNumber(selected.coords.y)})
                        </span>
                      ) : null}
                      {selected.createdBy ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                          By {selected.createdBy}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="hidden md:block">
                    <IconBlock />
                  </div>
                </div>

                {selected.notes ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
                    {selected.notes}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-zinc-500">No notes.</div>
                )}

                {selected.tags?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {selected.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
                  Future actions: “Copy coords”, “Create session for this location”, “Add route steps”, “Officer approve”.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
        Next: add Discord sign in and guild member sync so pins can be permissioned by role and perk.
      </div>
    </div>
  );
}
