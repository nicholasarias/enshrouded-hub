import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}


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

async function requireOfficer(guildId: string) {
  const session = await auth();
  if (!session) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const discordUserId = pickDiscordUserId(session);
  if (!discordUserId) return { ok: false as const, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const prof = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", discordUserId)
    .maybeSingle();

  if (prof.error || !prof.data?.id) {
    return { ok: false as const, res: NextResponse.json({ error: "Profile not found" }, { status: 401 }) };
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
      res: NextResponse.json({ error: "Failed to load guild settings", details: settings.error.message }, { status: 500 }),
    };
  }

  const officerRoleId = String(settings.data?.officer_role_id || "").trim();
  if (!isSnowflake(officerRoleId)) {
    return { ok: false as const, res: NextResponse.json({ error: "Officer role not configured for this guild" }, { status: 403 }) };
  }

  // IMPORTANT: your user_guild_roles table does not have an id column
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
      res: NextResponse.json({ error: "Failed to verify officer role", details: has.error.message }, { status: 500 }),
    };
  }

  if (!has.data?.user_id) {
    return { ok: false as const, res: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const };
}

type Body = {
  guildId: string;
  targetDiscordUserId: string;
  roleKind: "combat" | "logistics" | "both";
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<Body> | null;

  const guildId = String(body?.guildId || "").trim();
  const targetDiscordUserId = String(body?.targetDiscordUserId || "").trim();
  const roleKind = String(body?.roleKind || "").trim() as Body["roleKind"];

  if (!isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }
  if (!isSnowflake(targetDiscordUserId)) {
    return NextResponse.json({ error: "Missing or invalid targetDiscordUserId" }, { status: 400 });
  }
  if (roleKind !== "combat" && roleKind !== "logistics" && roleKind !== "both") {
    return NextResponse.json({ error: "Invalid roleKind" }, { status: 400 });
  }

  const guard = await requireOfficer(guildId);
  if (!guard.ok) return guard.res;

  const targetProf = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("discord_user_id", targetDiscordUserId)
    .maybeSingle();

  if (targetProf.error) {
    return NextResponse.json({ error: "Failed to load target profile", details: targetProf.error.message }, { status: 500 });
  }
  if (!targetProf.data?.id) {
    return NextResponse.json({ error: "Target profile not found" }, { status: 404 });
  }

  const targetUserId = targetProf.data.id;

  let del;
  if (roleKind === "both") {
    del = await supabaseAdmin.from("user_hub_roles").delete().eq("guild_id", guildId).eq("user_id", targetUserId);
  } else {
    del = await supabaseAdmin
      .from("user_hub_roles")
      .delete()
      .eq("guild_id", guildId)
      .eq("user_id", targetUserId)
      .eq("role_kind", roleKind);
  }

  if (del.error) {
    return NextResponse.json({ error: "Failed to reset roles", details: del.error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guildId, targetDiscordUserId, roleKind });
}
