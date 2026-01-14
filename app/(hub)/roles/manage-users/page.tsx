"use client";

import React, { useEffect, useState } from "react";
import ManageUsersClient from "./ManageUsersClient";

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function getGuildIdFromUrlOrFallback() {
  const url = new URL(window.location.href);
  const raw = String(url.searchParams.get("guildId") || "").trim();
  if (raw && isSnowflake(raw)) return raw;

  const fb = String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim();
  if (fb && isSnowflake(fb)) return fb;

  return "";
}

export default function ManageUsersPage() {
  const [mounted, setMounted] = useState(false);
  const [guildId, setGuildId] = useState("");

  useEffect(() => {
    setMounted(true);
    setGuildId(getGuildIdFromUrlOrFallback());
  }, []);

  if (!mounted) return null;

  if (!guildId) {
    return (
      <div style={{ padding: 24 }}>
        Missing guildId. Add <code>?guildId=...</code> or set <code>NEXT_PUBLIC_DISCORD_GUILD_ID</code>.
      </div>
    );
  }

  return <ManageUsersClient guildId={guildId} />;
}
