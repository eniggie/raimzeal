import { type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// Read Supabase URL from env — fail loudly at request time if missing or invalid.
// SUPABASE_URL is the canonical server-side variable.
// EXPO_PUBLIC_SUPABASE_URL is kept as a fallback for legacy env setups.
const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
const supabaseAnonKey = process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
    throw new Error(
      "[requireAuth] SUPABASE_URL is not configured or invalid. " +
      "Set the SUPABASE_URL environment variable to your Supabase project URL."
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

/**
 * requireAuth — returns 401 if no valid Supabase JWT is present.
 * Sets req.userId and req.userEmail on success.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const { data: { user }, error } = await getSupabaseClient().auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.userId = user.id;
    req.userEmail = user.email;
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * optionalAuth — extracts and validates the Supabase JWT if present.
 * Sets req.userId and req.userEmail if valid.
 * Continues without error if no token provided.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }
  const token = authHeader.slice(7);
  try {
    const { data: { user } } = await getSupabaseClient().auth.getUser(token);
    if (user) {
      req.userId = user.id;
      req.userEmail = user.email;
    }
  } catch {
    // Ignore auth errors for optional middleware — continue without userId
  }
  next();
}
