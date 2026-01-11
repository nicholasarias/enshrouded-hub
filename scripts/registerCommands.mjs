import "dotenv/config";

const token = process.env.DISCORD_BOT_TOKEN;
const appId = process.env.DISCORD_APPLICATION_ID;

if (!token || !appId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in .env.local");
  process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${appId}/commands`;

const body = [
  {
    name: "setup",
    description: "Set the channel for Enshrouded Hub session posts",
    type: 1,
    options: [
      {
        name: "channel",
        description: "Channel to post sessions in",
        type: 7,
        required: true,
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
