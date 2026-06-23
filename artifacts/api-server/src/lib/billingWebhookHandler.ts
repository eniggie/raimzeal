import type Stripe from "stripe";
import type { Request, Response } from "express";
import { getUncachableStripeClient } from "../stripeClient";
import { supabaseAdmin } from "./supabaseAdmin";
import { logger } from "./logger";
import { normaliseTier, tierFromPriceId } from "./tier";

/**
 * Extract the current billing period end from a Stripe Subscription object.
 *
 * Stripe API 2025-08-27.basil moved `current_period_end` from the subscription
 * root to the subscription item (`items.data[0].current_period_end`). We read
 * the item field first (always present), and fall back to computing from
 * `billing_cycle_anchor + price.recurring.interval` for edge cases where the
 * item list is empty or the field is missing.
 *
 * Returns a Unix timestamp (seconds) or undefined if neither source is usable.
 */
function derivePeriodEnd(sub: Stripe.Subscription): number | undefined {
  // Primary: item-level field (Stripe 2025-08-27.basil and later)
  const itemPeriodEnd = (sub.items?.data?.[0] as any)?.current_period_end as number | undefined;
  if (itemPeriodEnd && itemPeriodEnd > 0) {
    logger.debug({ itemPeriodEnd, iso: new Date(itemPeriodEnd * 1000).toISOString() }, "derivePeriodEnd: using item.current_period_end");
    return itemPeriodEnd;
  }

  // Fallback: compute from billing_cycle_anchor + billing interval
  const anchor   = (sub as any).billing_cycle_anchor as number | undefined;
  const price    = sub.items?.data?.[0]?.price;
  const interval = price?.recurring?.interval as string | undefined;
  const count    = price?.recurring?.interval_count ?? 1;

  logger.debug({ anchor, interval, count, itemPeriodEnd }, "derivePeriodEnd: item field absent — falling back to anchor computation");

  if (!anchor || !interval) return undefined;

  const now    = Math.floor(Date.now() / 1000);
  const cursor = new Date(anchor * 1000);
  let safety = 0;
  while (Math.floor(cursor.getTime() / 1000) <= now && safety++ < 1500) {
    if (interval === "month")      cursor.setMonth(cursor.getMonth() + count);
    else if (interval === "year")  cursor.setFullYear(cursor.getFullYear() + count);
    else if (interval === "week")  cursor.setDate(cursor.getDate() + 7 * count);
    else if (interval === "day")   cursor.setDate(cursor.getDate() + count);
    else break;
  }
  const computed = Math.floor(cursor.getTime() / 1000);
  logger.debug({ computed, iso: new Date(computed * 1000).toISOString() }, "derivePeriodEnd: anchor computation result");
  return computed;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * When a user activates a paid subscription, make sure they are in
 * digest_subscribers with active = true so opt-out tracking works correctly.
 * Uses upsert so it is safe to call multiple times for the same email.
 */
async function activateDigestForCustomer(customerId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("email, name")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data?.email) {
      await supabaseAdmin
        .from("digest_subscribers")
        .upsert(
          { email: data.email, user_name: data.name ?? "Friend", active: true },
          { onConflict: "email" },
        );
      logger.info({ customerId, email: data.email }, "Digest subscription activated — paid subscriber enrolled");
    }
  } catch (err) {
    logger.warn({ customerId, err }, "Could not activate digest for new paid subscriber — non-fatal");
  }
}

/**
 * When a subscriber downgrades to Foundation (subscription canceled or expired),
 * deactivate them in digest_subscribers so they stop receiving paid-tier emails.
 * Looks up the user's email via their stripe_customer_id in profiles.
 */
async function deactivateDigestForCustomer(customerId: string): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data?.email) {
      await supabaseAdmin
        .from("digest_subscribers")
        .update({ active: false })
        .eq("email", data.email);
      logger.info({ customerId, email: data.email }, "Digest subscription deactivated — user downgraded to Foundation");
    }
  } catch (err) {
    logger.warn({ customerId, err }, "Could not deactivate digest for downgraded user — non-fatal");
  }
}

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
      const priceId = sub.items.data[0]?.price?.id;
      const rawMetaTier = sub.items.data[0]?.price?.metadata?.["tier"];
      // Price ID lookup (explicit env-var mapping) takes priority over price metadata
      const tier = tierFromPriceId(priceId) ?? normaliseTier(rawMetaTier);
      const periodEnd = derivePeriodEnd(sub);

      await supabaseAdmin.from("profiles").update({
        stripe_customer_id: session.customer as string,
        subscription_status: sub.status,
        subscription_tier: tier,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: Boolean((sub as any).cancel_at_period_end),
      }).eq("id", userId);

      await activateDigestForCustomer(session.customer as string);
      logger.info({ userId, tier, status: sub.status }, "Checkout completed — subscription activated");
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const periodEnd = derivePeriodEnd(sub);

      if (sub.status === "active" || sub.status === "trialing") {
        // Payment succeeded — upgrade to the paid tier
        const priceId = sub.items.data[0]?.price?.id;
        const rawMetaTier = sub.items.data[0]?.price?.metadata?.["tier"];
        // Price ID lookup (explicit env-var mapping) takes priority over price metadata
        const tier = tierFromPriceId(priceId) ?? normaliseTier(rawMetaTier);
        const periodEndIso = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

        logger.info(
          { customerId, tier, status: sub.status, periodEnd, periodEndIso },
          "Subscription created/updated — writing tier upgrade"
        );

        await supabaseAdmin.from("profiles").update({
          subscription_status: sub.status,
          subscription_tier: tier,
          current_period_end: periodEndIso,
          cancel_at_period_end: Boolean((sub as any).cancel_at_period_end),
        }).eq("stripe_customer_id", customerId);

        await activateDigestForCustomer(customerId);
        logger.info({ customerId, tier, status: sub.status }, "Subscription created/updated — tier upgraded");
      } else if (sub.status === "incomplete_expired" || sub.status === "unpaid") {
        // Payment window lapsed or permanently unpaid — revoke access
        await supabaseAdmin.from("profiles").update({
          subscription_status: sub.status,
          subscription_tier: "foundation",
          current_period_end: null,
          cancel_at_period_end: false,
        }).eq("stripe_customer_id", customerId);

        await deactivateDigestForCustomer(customerId);
        logger.info({ customerId, status: sub.status }, "Subscription expired/unpaid — reverted to foundation");
      } else {
        // incomplete or past_due: payment pending/in-grace-period — update status only, no tier change
        await supabaseAdmin.from("profiles").update({
          subscription_status: sub.status,
        }).eq("stripe_customer_id", customerId);

        logger.info({ customerId, status: sub.status }, "Subscription status updated — tier unchanged");
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await supabaseAdmin.from("profiles").update({
        subscription_status: "canceled",
        subscription_tier: "foundation",
        current_period_end: null,
        cancel_at_period_end: false,
      }).eq("stripe_customer_id", customerId);

      await deactivateDigestForCustomer(customerId);
      logger.info({ customerId }, "Subscription canceled — downgraded to Foundation");
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
