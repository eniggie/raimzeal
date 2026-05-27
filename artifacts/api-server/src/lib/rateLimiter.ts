import rateLimit from "express-rate-limit";

// ── Auth: signup + login ──────────────────────────────────────────────────────
// 10 requests per minute per IP (generous enough for real users, blocks floods)
export const authSignupLoginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts — please wait a minute before trying again." },
});

// ── Auth: send-*-code ─────────────────────────────────────────────────────────
// 5 requests per minute per IP for OTP sending (prevents SMS/email spam)
export const authSendCodeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many code requests — please wait a minute before trying again." },
});

// ── Billing ───────────────────────────────────────────────────────────────────
// 30 requests per minute per IP on checkout / portal session creation
export const billingRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many billing requests. Please slow down." },
});

// ── Ovia AI ───────────────────────────────────────────────────────────────────
export const oviaRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment before asking Ovia again." },
  skipFailedRequests: false,
});

// Strict daily limit per IP for Ovia — prevents free-tier paywall bypass
export const oviaDailyRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Daily Ovia AI limit reached. Please try again tomorrow." },
  skipFailedRequests: false,
});

export const emailSendRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many email requests — please try again later." },
});

export const emailVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many verification attempts — please wait 15 minutes." },
});

export const emailSubscribeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many subscription requests." },
});

export const emailUnsubscribeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many unsubscribe requests." },
});

// Protect the admin digest blast endpoint — 3 sends per hour max
export const digestSendNowRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Digest send rate limit reached. Try again in an hour." },
});

// ── Community mutations ───────────────────────────────────────────────────────
// Light: likes and comments — 60 per minute per IP (interactive actions)
export const communityMutateLimitLight = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many community actions — please slow down." },
});

// ── Data export ───────────────────────────────────────────────────────────────
// 10 exports per minute per IP — each export runs up to 10 parallel DB queries
export const exportRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many export requests — please wait before exporting again." },
});

// Heavy: post creation — 20 per hour per IP (prevents spam flooding)
export const communityMutateLimitHeavy = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many posts — please wait before posting again." },
});

// ── General user-data writes (profile, measurements, records) ────────────────
// 120 requests per minute per IP — generous for real users, blocks floods
export const generalWriteRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down." },
});

// ── Stripe / Billing webhook endpoints ────────────────────────────────────────
// 200 requests per minute per IP — generous enough for Stripe's retry bursts
// but blocks DOS floods on the unauthenticated raw-body endpoints.
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many webhook requests." },
});
