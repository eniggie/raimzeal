import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { webhookRateLimit } from "./lib/rateLimiter";

const app: Express = express();

// Trust the Replit reverse proxy so express-rate-limit reads the real client IP
// from X-Forwarded-For instead of the proxy's loopback address.
app.set("trust proxy", 1);

// ── Stripe + Billing webhooks — MUST be registered before express.json() ────
// Stripe requires the raw Buffer; express.json() would destroy it.
// Rate limiter applied first (before raw body parser) to block DOS floods early.
app.post(
  "/api/billing/webhook",
  webhookRateLimit,
  express.raw({ type: "application/json" }),
  async (req, res, next) => {
    try {
      const { handleBillingWebhook } = await import("./lib/billingWebhookHandler");
      await handleBillingWebhook(req, res);
    } catch (err) {
      next(err);
    }
  }
);
app.post(
  "/api/stripe/webhook",
  webhookRateLimit,
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      // stripe-replit-sync verifies the signature and handles its own sync tables
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      // Also process billing events to update Supabase profiles (subscription tier,
      // status, period end). The payload was already verified above so we trust it.
      try {
        const { handleBillingEvent } = await import("./lib/billingWebhookHandler");
        const event = JSON.parse((req.body as Buffer).toString("utf8")) as Parameters<typeof handleBillingEvent>[0];
        await handleBillingEvent(event);
      } catch (err) {
        logger.error({ err }, "Billing event processing failed — non-fatal");
      }

      res.status(200).json({ received: true });
    } catch (err: unknown) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

// ── Security headers ─────────────────────────────────────────────────────────
// helmet() automatically disables X-Powered-By and sets HSTS, X-Frame-Options,
// X-Content-Type-Options, Referrer-Policy, and more.
// contentSecurityPolicy is disabled because this is a pure JSON API — CSP is
// handled by the web frontend (Vite) separately.
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS ─────────────────────────────────────────────────────────────────────
// In production: only allow raimzeal.com and the Replit preview domains.
// In development: allow any origin for ease of local testing.
const PRODUCTION_ORIGINS = [
  "https://raimzeal.com",
  "https://www.raimzeal.com",
];

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // server-to-server / mobile requests have no Origin
  if (process.env.NODE_ENV === "development") return true;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  // Allow Replit preview domains (*.replit.app, *.repl.co, *.replit.dev)
  if (/\.(replit\.app|repl\.co|replit\.dev)$/.test(origin)) return true;
  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin }, "CORS blocked request from unauthorized origin");
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ── Standard middleware (after webhook route) ────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: true, limit: "64kb" }));

app.use("/api", router);

// ── Global error handler ──────────────────────────────────────────────────────
// Catches body-parser SyntaxError (malformed JSON) and other Express errors.
// Prevents raw HTML stack traces from leaking server internals to clients.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof SyntaxError && "status" in err && (err as any).status === 400) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  logger.error({ err }, "Unhandled Express error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
