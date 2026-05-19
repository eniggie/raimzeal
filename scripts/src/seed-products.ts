/**
 * RAIMZEAL Membership Tiers — Stripe Product Seeder
 *
 * Creates the three RAIMZEAL membership products and prices in Stripe.
 * Safe to run multiple times — checks for existing products before creating.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
import { getUncachableStripeClient } from "./stripeClient";

const PRODUCTS = [
  {
    name: "RAIMZEAL Athlete",
    description: "Full workout library, unlimited Ovia AI, nutrition tracking, community posting, and more.",
    tier: "athlete",
    monthly: 999,   // $9.99
    yearly: 9599,   // $95.99 (save 20%)
  },
  {
    name: "RAIMZEAL Elite",
    description: "Everything in Athlete plus priority Ovia AI, AI meal plans, coaching reports, and early access.",
    tier: "elite",
    monthly: 1999,  // $19.99
    yearly: 19199,  // $191.99 (save 20%)
  },
] as const;

async function seed() {
  const stripe = await getUncachableStripeClient();
  console.log("🎯 Seeding RAIMZEAL membership products in Stripe...\n");

  for (const plan of PRODUCTS) {
    // Check if already exists
    const existing = await stripe.products.search({
      query: `metadata['tier']:'${plan.tier}' AND active:'true'`,
    });

    let productId: string;

    if (existing.data.length > 0) {
      productId = existing.data[0].id;
      console.log(`✓ ${plan.name} already exists (${productId})`);
    } else {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: { tier: plan.tier, app: "raimzeal" },
      });
      productId = product.id;
      console.log(`✚ Created ${plan.name} (${productId})`);
    }

    // Monthly price
    const existingMonthly = await stripe.prices.list({ product: productId, active: true });
    const hasMonthly = existingMonthly.data.some(
      (p) => p.recurring?.interval === "month" && p.unit_amount === plan.monthly
    );

    if (!hasMonthly) {
      const monthly = await stripe.prices.create({
        product: productId,
        unit_amount: plan.monthly,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { tier: plan.tier, interval: "month" },
      });
      console.log(`  ✚ Monthly price: $${plan.monthly / 100}/mo (${monthly.id})`);
    } else {
      console.log(`  ✓ Monthly price already exists`);
    }

    // Yearly price
    const hasYearly = existingMonthly.data.some(
      (p) => p.recurring?.interval === "year" && p.unit_amount === plan.yearly
    );

    if (!hasYearly) {
      const yearly = await stripe.prices.create({
        product: productId,
        unit_amount: plan.yearly,
        currency: "usd",
        recurring: { interval: "year" },
        metadata: { tier: plan.tier, interval: "year" },
      });
      console.log(`  ✚ Yearly price: $${plan.yearly / 100}/yr (${yearly.id})`);
    } else {
      console.log(`  ✓ Yearly price already exists`);
    }

    console.log();
  }

  console.log("✅ Done! Stripe webhooks will sync products to your database automatically.");
  console.log("   Restart the API server to pick up the new price IDs.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
