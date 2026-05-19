# RAIMZEAL — Pre-Submission Production Audit Report
**Date:** May 19, 2026  
**Target:** Apple App Store + Google Play Store (7-day deadline)  
**Auditor:** AI Agent  
**Status:** AUDIT COMPLETE — awaiting owner review before fixes begin

---

## SEVERITY LEGEND
| Symbol | Level | Meaning |
|--------|-------|---------|
| 🔴 | BLOCKER | Must be fixed before store submission. Will cause rejection or security breach. |
| 🟡 | HIGH | Should be fixed before launch. Significant UX/compliance/business risk. |
| 🟢 | MEDIUM | Fix before launch if possible. Lower risk but notable. |
| ⚪ | INFO | Observation only. No action required. |

---

## SECTION 1 — PAGES & ROUTES (Complete Inventory)

### 1A. Web App — `artifacts/raimzeal` (17 pages)

| # | File | Route | Feature | Status |
|---|------|--------|---------|--------|
| 1 | `Home.tsx` | `/` | Dashboard: activity rings, water, quick actions | Live |
| 2 | `Onboarding.tsx` | (initial, pre-auth) | Multi-step onboarding: goals, level, preferences | Live |
| 3 | `Login.tsx` | (auth overlay) | Email/password login | Live |
| 4 | `Workouts.tsx` | `/workouts` | Workout library with filters | Live |
| 5 | `WorkoutDetail.tsx` | `/workout/:id` | Individual workout with exercise list | Live |
| 6 | `WorkoutPlayer.tsx` | `/workout/:id/play` | Live workout session with timers | Live |
| 7 | `Exercises.tsx` | `/exercises` | Full exercise library with categories | Live |
| 8 | `ExerciseDetail.tsx` | `/exercise/:name` | Individual exercise with animation | Live |
| 9 | `Tracking.tsx` | `/tracking` | Weight/body fat/muscle charts | Live |
| 10 | `Calendar.tsx` | `/calendar` | Workout scheduling calendar | Live |
| 11 | `Nutrition.tsx` | `/nutrition` | Calorie & macro logging | Live |
| 12 | `Programs.tsx` | `/programs` | Multi-week training programs | Live |
| 13 | `Coach.tsx` | `/coach` | Ovia AI chat interface | Live |
| 14 | `Community.tsx` | `/community` | Social feed and challenges | Live |
| 15 | `Settings.tsx` | `/settings` | Profile, dark mode, data export | Live |
| 16 | `Membership.tsx` | `/membership` | Stripe subscription plans | Live |
| 17 | `not-found.tsx` | (fallback) | 404 error page | Live |
| — | — | `/privacy` | **Privacy Policy** | 🔴 MISSING |
| — | — | `/terms` | **Terms of Service** | 🟡 Missing on web (exists on mobile) |

### 1B. Mobile App — `artifacts/raimzeal-mobile` (22 screens)

#### Tab Screens (7)
| # | File | Route | Feature |
|---|------|--------|---------|
| 1 | `(tabs)/index.tsx` | `/` | Home dashboard with quick actions |
| 2 | `(tabs)/workouts.tsx` | `/workouts` | Mobile workout library |
| 3 | `(tabs)/ovia.tsx` | `/ovia` | Ovia AI chat with streaming |
| 4 | `(tabs)/nutrition.tsx` | `/nutrition` | Meal logging, barcode scanner, history |
| 5 | `(tabs)/progress.tsx` | `/progress` | Charts, progress photos |
| 6 | `(tabs)/community.tsx` | `/community` | Social feed |
| 7 | `(tabs)/profile.tsx` | `/profile` | User profile & stats |

#### Auth Screens (6)
| # | File | Route | Feature |
|---|------|--------|---------|
| 8 | `auth/welcome.tsx` | `/auth/welcome` | App landing/welcome screen |
| 9 | `auth/login.tsx` | `/auth/login` | Email/password login + password reset |
| 10 | `auth/signup.tsx` | `/auth/signup` | New user registration with Terms consent |
| 11 | `auth/verify-email.tsx` | `/auth/verify-email` | OTP email verification |
| 12 | `auth/phone.tsx` | `/auth/phone` | Phone number entry |
| 13 | `auth/verify-phone.tsx` | `/auth/verify-phone` | SMS OTP verification |

