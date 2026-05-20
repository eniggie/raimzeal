import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { requireAuth } from "../middleware/auth";

const stripeRouter = Router();

// ── Plans config (kept in sync with seed-products metadata) ──────────────────
export const PLANS = [
  {
    id: "free",
    name: "Foundation",
    tagline: "Start your journey",
    price: 0,
    priceLabel: "Free forever",
    features: [
      "10 workouts from library",
      "Basic calorie & macro tracking",
      "Community (read-only)",
      "Daily Ovia AI coaching limit",
      "Basic progress charts",
      "Weight tracking",
    ],
    cta: "Get started",
    highlighted: false,
  },
  {
    id: "athlete",
    name: "Athlete",
    tagline: "For the dedicated",
    price: 9.99,
    priceLabel: "$9.99 / month",
    features: [
      "Full workout library & programs",
      "Unlimited nutrition logging",
      "Full body measurements",
      "Unlimited Ovia AI",
      "Community posting & comments",
      "Progress PDF export",
      "Activity tracker & reminders",
      "Progress card sharing",
      "Calendar scheduling",
    ],
    cta: "Start Athlete",
    highlighted: true,
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "Maximum performance",
    price: 19.99,
    priceLabel: "$19.99 / month",
    features: [
      "Everything in Athlete",
      "Priority Ovia AI (GPT-4o)",
      "AI-generated meal plans",
      "Weekly Ovia coaching digest",
      "Custom workout builder",
      "Early access to new features",
      "Exclusive Elite badge",
      "PDF coaching reports",
    ],
    cta: "Go Elite",
    highlighted: false,
  },
] as const;

// GET /api/stripe/plans — public, no auth required
stripeRouter.get("/stripe/plans", async (_req, res) => {
  try {
    // Try to enrich with live Stripe price IDs
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({ active: true, expand: ["data.product"], limit: 20 });

    const enriched = PLANS.map((plan) => {
      if (plan.id === "free") return { ...plan, priceId: null };
      const match = prices.data.find(
        (p) =>
          (p.product as { metadata?: { tier?: string } })?.metadata?.tier === plan.id &&
          p.active
      );
      return { ...plan, priceId: match?.id ?? null };
    });

    res.json({ plans: enriched });
  } catch {
    // Return plans without price IDs if Stripe not yet connected
    res.json({ plans: PLANS.map((p) => ({ ...p, priceId: null })) });
  }
});

// GET /api/stripe/subscription — returns current user's subscription tier
// Requires a valid Supabase JWT in Authorization header
stripeRouter.get("/stripe/subscription", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;

    const result = await db.execute(
      sql`SELECT stripe_subscription_id, stripe_customer_id, membership_tier FROM users WHERE id = ${userId}`
    );
    const user = result.rows[0] as { stripe_subscription_id?: string; stripe_customer_id?: string; membership_tier?: string } | undefined;
    if (!user?.stripe_subscription_id) {
      return res.json({ tier: user?.membership_tier ?? "free", subscription: null });
    }

    const stripe = await getUncachableStripeClient();
    const sub = await stripe.subscriptions.retrieve(user.stripe_subscription_id);
    return res.json({ tier: user.membership_tier ?? "free", subscription: sub });
  } catch (err) {
    logger.error({ err }, "Error fetching subscription");
    return res.status(500).json({ error: "Could not fetch subscription" });
  }
});

// POST /api/stripe/checkout — create a Stripe Checkout Session
// requireAuth: userId and email come exclusively from verified JWT — never from request body.
stripeRouter.post("/stripe/checkout", requireAuth, async (req, res) => {
  try {
    const { priceId, successUrl, cancelUrl } = req.body as {
      priceId: string;
      successUrl: string;
      cancelUrl: string;
    };

    if (!priceId) return res.status(400).json({ error: "priceId required" });

    // Both userId and email are resolved from verified JWT — body values are ignored.
    const userId = (req as any).userId as string;
    const userEmail = (req as any).userEmail as string | undefined;

    const stripe = await getUncachableStripeClient();

    // Look up existing Stripe customer from DB using verified userId only.
    const result = await db.execute(
      sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`
    );
    const row = result.rows[0] as { stripe_customer_id?: string } | undefined;
    let customerId: string | undefined = row?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId },
      });
      customerId = customer.id;
      await db.execute(
        sql`UPDATE users SET stripe_customer_id = ${customerId} WHERE id = ${userId}`
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Checkout error");
    return res.status(500).json({ error: "Could not create checkout session" });
  }
});

// POST /api/stripe/portal — create a Billing Portal session
// requireAuth: customerId is looked up from DB using verified userId — never trusted from body
stripeRouter.post("/stripe/portal", requireAuth, async (req, res) => {
  try {
    const { returnUrl } = req.body as { returnUrl: string };
    const userId = (req as any).userId as string;

    // Look up customer ID from database using verified userId
    const result = await db.execute(
      sql`SELECT stripe_customer_id FROM users WHERE id = ${userId}`
    );
    const row = result.rows[0] as { stripe_customer_id?: string } | undefined;
    const customerId = row?.stripe_customer_id;

    if (!customerId) {
      return res.status(404).json({ error: "No billing account found for this user" });
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Portal error");
    return res.status(500).json({ error: "Could not create portal session" });
  }
});

export default stripeRouter;
