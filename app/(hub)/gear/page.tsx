"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ItemType = "weapon" | "armor" | "tool" | "consumable";
type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

type GearItem = {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  slot?: string | null; // for armor
  iconUrl?: string | null;
  description?: string | null;
  tags?: string[];
};

type ItemStat = {
  itemId: string;
  key: string; // e.g. damage, stamina, critChance
  value: number;
  unit?: string | null; // %, flat, etc.
};

type Patch = {
  id: string;
  version: string;
  releasedAt: string; // ISO
};

type StatChange = {
  itemId: string;
  patchId: string;
  key: string;
  oldValue: number;
  newValue: number;
  unit?: string | null;
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

function rarityTone(r: Rarity) {
  if (r === "legendary") return "border-amber-400/30 bg-amber-400/10 text-amber-100";
  if (r === "epic") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (r === "rare") return "border-cyan-400/30 bg-cyan-400/10 text-cyan-100";
  if (r === "uncommon") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  return "border-white/10 bg-white/5 text-zinc-200";
}

function typeTone(t: ItemType) {
  if (t === "weapon") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  if (t === "armor") return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  if (t === "tool") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  return "border-white/10 bg-white/5 text-zinc-200";
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function IconBlock({ url, name }: { url?: string | null; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={name} src={url} className="h-10 w-10 rounded-2xl border border-white/10 object-cover" />;
  }
  return <div className="h-10 w-10 rounded-2xl border border-emerald-400/20 bg-emerald-400/10" />;
}

const seedItems: GearItem[] = [
  {
    id: "i_sword_ember",
    name: "Embersteel Longsword",
    type: "weapon",
    rarity: "rare",
    description: "Balanced blade for close quarters. Reliable and fast.",
    tags: ["melee", "slash"],
  },
  {
    id: "i_staff_shroud",
    name: "Shroudwood Staff",
    type: "weapon",
    rarity: "epic",
    description: "Focus conduit favored by Flameborn casters.",
    tags: ["magic", "focus"],
  },
  {
    id: "i_bow_ashen",
    name: "Ashen Recurve Bow",
    type: "weapon",
    rarity: "uncommon",
    description: "Light draw with steady output. Great for exploration.",
    tags: ["ranged", "pierce"],
  },
  {
    id: "i_helm_stone",
    name: "Stoneguard Helm",
    type: "armor",
    rarity: "rare",
    slot: "Head",
    description: "Sturdy protection with a modest stamina edge.",
    tags: ["defense"],
  },
  {
    id: "i_chest_flame",
    name: "Flamewoven Chest",
    type: "armor",
    rarity: "epic",
    slot: "Chest",
    description: "Warmth and resilience. Crafted for long runs.",
    tags: ["defense", "stamina"],
  },
  {
    id: "i_pick_brutal",
    name: "Brutal Pickaxe",
    type: "tool",
    rarity: "uncommon",
    description: "Mining tool tuned for faster harvest cycles.",
    tags: ["gathering"],
  },
];

const seedStats: ItemStat[] = [
  { itemId: "i_sword_ember", key: "damage", value: 42 },
  { itemId: "i_sword_ember", key: "attackSpeed", value: 1.15, unit: "x" },
  { itemId: "i_sword_ember", key: "staminaCost", value: 12 },

  { itemId: "i_staff_shroud", key: "spellPower", value: 55 },
  { itemId: "i_staff_shroud", key: "manaRegen", value: 3, unit: "/s" },
  { itemId: "i_staff_shroud", key: "critChance", value: 6, unit: "%" },

  { itemId: "i_bow_ashen", key: "damage", value: 28 },
  { itemId: "i_bow_ashen", key: "drawSpeed", value: 0.9, unit: "s" },
  { itemId: "i_bow_ashen", key: "critChance", value: 4, unit: "%" },

  { itemId: "i_helm_stone", key: "armor", value: 18 },
  { itemId: "i_helm_stone", key: "stamina", value: 10 },

  { itemId: "i_chest_flame", key: "armor", value: 34 },
  { itemId: "i_chest_flame", key: "stamina", value: 20 },
  { itemId: "i_chest_flame", key: "fireResist", value: 8, unit: "%" },

  { itemId: "i_pick_brutal", key: "harvestSpeed", value: 12, unit: "%" },
  { itemId: "i_pick_brutal", key: "durability", value: 220 },
];

const seedPatches: Patch[] = [
  { id: "p_100", version: "1.0.0", releasedAt: "2025-01-24T00:00:00.000Z" },
  { id: "p_110", version: "1.1.0", releasedAt: "2025-03-18T00:00:00.000Z" },
];

const seedChanges: StatChange[] = [
  { itemId: "i_sword_ember", patchId: "p_110", key: "damage", oldValue: 40, newValue: 42 },
  { itemId: "i_staff_shroud", patchId: "p_110", key: "critChance", oldValue: 4, newValue: 6, unit: "%" },
  { itemId: "i_pick_brutal", patchId: "p_110", key: "harvestSpeed", oldValue: 10, newValue: 12, unit: "%" },
];

export default function GearPage() {
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<GearItem[]>(seedItems);
  const [stats, setStats] = useState<ItemStat[]>(seedStats);
  const [patches, setPatches] = useState<Patch[]>(seedPatches);
  const [changes, setChanges] = useState<StatChange[]>(seedChanges);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<ItemType | "all">("all");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(seedItems[0]?.id || "");

  useEffect(() => {
    let alive = true;

    async function tryLoad() {
      try {
        setError(null);

        // Optional future endpoint. If missing, we keep seed data.
        // Expected shape: { items, stats, patches, changes }
        const res = await fetch(`/api/gear?guildId=${encodeURIComponent(guildId)}`, {
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (Array.isArray(json?.items)) setItems(json.items);
        if (Array.isArray(json?.stats)) setStats(json.stats);
        if (Array.isArray(json?.patches)) setPatches(json.patches);
        if (Array.isArray(json?.changes)) setChanges(json.changes);

        const firstId = (json?.items?.[0]?.id as string) || "";
        if (firstId) setSelectedId((prev) => prev || firstId);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load gear");
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

  const patchById = useMemo(() => {
    const m = new Map<string, Patch>();
    for (const p of patches) m.set(p.id, p);
    return m;
  }, [patches]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = items.slice();

    if (q) {
      list = list.filter((i) => {
        const inName = i.name.toLowerCase().includes(q);
        const inTags = (i.tags || []).some((t) => String(t).toLowerCase().includes(q));
        return inName || inTags;
      });
    }

    if (typeFilter !== "all") list = list.filter((i) => i.type === typeFilter);
    if (rarityFilter !== "all") list = list.filter((i) => i.rarity === rarityFilter);

    // stable sort: rarity then name
    const rarityRank: Record<Rarity, number> = {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5,
    };

    list.sort((a, b) => {
      const ra = rarityRank[a.rarity] || 0;
      const rb = rarityRank[b.rarity] || 0;
      if (rb !== ra) return rb - ra;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [items, query, typeFilter, rarityFilter]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  const selectedStats = useMemo(() => {
    if (!selected) return [];
    return stats.filter((s) => s.itemId === selected.id);
  }, [stats, selected]);

  const selectedChanges = useMemo(() => {
    if (!selected) return [];
    const list = changes
      .filter((c) => c.itemId === selected.id)
      .map((c) => ({ ...c, patch: patchById.get(c.patchId) }))
      .sort((a, b) => {
        const da = a.patch?.releasedAt ? new Date(a.patch.releasedAt).getTime() : 0;
        const db = b.patch?.releasedAt ? new Date(b.patch.releasedAt).getTime() : 0;
        return db - da;
      });

    return list;
  }, [changes, selected, patchById]);

  useEffect(() => {
    // Keep selection valid when filters change
    if (!selectedId) return;
    const stillExists = filtered.some((i) => i.id === selectedId);
    if (!stillExists) {
      setSelectedId(filtered[0]?.id || "");
    }
  }, [filtered, selectedId]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">
              Gear
            </div>
            <div className="mt-1 text-2xl font-bold tracking-wide">
              Items and Stat Changes
            </div>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              Track weapons, armor, tools, and balance shifts over time. Built for guild standards and shared builds.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Items: {items.length}
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
        {/* Left: List */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold tracking-wide">Catalog</div>
              <div className="text-xs text-zinc-500">Search and filter</div>
            </div>
            <span className="text-xs text-zinc-500">{filtered.length} shown</span>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs font-semibold text-zinc-300">Search</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name or tag"
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
                  <option value="weapon">Weapon</option>
                  <option value="armor">Armor</option>
                  <option value="tool">Tool</option>
                  <option value="consumable">Consumable</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-300">Rarity</div>
                <select
                  value={rarityFilter}
                  onChange={(e) => setRarityFilter(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="all">All</option>
                  <option value="common">Common</option>
                  <option value="uncommon">Uncommon</option>
                  <option value="rare">Rare</option>
                  <option value="epic">Epic</option>
                  <option value="legendary">Legendary</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                Loading gear…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center">
                <div className="text-sm font-semibold text-zinc-200">No results</div>
                <div className="mt-1 text-sm text-zinc-400">
                  Try a different search or filter.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((i) => {
                  const isSelected = i.id === selectedId;
                  return (
                    <button
                      key={i.id}
                      onClick={() => setSelectedId(i.id)}
                      className={
                        "w-full rounded-2xl border p-3 text-left transition " +
                        (isSelected
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : "border-white/10 bg-black/25 hover:border-emerald-400/20 hover:bg-black/30")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <IconBlock url={i.iconUrl} name={i.name} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold tracking-wide text-zinc-100">
                            {i.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge label={i.type.toUpperCase()} cls={typeTone(i.type)} />
                            <Badge label={i.rarity.toUpperCase()} cls={rarityTone(i.rarity)} />
                            {i.slot ? (
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                                {i.slot}
                              </span>
                            ) : null}
                          </div>
                          {i.tags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {i.tags.slice(0, 4).map((t) => (
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
            Future: add officer only edit controls and approval workflow for “guild standard” gear lists.
          </div>
        </div>

        {/* Right: Detail */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-wide">Details</div>
                <div className="mt-2 flex items-start gap-3">
                  <IconBlock url={selected?.iconUrl} name={selected?.name || "Selected"} />
                  <div className="min-w-0">
                    <div className="truncate text-xl font-bold tracking-wide text-zinc-100">
                      {selected ? selected.name : "Select an item"}
                    </div>
                    {selected ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge label={selected.type.toUpperCase()} cls={typeTone(selected.type)} />
                        <Badge label={selected.rarity.toUpperCase()} cls={rarityTone(selected.rarity)} />
                        {selected.slot ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                            Slot: {selected.slot}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                {selected?.description ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
                    {selected.description}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-zinc-500">
                    Pick an item to view stats and patch history.
                  </div>
                )}
              </div>

              <div className="hidden md:block">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-xs font-semibold text-zinc-300">Signal</div>
                  <div className="mt-2 text-sm text-zinc-400">
                    Later: show “recommended for builds” and “guild approved” state here.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats + Changes */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold tracking-wide">Stats</div>
                <span className="text-xs text-zinc-500">
                  {selected ? selectedStats.length : 0} entries
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {!selected ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    Select an item to view stats.
                  </div>
                ) : selectedStats.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    No stats yet.
                  </div>
                ) : (
                  selectedStats.map((s) => (
                    <div
                      key={`${s.itemId}:${s.key}`}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                    >
                      <div className="text-sm text-zinc-300">{prettyStatKey(s.key)}</div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {safeNumber(s.value)}{s.unit ? ` ${s.unit}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 text-[11px] text-zinc-500">
                Tip: store stats as key/value so you can support new patches without schema migrations.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold tracking-wide">Patch Changes</div>
                <span className="text-xs text-zinc-500">
                  {selected ? selectedChanges.length : 0} changes
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {!selected ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    Select an item to view patch history.
                  </div>
                ) : selectedChanges.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    No recorded changes.
                  </div>
                ) : (
                  selectedChanges.map((c, idx) => {
                    const patchLabel = c.patch ? `${c.patch.version} • ${fmtDate(c.patch.releasedAt)}` : c.patchId;
                    const up = c.newValue > c.oldValue;
                    const tone = up ? "emerald" : c.newValue < c.oldValue ? "rose" : "zinc";

                    return (
                      <div
                        key={`${c.itemId}:${c.patchId}:${c.key}:${idx}`}
                        className="rounded-2xl border border-white/10 bg-black/25 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold tracking-wide text-zinc-100">
                              {prettyStatKey(c.key)}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">{patchLabel}</div>
                          </div>

                          <Badge
                            label={up ? "Buff" : c.newValue < c.oldValue ? "Nerf" : "Change"}
                            cls={tone === "emerald"
                              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                              : tone === "rose"
                              ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                              : "border-white/10 bg-white/5 text-zinc-200"}
                          />
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="text-xs text-zinc-400">Old</div>
                          <div className="text-sm font-semibold text-zinc-200">
                            {safeNumber(c.oldValue)}{c.unit ? ` ${c.unit}` : ""}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                          <div className="text-xs text-zinc-400">New</div>
                          <div className="text-sm font-semibold text-zinc-100">
                            {safeNumber(c.newValue)}{c.unit ? ` ${c.unit}` : ""}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="mt-4 text-[11px] text-zinc-500">
                Future: auto import changes by patch notes and let officers approve entries.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
        Next: builds can reference items by ID so loadouts automatically reflect patch changes.
      </div>
    </div>
  );
}

function prettyStatKey(key: string) {
  // simple label mapping without getting fancy
  const map: Record<string, string> = {
    damage: "Damage",
    attackSpeed: "Attack Speed",
    staminaCost: "Stamina Cost",
    spellPower: "Spell Power",
    manaRegen: "Mana Regen",
    critChance: "Crit Chance",
    drawSpeed: "Draw Speed",
    armor: "Armor",
    stamina: "Stamina",
    fireResist: "Fire Resist",
    harvestSpeed: "Harvest Speed",
    durability: "Durability",
  };
  return map[key] || key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}
