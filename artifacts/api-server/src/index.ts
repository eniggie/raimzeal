import app from "./app";
import { logger } from "./lib/logger";
import { startScheduler } from "./scheduler";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { validateEnv } from "./lib/validateEnv";
import pg from "pg";

validateEnv();

/**
 * Ensures the community_posts table has all required columns.
 * Runs via direct pg (DATABASE_URL) which connects to the same PostgreSQL
 * instance that Supabase PostgREST uses.
 * Non-fatal — any error is logged and the server continues.
 */
async function runSupabaseSchemaMigration() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping community schema migration");
    return;
  }

  const { Pool } = pg;
  // Use direct connection (port 5432) not the pooler (port 6543).
  // NOTIFY does not propagate through PgBouncer, so we need the direct host.
  const directUrl = databaseUrl.replace(/:6543\//, ":5432/");
  const pool = new Pool({ connectionString: directUrl, max: 1, connectionTimeoutMillis: 8000 });
  try {
    // Create community tables if they don't exist, then add optional columns.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        post_type TEXT NOT NULL DEFAULT 'post',
        is_legacy_post BOOLEAN NOT NULL DEFAULT false,
        image_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
      ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS is_legacy_post BOOLEAN NOT NULL DEFAULT false;

      CREATE TABLE IF NOT EXISTS community_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS community_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        user_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    // Reload PostgREST schema cache via direct connection (bypasses PgBouncer).
    await pool.query(`SELECT pg_notify('pgrst', 'reload schema')`);
    logger.info("Community schema migration complete — PostgREST cache reloaded");
  } catch (err) {
    logger.warn({ err }, "Community schema migration failed — non-fatal, posts may be unavailable");
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
