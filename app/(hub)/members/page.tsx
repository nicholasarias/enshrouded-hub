"use client";

import { useEffect, useMemo, useState } from "react";

type HubRole = {
  id: string;
  name: string;
  color?: "emerald" | "cyan" | "rose" | "amber" | "zinc";
};

type Perk = {
  id: string;
  name: string;
  description: string;
  requiredLevel: number;
  requiredRoleId?: string | null;
};

type Member = {
  id: string;
  discordUserId?: string;
  displayName: string;
  avatarUrl?: string | null;
  hubRoleIds: string[];
  level: number;
  xp: number;
  xpToNext: number;
  perksUnlocked: string[];
  discordRoles?: string[];
  lastActiveLabel?: string;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toneToClasses(tone: HubRole["color"] = "zinc") {
  if (tone === "emerald") return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  if (tone === "cyan") return "border-cyan-400/25 bg-cyan-400/10 text-cyan-100";
  if (tone === "rose") return "border-rose-400/25 bg-rose-400/10 text-rose-100";
  if (tone === "amber") return "border-amber-400/25 bg-amber-400/10 text-amber-100";
  return "border-white/10 bg-white/5 text-zinc-200";
}

function Badge({ label, tone }: { label: string; tone?: HubRole["color"] }) {
  const cls = toneToClasses(tone);
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

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={name} src={url} className="h-10 w-10 rounded-2xl border border-white/10 object-cover" />;
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-zinc-100">
      {initials || "?"}
    </div>
  );
}

const rolesSeed: HubRole[] = [
  { id: "officer", name: "Officer", color: "emerald" },
  { id: "builder", name: "Builder", color: "cyan" },
  { id: "farmer", name: "Farmer", color: "amber" },
  { id: "raider", name: "Raider", color: "rose" },
  { id: "member", name: "Member", color: "zinc" },
];

const perksSeed: Perk[] = [
  {
    id: "perk-map-pins",
    name: "Shared Map Pins",
    description: "Create and view guild pins on the map.",
    requiredLevel: 2,
  },
  {
    id: "perk-build-post",
    name: "Build Publishing",
    description: "Post builds to the guild catalog.",
    requiredLevel: 3,
  },
  {
    id: "perk-schedule-create",
    name: "Session Creation",
    description: "Create sessions that auto post to Discord.",
    requiredLevel: 4,
  },
  {
    id: "perk-gear-edit",
    name: "Gear Curator",
    description: "Edit items and note stat changes.",
    requiredLevel: 5,
    requiredRoleId: "officer",
  },
];

const membersSeed: Member[] = [
  {
    id: "m1",
    displayName: "Flameborn Captain",
    hubRoleIds: ["officer", "raider"],
    level: 5,
    xp: 320,
    xpToNext: 450,
    perksUnlocked: ["perk-map-pins", "perk-build-post", "perk-schedule-create", "perk-gear-edit"],
    lastActiveLabel: "Active today",
  },
  {
    id: "m2",
    displayName: "Stonewright",
    hubRoleIds: ["builder", "member"],
    level: 3,
    xp: 140,
    xpToNext: 220,
    perksUnlocked: ["perk-map-pins", "perk-build-post"],
    lastActiveLabel: "Active yesterday",
  },
  {
    id: "m3",
    displayName: "Huntmaster",
    hubRoleIds: ["farmer", "member"],
    level: 2,
    xp: 60,
    xpToNext: 120,
    perksUnlocked: ["perk-map-pins"],
    lastActiveLabel: "Active 3 days ago",
  },
];

