import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ---------- Badge icons (match your Discord route) ----------
function normalizeGroupKey(groupKey: string) {
  let g = String(groupKey || "").toLowerCase().trim();
  if (g.startsWith("logistics_")) g = g.slice("logistics_".length);
  return g;
}

function groupIcon(groupKey: string) {
  const g = normalizeGroupKey(groupKey);

  // Combat
  if (g === "strength") return "🛡";
  if (g === "intelligence") return "🧙";
  if (g === "dexterity") return "🏹";

  // Logistics
  if (g === "architect") return "🏗️";
  if (g === "agronomist") return "🌾";
  if (g === "quartermaster") return "📦";
  if (g === "provisioner") return "🍲";
  if (g === "excavator") return "⛏️";

  // fallback
  if (g === "logistics") return "🧰";
  return "❔";
}

function isCombatIcon(icon: string) {
  return icon === "🛡" || icon === "🧙" || icon === "🏹";
}

type BadgeParts = { combat: string; logistics: string };

type RsvpItem = {
  discordUserId: string;
  username: string; // discord_username if available, else fallback
  badges: BadgeParts;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = String(url.searchParams.get("sessionId") || "").trim();

  if (!sessionId || sessionId === "undefined" || sessionId === "null") {
  return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
}


  // 1) Load session
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from("sessions")
    .select("id,title,start_local,duration_minutes,notes,guild_id,discord_channel_id,discord_message_id,created_at")
    .eq("id", sessionId)
    .single();

  if (sessionErr || !session) {
    console.error("session detail lookup failed:", sessionErr);
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const guildId = String((session as any).guild_id || "").trim();

  // 2) Load RSVPs
  const { data: rsvps, error: rsvpsErr } = await supabaseAdmin
    .from("session_rsvps")
    .select("user_id,status")
    .eq("session_id", sessionId);

  if (rsvpsErr) {
    console.error("rsvps lookup failed:", rsvpsErr);
    return NextResponse.json({ error: "Failed to load RSVPs" }, { status: 500 });
  }

  const inIds: string[] = [];
  const maybeIds: string[] = [];
  const outIds: string[] = [];

  for (const r of rsvps ?? []) {
    const did = String((r as any).user_id || "").trim();
    const st = String((r as any).status || "").trim();
    if (!did) continue;
    if (st === "in") inIds.push(did);
    else if (st === "maybe") maybeIds.push(did);
    else if (st === "out") outIds.push(did);
  }

  const allDiscordIds = Array.from(new Set([...inIds, ...maybeIds, ...outIds]));

  // 3) profiles: map discord_user_id -> profiles.id + discord_username
  const discordToProfile = new Map<string, { profileId: string; username: string }>();

  if (allDiscordIds.length) {
    const { data: profs, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id,discord_user_id,discord_username")
      .in("discord_user_id", allDiscordIds);

    if (profErr) {
      console.error("profiles lookup failed:", profErr);
    } else {
      for (const p of profs ?? []) {
        const did = String((p as any).discord_user_id || "").trim();
        const pid = String((p as any).id || "").trim();
        const uname = String((p as any).discord_username || "").trim();
        if (!did || !pid) continue;
        discordToProfile.set(did, { profileId: pid, username: uname || did });
      }
    }
  }

  const profileIds = Array.from(new Set(Array.from(discordToProfile.values()).map((x) => x.profileId)));

  // 4) user_hub_roles: get selected role_ids per profile
  const perProfile = new Map<string, { combatRoleId: string | null; logisticsRoleId: string | null }>();

  if (guildId && profileIds.length) {
    const { data: selections, error: selErr } = await supabaseAdmin
      .from("user_hub_roles")
      .select("user_id,role_kind,role_id")
      .eq("guild_id", guildId)
      .in("user_id", profileIds);

    if (selErr) {
      console.error("user_hub_roles lookup failed:", selErr);
    } else {
      for (const row of selections ?? []) {
        const pid = String((row as any).user_id || "").trim();
        const kind = String((row as any).role_kind || "").trim();
        const rid = String((row as any).role_id || "").trim();
        if (!pid || !rid) continue;

        const cur = perProfile.get(pid) || { combatRoleId: null, logisticsRoleId: null };
        if (kind === "combat") cur.combatRoleId = rid;
        if (kind === "logistics") cur.logisticsRoleId = rid;
        perProfile.set(pid, cur);
      }
    }
  }

  const roleIds = Array.from(
    new Set(
      Array.from(perProfile.values())
        .flatMap((x) => [x.combatRoleId, x.logisticsRoleId])
        .filter(Boolean) as string[]
    )
  );

  // 5) guild_role_meta: role_id -> group_key
  const roleIdToGroup = new Map<string, string>();

  if (guildId && roleIds.length) {
    const { data: meta, error: metaErr } = await supabaseAdmin
      .from("guild_role_meta")
      .select("role_id,group_key")
      .eq("guild_id", guildId)
      .in("role_id", roleIds);

    if (metaErr) {
      console.error("guild_role_meta lookup failed:", metaErr);
    } else {
      for (const m of meta ?? []) {
        const rid = String((m as any).role_id || "").trim();
        const gk = String((m as any).group_key || "").trim();
        if (rid) roleIdToGroup.set(rid, gk);
      }
    }
  }

  // 6) Build badges per discord id
  const badgePartsByDiscord = new Map<string, BadgeParts>();

  for (const did of allDiscordIds) {
    const prof = discordToProfile.get(did);
    if (!prof) {
      badgePartsByDiscord.set(did, { combat: "❔", logistics: "❔" });
      continue;
    }

    const sel = perProfile.get(prof.profileId) || { combatRoleId: null, logisticsRoleId: null };

    const combatGroup = sel.combatRoleId ? roleIdToGroup.get(sel.combatRoleId) : null;
    const logiGroup = sel.logisticsRoleId ? roleIdToGroup.get(sel.logisticsRoleId) : null;

    const combatIcon = combatGroup ? groupIcon(combatGroup) : "❔";
    const logiIcon = logiGroup ? groupIcon(logiGroup) : "❔";

    badgePartsByDiscord.set(did, {
      combat: isCombatIcon(combatIcon) ? combatIcon : "❔",
      logistics: logiIcon || "❔",
    });
  }

  function makeItem(did: string): RsvpItem {
    const prof = discordToProfile.get(did);
    const username = prof?.username || did;
    const badges = badgePartsByDiscord.get(did) || { combat: "❔", logistics: "❔" };
    return { discordUserId: did, username, badges };
  }

  const inUsers = inIds.map(makeItem);
  const maybeUsers = maybeIds.map(makeItem);
  const outUsers = outIds.map(makeItem);

  const counts = {
    in: inUsers.length,
    maybe: maybeUsers.length,
    out: outUsers.length,
  };

  return NextResponse.json({
    session: {
      id: String((session as any).id),
      title: String((session as any).title || ""),
      startLocal: String((session as any).start_local || ""),
      durationMinutes: Number((session as any).duration_minutes || 0),
      notes: String((session as any).notes || ""),
      guildId,
      discordChannelId: (session as any).discord_channel_id ? String((session as any).discord_channel_id) : null,
      discordMessageId: (session as any).discord_message_id ? String((session as any).discord_message_id) : null,
      createdAt: String((session as any).created_at || ""),
    },
    counts,
    rosters: {
      in: inUsers,
      maybe: maybeUsers,
      out: outUsers,
    },
  });
}
