export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { handlers } from "@/auth";

// Auth.js v5 App Router wiring
export const { GET, POST } = handlers;
