"use client";

import { useEffect, useState } from "react";

export default function OfficerOnly({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isOfficer, setIsOfficer] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/me/permissions");
        const json = await res.json();
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
  }, []);

  if (!ready) return null;
  if (!isOfficer) return null;

  return <>{children}</>;
}
