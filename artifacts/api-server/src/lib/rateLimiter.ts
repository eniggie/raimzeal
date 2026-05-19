import rateLimit from "express-rate-limit";

export const oviaRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please wait a moment before asking Ovia again." },
  skipFailedRequests: false,
});

// Strict daily limit per IP for Ovia — prevents free-tier paywall bypass
// when proper per-user auth is not available.
export const oviaDailyRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Daily Ovia AI limit reached. Upgrade to Athlete or Elite for unlimited coaching." },
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

// Protect the admin digest blast endpoint — 3 sends per hour max,
// and always requires the INTERNAL_API_SECRET header.
export const digestSendNowRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Digest send rate limit reached. Try again in an hour." },
});
