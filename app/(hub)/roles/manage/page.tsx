"use client";

import React, { useEffect, useMemo, useState } from "react";
import OfficerOnly from "@/app/components/OfficerOnly";
import { findRolePreset } from "@/lib/rolePresets";

// --- Types ---
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

// --- Theme (match your Flameborn scheme) ---
const THEME = {
  shroudDeep: "#06080a",
  shroudMist: "#1a2430",
  flameAmber: "#f2994a",
  flameGold: "#f2c94c",
  stoneCard: "#1c1f26",
  stoneBorder: "#3a4150",
  stoneEdge: "#232a36",
  textSilver: "#d1d5db",
  textAsh: "#6b7280",
  dangerBg: "#2a0b0b",
  dangerBorder: "#7f1d1d",
  dangerText: "#fca5a5",
};

const GROUPS: Array<{ key: RoleMeta["group_key"]; label: string; subtitle: string }> = [
  { key: "strength", label: "Strength Group", subtitle: "Front line, shields, heavy impact." },
  { key: "intelligence", label: "Intelligence Group", subtitle: "Magic, support, tactics." },
  { key: "dexterity", label: "Dexterity Group", subtitle: "Ranged, scouting, precision." },
  { key: "logistics", label: "Logistics Roles", subtitle: "Settlement duties and production." },
];

// --- Helpers ---
function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

function getGuildIdFromUrlOrFallback() {
  if (typeof window === "undefined") return "";

  const url = new URL(window.location.href);
  const raw = String(url.searchParams.get("guildId") || "").trim();
  if (raw && isSnowflake(raw)) return raw;

  const fb = String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim();
  if (fb && isSnowflake(fb)) return fb;

  return "";
}

function buildUrl(path: string, params: Record<string, string>) {
  const u = new URL(path, "http://local");
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  const qs = u.searchParams.toString();
  return qs ? `${path}?${qs}` : path;
}

function roleColorHex(colorInt: number) {
  if (!Number.isFinite(colorInt) || colorInt <= 0) return "#999";
  return "#" + colorInt.toString(16).padStart(6, "0");
}

// --- Top bar ---
function TopBar(props: { guildId: string }) {
  const gid = props.guildId;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #0b0d11)`,
        borderBottom: `1px solid ${THEME.stoneBorder}`,
        boxShadow: "0 12px 30px rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: THEME.flameAmber,
                boxShadow: `0 0 14px rgba(242, 153, 74, 0.5)`,
              }}
            />
            <div style={{ display: "grid", lineHeight: 1.05 }}>
              <div
                style={{
                  color: "#fff",
                  fontWeight: 950,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  fontSize: 12,
                }}
              >
                Enshrouded Hub
              </div>
              <div style={{ color: THEME.textAsh, fontSize: 12 }}>Role Forge (Officer)</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={buildUrl("/dashboard", { guildId: gid })}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(12,14,18,0.6)",
                color: THEME.textSilver,
                textDecoration: "none",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                backdropFilter: "blur(6px)",
                whiteSpace: "nowrap",
              }}
            >
              Dashboard
            </a>

            <a
              href={buildUrl("/roles", { guildId: gid })}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "rgba(12,14,18,0.6)",
                color: THEME.textSilver,
                textDecoration: "none",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                backdropFilter: "blur(6px)",
                whiteSpace: "nowrap",
              }}
            >
              Roles
            </a>

            <a
              href={buildUrl("/roles/manage", { guildId: gid })}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${THEME.stoneBorder}`,
                background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
                color: "#111",
                textDecoration: "none",
                fontWeight: 950,
                letterSpacing: 1,
                textTransform: "uppercase",
                fontSize: 12,
                boxShadow: `0 0 18px rgba(242, 153, 74, 0.25)`,
                whiteSpace: "nowrap",
              }}
              title="You are here"
            >
              Manage
            </a>
          </div>
        </div>

        <div
          style={{
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${THEME.stoneBorder}`,
            background: "rgba(12,14,18,0.6)",
            color: THEME.textAsh,
            fontSize: 12,
            fontWeight: 950,
            letterSpacing: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
          title="Guild context"
        >
          {gid ? `Guild: ${gid}` : "Guild: missing"}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: `linear-gradient(90deg, transparent, ${THEME.flameAmber}, transparent)`,
        }}
      />
    </div>
  );
}

