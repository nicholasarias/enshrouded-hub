import type { ReactNode } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function NavItem({
  href,
  label,
  hint,
}: {
  href: string;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-emerald-400/40 hover:bg-emerald-400/5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-wide text-zinc-100">
          {label}
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-400/30 opacity-0 transition group-hover:opacity-100" />
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-zinc-400">{hint}</div>
      ) : null}
    </Link>
  );
}

function RuneBar() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/40" />
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/25" />
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/15" />
    </div>
  );
}

export default function HubLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100">
      {/* Background texture */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(16,185,129,0.12),transparent_60%),radial-gradient(900px_500px_at_80%_30%,rgba(34,211,238,0.09),transparent_55%),radial-gradient(900px_600px_at_50%_90%,rgba(244,63,94,0.06),transparent_55%)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/50 to-black/80" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl gap-4 px-4 py-4 md:gap-6 md:px-6 md:py-6">
        {/* Sidebar */}
        <aside className="hidden w-72 flex-none md:block">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-emerald-300/80">
                    Enshrouded Hub
                  </div>
                  <div className="mt-1 text-lg font-bold tracking-wide">
                    Guild Console
                  </div>
                </div>
                <RuneBar />
              </div>

              <div className="mt-3 text-xs text-zinc-400">
                Sessions, roles, builds, gear, and map tools in one place.
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link
                  href="/schedule"
                  className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-center text-xs font-semibold text-emerald-100 transition hover:border-emerald-400/40 hover:bg-emerald-400/15"
                >
                  Open Schedule
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-zinc-100 transition hover:border-white/15 hover:bg-white/7"
                >
                  Dashboard
                </Link>
              </div>

              <div className="mt-3">
                <Link
                  href="/api/auth/signin/discord"
                  className="flex items-center justify-center rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/15 hover:bg-white/5"
                  title="Discord sign in"
                >
                  Link Discord
                </Link>
                <div className="mt-2 text-[11px] text-zinc-500">
                  This assumes NextAuth route at /api/auth.
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-3">
              <div className="px-2 pb-2 text-xs font-semibold tracking-wide text-zinc-200">
                Navigation
              </div>
              <div className="space-y-2">
                <NavItem href="/dashboard" label="Dashboard" hint="Status and quick links" />
                <NavItem href="/schedule" label="Schedule" hint="Create sessions and RSVP" />
                <NavItem href="/members" label="Members" hint="Roles, levels, perks" />
                <NavItem href="/gear" label="Gear" hint="Items and stat changes" />
                <NavItem href="/map" label="Map" hint="Pins, routes, notes" />
                <NavItem href="/builds" label="Builds" hint="Loadouts and archetypes" />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wide text-zinc-200">
                  Realm Status
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200">
                  Online
                </span>
              </div>
              <div className="mt-2 text-xs text-zinc-400">
                In the future this can show server uptime, patch notes, and recent guild activity.
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="w-full">
          {/* Top bar */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl border border-emerald-400/20 bg-emerald-400/10" />
              <div>
                <div className="text-sm font-semibold tracking-wide">Enshrouded Hub</div>
                <div className="text-xs text-zinc-400">
                  Flameborn tools for your guild
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/api/auth/signin/discord"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-100 transition hover:border-white/15 hover:bg-white/7"
              >
                Link Discord
              </Link>
              <div className="hidden md:block">
                <RuneBar />
              </div>
            </div>
          </div>

          {children}

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs text-zinc-500">
            Tip: Keep the hub feel consistent. Every page should look like it belongs in the same in game menu.
          </div>
        </main>
      </div>
    </div>
  );
}
