import dotenv from "dotenv";

// Explicitly load .env.local (NOT .env)
dotenv.config({ path: ".env.local" });

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !appId || !guildId) {
  console.error("Missing env vars:");
  console.error("DISCORD_BOT_TOKEN:", token ? "OK" : "MISSING");
  console.error("DISCORD_APPLICATION_ID:", appId ? "OK" : "MISSING");
  console.error("DISCORD_GUILD_ID:", guildId ? "OK" : "MISSING");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;

const body = [
  {
    name: "setup",
    description: "Configure Enshrouded Hub for this server (channel and officer role)",
    type: 1,
    options: [
      {
        name: "channel",
        description: "Channel to post sessions in",
        type: 7, // CHANNEL
        required: false,
      },
      {
        name: "officer_role",
        description: "Role that grants officer access inside the Hub",
        type: 8, // ROLE
        required: false,
      },
    ],
  },
  {
    name: "rsvp",
    description: "Create a new hub session post with RSVP buttons",
    type: 1,
    options: [
      {
        name: "title",
        description: "Session title",
        type: 3,
        required: true,
      },
      {
        name: "when",
        description: "When (text). Example: 2026-01-12 8:30pm CT",
        type: 3,
        required: true,
      },
      {
        name: "hours",
        description: "Duration hours (0-24)",
        type: 4,
        required: false,
      },
      {
        name: "minutes",
        description: "Duration minutes (0-59)",
        type: 4,
        required: false,
      },
      {
        name: "notes",
        description: "Optional notes",
        type: 3,
        required: false,
      },
    ],
  },
];

const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(res.status, text);
