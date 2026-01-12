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

type UserSelection = {
  combatRoleId: string | null;
  logisticsRoleId: string | null;
};

const GROUPS: Array<{ key: RoleMeta["group_key"]; label: string }> = [
  { key: "strength", label: "Strength Group (Combat)" },
  { key: "intelligence", label: "Intelligence Group (Combat)" },
  { key: "dexterity", label: "Dexterity Group (Combat)" },
  { key: "logistics", label: "Logistics Roles" },
];

function roleColorHex(colorInt: number) {
  if (!Number.isFinite(colorInt) || colorInt <= 0) return "#999";
  return "#" + colorInt.toString(16).padStart(6, "0");
}

export default function MyRolePage() {
  const guildId = useMemo(() => (process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim(), []);

  const [loading, setLoading] = useState(true);
  const [busyRoleId, setBusyRoleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [selection, setSelection] = useState<UserSelection>({
    combatRoleId: null,
    logisticsRoleId: null,
  });

  async function loadRoles() {
    if (!guildId) {
      setError("Missing NEXT_PUBLIC_DISCORD_GUILD_ID for My Role page.");
      return;
    }

    try {
      const res = await fetch(`/api/roles?guildId=${encodeURIComponent(guildId)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load roles");

      const list: RoleRow[] = json.roles || [];

      // Only show configured roles (must have meta so we know combat/logistics)
      const configured = list
        .filter((r) => r.roleId !== guildId) // hide @everyone
        .filter((r) => !!r.meta) // hide roles not configured yet
        .filter((r) => !r.isManaged);

      setRoles(configured);
    } catch (e: any) {
      setError(e?.message || "Failed to load roles");
    }
  }

  async function loadSelections() {
    if (!guildId) return;

    try {
      const res = await fetch(`/api/me/selected-roles?guildId=${encodeURIComponent(guildId)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) return;

      setSelection({
        combatRoleId: json.combatRoleId || null,
        logisticsRoleId: json.logisticsRoleId || null,
      });
    } catch {
      // ignore
    }
  }

  async function selectRole(role: RoleRow) {
    setBusyRoleId(role.roleId);
    setError(null);

    try {
      const res = await fetch("/api/me/select-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, roleId: role.roleId }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to select role");

      const kind = json?.role?.roleKind as "combat" | "logistics" | undefined;
      if (kind === "combat") {
        setSelection((prev) => ({ ...prev, combatRoleId: role.roleId }));
      } else if (kind === "logistics") {
        setSelection((prev) => ({ ...prev, logisticsRoleId: role.roleId }));
      }
    } catch (e: any) {
      setError(e?.message || "Failed to select role");
    } finally {
      setBusyRoleId(null);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadRoles();
        await loadSelections();
      } finally {
        setLoading(false);
      }
    })();
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

  function isSelected(role: RoleRow) {
    const kind = role.meta?.role_kind;
    if (kind === "combat") return selection.combatRoleId === role.roleId;
    if (kind === "logistics") return selection.logisticsRoleId === role.roleId;
    return false;
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>My Role</h1>
        <button
          onClick={() => {
            (async () => {
              setLoading(true);
              setError(null);
              try {
                await loadRoles();
                await loadSelections();
              } finally {
                setLoading(false);
              }
            })();
          }}
          style={{ padding: "6px 10px" }}
          disabled={loading || !!busyRoleId}
        >
          Refresh
        </button>
      </div>

      <div style={{ opacity: 0.8 }}>
        Pick <b>one combat role</b> and <b>one logistics role</b>. You can change later.
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
              <div style={{ fontWeight: 900, marginBottom: 8 }}>{g.label}</div>

              {list.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No roles configured in this group yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {list.map((r) => {
                    const label = r.meta?.display_name || r.name;
                    const selected = isSelected(r);

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
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{label}</div>
                          {selected ? (
                            <span
                              style={{
                                fontSize: 12,
                                padding: "2px 8px",
                                border: "1px solid #ddd",
                                borderRadius: 999,
                                opacity: 0.8,
                              }}
                            >
                              Selected
                            </span>
                          ) : null}
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

                        <div>
                          <button
                            onClick={() => selectRole(r)}
                            disabled={!!busyRoleId}
                            style={{ padding: "8px 12px", fontWeight: 800 }}
                          >
                            {busyRoleId === r.roleId
                              ? "Selecting…"
                              : selected
                                ? "Selected"
                                : "Select this role"}
                          </button>

                          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
                            Selecting replaces your previous {r.meta?.role_kind} role.
                          </div>
                        </div>
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
