import { type Request, type Response, type NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";

/**
 * requirePremium — 402 if the authenticated user's subscription_status is not "active".
 * Must be used AFTER requireAuth so (req as any).userId is guaranteed.
 */
export async function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("subscription_status, subscription_tier")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    res.status(500).json({ error: "Could not verify subscription status." });
    return;
  }

  const status = (profile as any).subscription_status as string | null;
  if (status !== "active") {
    res.status(402).json({
      error: "Premium subscription required.",
      code: "PREMIUM_REQUIRED",
      currentStatus: status ?? "none",
    });
    return;
  }

  next();
}
