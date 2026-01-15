export const dynamic = "force-dynamic";
export const revalidate = 0;

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

function getBaseUrl() {
  // Prefer explicit base URL if you set it
  const explicit = String(process.env.NEXT_PUBLIC_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel provides VERCEL_URL without protocol
  const vercel = String(process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  // Fallback (local dev)
  return "http://localhost:3000";
}

async function getDetail(params: { sessionId: string; guildId?: string | null }): Promise<DetailResponse | null> {
  const sessionId = String(params.sessionId || "").trim();
  const guildId = String(params.guildId || "").trim();
  if (!sessionId) return null;

  const qs = new URLSearchParams();
  qs.set("sessionId", sessionId);
  if (guildId) qs.set("guildId", guildId);

  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/sessions/detail?${qs.toString()}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;

  return res.json();
}

export default async function SessionDetailPage(props: {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const resolvedParams =
    typeof (props.params as any)?.then === "function"
      ? await (props.params as Promise<{ id: string }>)
      : (props.params as { id: string });

  const resolvedSearchParams =
    props.searchParams && typeof (props.searchParams as any)?.then === "function"
      ? await (props.searchParams as Promise<Record<string, string | string[] | undefined>>)
      : (props.searchParams as Record<string, string | string[] | undefined>) || {};

  const sessionId = String(resolvedParams?.id || "").trim();

  const guildIdRaw = resolvedSearchParams.guildId;
  const guildId = Array.isArray(guildIdRaw) ? String(guildIdRaw[0] || "") : String(guildIdRaw || "");

  const data = await getDetail({ sessionId, guildId });

  return <SessionDetailClient data={data} />;
}