#### Stack Screens (9)
| # | File | Route | Feature |
|---|------|--------|---------|
| 14 | `activity-tracker.tsx` | `/activity-tracker` | GPS/step tracking |
| 15 | `body-measurements.tsx` | `/body-measurements` | Measurement logging form |
| 16 | `edit-profile.tsx` | `/edit-profile` | Profile editing |
| 17 | `membership.tsx` | `/membership` | Stripe subscription with Linking |
| 18 | `progress-photos.tsx` | `/progress-photos` | Before/after photo comparison |
| 19 | `reminders.tsx` | `/reminders` | Local notification scheduling |
| 20 | `terms.tsx` | `/terms` | Full Terms of Service |
| 21 | `workout-player.tsx` | `/workout-player` | Immersive workout session |
| 22 | `+not-found.tsx` | (fallback) | 404 screen |

---

## SECTION 2 — API ENDPOINTS (Complete Inventory)

Base path: `/api` — Server: Express on port 8080

| # | Method | Path | Auth | Rate Limit | Issue |
|---|--------|------|------|------------|-------|
| 1 | GET | `/api/healthz` | None | None | ⚪ Fine |
| 2 | POST | `/api/ovia/chat` | None | 30 req/15 min (IP) | 🔴 No per-user/tier enforcement |
| 3 | POST | `/api/email/send` | None | 10 req/hr | 🟡 No auth — anyone can send |
| 4 | POST | `/api/email/verify` | None | 5 req/15 min | ⚪ Fine |
| 5 | POST | `/api/email/digest/subscribe` | None | 5 req/hr | ⚪ Fine |
| 6 | POST | `/api/email/digest/unsubscribe` | None | None | 🟢 Add rate limit |
| 7 | POST | `/api/email/digest/send-now` | **None** | **None** | 🔴 CRITICAL — no auth, no rate limit — anyone can blast all subscribers |
| 8 | GET | `/api/stripe/plans` | None | None | ⚪ Fine (public data) |
| 9 | GET | `/api/stripe/subscription` | **None** | **None** | 🔴 Uses `req.userId` but no JWT middleware to verify identity |
| 10 | POST | `/api/stripe/checkout` | None | None | 🟡 No auth required — low risk (Stripe validates) |
| 11 | POST | `/api/stripe/portal` | None | None | 🟡 `customerId` not verified against session |
| 12 | POST | `/api/stripe/webhook` | Stripe sig | None | ✅ Correctly using raw body + signature |

---

## SECTION 3 — DATABASE (Complete Inventory)

### 3A. Drizzle/PostgreSQL Tables (API Server)
| Table | Purpose | RLS | Notes |
|-------|---------|-----|-------|
| `users` | Auth users, Stripe IDs, membership tier | N/A (server-side only) | 🟡 `email` column is nullable |
| `community_posts` | Public posts | Unknown | 🔴 RLS status unconfirmed |
| `community_comments` | Post comments | Unknown | 🔴 RLS status unconfirmed |
| `community_likes` | Post likes | Unknown | 🔴 RLS status unconfirmed |
| `programs` | Workout programs | N/A (read-only public) | ✅ |
| `digest_subscribers` | Email digest list | Unknown | 🟡 No RLS needed (server-only) |
| `messages` | AI conversation messages | Unknown | 🔴 If user-facing, needs RLS |
| `conversations` | AI conversation threads | Unknown | 🔴 If user-facing, needs RLS |

### 3B. Supabase Tables (Mobile Direct Access)
| Table | Purpose | RLS Confirmed | Notes |
|-------|---------|---------------|-------|
| `profiles` | User profile data | 🔴 Not confirmed | Must have RLS — user should only read/write own profile |
| `workout_logs` | Workout history | 🔴 Not confirmed | Must have RLS |
| `meal_logs` | Nutrition history | 🔴 Not confirmed | Must have RLS |
| `body_measurements` | Physical measurements | 🔴 Not confirmed | Must have RLS |
| `water_intake` | Daily water logs | 🔴 Not confirmed | Must have RLS |
| `ovia_messages` | AI chat history | ✅ RLS confirmed | Migration `004_ovia_messages.sql` sets policies |