export default function MembersPage() {
  const guildId = process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<HubRole[]>(rolesSeed);
  const [perks, setPerks] = useState<Perk[]>(perksSeed);
  const [members, setMembers] = useState<Member[]>(membersSeed);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"level" | "name">("level");

  useEffect(() => {
    let alive = true;

    async function tryLoad() {
      try {
        setError(null);

        // Optional future endpoint. If missing, we keep seed data.
        // Expected shape: { roles: HubRole[], perks: Perk[], members: Member[] }
        const res = await fetch(`/api/members?guildId=${encodeURIComponent(guildId)}`, {
          cache: "no-store",
        });

        if (!alive) return;

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const json = await res.json();
        if (json?.roles && Array.isArray(json.roles)) setRoles(json.roles);
        if (json?.perks && Array.isArray(json.perks)) setPerks(json.perks);
        if (json?.members && Array.isArray(json.members)) setMembers(json.members);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load members");
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

  const roleById = useMemo(() => {
    const m = new Map<string, HubRole>();
    for (const r of roles) m.set(r.id, r);
    return m;
  }, [roles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = members.slice();

    if (q) {
      list = list.filter((m) => m.displayName.toLowerCase().includes(q));
    }

    if (roleFilter !== "all") {
      list = list.filter((m) => m.hubRoleIds.includes(roleFilter));
    }

    if (sortBy === "name") {
      list.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } else {
      list.sort((a, b) => safeNumber(b.level) - safeNumber(a.level));
    }

    return list;
  }, [members, query, roleFilter, sortBy]);

  const officersCount = useMemo(() => members.filter((m) => m.hubRoleIds.includes("officer")).length, [members]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">
              Members
            </div>
            <div className="mt-1 text-2xl font-bold tracking-wide">
              Guild Roster and Perks
            </div>
            <div className="mt-2 max-w-2xl text-sm text-zinc-400">
              Roles, levels, and unlocks tied to your Discord identity and guild permissions.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Members: {members.length}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300">
              Officers: {officersCount}
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

      {/* Filters */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] lg:col-span-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-sm font-semibold tracking-wide">Roster</div>
              <div className="text-xs text-zinc-500">
                Search and filter members
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-semibold text-zinc-300">Search</div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name"
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-300">Role</div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="all">All</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="text-xs font-semibold text-zinc-300">Sort</div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/30"
                >
                  <option value="level">Level</option>
                  <option value="name">Name</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center text-sm text-zinc-400">
                Loading roster…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-10 text-center">
                <div className="text-sm font-semibold text-zinc-200">No results</div>
                <div className="mt-1 text-sm text-zinc-400">
                  Try a different search or role filter.
                </div>
              </div>
            ) : (
              filtered.map((m) => (
                <MemberCard key={m.id} member={m} roles={roleById} perks={perks} />
              ))
            )}
          </div>

          <div className="mt-4 text-[11px] text-zinc-500">
            Tip: Once Discord login is live, this page can show a member’s Discord roles and auto assign hub roles using mappings.
          </div>
        </div>

        {/* Perks panel */}
        <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-wide">Perks</div>
            <span className="text-xs text-zinc-500">{perks.length} total</span>
          </div>

          <div className="mt-4 space-y-3">
            {perks.map((p) => {
              const role = p.requiredRoleId ? roleById.get(p.requiredRoleId) : null;
              return (
                <div key={p.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold tracking-wide text-zinc-100">
                        {p.name}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">{p.description}</div>
                    </div>
                    <IconBlock />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge label={`Level ${p.requiredLevel}+`} tone="emerald" />
                    {role ? <Badge label={role.name} tone={role.color} /> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
            Future: perk unlock rules can be computed from levels, hub roles, and officer overrides.
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberCard({
  member,
  roles,
  perks,
}: {
  member: Member;
  roles: Map<string, HubRole>;
  perks: Perk[];
}) {
  const xp = safeNumber(member.xp, 0);
  const xpToNext = Math.max(1, safeNumber(member.xpToNext, 1));
  const pct = clamp((xp / xpToNext) * 100, 0, 100);

  const unlocked = new Set(member.perksUnlocked || []);

  const roleBadges = member.hubRoleIds
    .map((id) => roles.get(id))
    .filter(Boolean) as HubRole[];

  const unlockedCount = perks.filter((p) => unlocked.has(p.id)).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-emerald-400/20 hover:bg-black/30">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <Avatar name={member.displayName} url={member.avatarUrl} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-base font-bold tracking-wide text-zinc-100">
                {member.displayName}
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300">
                Level {safeNumber(member.level, 1)}
              </span>
              {member.lastActiveLabel ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400">
                  {member.lastActiveLabel}
                </span>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {roleBadges.length > 0 ? (
                roleBadges.map((r) => <Badge key={r.id} label={r.name} tone={r.color} />)
              ) : (
                <Badge label="Unassigned" tone="zinc" />
              )}
              <Badge label={`Perks ${unlockedCount}/${perks.length}`} tone="cyan" />
            </div>

            {/* XP Bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Progress</span>
                <span>
                  {xp}/{xpToNext} XP
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full border border-white/10 bg-black/30">
                <div
                  className="h-full bg-emerald-400/30"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Unlock preview */}
        <div className="flex flex-col gap-2 md:items-end">
          <div className="text-xs font-semibold text-zinc-300">Unlocks</div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {perks.slice(0, 3).map((p) => {
              const isUnlocked = unlocked.has(p.id);
              return (
                <span
                  key={p.id}
                  className={
                    isUnlocked
                      ? "rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-xs text-emerald-100"
                      : "rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-400"
                  }
                  title={p.description}
                >
                  {isUnlocked ? "Unlocked" : "Locked"}: {p.name}
                </span>
              );
            })}
          </div>
          <div className="text-[11px] text-zinc-600">
            Full perk detail page later
          </div>
        </div>
      </div>
    </div>
  );
}
