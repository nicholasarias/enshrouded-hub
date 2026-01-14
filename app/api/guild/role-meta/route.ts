import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isSnowflake(id: string) {
  return /^\d{10,25}$/.test(String(id || "").trim());
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  if (!guildId || !isSnowflake(guildId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid guildId" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("guild_role_meta")
    .select("role_id, role_kind, group_key, display_name, description, enabled, updated_at")
    .eq("guild_id", guildId)
    .eq("enabled", true)
    .order("role_kind", { ascending: true })
    .order("group_key", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    console.error("guild_role_meta select failed:", error);
    return NextResponse.json({ ok: false, error: "Failed to load role meta" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, guildId, roles: data ?? [] }, { status: 200 });
}