---

## SECTION 4 — THIRD-PARTY INTEGRATIONS

| Integration | Purpose | Status | Issue |
|-------------|---------|--------|-------|
| **Stripe** | Payments & subscriptions | ✅ Configured (Replit connector) | 🟡 Verify live keys for production |
| **OpenAI** (via Replit AI integration) | Ovia AI (GPT-4.1) | ✅ Working | 🟢 No per-user token tracking |
| **Supabase** | Auth + database (mobile) | ✅ Connected | 🔴 RLS unconfirmed on 5 tables |
| **Brave Search** | Web search in Ovia | 🔴 KEY NOT SET | `BRAVE_SEARCH_API_KEY` missing — UI shows "Web search enabled" but it silently falls back |
| **SMTP (email)** | Transactional emails | 🟡 PARTIAL | Only `SMTP_PASS` in secrets. `SMTP_HOST`, `SMTP_USER`, `SMTP_FROM` not confirmed — emails may silently fail |
| **Expo** | Mobile framework | ✅ Running | See mobile-specific issues below |

---

## SECTION 5 — ENVIRONMENT VARIABLES

### Confirmed in Secrets
| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase client key (mobile) |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL (mobile) |
| `SMTP_PASS` | SMTP password for email |

### Required — Status Unknown
| Variable | Purpose | Risk if Missing |
|----------|---------|-----------------|
| `BRAVE_SEARCH_API_KEY` | Ovia web search | 🔴 Ovia shows "Web search enabled" but it's non-functional |
| `SMTP_HOST` | Email server host | 🟡 All emails silently fail |
| `SMTP_PORT` | Email server port | 🟡 All emails silently fail |
| `SMTP_USER` | Email login | 🟡 All emails silently fail |
| `SMTP_FROM` | Sender address | 🟡 All emails silently fail |
| `DATABASE_URL` | PostgreSQL connection | 🔴 Server won't start without this |

### Auto-Managed by Replit
`REPLIT_CONNECTORS_HOSTNAME`, `REPL_IDENTITY`, `WEB_REPL_RENEWAL`, `REPLIT_DEPLOYMENT`, `REPLIT_DOMAINS`, `REPLIT_DEV_DOMAIN`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `PORT`, `NODE_ENV`, `BASE_PATH`

---

## SECTION 6 — MOBILE APP STORE READINESS

### `app.json` Audit
| Field | Value | Status |
|-------|-------|--------|
| `name` | RAIMZEAL | ✅ |
| `slug` | raimzeal-mobile | ✅ |
| `version` | 1.0.0 | ✅ |
| `ios.bundleIdentifier` | com.raimzeal.mobile | ✅ |
| `ios.buildNumber` | **NOT SET** | 🔴 Required for TestFlight/App Store |
| `android.package` | **MISSING** | 🔴 Required for Google Play — submission will fail |
| `android.versionCode` | **NOT SET** | 🔴 Required for Google Play |
| `icon` | `./assets/images/icon.png` | 🟡 Verify: must be 1024×1024px PNG, no transparency (iOS) |
| `splash` | `./assets/images/splash.png` | 🟡 Verify dimensions meet platform requirements |
| `scheme` | raimzeal-mobile | ✅ (deep links) |
| `orientation` | portrait | ✅ |
| `userInterfaceStyle` | dark | ⚪ Dark-only — verify intended |
| `supportsTablet` | false | ⚪ iPad excluded — intentional? |
| `notification` | null | 🟡 Push notifications not configured |
| Privacy Policy URL | **MISSING** | 🔴 Required for both stores |

---

## SECTION 7 — SECURITY AUDIT SUMMARY

### 🔴 Critical Security Issues

**S1. No Authentication Middleware on API**  
The Express server has no global JWT/session verification middleware. `GET /api/stripe/subscription` reads `req.userId` from the request body without verifying the caller is actually that user. Any anonymous HTTP client can query any user's subscription.

**S2. `/api/email/digest/send-now` is completely unprotected**  
No authentication, no rate limiting. Anyone can trigger a mass email blast to all digest subscribers.

