"use client";

import { useMemo, useState } from "react";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

export default function SyncRolesButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const guildId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const g = String(sp.get("guildId") || "").trim();
    return g && isSnowflake(g) ? g : null;
  }, []);

  async function run() {
    setLoading(true);
    setMsg(null);

    try {
      const url = guildId
        ? `/api/discord/sync-roles?guildId=${encodeURIComponent(guildId)}`
        : "/api/discord/sync-roles";

      const res = await fetch(url, { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || "Sync failed");
      }

      const rolesCount =
        json?.rolesCount ??
        json?.memberRoleCount ??
        json?.memberRolesCount ??
        0;

      const rolesEnabled =
        typeof json?.rolesEnabled === "boolean" ? json.rolesEnabled : null;

      setMsg(
        rolesEnabled === null
          ? `Synced ${rolesCount} roles`
          : `Synced ${rolesCount} roles (rolesEnabled: ${rolesEnabled ? "yes" : "no"})`
      );
    } catch (e: any) {
      setMsg(e?.message || "Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={run}
        disabled={loading}
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 hover:border-white/20 disabled:opacity-60"
      >
        {loading ? "Syncing…" : "Sync Roles"}
      </button>

      {msg ? <span className="text-xs text-zinc-400">{msg}</span> : null}
    </div>
  );
}
