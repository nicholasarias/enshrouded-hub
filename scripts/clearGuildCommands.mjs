import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID or DISCORD_GUILD_ID in .env.local");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify([]),
});

console.log(res.status, await res.text());
