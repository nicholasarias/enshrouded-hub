"use client";

import React, { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const GUILD_ID = "1391117470676287518";

// Match your Flameborn palette
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

function formatStartLocal(d: Date) {
  return d.toISOString();
}

const DateInput = React.forwardRef<HTMLInputElement, any>(function DateInput(props, ref) {
  const { value, onClick, placeholder } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 12px",
        borderRadius: 6,
        border: "1px solid #3a4150",
        background: "#0c0e12",
        color: "#d1d5db",
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {value && String(value).trim() ? value : <span style={{ opacity: 0.7 }}>{placeholder}</span>}
      <input ref={ref} readOnly style={{ display: "none" }} />
    </button>
  );
});

export default function CreateSessionClient() {
  const [title, setTitle] = useState("");
  const [startAt, setStartAt] = useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!startAt) return false;
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return false;
    return true;
  }, [title, startAt, durationMinutes]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOkFlash(false);

    try {
      if (!startAt) throw new Error("Pick a date and time.");

      const res = await fetch("/api/sessions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildId: GUILD_ID,
          title,
          startLocal: formatStartLocal(startAt),
          durationMinutes,
          notes,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Failed to create session");
      }

      setOkFlash(true);
      setTimeout(() => setOkFlash(false), 1200);

      window.location.reload();
    } catch (err: any) {
      setError(err?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: `2px solid ${THEME.stoneBorder}`,
        borderRadius: 6,
        background: `linear-gradient(180deg, ${THEME.stoneCard}, #11141a)`,
        boxShadow: "0 20px 40px rgba(0,0,0,0.65)",
        padding: 18,
        marginBottom: 24,
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 6,
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.55)",
          pointerEvents: "none",
        }}
      />

      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "end",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            borderBottom: `1px solid ${THEME.stoneBorder}`,
            paddingBottom: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                margin: 0,
                color: THEME.flameGold,
                textTransform: "uppercase",
                letterSpacing: 3,
                fontSize: 12,
                fontWeight: 950,
              }}
            >
              Create Session
            </div>
            <div style={{ marginTop: 6, color: THEME.textAsh, fontSize: 13, fontStyle: "italic" }}>
              Post a new run to the registry.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "end" }}>
            {okFlash ? (
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid rgba(120,220,180,0.45)`,
                  background: "rgba(120,220,180,0.10)",
                  color: THEME.textSilver,
                  fontSize: 12,
                  fontWeight: 950,
                  letterSpacing: 0.2,
                }}
              >
                ✅ Created
              </span>
            ) : null}
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: "uppercase" }}>
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title"
              required
              style={{
                padding: "12px 12px",
                borderRadius: 6,
                border: `1px solid ${THEME.stoneBorder}`,
                background: "#0c0e12",
                color: THEME.textSilver,
                outline: "none",
                fontWeight: 900,
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: "uppercase" }}>
              Date and time
            </span>

            <DatePicker
              selected={startAt}
              onChange={(d: Date | null) => setStartAt(d)}
              showTimeSelect
              timeFormat="h:mm aa"
              timeIntervals={15}
              dateFormat="MMM d, yyyy h:mm aa"
              placeholderText="Pick a date and time"
              popperPlacement="bottom-start"
              customInput={<DateInput />}
              calendarClassName="eh-datepicker"
              popperClassName="eh-datepicker-popper"
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 12 }}>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: "uppercase" }}>
                Duration
              </span>
              <input
                type="number"
                min={15}
                step={15}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                style={{
                  padding: "12px 12px",
                  borderRadius: 6,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "#0c0e12",
                  color: THEME.textSilver,
                  outline: "none",
                  fontWeight: 900,
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ color: THEME.textAsh, fontSize: 12, fontWeight: 950, letterSpacing: 1, textTransform: "uppercase" }}>
                Notes
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={3}
                style={{
                  padding: "12px 12px",
                  borderRadius: 6,
                  border: `1px solid ${THEME.stoneBorder}`,
                  background: "#0c0e12",
                  color: THEME.textSilver,
                  outline: "none",
                  fontWeight: 800,
                  lineHeight: 1.45,
                  resize: "vertical",
                  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.6)",
                }}
              />
            </label>
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
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            style={{
              padding: "12px 12px",
              borderRadius: 8,
              border: `1px solid ${THEME.stoneBorder}`,
              background: loading || !canSubmit ? "rgba(12,14,18,0.6)" : `linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold})`,
              color: loading || !canSubmit ? THEME.textSilver : "#111",
              cursor: loading || !canSubmit ? "not-allowed" : "pointer",
              fontWeight: 950,
              letterSpacing: 1,
              textTransform: "uppercase",
              fontSize: 12,
              boxShadow: loading || !canSubmit ? "none" : `0 0 18px rgba(242, 153, 74, 0.25)`,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Creating..." : "Create Session"}
          </button>
        </form>
      </div>

      <style jsx global>{`
        .eh-datepicker-popper {
          z-index: 80 !important;
        }

        .eh-datepicker.react-datepicker {
          border: 2px solid ${THEME.stoneBorder};
          border-radius: 8px;
          background: linear-gradient(180deg, ${THEME.stoneCard}, #0b0d11);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.75);
          overflow: hidden;
          font-family: Segoe UI, Roboto, serif;
        }

        .eh-datepicker .react-datepicker__header {
          background: linear-gradient(180deg, #11141a, #0b0d11);
          border-bottom: 1px solid ${THEME.stoneBorder};
          padding-top: 10px;
        }

        .eh-datepicker .react-datepicker__current-month,
        .eh-datepicker .react-datepicker-time__header,
        .eh-datepicker .react-datepicker-year-header {
          color: ${THEME.flameGold};
          font-weight: 950;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          font-size: 12px;
        }

        .eh-datepicker .react-datepicker__day-name {
          color: ${THEME.textAsh};
          font-weight: 900;
          letter-spacing: 1px;
          font-size: 11px;
        }

        .eh-datepicker .react-datepicker__navigation {
          top: 12px;
        }

        .eh-datepicker .react-datepicker__navigation-icon::before {
          border-color: ${THEME.textSilver};
        }

        .eh-datepicker .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
          border-color: ${THEME.flameAmber};
        }

        .eh-datepicker .react-datepicker__day,
        .eh-datepicker .react-datepicker__time-list-item {
          color: ${THEME.textSilver};
          font-weight: 900;
          border-radius: 10px;
        }

        .eh-datepicker .react-datepicker__day:hover,
        .eh-datepicker .react-datepicker__time-list-item:hover {
          background: rgba(242, 153, 74, 0.15);
          color: #fff;
        }

        .eh-datepicker .react-datepicker__day--selected,
        .eh-datepicker .react-datepicker__day--keyboard-selected {
          background: linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold});
          color: #111;
          box-shadow: 0 0 18px rgba(242, 153, 74, 0.25);
        }

        .eh-datepicker .react-datepicker__day--today {
          border: 1px solid rgba(242, 201, 76, 0.55);
        }

        .eh-datepicker .react-datepicker__day--outside-month {
          color: rgba(107, 114, 128, 0.7);
        }

        .eh-datepicker .react-datepicker__day--disabled,
        .eh-datepicker .react-datepicker__time-list-item--disabled {
          color: rgba(107, 114, 128, 0.5);
          cursor: not-allowed;
        }

        .eh-datepicker .react-datepicker__time-container {
          border-left: 1px solid ${THEME.stoneBorder};
          background: #0b0d11;
        }

        .eh-datepicker .react-datepicker__time-list-item--selected {
          background: linear-gradient(90deg, ${THEME.flameAmber}, ${THEME.flameGold}) !important;
          color: #111 !important;
          font-weight: 950;
        }

        .eh-datepicker-popper .react-datepicker__triangle::before,
        .eh-datepicker-popper .react-datepicker__triangle::after {
          border-bottom-color: ${THEME.stoneBorder} !important;
        }
      `}</style>
    </div>
  );
}
