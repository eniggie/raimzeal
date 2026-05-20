import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";
import { billingRateLimit } from "../lib/rateLimiter";

const billingRouter = Router();

// ─── Zod schemas ─────────────────────────────────────────────────────────────

// Item 29: Zod schema for /billing/create-checkout-session
// priceId  — required; Stripe price ID (e.g. price_1Abc...)
// successUrl — optional override; must be a URL if provided
// cancelUrl  — optional override; must be a URL if provided
const CheckoutSessionSchema = z.object({
  priceId: z.string().min(1, "priceId is required."),
  successUrl: z.string().url("successUrl must be a valid URL.").optional(),
  cancelUrl: z.string().url("cancelUrl must be a valid URL.").optional(),
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

// ─── POST /billing/create-checkout-session ───────────────────────────────────

billingRouter.post("/billing/create-checkout-session", billingRateLimit, requireAuth, async (req, res) => {
  try {
    const parsed = parseBody(CheckoutSessionSchema, req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }

    const userId = (req as any).userId as string;
    const userEmail = (req as any).userEmail as string;
    const { priceId, successUrl, cancelUrl } = parsed.data;

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
      line_items: [{ price: priceId, quantity: 1 }],
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

export default billingRouter;
