import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(id);
}

/**
 * GET /api/me/selected-roles?guildId=...
 *
 * Returns the user's current selection for:
 * - combat role (one)
 * - logistics role (one)
 *
 * Reads from: user_hub_roles
 */

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session as any).userId as string | undefined;
  if (!userId) {
    return NextResponse.json({ error: "Missing user id" }, { status: 400 });
  }

  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ error: "Missing or invalid guildId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("user_hub_roles")
    .select("role_kind, role_id, selected_at")
    .eq("user_id", userId)
    .eq("guild_id", guildId);

  if (error) {
    console.error("user_hub_roles select failed:", error);
    return NextResponse.json({ error: "Failed to load selections" }, { status: 500 });
  }

  let combatRoleId: string | null = null;
  let logisticsRoleId: string | null = null;

  for (const row of data ?? []) {
    if (row.role_kind === "combat") combatRoleId = row.role_id;
    if (row.role_kind === "logistics") logisticsRoleId = row.role_id;
  }

  return NextResponse.json(
    {
      ok: true,
      guildId,
      combatRoleId,
      logisticsRoleId,
    },
    { status: 200 }
  );
}
