import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";

if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
  throw new Error(
    "[supabaseAdmin] SUPABASE_URL is not configured or is invalid. " +
    "Set the SUPABASE_URL environment variable to your Supabase project URL " +
    "(e.g. https://<ref>.supabase.co). Do not use a key/secret value."
  );
}

if (!serviceRoleKey) {
  throw new Error(
    "[supabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not configured. " +
    "Set this environment variable to the Supabase service role key."
  );
}

export const SUPABASE_URL = supabaseUrl;

export const supabaseAdmin = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
