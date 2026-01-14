import RolesClient from "./RolesClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

type SP = Record<string, string | string[] | undefined>;

function getGuildIdFromSearchParams(sp: SP) {
  const raw = Array.isArray(sp.guildId) ? sp.guildId[0] : sp.guildId;
  const fromUrl = String(raw || "").trim();
  if (fromUrl && isSnowflake(fromUrl)) return fromUrl;

  const fromEnv = String(process.env.NEXT_PUBLIC_DISCORD_GUILD_ID || "").trim();
  if (fromEnv && isSnowflake(fromEnv)) return fromEnv;

  return "";
}

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

export default async function RolesPage({
  searchParams,
}: {
  searchParams?: SP | Promise<SP>;
}) {
  const sp = await Promise.resolve(searchParams ?? {});
  const guildId = getGuildIdFromSearchParams(sp);

  if (!guildId) {
    return (
      <div style={{ padding: 24 }}>
        Missing guildId. Add ?guildId=... to the URL or set NEXT_PUBLIC_DISCORD_GUILD_ID.
      </div>
    );
  }

  return <RolesClient guildId={guildId} theme={THEME} />;
}
