/**
 * RAIMZEAL Membership Tiers — Stripe Product Seeder
 *
 * Creates the three RAIMZEAL membership products and prices in Stripe.
 * Safe to run multiple times — checks for existing products before creating.
 *
 * Canonical prices (locked — do not change without explicit approval):
 *   Rise:   $9.99/mo  · $99/yr
 *   Reign:  $19.99/mo · $199/yr  (Best Value)
 *   Legacy: $49.99/mo · $499/yr
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/seed-products.ts
 */
import { getUncachableStripeClient } from "./stripeClient";

const PRODUCTS = [
  {
    name: "RAIMZEAL Rise",
    description: "Improved food scans, macro breakdown, basic meal planning, adaptive workouts, habit reminders, weekly wellness report, and more AI coach messages.",
    tier: "rise",
    monthly: 999,    // $9.99
    yearly:  9900,   // $99.00 (save ~17%)
  },
  {
    name: "RAIMZEAL Reign",
    description: "Everything in Rise plus full AI wellness coach, full food scan analysis, cycle syncing, adaptive strength programs, stress & sleep readiness, nutrition planning, and wearable integration.",
    tier: "reign",
    monthly: 1999,   // $19.99
    yearly:  19900,  // $199.00 (save ~17%) — Best Value
  },
  {
    name: "RAIMZEAL Legacy",
    description: "Everything in Reign plus fertility & pregnancy wellness tracking, advanced wearable insights, predictive wellness alerts, advanced weekly reports, premium community challenges, priority support, and early access to new features.",
    tier: "legacy",
    monthly: 4999,   // $49.99
    yearly:  49900,  // $499.00 (save ~17%)
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
    const existingPrices = await stripe.prices.list({ product: productId, active: true });
    const hasMonthly = existingPrices.data.some(
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
      console.log(`  ✚ Monthly price: $${(plan.monthly / 100).toFixed(2)}/mo (${monthly.id})`);
    } else {
      console.log(`  ✓ Monthly price already exists`);
    }

    // Yearly price
    const hasYearly = existingPrices.data.some(
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
      console.log(`  ✚ Yearly price: $${(plan.yearly / 100).toFixed(2)}/yr (${yearly.id})`);
    } else {
      console.log(`  ✓ Yearly price already exists`);
    }

    console.log();
  }

  console.log("✅ Done! Set the returned price IDs in Replit Secrets:");
  console.log("   STRIPE_PRICE_RISE_MONTHLY, STRIPE_PRICE_RISE_YEARLY");
  console.log("   STRIPE_PRICE_REIGN_MONTHLY, STRIPE_PRICE_REIGN_YEARLY");
  console.log("   STRIPE_PRICE_LEGACY_MONTHLY, STRIPE_PRICE_LEGACY_YEARLY");
  console.log("   Then restart the API server to pick up the new price IDs.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
