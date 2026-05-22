import { Router } from "express";
import { logger } from "../lib/logger";

const stripeRouter = Router();

// GET /api/stripe/donation-health — public, no auth
// Server-side HEAD check of the Stripe donation URL so clients can confirm
// it is reachable before navigating the user's browser there.
// Returns { ok: true } when the page responds with a 2xx or redirect, { ok: false } otherwise.
const STRIPE_DONATION_URL = "https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00";
stripeRouter.get("/stripe/donation-health", async (_req, res) => {
  try {
    const r = await fetch(STRIPE_DONATION_URL, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    const ok = r.ok || (r.status >= 300 && r.status < 400);
    return res.json({ ok });
  } catch {
    return res.json({ ok: false });
  }
});

export default stripeRouter;
