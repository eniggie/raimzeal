import { type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

// EXPO_PUBLIC_SUPABASE_URL may be set to a key value instead of the URL.
// Fall back to the known project URL so server-side auth always works.
const rawSupabaseUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
const supabaseUrl = rawSupabaseUrl.startsWith("https://")
  ? rawSupabaseUrl
  : "https://druogyuqjytmkwihinhg.supabase.co";
const supabaseAnonKey = process.env["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?? "";

function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}

/**
 * requireAuth — returns 401 if no valid Supabase JWT is present.
 * Sets (req as any).userId and (req as any).userEmail on success.
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
    (req as any).userId = user.id;
    (req as any).userEmail = user.email;
    next();
  } catch {
    res.status(401).json({ error: "Authentication failed" });
  }
}

/**
 * optionalAuth — extracts and validates the Supabase JWT if present.
 * Sets (req as any).userId and (req as any).userEmail if valid.
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
      (req as any).userId = user.id;
      (req as any).userEmail = user.email;
    }
  } catch {
    // Ignore auth errors for optional middleware — continue without userId
  }
  next();
}
