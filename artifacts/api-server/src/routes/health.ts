import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { getProbeHistory } from "../lib/healthProbe";

const router: IRouter = Router();

function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env["ADMIN_SECRET"];
  if (!secret) {
    res.status(503).json({ error: "Admin secret not configured on this server." });
    return;
  }
  if (req.headers["x-admin-secret"] !== secret) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  next();
}

router.get("/healthz", async (_req, res) => {
  const results = await Promise.allSettled([
    // Supabase ping — lightweight single-row SELECT
    supabaseAdmin.from("profiles").select("id").limit(1),
    // Stripe ping — list 1 product
    getUncachableStripeClient().then((stripe) => stripe.products.list({ limit: 1 })),
  ]);

  const supabase: "up" | "down" = results[0]?.status === "fulfilled" ? "up" : "down";
  const stripe: "up" | "down" = results[1]?.status === "fulfilled" ? "up" : "down";

  // Twilio: verify env vars are present (we won't spend credits on a ping)
  const twilio: "up" | "down" =
    process.env["TWILIO_ACCOUNT_SID"] &&
    process.env["TWILIO_AUTH_TOKEN"] &&
    process.env["TWILIO_FROM_NUMBER"]
      ? "up"
      : "down";

  if (supabase === "down") {
    logger.warn("[healthz] Supabase ping failed");
  }
  if (stripe === "down") {
    logger.warn("[healthz] Stripe ping failed");
  }

  res.json({ ok: true, supabase, stripe, twilio });
});

router.get("/health/donation-history", requireAdminSecret, (_req, res) => {
  const history = getProbeHistory();
  res.json({
    count: history.length,
    cap: 48,
    runs: history.slice().reverse(),
  });
});

export default router;
