import { Router } from "express";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { getPriceId } from "../lib/tier";

const stripeRouter = Router();

// GET /api/stripe/donation-health — public, no auth
// Server-side HEAD check of the Stripe donation URL so clients can confirm
// it is reachable before navigating the user's browser there.
// Returns { ok: true } when the page responds with a 2xx or redirect, { ok: false } otherwise.
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

// POST /api/stripe/checkout-session — auth required
// Creates a Stripe Checkout Session for a subscription plan.
// Body: { tier: "rise" | "reign" | "legacy", interval: "monthly" | "yearly" }
// Returns: { url: string } — the Stripe-hosted checkout URL to redirect the user to.
stripeRouter.post("/stripe/checkout-session", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const userEmail = (req as any).userEmail as string | undefined;
  const { tier, interval } = req.body as { tier?: string; interval?: string };

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
    res
      .status(404)
      .json({ error: "This plan is not yet available for purchase. Please check back soon." });
    return;
  }

  // Derive the app's public origin from the request so success/cancel URLs
  // work correctly in both development (Replit preview) and production (raimzeal.com).
  const origin =
    req.headers.origin ??
    `${req.protocol}://${req.get("host")}`;

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
    logger.error({ err, userId, tier, interval }, "Stripe checkout session creation failed");
    res.status(500).json({ error: "Could not create checkout session. Please try again." });
  }
});

export default stripeRouter;
