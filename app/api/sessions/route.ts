import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isUpcoming(startLocal: string) {
  const ms = Date.parse(startLocal);
  if (!Number.isFinite(ms)) return true;
  return ms >= Date.now() - 60 * 60 * 1000; // keep 1 hour past
}

type Counts = { in: number; maybe: number; out: number };

// ---------- Badge icons (match detail route) ----------
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId) {
    return NextResponse.json({ error: "Missing guildId" }, { status: 400 });
  }

  const limit = Math.min(Number(url.searchParams.get("limit") || 50), 100);

  // 1) Sessions
  const { data, error } = await supabaseAdmin
    .from("sessions")
    .select(
      "id,title,start_local,duration_minutes,notes,guild_id,discord_channel_id,discord_message_id,created_at"
    )
    .eq("guild_id", guildId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("sessions list failed:", error);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }

  const sessions = (data ?? []).map((s: any) => ({
    id: String(s.id),
    title: String(s.title ?? ""),
    startLocal: String(s.start_local ?? ""),
    durationMinutes: Number(s.duration_minutes ?? 0),
    notes: String(s.notes ?? ""),
    guildId: String(s.guild_id ?? ""),
    discordChannelId: s.discord_channel_id ? String(s.discord_channel_id) : null,
    discordMessageId: s.discord_message_id ? String(s.discord_message_id) : null,
    createdAt: String(s.created_at ?? ""),
    upcoming: isUpcoming(String(s.start_local ?? "")),
  }));

  // 2) RSVP counts and In roster ids in one pass
  const ids = sessions.map((s) => s.id).filter(Boolean);

  const countsBySession = new Map<string, Counts>();
  const inIdsBySession = new Map<string, Set<string>>();
  const allDiscordIds = new Set<string>();

  for (const id of ids) {
    countsBySession.set(id, { in: 0, maybe: 0, out: 0 });
    inIdsBySession.set(id, new Set<string>());
  }

  if (ids.length) {
    const { data: rsvps, error: rsvpErr } = await supabaseAdmin
      .from("session_rsvps")
      .select("session_id,user_id,status")
      .in("session_id", ids);

    if (rsvpErr) {
      console.error("rsvp counts failed:", rsvpErr);
    } else {
      for (const row of rsvps ?? []) {
        const sid = String((row as any)?.session_id || "").trim();
        const did = String((row as any)?.user_id || "").trim();
        const status = String((row as any)?.status || "").toLowerCase().trim();

        if (!sid || !did) continue;

        allDiscordIds.add(did);

        const cur = countsBySession.get(sid);
        if (!cur) continue;

        if (status === "in") {
          cur.in += 1;
          const set = inIdsBySession.get(sid);
          if (set) set.add(did);
        } else if (status === "maybe") cur.maybe += 1;
        else if (status === "out") cur.out += 1;

        countsBySession.set(sid, cur);
      }
    }
  }

  // 3) profiles: discord_user_id -> profile id
  const discordToProfile = new Map<string, { profileId: string; username: string }>();

  const discordList = Array.from(allDiscordIds);
  if (discordList.length) {
    const { data: profs, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id,discord_user_id,discord_username")
      .in("discord_user_id", discordList);

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

  // 4) user_hub_roles: per profile selected role ids
  const perProfile = new Map<string, { combatRoleId: string | null; logisticsRoleId: string | null }>();

  if (profileIds.length) {
    const { data: selections, error: selErr } = await supabaseAdmin
      .from("user_hub_roles")
      .select("user_id,role_kind,role_id")
      .eq("guild_id", guildId)
      .in("user_id", profileIds);

    if (selErr) {
      console.error("user_hub_roles lookup failed:", selErr);
    } else {
      for (const row of selections ?? []) {
        const pid = String((row as any)?.user_id || "").trim();
        const kind = String((row as any)?.role_kind || "").trim();
        const rid = String((row as any)?.role_id || "").trim();
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

  if (roleIds.length) {
    const { data: meta, error: metaErr } = await supabaseAdmin
      .from("guild_role_meta")
      .select("role_id,group_key")
      .eq("guild_id", guildId)
      .in("role_id", roleIds);

    if (metaErr) {
      console.error("guild_role_meta lookup failed:", metaErr);
    } else {
      for (const m of meta ?? []) {
        const rid = String((m as any)?.role_id || "").trim();
        const gk = String((m as any)?.group_key || "").trim();
        if (rid) roleIdToGroup.set(rid, gk);
      }
    }
  }

  // 6) compute missing badge counts for In roster per session
  function badgesForDiscord(did: string) {
    const prof = discordToProfile.get(did);
    if (!prof) return { combat: "❔", logistics: "❔" };

    const sel = perProfile.get(prof.profileId) || { combatRoleId: null, logisticsRoleId: null };

    const combatGroup = sel.combatRoleId ? roleIdToGroup.get(sel.combatRoleId) : null;
    const logiGroup = sel.logisticsRoleId ? roleIdToGroup.get(sel.logisticsRoleId) : null;

    const combatIcon = combatGroup ? groupIcon(combatGroup) : "❔";
    const logiIcon = logiGroup ? groupIcon(logiGroup) : "❔";

    return {
      combat: isCombatIcon(combatIcon) ? combatIcon : "❔",
      logistics: logiIcon || "❔",
    };
  }

  const missingCombatInBySession = new Map<string, number>();
  const missingLogisticsInBySession = new Map<string, number>();

  for (const sid of ids) {
    const set = inIdsBySession.get(sid) || new Set<string>();
    let mc = 0;
    let ml = 0;

    for (const did of set) {
      const b = badgesForDiscord(did);
      if (!String(b.combat || "").trim() || b.combat === "❔") mc += 1;
      if (!String(b.logistics || "").trim() || b.logistics === "❔") ml += 1;
    }

    missingCombatInBySession.set(sid, mc);
    missingLogisticsInBySession.set(sid, ml);
  }

  const sessionsWithCounts = sessions.map((s) => ({
    ...s,
    counts: countsBySession.get(s.id) || { in: 0, maybe: 0, out: 0 },
    missingCombatIn: missingCombatInBySession.get(s.id) || 0,
    missingLogisticsIn: missingLogisticsInBySession.get(s.id) || 0,
  }));

  return NextResponse.json({ sessions: sessionsWithCounts });
}
