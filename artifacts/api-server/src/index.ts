import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { validateEnv } from "./lib/validateEnv";
import pg from "pg";

validateEnv();

/**
 * Ensures the Supabase community_posts table has the image_url column and
 * notifies PostgREST to reload its schema cache so it picks up the column.
 * Non-fatal — any error is logged and the server continues.
 */
async function runSupabaseSchemaMigration() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) return;

  const { Pool } = pg;
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query(
      `ALTER TABLE IF EXISTS community_posts ADD COLUMN IF NOT EXISTS image_url TEXT`
    );
    await pool.query(`SELECT pg_notify('pgrst', 'reload schema')`);
    logger.info("Supabase schema migration complete — PostgREST cache reloaded");
  } catch (err) {
    logger.warn({ err }, "Supabase schema migration failed — non-fatal");
  } finally {
    await pool.end();
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
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
await runSupabaseSchemaMigration();

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  startScheduler();
});
