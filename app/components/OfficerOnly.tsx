"use client";

import { useEffect, useMemo, useState } from "react";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

export default function OfficerOnly({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isOfficer, setIsOfficer] = useState(false);

  const guildId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    const g = String(sp.get("guildId") || "").trim();
    return g && isSnowflake(g) ? g : null;
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const url = guildId ? `/api/me/permissions?guildId=${encodeURIComponent(guildId)}` : "/api/me/permissions";

        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));

        if (!alive) return;
        setIsOfficer(!!json?.isOfficer);
      } catch {
        if (!alive) return;
        setIsOfficer(false);
      } finally {
        if (!alive) return;
        setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [guildId]);

  if (!ready) return null;
  if (!isOfficer) return null;

  return <>{children}</>;
}
