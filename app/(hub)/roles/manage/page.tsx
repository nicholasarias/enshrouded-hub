"use client";

import { useEffect, useMemo, useState } from "react";
import OfficerOnly from "@/app/components/OfficerOnly";
import { findRolePreset } from "@/lib/rolePresets";

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

const GROUPS: Array<{ key: RoleMeta["group_key"]; label: string }> = [
  { key: "strength", label: "Strength Group" },
  { key: "intelligence", label: "Intelligence Group" },
  { key: "dexterity", label: "Dexterity Group" },
  { key: "logistics", label: "Logistics Roles" },
];

function roleColorHex(colorInt: number) {
  if (!Number.isFinite(colorInt) || colorInt <= 0) return "#999";
  return "#" + colorInt.toString(16).padStart(6, "0");
}

export default function RolesPage() {
  const guildId = useMemo(() => (process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perksCatalog, setPerksCatalog] = useState<Perk[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const selectedRole = roles.find((r) => r.roleId === selectedRoleId) || null;

  // editor fields
  const [roleKind, setRoleKind] = useState<RoleMeta["role_kind"]>("combat");
  const [groupKey, setGroupKey] = useState<RoleMeta["group_key"]>("strength");
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPerkKeys, setSelectedPerkKeys] = useState<string[]>([]);

  // auto apply UI
  const [autoApplying, setAutoApplying] = useState(false);
  const [autoOverwrite, setAutoOverwrite] = useState(false);
  const [autoResult, setAutoResult] = useState<string | null>(null);

  function hydrateEditorFromRole(r: RoleRow) {
    if (r.meta) {
      setRoleKind(r.meta.role_kind);
      setGroupKey(r.meta.group_key);
      setDisplayName(r.meta.display_name || "");
      setDescription(r.meta.description || "");
      setSelectedPerkKeys((r.perks || []).map((p) => p.key));
      return;
    }

    const preset = findRolePreset(r.name);
    setRoleKind(preset?.roleKind || "combat");
    setGroupKey(preset?.groupKey || "strength");
    setDisplayName(preset?.displayName || "");
    setDescription(preset?.description || "");
    setSelectedPerkKeys((r.perks || []).map((p) => p.key));
  }

  async function loadAll() {
    if (!guildId) {
      setError("Missing NEXT_PUBLIC_DISCORD_GUILD_ID. Add it to .env.local for now.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [rolesRes, perksRes] = await Promise.all([
        fetch(`/api/roles?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" }),
        fetch("/api/perks", { cache: "no-store" }),
      ]);

      const rolesJson = await rolesRes.json();
      const perksJson = await perksRes.json();

      if (!rolesRes.ok) throw new Error(rolesJson?.error || "Failed to load roles");
      if (!perksRes.ok) throw new Error(perksJson?.error || "Failed to load perks");

      const loadedRoles: RoleRow[] = rolesJson.roles || [];
      const loadedPerks: Perk[] = perksJson.perks || [];

      setRoles(loadedRoles);
      setPerksCatalog(loadedPerks);

      if (!selectedRoleId) {
        const first = loadedRoles.find((r) => r.roleId !== guildId) || loadedRoles[0];
        if (first) {
          setSelectedRoleId(first.roleId);
          hydrateEditorFromRole(first);
        }
      } else {
        const still = loadedRoles.find((r) => r.roleId === selectedRoleId);
        if (still) hydrateEditorFromRole(still);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load role data");
    } finally {
      setLoading(false);
    }
  }

  async function saveMetaAndPerks() {
    if (!guildId || !selectedRoleId) return;

    setSaving(true);
    setError(null);
    setAutoResult(null);

    try {
      const metaRes = await fetch("/api/role-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          roleId: selectedRoleId,
          roleKind,
          groupKey,
          displayName,
          description,
        }),
      });

      const metaJson = await metaRes.json();
      if (!metaRes.ok) throw new Error(metaJson?.error || "Failed to save role metadata");

      const perksRes = await fetch("/api/role-perks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          roleId: selectedRoleId,
          perkKeys: selectedPerkKeys,
        }),
      });

      const perksJson = await perksRes.json();
      if (!perksRes.ok) throw new Error(perksJson?.error || "Failed to save role perks");

      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function autoApplyPresets() {
    if (!guildId) return;

    setAutoApplying(true);
    setError(null);
    setAutoResult(null);

    try {
      const res = await fetch("/api/role-meta/auto-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, overwrite: autoOverwrite }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Auto apply failed");

      setAutoResult(
        `Applied ${json.applied}, skipped (no preset) ${json.skippedNoPreset}, skipped (already had meta) ${json.skippedHasMeta}, checked ${json.totalRolesChecked}.`
      );

      await loadAll();
    } catch (e: any) {
      setError(e?.message || "Auto apply failed");
    } finally {
      setAutoApplying(false);
    }
  }

  function togglePerkKey(key: string) {
    setSelectedPerkKeys((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      return [...prev, key];
    });
  }

  function applyPresetToSelected() {
    if (!selectedRole) return;
    const preset = findRolePreset(selectedRole.name);
    if (!preset) return;

    setRoleKind(preset.roleKind);
    setGroupKey(preset.groupKey);
    setDisplayName(preset.displayName || "");
    setDescription(preset.description || "");
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const grouped = useMemo(() => {
    const map = new Map<RoleMeta["group_key"], RoleRow[]>();
    for (const g of GROUPS) map.set(g.key, []);

    for (const r of roles) {
      if (r.roleId === guildId) continue; // hide @everyone
      if (r.isManaged) continue;

      const preset = !r.meta ? findRolePreset(r.name) : null;
      const key = (r.meta?.group_key || preset?.groupKey || "strength") as RoleMeta["group_key"];

      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }

    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (b.position || 0) - (a.position || 0));
      map.set(k, arr);
    }

    return map;
  }, [roles, guildId]);

  const selectedPreset = selectedRole ? findRolePreset(selectedRole.name) : null;

  return (
    <OfficerOnly>
      <div style={{ padding: 16, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Roles</h1>
          <button onClick={loadAll} style={{ padding: "6px 10px" }} disabled={loading || saving || autoApplying}>
            Refresh
          </button>
          {saving ? <div style={{ opacity: 0.7 }}>Saving…</div> : null}
        </div>

        {error ? (
          <div style={{ padding: 10, border: "1px solid #fca5a5", borderRadius: 8 }}>
            <b>Error:</b> {error}
          </div>
        ) : null}

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Quick setup</div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={autoApplyPresets}
              disabled={autoApplying || loading || saving}
              style={{ padding: "8px 12px", fontWeight: 800 }}
            >
              {autoApplying ? "Applying…" : "Auto apply presets"}
            </button>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={autoOverwrite}
                onChange={(e) => setAutoOverwrite(e.target.checked)}
              />
              Overwrite existing meta
            </label>

            {autoResult ? <div style={{ fontSize: 12, opacity: 0.8 }}>{autoResult}</div> : null}
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Uses name matching from <code>web/lib/rolePresets.ts</code>. It never edits Discord roles.
          </div>
        </div>

        {loading ? <div>Loading…</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14 }}>
          {/* Left */}
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Role Groups</div>

            {GROUPS.map((g) => {
              const list = grouped.get(g.key) || [];
              return (
                <div key={g.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{g.label}</div>

                  {list.length === 0 ? (
                    <div style={{ opacity: 0.7, fontSize: 13 }}>No roles here yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {list.map((r) => {
                        const active = r.roleId === selectedRoleId;
                        const label = r.meta?.display_name || r.name;

                        return (
                          <button
                            key={r.roleId}
                            onClick={() => {
                              setSelectedRoleId(r.roleId);
                              hydrateEditorFromRole(r);
                            }}
                            style={{
                              textAlign: "left",
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #ddd",
                              background: active ? "#f5f5f5" : "white",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span
                                style={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: 999,
                                  background: roleColorHex(r.colorInt),
                                  display: "inline-block",
                                }}
                              />
                              <div style={{ fontWeight: 700 }}>{label}</div>
                            </div>

                            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                              {r.meta?.role_kind
                                ? `Kind: ${r.meta.role_kind}`
                                : `Kind: ${findRolePreset(r.name)?.roleKind || "(unset)"}`}{" "}
                              ·{" "}
                              {r.meta?.group_key
                                ? `Group: ${r.meta.group_key}`
                                : `Group: ${findRolePreset(r.name)?.groupKey || "(unset)"}`}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right */}
          <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
            {!selectedRole ? (
              <div style={{ opacity: 0.7 }}>Select a role to edit.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>
                    Edit: {selectedRole.meta?.display_name || selectedRole.name}
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>Role ID: {selectedRole.roleId}</div>
                </div>

                {selectedPreset ? (
                  <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Preset suggestion found</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>
                      Suggests: <b>{selectedPreset.roleKind}</b> · <b>{selectedPreset.groupKey}</b>
                      {selectedPreset.displayName ? ` · "${selectedPreset.displayName}"` : ""}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={applyPresetToSelected}
                        style={{ padding: "6px 10px", fontWeight: 700 }}
                      >
                        Apply preset to editor
                      </button>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>Role kind</span>
                    <select value={roleKind} onChange={(e) => setRoleKind(e.target.value as any)}>
                      <option value="combat">combat</option>
                      <option value="logistics">logistics</option>
                    </select>
                  </label>

                  <label style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>Group</span>
                    <select value={groupKey} onChange={(e) => setGroupKey(e.target.value as any)}>
                      <option value="strength">strength</option>
                      <option value="intelligence">intelligence</option>
                      <option value="dexterity">dexterity</option>
                      <option value="logistics">logistics</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontWeight: 700 }}>Display name (optional)</span>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </label>

                <label style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontWeight: 700 }}>Description (optional)</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </label>

                <div style={{ borderTop: "1px solid #eee", paddingTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Perks</div>

                  {perksCatalog.length === 0 ? (
                    <div style={{ opacity: 0.7 }}>
                      No perks found yet. Create perks first using /api/perks.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {perksCatalog.map((p) => {
                        const checked = selectedPerkKeys.includes(p.key);
                        return (
                          <label
                            key={p.key}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 10,
                              padding: 10,
                              border: "1px solid #eee",
                              borderRadius: 10,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedPerkKeys((prev) => (prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]))}
                              style={{ marginTop: 2 }}
                            />
                            <div style={{ display: "grid", gap: 2 }}>
                              <div style={{ fontWeight: 700 }}>
                                {p.icon ? `${p.icon} ` : ""}
                                {p.name}{" "}
                                <span style={{ fontWeight: 400, opacity: 0.7 }}>({p.key})</span>
                              </div>
                              {p.description ? (
                                <div style={{ fontSize: 13, opacity: 0.8 }}>{p.description}</div>
                              ) : null}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    onClick={saveMetaAndPerks}
                    disabled={saving || loading || autoApplying}
                    style={{ padding: "8px 12px", fontWeight: 800 }}
                  >
                    Save changes
                  </button>

                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    This only updates hub metadata and perk mapping.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ opacity: 0.75, fontSize: 12 }}>
          Tip: Run Sync Roles first so Discord roles exist in the hub.
        </div>
      </div>
    </OfficerOnly>
  );
}
