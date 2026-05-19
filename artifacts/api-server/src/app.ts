import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// ── Stripe webhook — MUST be registered before express.json() ───────────────
// Stripe requires the raw Buffer; express.json() would destroy it.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
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
  if (process.env.NODE_ENV !== "production") return true;
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

export default app;
