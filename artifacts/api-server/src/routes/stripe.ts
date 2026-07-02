import { Router, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";
import { getUncachableStripeClient } from "../stripeClient";
import { getPriceId, tierFromPriceId, normaliseTier } from "../lib/tier";
import { supabaseAdmin } from "../lib/supabaseAdmin";

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
  const userId = req.userId as string;
  const userEmail = req.userEmail as string | undefined;
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
      success_url: `${origin}/membership?checkout=success`,
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

// GET /api/stripe/sync-subscription — pull user's active Stripe subscription and
// write it to the Supabase profiles row. Used as a reliable fallback for the
// membership page after checkout, in case the webhook hasn't fired yet.
stripeRouter.get("/stripe/sync-subscription", requireAuth, async (req, res) => {
  const userId = req.userId as string;

  try {
    const stripe = await getUncachableStripeClient();

    // Get the user's stripe_customer_id and email from Supabase
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | null | undefined;

    // If no customer ID stored yet, look up by email in Stripe
    if (!customerId) {
      const email = profile?.email as string | undefined;
      if (email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        customerId = customers.data[0]?.id;
      }
    }

    if (!customerId) {
      res.json({ tier: "foundation", status: null, synced: false });
      return;
    }

    // Find the most recently active / trialing subscription
    const [activeSubs, trialingSubs] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 }),
      stripe.subscriptions.list({ customer: customerId, status: "trialing", limit: 1 }),
    ]);
    const sub = activeSubs.data[0] ?? trialingSubs.data[0];

    if (!sub) {
      res.json({ tier: "foundation", status: "none", synced: false });
      return;
    }

    const priceId = sub.items.data[0]?.price?.id;
    const rawMetaTier = sub.items.data[0]?.price?.metadata?.["tier"];
    const tier = tierFromPriceId(priceId) ?? normaliseTier(rawMetaTier) ?? "foundation";
    const itemPeriodEnd = (sub.items?.data?.[0] as any)?.current_period_end as number | undefined;
    const periodEndIso = itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : null;

    await supabaseAdmin.from("profiles").update({
      stripe_customer_id: customerId,
      subscription_status: sub.status,
      subscription_tier: tier,
      current_period_end: periodEndIso,
      cancel_at_period_end: Boolean((sub as any).cancel_at_period_end),
    }).eq("id", userId);

    logger.info({ userId, tier, status: sub.status }, "Subscription synced via /stripe/sync-subscription");
    res.json({ tier, status: sub.status, synced: true });
  } catch (err) {
    const isNotConfigured =
      err instanceof Error &&
      (err.message.includes("not found") ||
        err.message.includes("Connect Stripe") ||
        err.message.includes("Missing Replit"));
    if (isNotConfigured) {
      res.json({ tier: "foundation", status: null, synced: false });
    } else {
      logger.error({ err, userId }, "Failed to sync subscription");
      res.status(500).json({ error: "Failed to sync subscription" });
    }
  }
});

// POST /api/stripe/portal-session — open Stripe Billing Portal for active subscribers
stripeRouter.post("/stripe/portal-session", requireAuth, async (req, res) => {
  const userId = req.userId as string;

  const origin =
    req.headers.origin ??
    (process.env["REPLIT_DOMAINS"]
      ? `https://${process.env["REPLIT_DOMAINS"].split(",")[0]}`
      : `${req.protocol}://${req.get("host")}`);

  try {
    const stripe = await getUncachableStripeClient();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | null | undefined;

    if (!customerId) {
      const email = profile?.email as string | undefined;
      if (email) {
        const customers = await stripe.customers.list({ email, limit: 1 });
        customerId = customers.data[0]?.id;
      }
    }

    if (!customerId) {
      res.status(400).json({ error: "No billing account found. Please subscribe first." });
      return;
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/membership?portal=return`,
    });

    logger.info({ userId, customerId }, "Stripe billing portal session created");
    res.json({ url: portalSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isNotConfigured =
      message.includes("not found") ||
      message.includes("Connect Stripe") ||
      message.includes("integration") ||
      message.includes("Missing Replit");

    if (isNotConfigured) {
      logger.warn({ userId }, "Stripe not connected — portal unavailable");
      res.status(503).json({ error: "Billing portal is not yet available.", code: "STRIPE_NOT_CONFIGURED" });
    } else {
      logger.error({ err, userId }, "Stripe billing portal session creation failed");
      res.status(500).json({ error: "Could not open billing portal. Please try again." });
    }
  }
});

// POST /api/stripe/checkout — canonical path (task spec / new clients)
stripeRouter.post("/stripe/checkout", requireAuth, handleCheckoutSession);

// POST /api/stripe/checkout-session — alias kept for compatibility
stripeRouter.post("/stripe/checkout-session", requireAuth, handleCheckoutSession);

// POST /api/billing/create-checkout-session — legacy alias (older cached bundles)
stripeRouter.post("/billing/create-checkout-session", requireAuth, handleCheckoutSession);

export default stripeRouter;
