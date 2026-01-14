"use client";

import React, { useEffect, useMemo, useState } from "react";
import OfficerOnly from "@/app/components/OfficerOnly";

type Row = {
  userId: string;
  discordUserId: string;
  discordUsername: string | null;
  discordGlobalName: string | null;
  discordAvatar: string | null;

  combatRoleId: string | null;
  combatRoleName: string | null;

  logisticsRoleId: string | null;
  logisticsRoleName: string | null;

  updatedAt: string | null;
};

type ListResponse = {
  ok: boolean;
  guildId: string;
  count: number;
  rows: Row[];
  error?: string;
  details?: string;
};

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
  dangerText: "#fecaca",
};

function fmtWhen(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function buildUrl(path: string, params: Record<string, string>) {
  const u = new URL(path, "http://local");
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, v);
  }
  const qs = u.searchParams.toString();
  return qs ? `${path}?${qs}` : path;
}

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
              <div style={{ color: THEME.textAsh, fontSize: 12 }}>User Selections (Officer)</div>
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
              Forge
            </a>

            <a
              href={buildUrl("/roles/manage-users", { guildId: gid })}
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
              Manage Users
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

function StoneSection(props: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
        border: `2px solid ${THEME.stoneBorder}`,
        borderRadius: 6,
        padding: 18,
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
          <div style={{ color: THEME.flameGold, textTransform: "uppercase", letterSpacing: 3, fontSize: 12, fontWeight: 950 }}>{props.title}</div>
          {props.subtitle ? <div style={{ marginTop: 8, color: THEME.textAsh, fontSize: 12, fontWeight: 900 }}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>{props.right}</div> : null}
      </div>

      {props.children}
    </div>
  );
}

function PillButton(props: { onClick: () => void; disabled?: boolean; children: React.ReactNode; kind?: "primary" | "ghost" | "danger" }) {
  const kind = props.kind || "ghost";

  const base: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${THEME.stoneBorder}`,
    background: "rgba(12,14,18,0.6)",
    color: THEME.textSilver,
    cursor: props.disabled ? "not-allowed" : "pointer",
    fontWeight: 950,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontSize: 12,
    whiteSpace: "nowrap",
    opacity: props.disabled ? 0.6 : 1,
  };

  if (kind === "primary") {
    base.background = `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`;
    base.color = "#111";
    base.boxShadow = `0 0 18px rgba(242, 153, 74, 0.25)`;
  }

  if (kind === "danger") {
    base.border = `1px solid ${THEME.dangerBorder}`;
    base.background = "rgba(127,29,29,0.15)";
    base.color = THEME.dangerText;
  }

  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled} style={base}>
      {props.children}
    </button>
  );
}

export default function ManageUsersClient(props: { guildId: string }) {
  const guildId = props.guildId;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const subtitle = useMemo(
    () => "Reset a user’s combat or logistics role selection. This edits hub selections only, not Discord roles.",
    []
  );

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/officer/roles/list?guildId=${encodeURIComponent(guildId)}`, { cache: "no-store" });
      const data = (await res.json()) as ListResponse;

      if (!res.ok || !data.ok) {
        setErr(data.details ? `${data.error || `Failed to load (HTTP ${res.status})`}: ${data.details}` : (data.error || `Failed to load (HTTP ${res.status})`));
        setRows([]);
        return;
      }

      setRows(data.rows || []);
    } catch (e: any) {
      setErr(String(e?.message || e || "Failed to load"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  async function reset(targetDiscordUserId: string, roleKind: "combat" | "logistics" | "both") {
    const key = `${targetDiscordUserId}:${roleKind}`;
    setBusyKey(key);
    setErr(null);

    try {
      const res = await fetch("/api/officer/roles/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ guildId, targetDiscordUserId, roleKind }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setErr(data.details ? `${data.error || `Reset failed (HTTP ${res.status})`}: ${data.details}` : (data.error || `Reset failed (HTTP ${res.status})`));
        return;
      }

      await load();
    } catch (e: any) {
      setErr(String(e?.message || e || "Reset failed"));
    } finally {
      setBusyKey(null);
    }
  }

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
          <StoneSection
            title="Officer Manage Users"
            subtitle={subtitle}
            right={
              <PillButton onClick={load} disabled={loading} kind="primary">
                {loading ? "Loading..." : "Refresh"}
              </PillButton>
            }
          >
            {err ? (
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
                {err}
              </div>
            ) : null}

            <div
              style={{
                border: `1px solid ${THEME.stoneBorder}`,
                borderRadius: 6,
                overflow: "hidden",
                background: "rgba(0,0,0,0.18)",
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderBottom: `1px solid ${THEME.stoneBorder}`,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div style={{ fontWeight: 950, color: "#fff", letterSpacing: 1, textTransform: "uppercase", fontSize: 12 }}>
                  Selections
                </div>
                <div style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 900 }}>
                  {loading ? "Loading..." : `${rows.length} users`}
                </div>
              </div>

              <div style={{ display: "grid" }}>
                {!loading && rows.length === 0 ? (
                  <div style={{ padding: 14, color: THEME.textAsh, fontWeight: 900 }}>No selections found yet.</div>
                ) : null}

                {rows.map((r) => {
                  const display = r.discordGlobalName || r.discordUsername || r.discordUserId;
                  const combat = r.combatRoleName || r.combatRoleId || "—";
                  const logistics = r.logisticsRoleName || r.logisticsRoleId || "—";

                  return (
                    <div
                      key={r.discordUserId}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.35fr 1fr 1fr 0.9fr 1.35fr",
                        gap: 10,
                        padding: 12,
                        borderTop: `1px solid ${THEME.stoneEdge}`,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                        {r.discordAvatar ? (
                          <img
                            src={`https://cdn.discordapp.com/avatars/${r.discordUserId}/${r.discordAvatar}.png?size=64`}
                            alt=""
                            width={30}
                            height={30}
                            style={{ borderRadius: 999, border: `1px solid ${THEME.stoneEdge}` }}
                          />
                        ) : (
                          <div style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${THEME.stoneEdge}` }} />
                        )}

                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {display}
                          </div>
                          <div style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {r.discordUserId}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontWeight: 900, color: THEME.textSilver, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {combat}
                      </div>

                      <div style={{ fontWeight: 900, color: THEME.textSilver, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {logistics}
                      </div>

                      <div style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 900 }}>{fmtWhen(r.updatedAt)}</div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <PillButton
                          onClick={() => reset(r.discordUserId, "combat")}
                          disabled={busyKey === `${r.discordUserId}:combat`}
                        >
                          Reset combat
                        </PillButton>

                        <PillButton
                          onClick={() => reset(r.discordUserId, "logistics")}
                          disabled={busyKey === `${r.discordUserId}:logistics`}
                        >
                          Reset logistics
                        </PillButton>

                        <PillButton
                          onClick={() => reset(r.discordUserId, "both")}
                          disabled={busyKey === `${r.discordUserId}:both`}
                          kind="danger"
                        >
                          Clear both
                        </PillButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 14, color: THEME.textAsh, fontSize: 12, fontWeight: 900, textAlign: "center" }}>
              Officer only page. Keep the guildId in the URL when sharing internally.
            </div>
          </StoneSection>
        </div>
      </div>
    </OfficerOnly>
  );
}
