import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { billingRateLimit } from "../lib/rateLimiter";
import { getUserTier, getPriceId } from "../lib/tier";

const billingRouter = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CheckoutSessionSchema = z
  .object({
    tier: z.enum(["rise", "reign", "legacy"]).optional(),
    interval: z.enum(["monthly", "yearly"]).optional(),
    priceId: z.string().min(1).optional(),
    successUrl: z.string().url("successUrl must be a valid URL.").optional(),
    cancelUrl: z.string().url("cancelUrl must be a valid URL.").optional(),
  })
  .refine((d) => d.priceId || (d.tier && d.interval), {
    message: "Either priceId or both tier + interval must be provided.",
  });

const PortalSessionSchema = z.object({
  returnUrl: z.string().url("returnUrl must be a valid URL.").optional(),
});

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parseBody<T>(schema: z.ZodType<T>, body: unknown): ParseResult<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    return { ok: false, error: result.error.errors[0]?.message ?? "Invalid request body." };
  }
  return { ok: true, data: result.data };
}

// ─── GET /billing/status ─────────────────────────────────────────────────────

billingRouter.get("/billing/status", billingRateLimit, requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status, subscription_tier, current_period_end, stripe_customer_id")
      .eq("id", userId)
      .single();

    const row = (profile as Record<string, unknown> | null) ?? {};
    const status = (row["subscription_status"] as string | null) ?? "none";
    const rawTier = (row["subscription_tier"] as string | null) ?? "foundation";
    const tier =
      rawTier === "rise" || rawTier === "reign" || rawTier === "legacy"
        ? rawTier
        : "foundation";
    const currentPeriodEnd = (row["current_period_end"] as string | null) ?? null;
    const hasCustomer = !!(row["stripe_customer_id"] as string | null);

    res.json({ tier, status, currentPeriodEnd, hasCustomer });
  } catch (err) {
    req.log?.error({ err }, "GET /billing/status error");
    res.status(500).json({ error: "Could not fetch billing status." });
  }
});

// ─── GET /billing/prices ─────────────────────────────────────────────────────
// Returns which tier/interval combos are configured (no actual price IDs exposed).

billingRouter.get("/billing/prices", async (_req, res) => {
  const tiers = ["rise", "reign", "legacy"] as const;
  const intervals = ["monthly", "yearly"] as const;

  const availability: Record<string, Record<string, boolean>> = {};
  for (const tier of tiers) {
    availability[tier] = {};
    for (const interval of intervals) {
      availability[tier]![interval] = getPriceId(tier, interval) !== null;
    }
  }

  res.json({ prices: availability });
});

// ─── POST /billing/create-checkout-session ───────────────────────────────────

billingRouter.post("/billing/create-checkout-session", billingRateLimit, requireAuth, async (req, res) => {
  try {
    const parsed = parseBody(CheckoutSessionSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

    const userId = (req as any).userId as string;
    const userEmail = (req as any).userEmail as string;
    const { tier, interval, successUrl, cancelUrl } = parsed.data;
    let { priceId } = parsed.data;

    // Resolve priceId from tier + interval if not explicitly provided
    if (!priceId && tier && interval) {
      const resolved = getPriceId(tier, interval);
      if (!resolved) {
        res.status(400).json({
          error: `The ${tier} ${interval} plan is not yet configured. Please try again later or contact support@raimzeal.com.`,
          code: "PRICE_NOT_CONFIGURED",
        });
        return;
      }
      priceId = resolved;
    }

    const stripe = await getUncachableStripeClient();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    let customerId = (profile as any)?.stripe_customer_id as string | null ?? null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const base = `https://${process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "localhost"}`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId!, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: successUrl ?? `${base}/billing?success=1`,
      cancel_url: cancelUrl ?? `${base}/pricing`,
      metadata: { user_id: userId },
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log?.error({ err }, "POST /billing/create-checkout-session error");
    res.status(500).json({ error: "Could not create checkout session." });
  }
});

// ─── POST /billing/create-portal-session ────────────────────────────────────

billingRouter.post("/billing/create-portal-session", billingRateLimit, requireAuth, async (req, res) => {
  try {
    const parsed = parseBody(PortalSessionSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

    const userId = (req as any).userId as string;
    const { returnUrl } = parsed.data;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    const customerId = (profile as any)?.stripe_customer_id as string | null ?? null;
    if (!customerId) {
      res.status(404).json({ error: "No billing account found. Subscribe first." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const base = `https://${process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "localhost"}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl ?? `${base}/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    req.log?.error({ err }, "POST /billing/create-portal-session error");
    res.status(500).json({ error: "Could not create portal session." });
  }
});

// ─── POST /billing/cancel-at-period-end ──────────────────────────────────────
// Schedules a subscription to cancel at the end of the current billing period.
// Access is preserved until currentPeriodEnd, then webhook fires subscription.deleted
// which sets the profile back to Foundation. Never deletes user data.

billingRouter.post("/billing/cancel-at-period-end", billingRateLimit, requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;

    const userTier = await getUserTier(userId);
    if (userTier === "foundation") {
      res.status(400).json({ error: "No active subscription to cancel." });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    const customerId = (profile as any)?.stripe_customer_id as string | null ?? null;
    if (!customerId) {
      res.status(404).json({ error: "No billing account found." });
      return;
    }

    const stripe = await getUncachableStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    const sub = subscriptions.data[0];
    if (!sub) {
      res.status(404).json({ error: "No active subscription found." });
      return;
    }

    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });

    logger.info({ userId, subscriptionId: sub.id }, "Subscription scheduled to cancel at period end");
    res.json({
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: new Date((updated as any).current_period_end * 1000).toISOString(),
    });
  } catch (err) {
    req.log?.error({ err }, "POST /billing/cancel-at-period-end error");
    res.status(500).json({ error: "Could not schedule cancellation." });
  }
});

export default billingRouter;
