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
      const { handleBillingEvent, isDuplicate, markProcessed } = await import("./lib/billingWebhookHandler");
      const event = JSON.parse((req.body as Buffer).toString("utf8")) as Parameters<typeof handleBillingEvent>[0];

      // Idempotency: skip billing application if we've already applied this event
      // (Stripe delivers at-least-once and retries on any non-2xx).
      let alreadyApplied = false;
      try {
        alreadyApplied = await isDuplicate(event.id);
      } catch (err) {
        logger.error({ err, eventId: event.id }, "Webhook idempotency check failed — processing anyway");
      }

      if (!alreadyApplied) {
        // Apply the billing change, THEN mark processed. If application throws
        // (transient Supabase/Stripe error), we respond 500 so Stripe retries
        // and the tier/status change is not silently lost. stripe-replit-sync's
        // own sync is idempotent, so re-running it on retry is safe.
        await handleBillingEvent(event);
        try {
          await markProcessed(event.id);
        } catch (err) {
          logger.error({ err, eventId: event.id }, "Failed to record processed webhook event (handling succeeded)");
        }
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
// Endpoints that legitimately receive large base64 payloads (a full meal photo
// for AI analysis, or a voice recording for transcription) need a much larger
// body limit than the tight 64 kb default used for every other JSON route.
// These scoped parsers run before the global one and mark the body as parsed,
// so the 64 kb parser below no-ops for these paths only.
app.use("/api/user/meal-photo/analyze", express.json({ limit: "15mb" }));
app.use("/api/ovia/transcribe", express.json({ limit: "30mb" }));

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
  // body-parser raises this when a request exceeds the configured size limit.
  if ((err as any)?.type === "entity.too.large") {
    res.status(413).json({ error: "Request payload too large." });
    return;
  }
  logger.error({ err }, "Unhandled Express error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
