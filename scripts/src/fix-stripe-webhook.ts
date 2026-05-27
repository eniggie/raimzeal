import { getUncachableStripeClient } from "./stripeClient.js";

const DEAD_DOMAINS = [
  "0529307b-a170-46c8-aaa6-2fe73e80805c-00-1w5564xboszwx.kirk.replit.dev",
];

const PRODUCTION_DOMAIN = process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? "";

async function main() {
  const stripe = await getUncachableStripeClient();

  console.log("Fetching all webhook endpoints...");
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });

  console.log(`Found ${endpoints.data.length} webhook endpoint(s):`);
  for (const ep of endpoints.data) {
    console.log(`  [${ep.status}] ${ep.url}`);
  }

  // Delete stale endpoints pointing at dead Replit dev domains
  let deleted = 0;
  for (const ep of endpoints.data) {
    const isDead = DEAD_DOMAINS.some((d) => ep.url.includes(d));
    if (isDead) {
      console.log(`\nDeleting stale endpoint: ${ep.url}`);
      await stripe.webhookEndpoints.del(ep.id);
      console.log(`  ✓ Deleted ${ep.id}`);
      deleted++;
    }
  }

  if (deleted === 0) {
    console.log("\nNo stale endpoints found to delete.");
  } else {
    console.log(`\n✓ Removed ${deleted} stale endpoint(s).`);
  }

  // Show remaining endpoints
  const remaining = await stripe.webhookEndpoints.list({ limit: 100 });
  console.log(`\nRemaining endpoints (${remaining.data.length}):`);
  for (const ep of remaining.data) {
    const tag = PRODUCTION_DOMAIN && ep.url.includes(PRODUCTION_DOMAIN) ? " ← PRODUCTION" : "";
    console.log(`  [${ep.status}] ${ep.url}${tag}`);
  }

  if (PRODUCTION_DOMAIN) {
    const hasProduction = remaining.data.some((ep) => ep.url.includes(PRODUCTION_DOMAIN));
    if (!hasProduction) {
      console.log(`\n⚠ No endpoint found for production domain (${PRODUCTION_DOMAIN}).`);
      console.log("  The server will create one automatically on next restart.");
    } else {
      console.log(`\n✓ Production webhook endpoint is active.`);
    }
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
