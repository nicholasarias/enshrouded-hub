import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}
if (!serviceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

// Server-side only client (bypasses RLS). Do not import this into client components.
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
