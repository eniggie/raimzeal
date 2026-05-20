import type Stripe from "stripe";
import type { Request, Response } from "express";
import { getUncachableStripeClient } from "../stripeClient";
import { supabaseAdmin } from "./supabaseAdmin";
import { logger } from "./logger";

// ─── Idempotency ─────────────────────────────────────────────────────────────
// Every incoming Stripe event is recorded in stripe_webhook_events by its
// event.id (e.g. "evt_1Abc..."). If the same event arrives twice (Stripe
// retries on non-2xx or network timeout), we short-circuit and return 200
// immediately rather than re-applying the DB update.

async function isDuplicate(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  return !!data;
}

async function markProcessed(eventId: string): Promise<void> {
  await supabaseAdmin
    .from("stripe_webhook_events")
    .insert({ id: eventId });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

export async function handleBillingEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (!userId || session.mode !== "subscription") break;

      const stripe = await getUncachableStripeClient();
      const sub = await stripe.subscriptions.retrieve(session.subscription as string);
      const tier = sub.items.data[0]?.price?.metadata?.["tier"] ?? "athlete";
      const periodEnd = (sub as any).current_period_end as number | undefined;

      await supabaseAdmin.from("profiles").update({
        stripe_customer_id: session.customer as string,
        subscription_status: sub.status,
        subscription_tier: tier,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      }).eq("id", userId);

      logger.info({ userId, tier, status: sub.status }, "Checkout completed — subscription activated");
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const tier = sub.items.data[0]?.price?.metadata?.["tier"] ?? "athlete";
      const periodEnd = (sub as any).current_period_end as number | undefined;

      await supabaseAdmin.from("profiles").update({
        subscription_status: sub.status,
        subscription_tier: tier,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      }).eq("stripe_customer_id", customerId);

      logger.info({ customerId, tier, status: sub.status }, "Subscription updated");
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await supabaseAdmin.from("profiles").update({
        subscription_status: "canceled",
        subscription_tier: "free",
        current_period_end: null,
      }).eq("stripe_customer_id", customerId);

      logger.info({ customerId }, "Subscription canceled");
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await supabaseAdmin.from("profiles").update({
        subscription_status: "past_due",
      }).eq("stripe_customer_id", customerId);

      logger.warn({ customerId }, "Invoice payment failed — subscription past_due");
      break;
    }

    default:
      break;
  }
}

export async function handleBillingWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];

  if (!secret) {
    logger.warn("STRIPE_WEBHOOK_SECRET not configured — billing webhook rejected");
    res.status(500).json({ error: "Webhook secret not configured." });
    return;
  }
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header." });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = await getUncachableStripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err) {
    logger.error({ err }, "Stripe billing webhook signature verification failed");
    res.status(400).json({ error: "Webhook signature verification failed." });
    return;
  }

  // ── Idempotency check ──────────────────────────────────────────────────────
  try {
    if (await isDuplicate(event.id)) {
      logger.info({ eventId: event.id, type: event.type }, "Stripe billing event already processed — skipping");
      res.json({ received: true });
      return;
    }
    await markProcessed(event.id);
  } catch (err) {
    logger.error({ err, eventId: event.id }, "Idempotency check failed — processing anyway");
  }

  try {
    await handleBillingEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error({ err }, "Billing webhook handler error");
    res.status(500).json({ error: "Webhook handler error." });
  }
}
