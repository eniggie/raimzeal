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

  // Email: verify SMTP credentials can connect
  let email: "up" | "down" = "down";
  let emailProvider: string = "not configured";
  const smtpHost = process.env["SMTP_HOST"];
  const smtpUser = process.env["SMTP_USER"];
  const smtpPass = process.env["SMTP_PASS"];
  if (smtpHost && smtpUser && smtpPass) {
    emailProvider = smtpHost;
    try {
      const nodemailer = (await import("nodemailer")).default;
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env["SMTP_PORT"] ?? "587"),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 5000,
        socketTimeout: 5000,
      });
      await transporter.verify();
      email = "up";
    } catch {
      email = "down";
    }
  }

  // AI: Ovia AI is up when the Brave Search key is configured
  const ai: "up" | "degraded" = process.env["BRAVE_SEARCH_API_KEY"] ? "up" : "degraded";

  if (supabase === "down") {
    logger.warn("[healthz] Supabase ping failed");
  }
  if (stripe === "down") {
    logger.warn("[healthz] Stripe ping failed");
  }
  if (email === "down") {
    logger.warn("[healthz] SMTP verification failed");
  }

  res.json({ ok: true, supabase, stripe, twilio, email, emailProvider, ai });
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