// --- Fog System (same vibe as your other pages) ---
function ShroudFog() {
  const blobStyleBase: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: `radial-gradient(
      circle at center,
      rgba(35, 50, 75, 1) 0%,
      rgba(20, 30, 45, 0.6) 45%,
      transparent 75%
    )`,
    filter: "blur(100px)",
    opacity: 0.85,
    willChange: "transform, opacity",
    maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
    WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
  };

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          ...blobStyleBase,
          left: "-20%",
          top: "10%",
          width: "60%",
          height: "80%",
          animation: "driftUp 18s linear infinite",
          animationDelay: "-2s",
          opacity: 0.65,
        }}
      />
      <div
        style={{
          ...blobStyleBase,
          left: "25%",
          top: "20%",
          width: "70%",
          height: "90%",
          animation: "driftUp 22s linear infinite",
          animationDelay: "-9s",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          ...blobStyleBase,
          left: "55%",
          top: "15%",
          width: "55%",
          height: "85%",
          animation: "driftUp 20s linear infinite",
          animationDelay: "-14s",
          opacity: 0.5,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: "-10%",
          right: "-10%",
          bottom: "-35%",
          height: "70%",
          background: `radial-gradient(ellipse at bottom, ${THEME.shroudMist} 0%, #1a2430cc 40%, transparent 80%)`,
          filter: "blur(12px)",
          opacity: 0.95,
          maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          background: `linear-gradient(to top, ${THEME.shroudMist} 0%, #1a2430ee 45%, transparent 100%)`,
          opacity: 0.35,
          maskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)`,
        }}
      />

      <style>{`
        @keyframes driftUp {
          0% { transform: translateY(100%) scale(1) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          50% { transform: translateY(15%) scale(1.5) rotate(3deg); }
          90% { opacity: 0.1; }
          100% { transform: translateY(-130%) scale(2) rotate(-3deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// --- Page ---
export default function RolesManagePage() {
  const [guildId] = useState(() => getGuildIdFromUrlOrFallback());

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
      setError("Missing guildId. Use /roles/manage?guildId=YOUR_GUILD_ID (or set NEXT_PUBLIC_DISCORD_GUILD_ID).");
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
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: THEME.shroudDeep,
          background: `radial-gradient(circle, ${THEME.shroudMist} 0%, ${THEME.shroudDeep} 78%, #000 100%)`,
          color: THEME.textSilver,
          padding: "110px 20px 70px 20px",
          fontFamily: "'Segoe UI', Roboto, serif",
          position: "relative",
        }}
      >
        <TopBar guildId={guildId} />
        <ShroudFog />

        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.85) 100%)",
            zIndex: 0,
          }}
        />

        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 10 }}>
          <div
            style={{
              background: `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
              border: `2px solid ${THEME.stoneBorder}`,
              borderRadius: 6,
              padding: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                borderBottom: `1px solid ${THEME.stoneBorder}`,
                paddingBottom: 12,
                marginBottom: 14,
              }}
            >
              <div>
                <div style={{ color: THEME.flameGold, textTransform: "uppercase", letterSpacing: 3, fontSize: 12, fontWeight: 950 }}>
                  Officer Role Forge
                </div>
                <h1 style={{ margin: "10px 0 0", fontSize: 26, fontWeight: 950, color: "#fff" }}>Role Metadata & Perks</h1>
                <div style={{ marginTop: 8, color: THEME.textAsh, fontSize: 12, fontWeight: 900 }}>
                  This never edits Discord roles. It only updates hub metadata and perk mapping.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={loadAll}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${THEME.stoneBorder}`,
                    background: "rgba(12,14,18,0.6)",
                    color: THEME.textSilver,
                    cursor: "pointer",
                    fontWeight: 950,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontSize: 12,
                    whiteSpace: "nowrap",
                  }}
                  disabled={loading || saving || autoApplying}
                >
                  Refresh
                </button>

                <button
                  onClick={saveMetaAndPerks}
                  disabled={!selectedRole || saving || loading || autoApplying}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${THEME.stoneBorder}`,
                    background: selectedRole
                      ? `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`
                      : "rgba(12,14,18,0.6)",
                    color: selectedRole ? "#111" : THEME.textAsh,
                    cursor: selectedRole ? "pointer" : "not-allowed",
                    fontWeight: 950,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontSize: 12,
                    boxShadow: selectedRole ? `0 0 18px rgba(242, 153, 74, 0.25)` : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            {error ? (
              <div
                style={{
                  background: THEME.dangerBg,
                  border: `1px solid ${THEME.dangerBorder}`,
                  color: THEME.dangerText,
                  padding: 12,
                  borderRadius: 6,
                  fontWeight: 950,
                  marginBottom: 14,
                }}
              >
                {error}
              </div>
            ) : null}

            <div
              style={{
                border: `1px solid ${THEME.stoneBorder}`,
                borderRadius: 6,
                padding: 14,
                background: "rgba(0,0,0,0.22)",
                display: "grid",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 950, color: THEME.flameGold, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
                Quick setup
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={autoApplyPresets}
                  disabled={autoApplying || loading || saving || !guildId}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${THEME.stoneBorder}`,
                    background: `linear-gradient(180deg, ${THEME.stoneCard}, #0f1217)`,
                    color: THEME.textSilver,
                    cursor: "pointer",
                    fontWeight: 950,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    fontSize: 12,
                  }}
                >
                  {autoApplying ? "Applying..." : "Auto apply presets"}
                </button>

                <label style={{ display: "flex", gap: 8, alignItems: "center", color: THEME.textSilver, fontWeight: 900 }}>
                  <input type="checkbox" checked={autoOverwrite} onChange={(e) => setAutoOverwrite(e.target.checked)} />
                  Overwrite existing meta
                </label>

                {autoResult ? <div style={{ fontSize: 12, color: THEME.textAsh, fontWeight: 900 }}>{autoResult}</div> : null}
              </div>

              <div style={{ fontSize: 12, color: THEME.textAsh, fontWeight: 900 }}>
                Uses name matching from <code>web/lib/rolePresets.ts</code>.
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: "center", color: THEME.flameGold, padding: "60px 10px", fontWeight: 950 }}>
                Communing with the Role Forge...
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 14, marginTop: 14 }}>
                {/* Left */}
                <div
                  style={{
                    border: `1px solid ${THEME.stoneBorder}`,
                    borderRadius: 6,
                    padding: 12,
                    background: "rgba(0,0,0,0.20)",
                  }}
                >
                  <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase", fontSize: 12, marginBottom: 10 }}>
                    Role Groups
                  </div>

                  {GROUPS.map((g) => {
                    const list = grouped.get(g.key) || [];
                    return (
                      <div key={g.key} style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 950, color: THEME.flameGold, letterSpacing: 1, fontSize: 12, textTransform: "uppercase" }}>
                          {g.label}
                        </div>
                        <div style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 900, marginTop: 4, marginBottom: 8 }}>
                          {g.subtitle}
                        </div>

                        {list.length === 0 ? (
                          <div style={{ color: THEME.textAsh, fontSize: 13, fontWeight: 900 }}>No roles here yet.</div>
                        ) : (
                          <div style={{ display: "grid", gap: 8 }}>
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
                                    padding: "10px 10px",
                                    borderRadius: 6,
                                    border: `1px solid ${active ? THEME.flameAmber : THEME.stoneBorder}`,
                                    background: active ? "rgba(242,153,74,0.08)" : "rgba(12,14,18,0.6)",
                                    cursor: "pointer",
                                    color: THEME.textSilver,
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
                                        boxShadow: "0 0 10px rgba(0,0,0,0.6)",
                                      }}
                                    />
                                    <div style={{ fontWeight: 950, letterSpacing: 0.3 }}>{label}</div>
                                  </div>

                                  <div style={{ fontSize: 12, color: THEME.textAsh, fontWeight: 900, marginTop: 4 }}>
                                    {(r.meta?.role_kind ? `Kind: ${r.meta.role_kind}` : `Kind: ${findRolePreset(r.name)?.roleKind || "(unset)"}`) +
                                      "  •  " +
                                      (r.meta?.group_key ? `Group: ${r.meta.group_key}` : `Group: ${findRolePreset(r.name)?.groupKey || "(unset)"}`)}
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
                <div
                  style={{
                    border: `1px solid ${THEME.stoneBorder}`,
                    borderRadius: 6,
                    padding: 12,
                    background: "rgba(0,0,0,0.20)",
                  }}
                >
                  {!selectedRole ? (
                    <div style={{ color: THEME.textAsh, fontWeight: 900 }}>Select a role to edit.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 950, fontSize: 18, color: "#fff" }}>
                          Edit: {selectedRole.meta?.display_name || selectedRole.name}
                        </div>
                        <div style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 900, marginTop: 4 }}>
                          Role ID: {selectedRole.roleId}
                        </div>
                      </div>

                      {selectedPreset ? (
                        <div
                          style={{
                            padding: 12,
                            border: `1px solid ${THEME.stoneBorder}`,
                            borderRadius: 6,
                            background: "rgba(242,153,74,0.08)",
                          }}
                        >
                          <div style={{ fontWeight: 950, color: THEME.flameGold, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
                            Preset suggestion found
                          </div>
                          <div style={{ fontSize: 13, color: THEME.textSilver, fontWeight: 900, marginTop: 8 }}>
                            Suggests{" "}
                            <span style={{ color: THEME.flameAmber }}>{selectedPreset.roleKind}</span>
                            {"  •  "}
                            <span style={{ color: THEME.flameAmber }}>{selectedPreset.groupKey}</span>
                            {selectedPreset.displayName ? `  •  "${selectedPreset.displayName}"` : ""}
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <button
                              onClick={applyPresetToSelected}
                              style={{
                                padding: "10px 12px",
                                borderRadius: 8,
                                border: `1px solid ${THEME.stoneBorder}`,
                                background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
                                color: "#111",
                                cursor: "pointer",
                                fontWeight: 950,
                                letterSpacing: 1,
                                textTransform: "uppercase",
                                fontSize: 12,
                              }}
                            >
                              Apply preset to editor
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontWeight: 950, color: THEME.textAsh, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
                            Role kind
                          </span>
                          <select
                            value={roleKind}
                            onChange={(e) => setRoleKind(e.target.value as any)}
                            style={{
                              padding: "12px 12px",
                              borderRadius: 6,
                              border: `1px solid ${THEME.stoneBorder}`,
                              background: "#0c0e12",
                              color: THEME.textSilver,
                              outline: "none",
                              fontWeight: 900,
                            }}
                          >
                            <option value="combat">combat</option>
                            <option value="logistics">logistics</option>
                          </select>
                        </label>

                        <label style={{ display: "grid", gap: 6 }}>
                          <span style={{ fontWeight: 950, color: THEME.textAsh, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
                            Group
                          </span>
                          <select
                            value={groupKey}
                            onChange={(e) => setGroupKey(e.target.value as any)}
                            style={{
                              padding: "12px 12px",
                              borderRadius: 6,
                              border: `1px solid ${THEME.stoneBorder}`,
                              background: "#0c0e12",
                              color: THEME.textSilver,
                              outline: "none",
                              fontWeight: 900,
                            }}
                          >
                            <option value="strength">strength</option>
                            <option value="intelligence">intelligence</option>
                            <option value="dexterity">dexterity</option>
                            <option value="logistics">logistics</option>
                          </select>
                        </label>
                      </div>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontWeight: 950, color: THEME.textAsh, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
                          Display name (optional)
                        </span>
                        <input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 6,
                            border: `1px solid ${THEME.stoneBorder}`,
                            background: "#0c0e12",
                            color: THEME.textSilver,
                            outline: "none",
                            fontWeight: 900,
                          }}
                        />
                      </label>

                      <label style={{ display: "grid", gap: 6 }}>
                        <span style={{ fontWeight: 950, color: THEME.textAsh, letterSpacing: 2, textTransform: "uppercase", fontSize: 12 }}>
                          Description (optional)
                        </span>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={3}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 6,
                            border: `1px solid ${THEME.stoneBorder}`,
                            background: "#0c0e12",
                            color: THEME.textSilver,
                            outline: "none",
                            fontWeight: 900,
                            resize: "vertical",
                          }}
                        />
                      </label>

                      <div style={{ borderTop: `1px solid ${THEME.stoneBorder}`, paddingTop: 12 }}>
                        <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase", fontSize: 12, marginBottom: 10 }}>
                          Perks
                        </div>

                        {perksCatalog.length === 0 ? (
                          <div style={{ color: THEME.textAsh, fontWeight: 900 }}>
                            No perks found yet. Create perks first using /api/perks.
                          </div>
                        ) : (
                          <div style={{ display: "grid", gap: 10 }}>
                            {perksCatalog.map((p) => {
                              const checked = selectedPerkKeys.includes(p.key);
                              return (
                                <label
                                  key={p.key}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 10,
                                    padding: 12,
                                    border: `1px solid ${THEME.stoneBorder}`,
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: checked ? "rgba(242,153,74,0.06)" : "rgba(0,0,0,0.18)",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      setSelectedPerkKeys((prev) =>
                                        prev.includes(p.key) ? prev.filter((k) => k !== p.key) : [...prev, p.key]
                                      )
                                    }
                                    style={{ marginTop: 2 }}
                                  />
                                  <div style={{ display: "grid", gap: 4 }}>
                                    <div style={{ fontWeight: 950, color: THEME.textSilver }}>
                                      {p.icon ? `${p.icon} ` : ""}
                                      {p.name}{" "}
                                      <span style={{ fontWeight: 900, color: THEME.textAsh }}>({p.key})</span>
                                    </div>
                                    {p.description ? (
                                      <div style={{ fontSize: 13, color: THEME.textAsh, fontWeight: 900 }}>
                                        {p.description}
                                      </div>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          onClick={saveMetaAndPerks}
                          disabled={saving || loading || autoApplying || !selectedRole}
                          style={{
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: `1px solid ${THEME.stoneBorder}`,
                            background: `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
                            color: "#111",
                            cursor: "pointer",
                            fontWeight: 950,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            fontSize: 12,
                            boxShadow: `0 0 18px rgba(242, 153, 74, 0.25)`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {saving ? "Saving..." : "Save changes"}
                        </button>

                        <div style={{ fontSize: 12, color: THEME.textAsh, fontWeight: 900 }}>
                          Tip: Run Sync Roles first so Discord roles exist in the hub.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: 18,
              border: `1px solid ${THEME.stoneBorder}`,
              borderRadius: 6,
              padding: 12,
              background: "rgba(0,0,0,0.20)",
              color: THEME.textAsh,
              fontSize: 12,
              fontWeight: 900,
              textAlign: "center",
            }}
          >
            Officer only page. If you share this link, keep the guildId in the URL.
          </div>
        </div>
      </div>
    </OfficerOnly>
  );
}
