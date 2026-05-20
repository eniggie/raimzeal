import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requirePremium } from "../middleware/requirePremium";

const premiumRouter = Router();

// ─── GET /premium/sample — exercises the requirePremium guard ────────────────
premiumRouter.get("/premium/sample", requireAuth, requirePremium, (_req, res) => {
  res.json({
    message: "Welcome to RAIMZEAL Premium. This endpoint is gated behind an active subscription.",
    features: [
      "Unlimited Ovia AI",
      "Full workout library",
      "AI-generated meal plans",
      "Priority support",
    ],
  });
});

export default premiumRouter;
