import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { getPriceId } from "../lib/tier";

const stripeRouter = Router();

// GET /api/stripe/status — public, tells clients if subscription checkout is live
stripeRouter.get("/stripe/status", (_req, res) => {
  const PRICE_KEYS = [
    "STRIPE_PRICE_RISE_MONTHLY",
    "STRIPE_PRICE_RISE_YEARLY",
    "STRIPE_PRICE_REIGN_MONTHLY",
    "STRIPE_PRICE_REIGN_YEARLY",
    "STRIPE_PRICE_LEGACY_MONTHLY",
    "STRIPE_PRICE_LEGACY_YEARLY",
  ];
  const available = PRICE_KEYS.every((k) => !!process.env[k]);
  return res.json({ available });
});

// GET /api/stripe/donation-health — public, no auth
const STRIPE_DONATION_URL = "https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00";
stripeRouter.get("/stripe/donation-health", async (_req, res) => {
  try {
    const r = await fetch(STRIPE_DONATION_URL, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    const ok = r.ok || (r.status >= 300 && r.status < 400);
    return res.json({ ok });
  } catch {
    return res.json({ ok: false });
  }
});

// Shared handler used by both route aliases below.
// Accepts { tier, interval } — both are required.
async function handleCheckoutSession(req: Request, res: Response) {
  const userId = (req as any).userId as string;
  const userEmail = (req as any).userEmail as string | undefined;
  const body = req.body as Record<string, unknown>;

  // Support legacy field names used by older cached bundles
  const tier     = (body["tier"]     ?? body["plan"]     ?? body["planKey"]) as string | undefined;
  const interval = (body["interval"] ?? body["billing"]  ?? body["billingCycle"]) as string | undefined;

  if (!tier || !interval) {
    res.status(400).json({ error: "tier and interval are required." });
    return;
  }
  if (!["rise", "reign", "legacy"].includes(tier)) {
    res.status(400).json({ error: "Invalid tier." });
    return;
  }
  if (!["monthly", "yearly"].includes(interval)) {
    res.status(400).json({ error: "Invalid interval." });
    return;
  }

  const priceId = getPriceId(
    tier as "rise" | "reign" | "legacy",
    interval as "monthly" | "yearly"
  );
  if (!priceId) {
    res.status(503).json({ error: "Subscriptions are not yet active. All features are free for now — check back soon!", code: "STRIPE_NOT_CONFIGURED" });
    return;
  }

  // Mobile clients (React Native / Expo) do not send an Origin header.
  // Fall back to the first public REPLIT_DOMAINS entry so that Stripe's
  // success_url / cancel_url point to a reachable HTTPS URL rather than the
  // internal localhost:PORT address that req.get("host") would return.
  const origin =
    req.headers.origin ??
    (process.env["REPLIT_DOMAINS"]
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]}`
      : `${req.protocol}://${req.get("host")}`);

  try {
    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/welcome?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/membership`,
      metadata: { user_id: userId },
      allow_promotion_codes: true,
      ...(userEmail ? { customer_email: userEmail } : {}),
    });

    if (!session.url) {
      logger.error({ userId, tier, interval }, "Stripe returned session with no URL");
      res.status(500).json({ error: "Stripe did not return a checkout URL." });
      return;
    }

    logger.info({ userId, tier, interval, sessionId: session.id }, "Stripe checkout session created");
    res.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotConfigured =
      message.includes("not found") ||
      message.includes("Connect Stripe") ||
      message.includes("integration") ||
      message.includes("Missing Replit");

    if (isNotConfigured) {
      logger.warn({ userId, tier, interval }, "Stripe not connected — returning 503");
      res.status(503).json({ error: "Subscriptions are not yet active. All features are free for now — check back soon!", code: "STRIPE_NOT_CONFIGURED" });
    } else {
      logger.error({ err, userId, tier, interval }, "Stripe checkout session creation failed");
      res.status(500).json({ error: "Could not create checkout session. Please try again." });
    }
  }
}

// POST /api/stripe/checkout-session — canonical path (current bundles)
stripeRouter.post("/stripe/checkout-session", requireAuth, handleCheckoutSession);

// POST /api/billing/create-checkout-session — legacy alias (older cached bundles)
stripeRouter.post("/billing/create-checkout-session", requireAuth, handleCheckoutSession);

export default stripeRouter;
