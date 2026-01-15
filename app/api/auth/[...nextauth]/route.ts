import { handlers } from "@/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

console.log("AUTH ROUTE LOADED: /api/auth/[...nextauth]");

export const { GET, POST } = handlers;
