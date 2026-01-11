"use client";

import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">
          Dashboard
        </div>
        <div className="mt-1 text-2xl font-bold tracking-wide">
          Flameborn Command Console
        </div>
        <div className="mt-2 max-w-2xl text-sm text-zinc-400">
          Your guild’s current state, upcoming activity, and quick access to core tools.
        </div>
      </div>

      {/* Top Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Next Session */}
        <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold tracking-wide">
              Next Session
            </div>
            <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200">
              Live
            </span>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="text-base font-bold text-zinc-100">
              No session scheduled
            </div>
            <div className="mt-1 text-sm text-zinc-400">
              Create one to rally the guild.
            </div>
            <Link
              href="/schedule"
              className="mt-4 inline-block rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400/40 hover:bg-emerald-400/15"
            >
              Open Schedule
            </Link>
          </div>
        </div>

        {/* Guild Snapshot */}
        <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="text-sm font-semibold tracking-wide">
            Guild Snapshot
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <span className="text-sm text-zinc-300">Members</span>
              <span className="text-sm font-semibold text-zinc-100">
                —
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <span className="text-sm text-zinc-300">Officers</span>
              <span className="text-sm font-semibold text-zinc-100">
                —
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <span className="text-sm text-zinc-300">Active Builds</span>
              <span className="text-sm font-semibold text-zinc-100">
                —
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-zinc-500">
            These will populate automatically once Discord sync and hub roles are enabled.
          </div>
        </div>

        {/* Realm Status */}
        <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="text-sm font-semibold tracking-wide">
            Realm Status
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/25 p-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/40" />
              <span className="text-sm font-semibold text-zinc-100">
                Operational
              </span>
            </div>
            <div className="mt-2 text-sm text-zinc-400">
              No known outages. Patch tracking coming soon.
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-2xl border border-white/10 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="text-sm font-semibold tracking-wide">
          Quick Actions
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard
            href="/members"
            title="Members"
            desc="Roles, levels, perks"
          />
          <ActionCard
            href="/gear"
            title="Gear"
            desc="Items and stat changes"
          />
          <ActionCard
            href="/builds"
            title="Builds"
            desc="Loadouts and archetypes"
          />
          <ActionCard
            href="/map"
            title="Map"
            desc="Pins, routes, resources"
          />
        </div>
      </div>

      {/* Footer Note */}
      <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
        This hub is designed to grow with Enshrouded and future games without rewriting core systems.
      </div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-emerald-400/30 hover:bg-black/30"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-bold tracking-wide text-zinc-100">
            {title}
          </div>
          <div className="mt-1 text-sm text-zinc-400">
            {desc}
          </div>
        </div>
        <div className="mt-1 h-3 w-3 rounded-full bg-emerald-400/20 opacity-0 transition group-hover:opacity-100" />
      </div>
    </Link>
  );
}
