import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "../lib/logger";

const billingRouter = Router();

// ─── POST /billing/create-checkout-session ───────────────────────────────────

billingRouter.post("/billing/create-checkout-session", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const userEmail = (req as any).userEmail as string;
    const { priceId, successUrl, cancelUrl } = req.body as {
      priceId: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!priceId) {
      res.status(400).json({ error: "priceId is required." });
      return;
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
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: successUrl ?? `${base}/billing?success=1`,
      cancel_url: cancelUrl ?? `${base}/pricing`,
      metadata: { user_id: userId },
    });

    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Billing checkout error");
    res.status(500).json({ error: "Could not create checkout session." });
  }
});

// ─── POST /billing/create-portal-session ────────────────────────────────────

billingRouter.post("/billing/create-portal-session", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const { returnUrl } = req.body as { returnUrl?: string };

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
    logger.error({ err }, "Portal session error");
    res.status(500).json({ error: "Could not create portal session." });
  }
});

export default billingRouter;
