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
  slot?: string | null;
  iconUrl?: string | null;
  tags?: string[];
};

type ItemStat = {
  itemId: string;
  key: string;
  value: number;
  unit?: string | null;
};

type BuildRole = "tank" | "dps" | "support" | "harvest" | "explore";

type Build = {
  id: string;
  name: string;
  role: BuildRole;
  difficulty: "easy" | "medium" | "hard";
  description?: string | null;
  authorName?: string | null;
  updatedAt?: string | null;

  // References gear by item id
  gear: {
    weaponPrimary?: string | null;
    weaponSecondary?: string | null;
    helm?: string | null;
    chest?: string | null;
    legs?: string | null;
    gloves?: string | null;
    boots?: string | null;
    tool?: string | null;
  };

  tags?: string[];
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

function roleTone(role: BuildRole) {
  if (role === "tank") return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  if (role === "dps") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  if (role === "support") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (role === "harvest") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/5 text-zinc-200";
}

function difficultyTone(d: Build["difficulty"]) {
  if (d === "hard") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  if (d === "medium") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
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

// Seed gear mirrors the gear page IDs so build loadouts feel connected.
const seedItems: GearItem[] = [
  { id: "i_sword_ember", name: "Embersteel Longsword", type: "weapon", rarity: "rare", tags: ["melee", "slash"] },
  { id: "i_staff_shroud", name: "Shroudwood Staff", type: "weapon", rarity: "epic", tags: ["magic", "focus"] },
  { id: "i_bow_ashen", name: "Ashen Recurve Bow", type: "weapon", rarity: "uncommon", tags: ["ranged", "pierce"] },
  { id: "i_helm_stone", name: "Stoneguard Helm", type: "armor", rarity: "rare", slot: "Head", tags: ["defense"] },
  { id: "i_chest_flame", name: "Flamewoven Chest", type: "armor", rarity: "epic", slot: "Chest", tags: ["defense", "stamina"] },
  { id: "i_pick_brutal", name: "Brutal Pickaxe", type: "tool", rarity: "uncommon", tags: ["gathering"] },
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

const seedBuilds: Build[] = [
  {
    id: "b_flame_knight",
    name: "Flame Knight",
    role: "tank",
    difficulty: "medium",
    description: "Frontline stability with stamina support. Built for long fights and safe revives.",
    authorName: "Flameborn Captain",
    updatedAt: "2025-03-22T00:00:00.000Z",
    gear: {
      weaponPrimary: "i_sword_ember",
      helm: "i_helm_stone",
      chest: "i_chest_flame",
      tool: "i_pick_brutal",
    },
    tags: ["frontline", "group", "survivability"],
  },
  {
    id: "b_shroud_mage",
    name: "Shroud Mage",
    role: "dps",
    difficulty: "hard",
    description: "High spell power with crit leaning. Best when protected by a frontline.",
    authorName: "Stonewright",
    updatedAt: "2025-03-18T00:00:00.000Z",
    gear: {
      weaponPrimary: "i_staff_shroud",
      chest: "i_chest_flame",
    },
    tags: ["magic", "burst"],
  },
  {
    id: "b_ash_ranger",
    name: "Ash Ranger",
    role: "explore",
    difficulty: "easy",
    description: "Lightweight ranged setup for scouting, kiting, and map discovery.",
    authorName: "Huntmaster",
    updatedAt: "2025-01-28T00:00:00.000Z",
    gear: {
      weaponPrimary: "i_bow_ashen",
      helm: "i_helm_stone",
    },
    tags: ["ranged", "mobility"],
  },
];

export default function BuildsPage() {
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [items, setItems] = useState<GearItem[]>(seedItems);
  const [stats, setStats] = useState<ItemStat[]>(seedStats);
  const [builds, setBuilds] = useState<Build[]>(seedBuilds);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<BuildRole | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<Build["difficulty"] | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(seedBuilds[0]?.id || "");

  useEffect(() => {
    let alive = true;

    async function tryLoad() {
      try {
        setError(null);

        // Optional future endpoints.
        // /api/builds -> { builds }
        // /api/gear -> { items, stats }
        const [bRes, gRes] = await Promise.allSettled([
          fetch(`/api/builds?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
          fetch(`/api/gear?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
        ]);

        if (!alive) return;

        if (bRes.status === "fulfilled" && bRes.value.ok) {
          const bj = await bRes.value.json();
          if (Array.isArray(bj?.builds)) setBuilds(bj.builds);
        }

        if (gRes.status === "fulfilled" && gRes.value.ok) {
          const gj = await gRes.value.json();
          if (Array.isArray(gj?.items)) setItems(gj.items);
          if (Array.isArray(gj?.stats)) setStats(gj.stats);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load builds");
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

  const itemById = useMemo(() => {
    const m = new Map<string, GearItem>();
    for (const it of items) m.set(it.id, it);
    return m;
  }, [items]);

  const statsByItem = useMemo(() => {
    const m = new Map<string, ItemStat[]>();
    for (const s of stats) {
      const list = m.get(s.itemId) || [];
      list.push(s);
      m.set(s.itemId, list);
    }
    return m;
  }, [stats]);

  const filteredBuilds = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = builds.slice();

    if (q) {
      list = list.filter((b) => {
        const inName = b.name.toLowerCase().includes(q);
        const inTags = (b.tags || []).some((t) => String(t).toLowerCase().includes(q));
        return inName || inTags;
      });
    }

    if (roleFilter !== "all") list = list.filter((b) => b.role === roleFilter);
    if (difficultyFilter !== "all") list = list.filter((b) => b.difficulty === difficultyFilter);

    list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [builds, query, roleFilter, difficultyFilter]);

  const selected = useMemo(() => builds.find((b) => b.id === selectedId) || null, [builds, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const still = filteredBuilds.some((b) => b.id === selectedId);
    if (!still) setSelectedId(filteredBuilds[0]?.id || "");
  }, [filteredBuilds, selectedId]);

  const equippedItemIds = useMemo(() => {
    if (!selected) return [];
    const g = selected.gear || {};
    const ids = [
      g.weaponPrimary,
      g.weaponSecondary,
      g.helm,
      g.chest,
      g.legs,
      g.gloves,
      g.boots,
      g.tool,
    ].filter(Boolean) as string[];
    return ids;
  }, [selected]);

  const equippedItems = useMemo(() => {
    return equippedItemIds.map((id) => itemById.get(id)).filter(Boolean) as GearItem[];
  }, [equippedItemIds, itemById]);

  const aggregatedStats = useMemo(() => {
    // Simple aggregation by key + unit.
    // NOTE: some stats should not be naively summed (like attackSpeed multipliers).
    // We keep it straightforward for MVP: sum numeric stats by key and display unit if consistent.
    const acc = new Map<string, { key: string; value: number; unit?: string | null; count: number }>();

    for (const id of equippedItemIds) {
      const list = statsByItem.get(id) || [];
      for (const s of list) {
        const k = s.key;
        const prev = acc.get(k);
        if (!prev) {
          acc.set(k, { key: k, value: safeNumber(s.value), unit: s.unit || null, count: 1 });
        } else {
          acc.set(k, {
            key: k,
            value: safeNumber(prev.value) + safeNumber(s.value),
            unit: prev.unit === (s.unit || null) ? prev.unit : prev.unit || s.unit || null,
            count: prev.count + 1,
          });
        }
      }
    }

    const out = Array.from(acc.values());
    out.sort((a, b) => b.value - a.value);
    return out;
  }, [equippedItemIds, statsByItem]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">
              Builds
            </div>
            <div className="mt-1 text-2xl font-bold tracking-wide">
              Loadouts and Archetypes
            </div>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              Save build templates, reference gear by ID, and keep loadouts aligned with patch changes.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Builds: {builds.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Gear linked: {items.length}
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
        {/* Left list */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold tracking-wide">Catalog</div>
              <div className="text-xs text-zinc-500">Search and filter builds</div>
            </div>
            <span className="text-xs text-zinc-500">{filteredBuilds.length} shown</span>
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
                <div className="text-xs font-semibold text-zinc-300">Role</div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="all">All</option>
                  <option value="tank">Tank</option>
                  <option value="dps">DPS</option>
                  <option value="support">Support</option>
                  <option value="harvest">Harvest</option>
                  <option value="explore">Explore</option>
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-300">Difficulty</div>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="all">All</option>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                Loading builds…
              </div>
            ) : filteredBuilds.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center">
                <div className="text-sm font-semibold text-zinc-200">No results</div>
                <div className="mt-1 text-sm text-zinc-400">Try a different search or filter.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBuilds.map((b) => {
                  const isSelected = b.id === selectedId;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setSelectedId(b.id)}
                      className={
                        "w-full rounded-2xl border p-3 text-left transition " +
                        (isSelected
                          ? "border-emerald-400/30 bg-emerald-400/10"
                          : "border-white/10 bg-black/25 hover:border-emerald-400/20 hover:bg-black/30")
                      }
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 flex-none rounded-2xl border border-emerald-400/20 bg-emerald-400/10" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold tracking-wide text-zinc-100">
                            {b.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <Badge label={b.role.toUpperCase()} cls={roleTone(b.role)} />
                            <Badge label={b.difficulty.toUpperCase()} cls={difficultyTone(b.difficulty)} />
                          </div>
                          {b.tags?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {b.tags.slice(0, 4).map((t) => (
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
            Future: Add “publish build” permission via perks, and allow builds to be shared to Discord.
          </div>
        </div>

        {/* Right detail */}
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-wide">Build Detail</div>

                <div className="mt-3">
                  <div className="text-xl font-bold tracking-wide text-zinc-100">
                    {selected ? selected.name : "Select a build"}
                  </div>

                  {selected ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge label={selected.role.toUpperCase()} cls={roleTone(selected.role)} />
                      <Badge label={selected.difficulty.toUpperCase()} cls={difficultyTone(selected.difficulty)} />
                      {selected.authorName ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                          By {selected.authorName}
                        </span>
                      ) : null}
                      {selected.updatedAt ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                          Updated {fmtDate(selected.updatedAt)}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {selected?.description ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
                    {selected.description}
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-zinc-500">
                    Pick a build to see its loadout and stat summary.
                  </div>
                )}
              </div>

              <div className="hidden md:block">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-xs font-semibold text-zinc-300">Guidance</div>
                  <div className="mt-2 text-sm text-zinc-400">
                    Later: show skill nodes, consumables, and playstyle rotation here.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Gear slots + Stats */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold tracking-wide">Loadout</div>
                <span className="text-xs text-zinc-500">{equippedItems.length} linked</span>
              </div>

              <div className="mt-4 space-y-2">
                {!selected ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    Select a build to view loadout.
                  </div>
                ) : (
                  <>
                    <SlotRow label="Primary Weapon" item={itemById.get(selected.gear.weaponPrimary || "") || null} />
                    <SlotRow label="Secondary Weapon" item={itemById.get(selected.gear.weaponSecondary || "") || null} />
                    <SlotRow label="Helm" item={itemById.get(selected.gear.helm || "") || null} />
                    <SlotRow label="Chest" item={itemById.get(selected.gear.chest || "") || null} />
                    <SlotRow label="Legs" item={itemById.get(selected.gear.legs || "") || null} />
                    <SlotRow label="Gloves" item={itemById.get(selected.gear.gloves || "") || null} />
                    <SlotRow label="Boots" item={itemById.get(selected.gear.boots || "") || null} />
                    <SlotRow label="Tool" item={itemById.get(selected.gear.tool || "") || null} />
                  </>
                )}
              </div>

              <div className="mt-4 text-[11px] text-zinc-500">
                This references gear by ID, so when gear stats change, the build reflects it automatically.
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold tracking-wide">Stat Summary</div>
                <span className="text-xs text-zinc-500">{aggregatedStats.length} keys</span>
              </div>

              <div className="mt-4 space-y-2">
                {!selected ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    Select a build to view stats.
                  </div>
                ) : aggregatedStats.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                    No stats found for equipped items.
                  </div>
                ) : (
                  aggregatedStats.slice(0, 10).map((s) => (
                    <div
                      key={s.key}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3"
                    >
                      <div className="text-sm text-zinc-300">{prettyStatKey(s.key)}</div>
                      <div className="text-sm font-semibold text-zinc-100">
                        {roundNice(s.value)}{s.unit ? ` ${s.unit}` : ""}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 text-[11px] text-zinc-500">
                Note: some keys should be combined by special rules (multipliers, caps). We can upgrade aggregation once your stat rules are defined.
              </div>
            </div>
          </div>

          {/* Linked items preview */}
          <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">Linked Gear</div>
              <span className="text-xs text-zinc-500">Quick view</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {equippedItems.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400 sm:col-span-2">
                  No linked gear for this build yet.
                </div>
              ) : (
                equippedItems.map((it) => (
                  <div key={it.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start gap-3">
                      <IconBlock url={it.iconUrl} name={it.name} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold tracking-wide text-zinc-100">{it.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge label={it.type.toUpperCase()} cls="border-white/10 bg-white/5 text-zinc-200" />
                          <Badge label={it.rarity.toUpperCase()} cls={rarityTone(it.rarity)} />
                          {it.slot ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                              {it.slot}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1">
                          {(statsByItem.get(it.id) || []).slice(0, 3).map((s) => (
                            <span
                              key={`${it.id}:${s.key}`}
                              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-400"
                              title={prettyStatKey(s.key)}
                            >
                              {prettyStatKey(s.key)} {roundNice(s.value)}{s.unit ? s.unit : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 text-[11px] text-zinc-500">
              Future: Add build export and a “post to Discord” button with an embed that lists gear and key stats.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
        Next: Style 1 map page. The fastest MVP is an embedded map with guild pin layers and notes.
      </div>
    </div>
  );
}

function SlotRow({ label, item }: { label: string; item: GearItem | null }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <div className="text-sm text-zinc-300">{label}</div>
      {item ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">{item.name}</span>
          <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${rarityTone(item.rarity)}`}>
            {item.rarity.toUpperCase()}
          </span>
        </div>
      ) : (
        <span className="text-xs text-zinc-500">Empty</span>
      )}
    </div>
  );
}

function prettyStatKey(key: string) {
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
  return map[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function roundNice(n: number) {
  const v = safeNumber(n, 0);
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, "");
}
