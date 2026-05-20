import { createClient } from "@supabase/supabase-js";

const rawUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
export const SUPABASE_URL = rawUrl.startsWith("https://")
  ? rawUrl
  : "https://druogyuqjytmkwihinhg.supabase.co";

const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

if (!serviceRoleKey) {
  console.warn("[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY not set — admin operations will fail.");
}

export const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
