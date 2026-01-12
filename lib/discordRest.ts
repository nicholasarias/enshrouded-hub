const DISCORD_API = "https://discord.com/api/v10";

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export async function discordBotGet<T>(path: string): Promise<T> {
  const token = mustEnv("DISCORD_BOT_TOKEN");

  const res = await fetch(`${DISCORD_API}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Discord API error ${res.status} on ${path}: ${text}`);
  }

  return (await res.json()) as T;
}
