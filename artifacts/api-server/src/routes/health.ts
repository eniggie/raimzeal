import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { getEmailConfigStatus } from "../lib/mailer";

const router: IRouter = Router();

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
  const emailStatus = getEmailConfigStatus();
  const email: "up" | "down" = emailStatus.configured ? "up" : "down";

  if (supabase === "down") {
    logger.warn("[healthz] Supabase ping failed");
  }
  if (stripe === "down") {
    logger.warn("[healthz] Stripe ping failed");
  }

  if (email === "down") {
    logger.warn({ missing: emailStatus.missing }, "[healthz] email env vars are missing — email verification will fail");
  }

  res.json({
    ok: true,
    supabase,
    stripe,
    twilio,
    email,
    emailProvider: emailStatus.provider,
    emailProviders: emailStatus.providers,
    emailFallbackCount: emailStatus.fallbackCount,
  });
});

export default router;
