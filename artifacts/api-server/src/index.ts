import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const RAIMZEAL_PRODUCTS = [
  {
    name: "RAIMZEAL Athlete",
    description: "Full workout library, unlimited Ovia AI, nutrition tracking, community posting, and more.",
    tier: "athlete",
    monthly: 999,
  },
  {
    name: "RAIMZEAL Elite",
    description: "Everything in Athlete plus priority Ovia AI, AI meal plans, coaching reports, and early access.",
    tier: "elite",
    monthly: 1999,
  },
] as const;

async function seedProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    for (const plan of RAIMZEAL_PRODUCTS) {
      const existing = await stripe.products.search({
        query: `metadata['tier']:'${plan.tier}' AND active:'true'`,
      });
      let productId: string;
      if (existing.data.length > 0) {
        productId = existing.data[0].id;
      } else {
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
          metadata: { tier: plan.tier, app: "raimzeal" },
        });
        productId = product.id;
        logger.info({ productId, tier: plan.tier }, "Created Stripe product");
      }
      const prices = await stripe.prices.list({ product: productId, active: true });
      const hasMonthly = prices.data.some(
        (p) => p.recurring?.interval === "month" && p.unit_amount === plan.monthly
      );
      if (!hasMonthly) {
        await stripe.prices.create({
          product: productId,
          unit_amount: plan.monthly,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { tier: plan.tier },
        });
        logger.info({ tier: plan.tier }, "Created monthly Stripe price");
      }
    }
    logger.info("Stripe products seeded");
  } catch (err) {
    logger.warn({ err }, "Stripe product seeding skipped — non-fatal");
  }
}

async function initStripe() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }

  try {
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env["REPLIT_DOMAINS"]?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info("Stripe webhook configured");

    // Background backfill — do not block server startup
    stripeSync.syncBackfill()
      .then(() => logger.info("Stripe data backfill complete"))
      .catch((err: unknown) => logger.error({ err }, "Stripe backfill error"));
  } catch (err: unknown) {
    logger.error({ err }, "Stripe initialization failed — payments unavailable");
    // Non-fatal: server continues without Stripe
  }
}

await initStripe();
await seedProducts();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  startScheduler();
});
