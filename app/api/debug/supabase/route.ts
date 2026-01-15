import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const guildId = String(url.searchParams.get("guildId") || "").trim();

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";

  let count: number | null = null;
  let last: any = null;
  let err: any = null;

  if (guildId) {
    const q = await supabaseAdmin
      .from("sessions")
      .select("id,title,created_at,guild_id")
      .eq("guild_id", guildId)
      .order("created_at", { ascending: false })
      .limit(5);

    err = q.error || null;
    last = q.data || null;
    count = Array.isArray(q.data) ? q.data.length : null;
  }

  return NextResponse.json({
    supabaseUrl,
    hasGuildId: Boolean(guildId),
    sampleCount: count,
    latest5: last,
    error: err,
  });
}
