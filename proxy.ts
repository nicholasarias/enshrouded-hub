import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEFAULT_GUILD_ID = "1391117470676287518";

export function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Only guard the home page
  if (pathname !== "/") return NextResponse.next();

  const guildId = url.searchParams.get("guildId")?.trim() || "";

  // If already present, allow normal dashboard render
  if (guildId) return NextResponse.next();

  // Otherwise send them to landing with default guildId
  const to = url.clone();
  to.pathname = "/landing";
  to.searchParams.set("guildId", DEFAULT_GUILD_ID);
  return NextResponse.redirect(to);
}

// Don’t run on Next internal assets
export const config = {
  matcher: ["/"],
};
