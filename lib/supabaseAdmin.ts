import "server-only";


import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Server-side only client (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, serviceKey);
