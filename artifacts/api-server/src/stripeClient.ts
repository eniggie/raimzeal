import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

async function fetchConnection(hostname: string, token: string, env: string) {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", env);

  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": token },
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) return null;

  const data = await resp.json() as {
    items?: Array<{ settings?: { publishable?: string; secret?: string } }>
  };

  const settings = data.items?.[0]?.settings;
  if (!settings?.secret || !settings?.publishable) return null;

  return { publishableKey: settings.publishable, secretKey: settings.secret };
}

async function getCredentials(): Promise<{ publishableKey: string; secretKey: string }> {
  const hostname = process.env["REPLIT_CONNECTORS_HOSTNAME"];
  const xReplitToken = process.env["REPL_IDENTITY"]
    ? "repl " + process.env["REPL_IDENTITY"]
    : process.env["WEB_REPL_RENEWAL"]
      ? "depl " + process.env["WEB_REPL_RENEWAL"]
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
      "Ensure the Stripe integration is connected via the Integrations tab."
    );
  }

  const isProduction = process.env["REPLIT_DEPLOYMENT"] === "1";

  if (isProduction) {
    const prod = await fetchConnection(hostname, xReplitToken, "production");
    if (prod) return prod;
    const dev = await fetchConnection(hostname, xReplitToken, "development");
    if (dev) return dev;
    throw new Error(
      "Stripe connection not found. Connect Stripe via the Integrations tab first."
    );
  }

  const dev = await fetchConnection(hostname, xReplitToken, "development");
  if (dev) return dev;
  throw new Error(
    "Stripe development connection not found. Connect Stripe via the Integrations tab first."
  );
}

/**
 * Returns a fresh Stripe client. Never cache this — always call again to pick up rotated keys.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, { apiVersion: "2025-08-27.basil" as any });
}

export async function getStripePublishableKey(): Promise<string> {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

/**
 * Returns a fresh StripeSync instance for webhook processing and data sync.
 */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  const { secretKey } = await getCredentials();
  const webhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl, max: 2 },
    stripeSecretKey: secretKey,
    ...(webhookSecret ? { webhookSecret } : {}),
  });
}
