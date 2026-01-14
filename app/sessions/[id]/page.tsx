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
  const fromEnv =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.VERCEL_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL;

  if (fromEnv) return fromEnv.startsWith("http") ? fromEnv : `https://${fromEnv}`;
  return "http://localhost:3000";
}

async function getDetail(sessionId: string): Promise<DetailResponse | null> {
  const baseUrl = getBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/sessions/detail?sessionId=${encodeURIComponent(sessionId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function SessionDetailPage(props: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams =
    typeof (props.params as any)?.then === "function"
      ? await (props.params as Promise<{ id: string }>)
      : (props.params as { id: string });

  const sessionId = String(resolvedParams?.id || "").trim();
  const data = await getDetail(sessionId);

  return <SessionDetailClient data={data} />;
}
