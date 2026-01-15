export const dynamic = "force-dynamic";
export const revalidate = 0;

import { headers } from "next/headers";
import SessionDetailClient from "./session-detail-client";

type BadgeParts = { combat: string; logistics: string };

type RsvpItem = {
  discordUserId: string;
  username: string;
  badges: BadgeParts;
};

type DetailResponse = {
  session: {
    id: string;
    title: string;
    startLocal: string;
    durationMinutes: number;
    notes: string;
    guildId: string;
    discordChannelId: string | null;
    discordMessageId: string | null;
    createdAt: string;
  };
  counts: { in: number; maybe: number; out: number };
  rosters: { in: RsvpItem[]; maybe: RsvpItem[]; out: RsvpItem[] };
};

async function getBaseUrlFromHeaders() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "";
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore
  }
  return "";
}

function getBaseUrlFromEnv() {
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  return "http://localhost:3000";
}

async function getDetail(sessionId: string, guildId: string): Promise<DetailResponse | null> {
  const base = (await getBaseUrlFromHeaders()) || getBaseUrlFromEnv();

  const url = new URL("/api/sessions/detail", base);
  url.searchParams.set("sessionId", sessionId);
  if (guildId) url.searchParams.set("guildId", guildId);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function SessionDetailPage(props: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: any;
}) {
  const resolvedParams =
    typeof (props.params as any)?.then === "function"
      ? await (props.params as Promise<{ id: string }>)
      : (props.params as { id: string });

  const sessionId = String(resolvedParams?.id || "").trim();
  const guildId = String((props as any)?.searchParams?.guildId || "").trim();

  const data = sessionId ? await getDetail(sessionId, guildId) : null;

  return <SessionDetailClient data={data} />;
}
