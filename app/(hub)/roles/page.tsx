"use client";

import { useEffect, useMemo, useState } from "react";

type Perk = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
};

type RoleMeta = {
  guild_id: string;
  role_id: string;
  role_kind: "combat" | "logistics";
  group_key: "strength" | "intelligence" | "dexterity" | "logistics";
  display_name: string | null;
  description: string | null;
  updated_at: string;
};

type RoleRow = {
  guildId: string;
  roleId: string;
  name: string;
  colorInt: number;
  position: number;
  isManaged: boolean;
  updatedAt: string;
  meta: RoleMeta | null;
  perks: Perk[];
};

const GROUPS: Array<{ key: RoleMeta["group_key"]; label: string; sub: string }> = [
  { key: "strength", label: "Strength Group", sub: "Front liners. Shields, parries, heavy hits." },
  { key: "intelligence", label: "Intelligence Group", sub: "AOE, healing, wand builds, utility." },
  { key: "dexterity", label: "Dexterity Group", sub: "Ranged, stealth, stamina, mobility." },
  { key: "logistics", label: "Logistics Roles", sub: "Keeps the server smooth and organized." },
];

function roleColorHex(colorInt: number) {
  if (!Number.isFinite(colorInt) || colorInt <= 0) return "#999";
  return "#" + colorInt.toString(16).padStart(6, "0");
}

export default function RolesPublicPage() {
  const guildId = useMemo(() => (process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);

  async function load() {
    if (!guildId) {
      setError("Missing NEXT_PUBLIC_DISCORD_GUILD_ID.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/roles?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load roles");

      const list: RoleRow[] = json.roles || [];

      // Only show configured roles (meta exists)
      const configured = list
        .filter((r) => r.roleId !== guildId) // hide @everyone
        .filter((r) => !!r.meta)
        .filter((r) => !r.isManaged);

      setRoles(configured);
    } catch (e: any) {
      setError(e?.message || "Failed to load roles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const grouped = useMemo(() => {
    const map = new Map<RoleMeta["group_key"], RoleRow[]>();
    for (const g of GROUPS) map.set(g.key, []);

    for (const r of roles) {
      const key = r.meta!.group_key;
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (b.position || 0) - (a.position || 0));
      map.set(k, arr);
    }

    return map;
  }, [roles]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Roles</h1>

        <a
          href="/my-role"
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid #ddd",
            textDecoration: "none",
            fontWeight: 800,
            display: "inline-block",
          }}
        >
          Choose my roles
        </a>

        <button onClick={load} style={{ padding: "6px 10px" }} disabled={loading}>
          Refresh
        </button>
      </div>

      <div style={{ opacity: 0.8 }}>
        Everyone can view this page. To pick your loadout path, use <b>Choose my roles</b>.
      </div>

      {loading ? <div>Loading…</div> : null}
      {error ? (
        <div style={{ padding: 10, border: "1px solid #fca5a5", borderRadius: 8 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {GROUPS.map((g) => {
          const list = grouped.get(g.key) || [];
          return (
            <div key={g.key} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "grid", gap: 4, marginBottom: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 18 }}>{g.label}</div>
                <div style={{ fontSize: 13, opacity: 0.8 }}>{g.sub}</div>
              </div>

              {list.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No roles configured in this group yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {list.map((r) => {
                    const label = r.meta?.display_name || r.name;

                    return (
                      <div
                        key={r.roleId}
                        style={{
                          border: "1px solid #eee",
                          borderRadius: 10,
                          padding: 12,
                          display: "grid",
                          gap: 8,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              background: roleColorHex(r.colorInt),
                              display: "inline-block",
                            }}
                          />
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{label}</div>
                          <span style={{ fontSize: 12, opacity: 0.7 }}>
                            {r.meta?.role_kind === "combat" ? "Combat" : "Logistics"}
                          </span>
                        </div>

                        {r.meta?.description ? (
                          <div style={{ opacity: 0.85 }}>{r.meta.description}</div>
                        ) : null}

                        {r.perks?.length ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {r.perks.map((p) => (
                              <span
                                key={p.key}
                                style={{
                                  fontSize: 12,
                                  padding: "3px 8px",
                                  border: "1px solid #ddd",
                                  borderRadius: 999,
                                }}
                              >
                                {p.icon ? `${p.icon} ` : ""}
                                {p.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, opacity: 0.7 }}>No perks assigned yet.</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
