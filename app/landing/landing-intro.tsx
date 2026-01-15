"use client";

import React, { useEffect, useMemo, useState } from "react";

const DEFAULT_GUILD_ID = "1391117470676287518";

// Match your hub palette
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
};

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function buildUrl(basePath: string, params: Record<string, string>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type Ember = {
  key: string;
  size: number;
  left: string;
  top: string;
  delay: string;
  dur: string;
  opacity: number;
};

export default function LandingIntro(props: { guildId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [entering, setEntering] = useState(false);

  const guildId = useMemo(() => {
    const raw = String(props.guildId || "").trim();
    if (raw && isSnowflake(raw)) return raw;
    return DEFAULT_GUILD_ID;
  }, [props.guildId]);

  const dashboardHref = useMemo(() => {
    return buildUrl("/", { guildId });
  }, [guildId]);

  // 👉 Client-only ember generation (prevents hydration mismatch)
  const embers = useMemo<Ember[]>(() => {
    if (!loaded) return [];

    return Array.from({ length: 22 }).map((_, i) => {
      const size = rand(2, 6);
      return {
        key: `e${i}-${Math.random().toString(16).slice(2)}`,
        size,
        left: `${rand(0, 100)}%`,
        top: `${rand(55, 92)}%`,
        delay: `${rand(0, 4.5)}s`,
        dur: `${rand(3.8, 7.2)}s`,
        opacity: rand(0.35, 0.85),
      };
    });
  }, [loaded]);

  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 220);
    return () => clearTimeout(t);
  }, []);

  function enter() {
    if (entering) return;
    setEntering(true);

    setTimeout(() => {
      window.location.href = dashboardHref;
    }, 900);
  }

  const titleText = "ENSHROUDED HUB";

  return (
    <div className={`wrap ${loaded ? "loaded" : ""} ${entering ? "entering" : ""}`}>
      <div className="fog fog1" aria-hidden="true" />
      <div className="fog fog2" aria-hidden="true" />

      <div className="logo">
        <div className="embers" aria-hidden="true">
          {loaded
            ? embers.map((e) => (
                <span
                  key={e.key}
                  className="ember"
                  style={{
                    width: e.size,
                    height: e.size,
                    left: e.left,
                    top: e.top,
                    animationDelay: e.delay,
                    animationDuration: e.dur,
                    opacity: e.opacity,
                  }}
                />
              ))
            : null}
        </div>

        <h1 className="logoText" aria-label={titleText}>
          {titleText}
        </h1>

        <p className="tagline">The Shroud Consumes All</p>

        <button type="button" className="enterBtn" onClick={enter}>
          Enter the Shroud
        </button>
      </div>

      <style jsx>{`
        .wrap {
          position: fixed;
          inset: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: radial-gradient(circle at center, ${THEME.shroudMist} 0%, ${THEME.shroudDeep} 80%, #000 100%);
          color: ${THEME.textSilver};
          font-family: "Segoe UI", Roboto, serif;
        }

        .fog {
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          opacity: 0;
          filter: blur(46px);
          transform-origin: center;
          pointer-events: none;
          will-change: transform, opacity;
        }

        .fog1 {
          background: radial-gradient(circle at center, transparent 20%, ${THEME.shroudDeep} 100%),
            repeating-linear-gradient(
              120deg,
              rgba(42, 61, 69, 0.55) 0,
              rgba(74, 109, 117, 0.28) 40px,
              transparent 105px
            );
          animation: drift 35s infinite linear;
          z-index: 2;
        }

        .fog2 {
          background: repeating-linear-gradient(45deg, transparent 0, rgba(42, 61, 69, 0.42) 60px, transparent 150px);
          animation: drift 55s infinite reverse linear;
          z-index: 3;
          filter: blur(64px);
        }

        .logo {
          position: relative;
          z-index: 10;
          text-align: center;
          opacity: 0;
          transform: scale(0.78);
          filter: blur(48px);
          transition: opacity 1.4s ease, transform 1.4s cubic-bezier(0.1, 0.9, 0.2, 1), filter 1.4s ease;
        }

        .embers {
          position: absolute;
          inset: -40px 0 auto 0;
          height: 240px;
          pointer-events: none;
          z-index: 1;
        }

        .ember {
          position: absolute;
          background: ${THEME.flameAmber};
          border-radius: 999px;
          filter: blur(1px);
          animation-name: rise;
          animation-timing-function: ease-out;
          animation-iteration-count: infinite;
        }

        .logoText {
          margin: 0;
          font-weight: 950;
          text-transform: uppercase;
          letter-spacing: 0.22em;
          font-size: clamp(2.9rem, 8vw, 6.6rem);
          color: #fff;
          text-shadow: 0 0 20px rgba(242, 153, 74, 0.35), 0 18px 50px rgba(0, 0, 0, 0.85);
          position: relative;
          z-index: 2;
        }

        .tagline {
          margin: 10px 0 0;
          color: ${THEME.textAsh};
          font-size: 12px;
          letter-spacing: 5px;
          text-transform: uppercase;
          opacity: 0.75;
        }

        .enterBtn {
          margin-top: 34px;
          padding: 14px 22px;
          border-radius: 8px;
          border: 1px solid ${THEME.stoneBorder};
          background: linear-gradient(180deg, ${THEME.stoneCard}, #0f1217);
          color: ${THEME.textSilver};
          cursor: pointer;
          font-weight: 950;
          letter-spacing: 1px;
          text-transform: uppercase;
          box-shadow: 0 16px 45px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(0, 0, 0, 0.6);
          opacity: 0;
          transform: translateY(18px);
          transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 1.1s ease;
        }

        .enterBtn:hover {
          transform: translateY(14px);
          border-color: ${THEME.flameAmber};
          box-shadow: 0 0 22px rgba(242, 153, 74, 0.25), 0 16px 45px rgba(0, 0, 0, 0.65),
            inset 0 0 14px rgba(242, 153, 74, 0.12);
        }

        .hint {
          margin-top: 14px;
          font-size: 12px;
          color: rgba(209, 213, 219, 0.55);
          letter-spacing: 0.4px;
          opacity: 0;
          transition: opacity 1.1s ease;
        }

        .loaded .fog {
          opacity: 0.92;
          transition: opacity 1.2s ease;
        }

        .loaded .logo {
          opacity: 1;
          transform: scale(1);
          filter: blur(0px);
        }

        .loaded .enterBtn {
          opacity: 1;
          transform: translateY(0);
        }

        .loaded .hint {
          opacity: 1;
        }

        .entering .fog {
          transition: transform 0.95s cubic-bezier(0.7, 0, 0.3, 1), opacity 0.75s ease;
          transform: scale(9) translateY(18%);
          opacity: 0;
        }

        .entering .logo {
          transition: transform 0.65s ease, opacity 0.65s ease, filter 0.65s ease;
          transform: scale(2.2);
          opacity: 0;
          filter: blur(24px);
        }

        @keyframes drift {
          0% {
            transform: translate(0, 0) rotate(0deg);
          }
          50% {
            transform: translate(-3%, 2%) rotate(1deg);
          }
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
        }

        @keyframes rise {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          20% {
            opacity: 0.85;
          }
          100% {
            transform: translateY(-170px) scale(0.55);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
