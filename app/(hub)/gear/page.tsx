"use client";

import { useEffect, useMemo, useState } from "react";
import OfficerOnly from "@/app/components/OfficerOnly";

type GearItem = {
  id: string;
  guild_id: string;
  name: string;
  slot: string;
  rarity: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export default function GearPage() {
  // If you store guildId somewhere else later, replace this.
  const guildId = useMemo(() => {
    return (process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim();
  }, []);

  const [gear, setGear] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create form fields
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("");
  const [rarity, setRarity] = useState("");
  const [notes, setNotes] = useState("");

  async function loadGear() {
    if (!guildId) {
      setError("Missing NEXT_PUBLIC_DISCORD_GUILD_ID for the gear page.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/gear?guildId=${encodeURIComponent(guildId)}`, {
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to load gear");
      }

      setGear(json.gear || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load gear");
    } finally {
      setLoading(false);
    }
  }

  async function createGear() {
    if (!guildId) {
      setError("Missing NEXT_PUBLIC_DISCORD_GUILD_ID for the gear page.");
      return;
    }

    setError(null);

    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId,
          name,
          slot,
          rarity,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to create gear");
      }

      setGear((prev) => [json.gear, ...prev]);

      setName("");
      setSlot("");
      setRarity("");
      setNotes("");
    } catch (e: any) {
      setError(e?.message || "Failed to create gear");
    }
  }

  useEffect(() => {
    void loadGear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Gear</h1>
        <button onClick={loadGear} style={{ padding: "6px 10px" }}>
          Refresh
        </button>
      </div>

      {loading ? <div>Loading...</div> : null}
      {error ? (
        <div style={{ padding: 10, border: "1px solid #fca5a5", borderRadius: 8 }}>
          <b>Error:</b> {error}
        </div>
      ) : null}

      <OfficerOnly>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Add Gear</div>

          <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span>Slot</span>
              <input
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                placeholder="Helmet, Chest, Weapon..."
              />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span>Rarity (optional)</span>
              <input value={rarity} onChange={(e) => setRarity(e.target.value)} />
            </label>

            <label style={{ display: "grid", gap: 4 }}>
              <span>Notes (optional)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </label>

            <button
              onClick={createGear}
              disabled={!name.trim() || !slot.trim()}
              style={{ padding: "8px 12px", fontWeight: 700 }}
            >
              Create
            </button>
          </div>
        </div>
      </OfficerOnly>

      <div style={{ display: "grid", gap: 10 }}>
        {gear.map((g) => (
          <div key={g.id} style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
            <div style={{ fontWeight: 800 }}>{g.name}</div>
            <div>Slot: {g.slot}</div>
            {g.rarity ? <div>Rarity: {g.rarity}</div> : null}
            {g.notes ? <div>Notes: {g.notes}</div> : null}
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Updated: {new Date(g.updated_at).toLocaleString()}
            </div>
          </div>
        ))}
        {!loading && gear.length === 0 ? <div>No gear yet.</div> : null}
      </div>
    </div>
  );
}
