import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

function pickDiscordUserId(session: any): string | null {
  const candidates = [
    session?.discordUserId,
    session?.user?.discord_user_id,
    session?.user?.discordUserId,
    session?.user?.id,
    session?.user?.sub,
  ];

  for (const v of candidates) {
    const s = String(v || "").trim();
    if (isSnowflake(s)) return s;
  }

  return null;
}

async function requireOfficerOr401(guildId: string) {
  const session = await auth();
  if (!session) {
    return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) {
    return { ok: false as const, res: NextResponse.json({ error: "Missing discord user id in session" }, { status: 401 }) };
  }

  const prof = await supabaseAdmin
    .from("profiles")
    .select("id, discord_user_id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (prof.error || !prof.data?.id) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Profile not found" }, { status: 401 }),
    };
  }

  const userId = prof.data.id;

  const settings = await supabaseAdmin
    .from("guild_settings")
    .select("officer_role_id")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (settings.error) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Failed to load guild settings" }, { status: 500 }),
    };
  }

  const officerRoleId = String(settings.data?.officer_role_id || "").trim();
  if (!isSnowflake(officerRoleId)) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Officer role not configured for this guild" }, { status: 403 }),
    };
  }

    const has = await supabaseAdmin
    .from("user_guild_roles")
    .select("user_id")
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("role_id", officerRoleId)
    .maybeSingle();

  if (has.error) {
    return {
      ok: false as const,
      res: NextResponse.json(
        { error: "Failed to verify officer role", details: has.error.message },
        { status: 500 }
      ),
    };
  }

  if (!has.data?.user_id) {
    return {
      ok: false as const,
      res: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true as const };
}

type RowOut = {
  userId: string;
  discordUserId: string;
  discordUsername: string | null;
  discordGlobalName: string | null;
  discordAvatar: string | null;

  combatRoleId: string | null;
  combatRoleName: string | null;

  logisticsRoleId: string | null;
  logisticsRoleName: string | null;

  updatedAt: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  const guard = await requireOfficerOr401(guildId);
  if (!guard.ok) return guard.res;

  // 1) Load all selections for this guild
  const selections = await supabaseAdmin
  .from("user_hub_roles")
  .select("*")
  .eq("guild_id", guildId);


  if (selections.error) {
    return NextResponse.json(
      { error: "Failed to load user hub roles", details: selections.error.message },
      { status: 500 }
    );
  }

  const rows = selections.data || [];

  const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
  const roleIds = Array.from(new Set(rows.map((r: any) => r.role_id).filter(Boolean)));

  // 2) Load profiles for those users
  const profilesRes =
    userIds.length > 0
      ? await supabaseAdmin
          .from("profiles")
          .select("id, discord_user_id, discord_username, discord_global_name, discord_avatar")
          .in("id", userIds)
      : { data: [], error: null as any };

  if (profilesRes.error) {
    return NextResponse.json(
      { error: "Failed to load profiles", details: profilesRes.error.message },
      { status: 500 }
    );
  }

  const profiles = profilesRes.data || [];
  const profileById = new Map<string, any>();
  for (const p of profiles) profileById.set(p.id, p);

  // 3) Load Discord role names (best effort)
  const rolesRes =
    roleIds.length > 0
      ? await supabaseAdmin
          .from("discord_guild_roles")
          .select("role_id, name")
          .eq("guild_id", guildId)
          .in("role_id", roleIds)
      : { data: [], error: null as any };

  // If this table name differs in your schema, you can change it here only.
  const roleNameById = new Map<string, string>();
  if (!rolesRes.error) {
    for (const r of rolesRes.data || []) {
      roleNameById.set(String(r.role_id), String(r.name || ""));
    }
  }

  // 4) Build per-user output
  const outByUser = new Map<string, RowOut>();

  for (const r of rows) {
    const userId = String(r.user_id || "");
    if (!userId) continue;

    const prof = profileById.get(userId);

    const existing =
      outByUser.get(userId) ||
      ({
        userId,
        discordUserId: String(prof?.discord_user_id || ""),
        discordUsername: prof?.discord_username ?? null,
        discordGlobalName: prof?.discord_global_name ?? null,
        discordAvatar: prof?.discord_avatar ?? null,

        combatRoleId: null,
        combatRoleName: null,

        logisticsRoleId: null,
        logisticsRoleName: null,

        updatedAt: null,
      } as RowOut);

    const kind = String(r.role_kind || "");
    const roleId = String(r.role_id || "");
    const updatedAt = r.updated_at ? String(r.updated_at) : r.created_at ? String(r.created_at) : null;


    if (kind === "combat") {
      existing.combatRoleId = roleId || null;
      existing.combatRoleName = roleNameById.get(roleId) || null;
    } else if (kind === "logistics") {
      existing.logisticsRoleId = roleId || null;
      existing.logisticsRoleName = roleNameById.get(roleId) || null;
    }

    if (!existing.updatedAt) {
      existing.updatedAt = updatedAt;
    } else if (updatedAt && new Date(updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
      existing.updatedAt = updatedAt;
    }

    outByUser.set(userId, existing);
  }

  // Only return users we have a discord id for (keeps UI clean)
  const out = Array.from(outByUser.values()).filter((r) => isSnowflake(r.discordUserId));

  // Sort: most recently updated first
  out.sort((a, b) => {
    const at = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bt = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bt - at;
  });

  return NextResponse.json({
    ok: true,
    guildId,
    count: out.length,
    rows: out,
  });
}
