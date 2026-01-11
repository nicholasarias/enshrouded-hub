import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function verifyDiscordRequest(
  req: Request,
  body: string,
  signature: string,
  timestamp: string
) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) return false;

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + body),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

export async function POST(req: Request) {
  // Require Discord signature headers (Ed25519)
  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");

  if (!signature || !timestamp) {
    return new Response("Missing Discord signature headers", { status: 401 });
  }

  // Read raw body ONCE (Discord signature is over raw bytes)
  const rawBody = await req.text();

  if (!rawBody || rawBody.length > 100_000) {
    return new Response("Payload too large or empty", { status: 413 });
  }

  // Verify signature
  const isValid = verifyDiscordRequest(req, rawBody, signature, timestamp);
  if (!isValid) {
    return new Response("Invalid signature", { status: 401 });
  }

  // Safe to parse after verification
  const body = JSON.parse(rawBody);


  // 1️⃣ PING
  if (body.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // 2️⃣ SLASH COMMANDS (like /setup)
  if (body.type === 2) {
    const commandName = body.data?.name;

    if (commandName === "setup") {
      const channel = body.data?.options?.find(
        (o: any) => o.name === "channel"
      )?.value;

      if (!channel) {
        return NextResponse.json({
          type: 4,
          data: { content: "Missing channel option.", flags: 64 },
        });
      }

     const appId = process.env.DISCORD_APPLICATION_ID;
if (!appId) {
  return NextResponse.json({
    type: 4,
    data: { content: "Server misconfig: DISCORD_APPLICATION_ID missing.", flags: 64 },
  });
}

// Background save + follow up message
void (async () => {
  try {
    await supabaseAdmin.from("discord_servers").upsert({
      guild_id: body.guild_id,
      channel_id: channel,
      updated_at: new Date().toISOString(),
    });

    await fetch(`https://discord.com/api/v10/webhooks/${appId}/${body.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "✅ Channel saved successfully.",
        flags: 64,
      }),
    });
  } catch (e) {
    console.error("Setup save failed:", e);

    await fetch(`https://discord.com/api/v10/webhooks/${appId}/${body.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "❌ Failed to save channel. Check server logs.",
        flags: 64,
      }),
    });
  }
})();

// Immediate deferred response (no timeout)
return NextResponse.json({
  type: 5,
  data: { flags: 64 },
});

    }

    return NextResponse.json({ type: 4, data: { content: "Unknown command." } });
  }

  // 3️⃣ BUTTON CLICKS (RSVP)
  if (body.type === 3) {
    const customId = String(body.data?.custom_id || "");

    if (!customId.startsWith("rsvp:")) {
      return NextResponse.json({ type: 6 });
    }

    const [, sessionId, status] = customId.split(":");
    const userId = String(body.member?.user?.id || body.user?.id || "");

    if (!sessionId || !userId || !["in", "maybe", "out"].includes(status)) {
      return NextResponse.json({ type: 6 });
    }

    const { data: existing, error: existingErr } = await supabaseAdmin
  .from("session_rsvps")
  .select("status")
  .eq("session_id", sessionId)
  .eq("user_id", userId)
  .maybeSingle();

if (existingErr) {
  console.error("RSVP existing lookup failed:", existingErr);
  return NextResponse.json({ type: 6 });
}

if (existing?.status === status) {
  // No change, just ACK so Discord doesn't show failure
  return NextResponse.json({ type: 6 });
}


    // Save RSVP
    const { error } = await supabaseAdmin.from("session_rsvps").upsert(
      {
        session_id: sessionId,
        user_id: userId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,user_id" }
    );

    if (error) {
      console.error("RSVP upsert failed:", error);
      return NextResponse.json({ type: 6 });
    }

    // Load session
    const { data: session, error: sessionErr } = await supabaseAdmin
      .from("sessions")
      .select("title,start_local,duration_minutes,notes")
      .eq("id", sessionId)
      .single();

    if (sessionErr || !session) {
      console.error("Session lookup failed:", sessionErr);
      return NextResponse.json({ type: 6 });
    }

    // Count RSVPs
    const { data: rsvps, error: rsvpsErr } = await supabaseAdmin
      .from("session_rsvps")
      .select("status")
      .eq("session_id", sessionId);

    if (rsvpsErr) {
      console.error("RSVP count failed:", rsvpsErr);
      return NextResponse.json({ type: 6 });
    }

    let inCount = 0;
    let maybeCount = 0;
    let outCount = 0;

    for (const r of rsvps ?? []) {
      if (r.status === "in") inCount++;
      if (r.status === "maybe") maybeCount++;
      if (r.status === "out") outCount++;
    }

    // UPDATE_MESSAGE (type 7)
    return NextResponse.json({
      type: 7,
      data: {
        embeds: [
          {
            title: `New Session: ${session.title}`,
            description: session.notes || "No notes.",
            timestamp: new Date().toISOString(),
            color: 0x2dd4bf,
            fields: [
  {
    name: "🕒 When",
    value: (() => {
      const ms = Date.parse(String(session.start_local));
      if (!Number.isFinite(ms)) return String(session.start_local);
      const unix = Math.floor(ms / 1000);
      return `<t:${unix}:F> (<t:${unix}:R>)`;
    })(),
    inline: false,
  },
  {
    name: "⏱ Duration",
    value: `${Number(session.duration_minutes)} minutes`,
    inline: true,
  },
  {
    name: "📊 RSVPs",
    value: `**In:** ${inCount}  |  **Maybe:** ${maybeCount}  |  **Out:** ${outCount}`,
    inline: false,
  },
],


            footer: { text: "Click a button to RSVP" },
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                label: `In (${inCount})`,
                custom_id: `rsvp:${sessionId}:in`,
              },
              {
                type: 2,
                style: 1,
                label: `Maybe (${maybeCount})`,
                custom_id: `rsvp:${sessionId}:maybe`,
              },
              {
                type: 2,
                style: 4,
                label: `Out (${outCount})`,
                custom_id: `rsvp:${sessionId}:out`,
              },
            ],
          },
        ],
      },
    });
  }

  // Fallback ACK
  return NextResponse.json({ type: 6 });
}