**S3. RLS Not Confirmed on 5 Supabase Tables**  
`profiles`, `workout_logs`, `meal_logs`, `body_measurements`, `water_intake` — if RLS is not enabled with `auth.uid() = user_id` policies, any authenticated user can read or modify any other user's health data. This is a GDPR/HIPAA-class breach.

**S4. Ovia AI — Free Tier Limits Not Enforced Server-Side**  
The Foundation plan advertises "5 Ovia AI messages/day" but this is only cosmetic — there is no server-side check. Free users can send unlimited messages, bypassing the paywall.

### 🟡 High Security Issues

**S5. CORS Wildcard in Production**  
`app.use(cors())` with no configuration allows any origin. In production this should be restricted to `raimzeal.com` and `www.raimzeal.com`.

**S6. No Security Headers (helmet missing)**  
Missing: `X-Content-Type-Options`, `Strict-Transport-Security`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`. `X-Powered-By: Express` is currently exposed.

**S7. Password Field in `users` Table**  
The Drizzle schema shows `password: text("password").notNull()`. It is unclear if this is Supabase Auth (hashed) or a custom system. Passwords must be bcrypt-hashed — needs verification.

**S8. `email` Field Nullable in `users` Table**  
Email is not `.notNull()` — this could cause silent failures in email flows and stripe customer creation.

### 🟢 Medium Security Issues

**S9. No Global API Rate Limit**  
Only specific endpoints are rate-limited. A simple global middleware would protect all endpoints.

**S10. `X-Powered-By: Express` Header**  
Minor fingerprinting risk. Should be disabled with `app.disable('x-powered-by')`.

---

## SECTION 8 — OVIA AI AUDIT SUMMARY

| Check | Status | Notes |
|-------|--------|-------|
| API key server-side only | ✅ | Via Replit AI integration (never in client code) |
| All calls via server endpoint | ✅ | Both web and mobile POST to `/api/ovia/chat` |
| Rate limiting (IP-based) | ✅ | 30 req / 15 min per IP |
| Per-user/tier enforcement | 🔴 MISSING | "5 msg/day" for free advertised but not enforced |
| Message history in Supabase | ✅ | `ovia_messages` table with RLS confirmed |
| Context window management | ✅ | 40 message limit, 4000 char limit per message |
| Streaming responses | ✅ | Fixed in last commit (web + mobile) |
| Error handling | ✅ | Graceful fallback messages on both platforms |
| Content moderation | 🟢 MISSING | No filter on user input or AI output |
| User can clear chat history | ⚪ NOT CHECKED | Needs testing |
| Token usage tracking | 🟢 MISSING | No per-user monitoring |
| Brave web search | 🔴 NON-FUNCTIONAL | Key not configured — UI misleadingly shows "Web search enabled" |

---

## SECTION 9 — STRIPE AUDIT SUMMARY

| Check | Status | Notes |
|-------|--------|-------|
| Keys in environment | ✅ | Managed via Replit Stripe connector |
| Webhook signature verification | ✅ | `stripe-replit-sync` library handles this |
| Subscription creation | ✅ | Checkout session flow working |
| Plan definitions | ✅ | Foundation ($0), Athlete ($9.99/mo), Elite ($19.99/mo) |
| Annual pricing | ✅ | Seeded ($95.99/yr, $191.99/yr) |
| Failed payment handling | 🟡 UNKNOWN | `stripe-replit-sync` handles events but needs testing |
| Customer Portal | ✅ | `/api/stripe/portal` endpoint exists |
| Subscription cancellation | 🟡 UNKNOWN | Handled by portal — not separately tested |
| Test vs live keys | 🟡 UNKNOWN | **Must verify production uses Stripe live mode keys** |
| Entitlement enforcement | 🔴 NOT ENFORCED | Tier stored in DB but not checked when accessing features |

---

## SECTION 10 — COMPLETE ISSUE REGISTER

### 🔴 BLOCKERS (10 issues — must fix before any store submission)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| B1 | `android.package` missing from `app.json` | `app.json` | Google Play submission fails immediately |
| B2 | `ios.buildNumber` not set | `app.json` | TestFlight/App Store upload fails |
| B3 | `android.versionCode` not set | `app.json` | Google Play upload fails |
| B4 | No auth middleware — `/api/stripe/subscription` unprotected | `api-server/routes/stripe.ts` | Any attacker can query any user's billing |
| B5 | `/api/email/digest/send-now` — no auth, no rate limit | `api-server/routes/email.ts` | Anyone can trigger mass spam to all users |
| B6 | RLS not confirmed on 5 Supabase tables | Supabase dashboard | GDPR breach — users can read each other's health data |
| B7 | Ovia free tier limit ("5 msg/day") not server-side enforced | `api-server/routes/ovia.ts` | Revenue bypass — free users get unlimited AI |
| B8 | Privacy Policy page missing | Web + Mobile | Apple App Store and Google Play both require a Privacy Policy URL |
| B9 | Brave Search shows "enabled" in UI but key is missing | `api-server/routes/ovia.ts`, `Coach.tsx`, `ovia.tsx` | Misleads users; web search silently fails |
| B10 | Stripe test vs live mode unverified for production | Stripe dashboard | Possible live app accepting test payments |

### 🟡 HIGH PRIORITY (8 issues)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| H1 | CORS wildcard in production | `api-server/src/app.ts` | Any site can make authenticated requests against the API |
| H2 | Security headers missing (no helmet) | `api-server/src/app.ts` | No CSP, HSTS, X-Frame-Options — browser attacks possible |
| H3 | SMTP not fully configured (4 of 5 vars unconfirmed) | Secrets / email.ts | Welcome emails, verification OTPs, digests all silently fail |
| H4 | Password field in `users` table — hashing unverified | `lib/db/schema.ts` | Passwords potentially stored in plain text |
| H5 | `email` column nullable in `users` table | `lib/db/schema.ts` | Silent failures in email/Stripe flows |
| H6 | Push notifications not configured | `app.json`, mobile | Reminders screen exists but push delivery is broken |
| H7 | Terms of Service not on web app | Web app | Required for App Store compliance |
| H8 | `X-Powered-By: Express` exposed | `api-server/src/app.ts` | Server fingerprinting |

### 🟢 MEDIUM PRIORITY (5 issues)

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| M1 | No global API rate limit | `api-server` | DDoS / abuse on unprotected endpoints |
| M2 | No content moderation on community posts | Community | Inappropriate content appears live immediately |
| M3 | No per-user OpenAI token tracking | `ovia.ts` | Cannot monitor AI cost per user for billing analytics |
| M4 | `supportsTablet: false` — iPad excluded | `app.json` | Limited audience, but may be intentional |
| M5 | Community posts have no pagination | `community.tsx` | Performance degrades as data grows |

---

## SECTION 11 — RECOMMENDED FIX ORDER

Phase 1 — Store submission blockers (fix first, in this order):
1. `app.json`: add `android.package`, `android.versionCode`, `ios.buildNumber`
2. Create Privacy Policy page (web) + link in both apps
3. Confirm/enable RLS on all 5 Supabase tables
4. Add auth to `/api/email/digest/send-now` + rate limit
5. Add auth middleware (or remove userId from body, require it from JWT) on stripe endpoints
6. Verify Stripe is in live mode for production
7. Either set `BRAVE_SEARCH_API_KEY` or remove "Web search enabled" badge from UI
8. Enforce Ovia free tier limit server-side OR remove the "5 msg/day" claim from UI
9. Add `helmet` + restrict CORS to `raimzeal.com` in production
10. Confirm SMTP configuration is complete and test email delivery

Phase 2 — Security hardening:
11. Verify passwords are bcrypt-hashed
12. Add `ios.buildNumber` and test TestFlight upload
13. Configure push notifications (Expo push service)
14. Add web Terms of Service page

Phase 3 — Quality & compliance:
15. Add global rate limiter
16. Add community content moderation
17. Add per-user AI token tracking
18. Verify all icon/splash assets meet size requirements

---

*This report covers Phase 1 of the audit as requested. Phases 2–9 (page-by-page testing, detailed API testing, security pen-testing, Stripe end-to-end testing) are ready to begin on your instruction.*
