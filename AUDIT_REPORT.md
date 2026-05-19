# RAIMZEAL — Phase 1 Audit Report
**Generated:** May 19, 2026  
**Auditor:** Automated codebase analysis + live endpoint verification  
**Scope:** Web app, Mobile app, API server, Database, Integrations  
**Status:** OBSERVATION ONLY — no code changes made during this audit

---

## SEVERITY LEGEND
- 🔴 **BLOCKER** — Must fix before App Store submission. Security risk or broken core flow.
- 🟠 **HIGH** — Significant issue affecting security, reliability, or store compliance.
- 🟡 **MEDIUM** — Functional gap or polish issue. Should fix before v1.0 release.
- 🔵 **LOW** — Technical debt or minor issue. Can fix post-launch.

---

## SECTION 1: ALL PAGES & ROUTES

### Web App (`artifacts/raimzeal`) — Router: `wouter`

| Route | File | Notes |
|-------|------|-------|
| `/` | `src/pages/Home.tsx` | Main dashboard |
| `/workouts` | `src/pages/Workouts.tsx` | Workout library |
| `/workout/:id` | `src/pages/WorkoutDetail.tsx` | Workout detail |
| `/workout/:id/play` | `src/pages/WorkoutPlayer.tsx` | Active session |
| `/exercises` | `src/pages/Exercises.tsx` | Exercise database |
| `/exercise/:name` | `src/pages/ExerciseDetail.tsx` | Exercise detail |
| `/tracking` | `src/pages/Tracking.tsx` | Progress/PRs |
| `/calendar` | `src/pages/Calendar.tsx` | Scheduling |
| `/nutrition` | `src/pages/Nutrition.tsx` | Meal/calorie logging |
| `/programs` | `src/pages/Programs.tsx` | Training programs |
| `/coach` | `src/pages/Coach.tsx` | Ovia AI chat |
| `/community` | `src/pages/Community.tsx` | Social feed |
| `/settings` | `src/pages/Settings.tsx` | Profile + account |
| `/membership` | `src/pages/Membership.tsx` | Subscription plans |
| `/privacy` | `src/pages/Privacy.tsx` | Privacy Policy — 200 OK ✅ |
| `/terms` | `src/pages/TermsOfService.tsx` | Terms of Service — 200 OK ✅ |
| `*` | `src/pages/not-found.tsx` | 404 page |
| (conditional) | `src/pages/Login.tsx` | Auth gate |
| (conditional) | `src/pages/Onboarding.tsx` | Onboarding flow |

### Mobile App (`artifacts/raimzeal-mobile`) — Router: `expo-router`

| Route | File | Notes |
|-------|------|-------|
| `/(tabs)/index` | `app/(tabs)/index.tsx` | Home / activity rings |
| `/(tabs)/workouts` | `app/(tabs)/workouts.tsx` | Workout browser |
| `/(tabs)/ovia` | `app/(tabs)/ovia.tsx` | Ovia AI chat |
| `/(tabs)/nutrition` | `app/(tabs)/nutrition.tsx` | Calorie + macro tracker |
| `/(tabs)/progress` | `app/(tabs)/progress.tsx` | Charts + PRs |
| `/(tabs)/community` | `app/(tabs)/community.tsx` | Social feed |
| `/(tabs)/profile` | `app/(tabs)/profile.tsx` | Profile + settings |
| `/activity-tracker` | `app/activity-tracker.tsx` | Step counter |
| `/workout-player` | `app/workout-player.tsx` | Full-screen workout |
| `/edit-profile` | `app/edit-profile.tsx` | Edit stats/info |
| `/body-measurements` | `app/body-measurements.tsx` | Measurement logging |
| `/progress-photos` | `app/progress-photos.tsx` | Before/after gallery |
| `/reminders` | `app/reminders.tsx` | Notification settings |
| `/membership` | `app/membership.tsx` | Subscription + billing |
| `/privacy` | `app/privacy.tsx` | Privacy Policy ✅ |
| `/terms` | `app/terms.tsx` | Terms of Service |
| `/auth/welcome` | `app/auth/welcome.tsx` | Unauthenticated splash |
| `/auth/login` | `app/auth/login.tsx` | Sign in |
| `/auth/signup` | `app/auth/signup.tsx` | Register |
| `/auth/phone` | `app/auth/phone.tsx` | Phone entry |
| `/auth/verify-phone` | `app/auth/verify-phone.tsx` | OTP verification |
| `/auth/verify-email` | `app/auth/verify-email.tsx` | Email verification |
| `+not-found` | `app/+not-found.tsx` | 404 fallback |

---

## SECTION 2: ALL API ENDPOINTS

Base: `/api` — Express server on port 8080

| Method | Path | Auth Required | Rate Limit | Status |
|--------|------|--------------|-----------|--------|
| GET | `/api/healthz` | None | None | ✅ Public health check |
| POST | `/api/ovia/chat` | ❌ **None** | IP: 30/15min + 100/day | 🔴 No JWT validation |
| POST | `/api/email/send` | ❌ **None** | 10/hr per IP | 🔴 Anyone can send emails to any address |
| POST | `/api/email/verify` | ❌ **None** | Rate limited | 🟠 No user binding |
| POST | `/api/email/digest/subscribe` | ❌ None | Rate limited | 🟡 Acceptable for subscribe |
| POST | `/api/email/digest/unsubscribe` | ❌ None | None | 🟡 Acceptable |
| POST | `/api/email/digest/send-now` | ✅ `x-internal-secret` | 3/hr | ✅ Protected |
| GET | `/api/stripe/plans` | None | None | ✅ Public |
| GET | `/api/stripe/subscription` | ❌ `(req as any).userId` — **never set** | None | 🔴 Always returns `free` |
| POST | `/api/stripe/checkout` | ❌ `userId` from req.body | None | 🔴 Any userId accepted from body |
| POST | `/api/stripe/portal` | ❌ `customerId` from req.body | None | 🔴 Any customerId accepted |
| POST | `/api/stripe/webhook` | ✅ Stripe signature | None | ✅ Secure |

---

## SECTION 3: SUPABASE DATABASE

### Tables

| Table | Columns | RLS Status |
|-------|---------|-----------|
| `profiles` | id, name, age, height, weight, fitness_level, goals[], units, updated_at | ✅ Migration 005 (pending run) |
| `workout_logs` | id, user_id, workout_id, workout_name, date, duration, calories_burned, exercises (JSONB) | ✅ Migration 005 (pending run) |
| `meal_logs` | id, user_id, date, name, calories, protein, carbs, fat, meal_type, amount_grams | ✅ Migration 005 (pending run) |
| `body_measurements` | id, user_id, date, weight, chest, waist, hips, arms, thighs | ✅ Migration 005 (pending run) |
| `water_intake` | user_id, date, glasses | ✅ Migration 005 (pending run) |
| `ovia_messages` | id, user_id, role, content, timestamp | ✅ Migration 004 |
| `community_posts` | id, user_id, user_name, content, post_type, created_at | 🔴 **NO RLS** |
| `community_comments` | id, post_id, user_id, user_name, content, created_at | 🔴 **NO RLS** |
| `community_likes` | id, post_id, user_id, created_at | 🟠 Unique constraint only — no RLS |
| `programs` | id, title, description, level, duration_weeks, goals[], schedule (JSONB), is_active, created_at | ❓ Unknown — no migration found |

### PostgreSQL (Drizzle ORM — `lib/db`)

| Table | Columns |
|-------|---------|
| `users` | id, username, password, stripe_customer_id, stripe_subscription_id, stripe_price_id, membership_tier |
| `digest_subscribers` | email, user_name, is_active, subscribed_at |

### RLS Policy Detail (Migration 005 — must still be run manually)

| Table | Policies |
|-------|---------|
| `profiles` | select/insert/update/delete own — `auth.uid() = id` |
| `workout_logs` | select/insert/update/delete own — `auth.uid() = user_id` |
| `meal_logs` | select/insert/update/delete own — `auth.uid() = user_id` |
| `body_measurements` | select/insert/update/delete own — `auth.uid() = user_id` |
| `water_intake` | select/insert/update/delete own — `auth.uid() = user_id` |
| `ovia_messages` | select/insert/update own — `auth.uid() = user_id` |
| `community_posts` | 🔴 None defined anywhere |
| `community_comments` | 🔴 None defined anywhere |
| `community_likes` | 🔴 None defined anywhere |

---

## SECTION 4: THIRD-PARTY INTEGRATIONS

| Service | Purpose | Config | Status |
|---------|---------|--------|--------|
| Supabase | Auth + user DB | `EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configured |
| Stripe | Payments | Replit Connector managed | ✅ Configured |
| OpenAI | Ovia AI (gpt-4.1) | `AI_INTEGRATIONS_OPENAI_API_KEY` + `AI_INTEGRATIONS_OPENAI_BASE_URL` | ✅ Configured — 🔴 model name issue |
| Brave Search | AI web search | `BRAVE_SEARCH_API_KEY` | 🟠 Key not confirmed in Secrets |
| Nodemailer/SMTP | Email | `SMTP_HOST/PORT/USER/PASS/FROM` | 🟠 4/5 secrets unset |
| Expo Notifications | Push alerts | Plugin in app.json | 🟡 Local only — no server push token |
| Expo Camera | Barcode scanning | `BarcodeScannerModal.tsx` | ✅ Present |
| Expo Location | Activity tracker | Permission declared | ✅ Present |
| Drizzle ORM | Postgres ORM | `lib/db` | ✅ Configured |
| RevenueCat | In-app purchases | — | ❌ Not integrated |
| Sentry | Error tracking | — | ❌ Not integrated |
| Analytics | User telemetry | — | ❌ Not integrated |

---

## SECTION 5: ENVIRONMENT VARIABLES

### API Server

| Variable | In Secrets | Required For |
|----------|-----------|-------------|
| `DATABASE_URL` | ✅ Replit managed | Postgres connection |
| `REPLIT_CONNECTORS_HOSTNAME` | ✅ Replit managed | Stripe + DB connectors |
| `REPL_IDENTITY` | ✅ Replit managed | Service auth |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ✅ Replit integration | Ovia AI |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ✅ Replit integration | Ovia AI |
| `BRAVE_SEARCH_API_KEY` | ❌ **Not confirmed** | Ovia web search |
| `SMTP_HOST` | ❌ **Not set** | All emails |
| `SMTP_PORT` | ❌ **Not set** | All emails |
| `SMTP_USER` | ❌ **Not set** | All emails |
| `SMTP_PASS` | ✅ Set | All emails |
| `SMTP_FROM` | ❌ **Not set** | All emails |
| `INTERNAL_API_SECRET` | ❌ **Not confirmed** | send-now endpoint |

### Mobile App

| Variable | Set | Notes |
|----------|-----|-------|
| `EXPO_PUBLIC_SUPABASE_URL` | ✅ | In Replit Secrets |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | ✅ | In Replit Secrets |
| `EXPO_PUBLIC_API_BASE` | Optional | Falls back to domain detection |
| `EXPO_PUBLIC_DOMAIN` | Injected at build | Via workflow command |

---

## SECTION 6: FEATURE STATUS

### ✅ Complete & Working
- Supabase Auth (email + phone OTP)
- Onboarding flow
- Workout library, detail, player
- Nutrition / calorie + macro tracking
- Body measurements logging
- Progress photos (local device storage)
- Activity tracker (step counter + GPS)
- Progress charts (web + mobile)
- Ovia AI chat with streaming
- Privacy Policy (web + mobile) — live at raimzeal.com/privacy
- Terms of Service (web + mobile)
- Membership / upgrade page
- Stripe Checkout (web redirect flow)
- Stripe Customer Portal
- Security headers (helmet — HSTS, X-Content-Type, X-Frame, Referrer)
- CORS restriction to raimzeal.com in production
- Rate limiting (Ovia + email endpoints)
- Push notification scheduling (local notifications)
- Barcode scanner (food logging)
- Dark theme throughout
- Segmented macro chart (Calories/Protein/Carbs/Fat) — task #95
- Sticky chart summary pill — task #97
- Date labels on chart bars — task #96
- lucide-react-native import fixed (was Metro build blocker)

### 🔴 Broken / Non-Functional
- **Stripe subscription tier** — `GET /api/stripe/subscription` always returns `free` (no auth middleware sets userId)
- **Community data** — both web and mobile show hardcoded mock/demo posts, not live Supabase data
- **Email system** — SMTP missing 4/5 env vars; all sends silently fail including OTP verification
- **Ovia tier enforcement** — paid tiers (Athlete/Elite) hit same 100/day IP limit as free users
- **Cascade delete** — deleting account leaves all health data orphaned in Supabase

### 🟡 Incomplete / In Progress
- Community RLS policies (tables exist, no security)
- Per-user Ovia plan rate limiting
- Universal Links / App Links for password reset deep linking
- Analytics integration
- Error tracking (Sentry)
- Apple Health / Google Fit integration
- App Store screenshot preparation
- Support page/URL

---

## SECTION 7: SECURITY HEADERS (Live Verification)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains  ✅
X-Content-Type-Options: nosniff                                  ✅
X-Frame-Options: SAMEORIGIN                                      ✅
Referrer-Policy: no-referrer                                     ✅
X-Powered-By: Express                                            ✅ Removed by helmet
CORS — raimzeal.com origin                                       ✅ Allowed
CORS — evil.com origin (production mode)                         ✅ Blocked
send-now: no header → 401                                        ✅
send-now: wrong header → 401                                     ✅
Ovia daily rate limit: 100/day (headers confirmed)               ✅
npm audit: no known vulnerabilities                              ✅
API typechecks: clean                                            ✅
Web typechecks: clean                                            ✅
Mobile typechecks: clean                                         ✅
```

---

## SECTION 8: FULL ISSUE REGISTER

### 🔴 BLOCKERS (7)

**B1 — No authentication on Express API routes**
`/api/ovia/chat`, `/api/email/send`, `/api/email/verify` have zero authentication. Any anonymous internet user can call the Ovia AI endpoint, consuming OpenAI API credits and bypassing plan restrictions entirely. No JWT validation middleware exists in the Express app.
*Files:* `api-server/src/app.ts`, `routes/ovia.ts`, `routes/email.ts`

**B2 — Stripe subscription check is broken for all users**
`GET /api/stripe/subscription` reads `(req as any).userId` — a property that is never set by any middleware anywhere in the codebase. The fallback on line 98 returns `{ tier: "free", subscription: null }` for everyone. Premium subscribers cannot have their tier recognised by the API.
*File:* `api-server/src/routes/stripe.ts:97-98`

**B3 — Stripe checkout and portal accept untrusted body parameters**
`POST /api/stripe/checkout` takes `userId` from the request body — any caller can create a Stripe session linked to any user ID they choose. `POST /api/stripe/portal` takes `customerId` from the body — anyone who knows a Stripe customer ID gains full billing portal access for that customer.
*File:* `api-server/src/routes/stripe.ts:120,173`

**B4 — Community tables have no Row Level Security**
No migration defines RLS on `community_posts`, `community_comments`, or `community_likes`. Any authenticated Supabase user can read, write, update, or delete any other user's community content. Additionally, both web and mobile show hardcoded demo posts — the community feature is not connected to live Supabase data.
*Files:* All `supabase/migrations/*.sql` — no community RLS found in any file

**B5 — Ovia AI sends user PII to OpenAI in every message**
`userContext` in `ovia.tsx:70-71` includes `name: user?.name` and `email: user?.email`. This personally identifiable information is transmitted to OpenAI's API with every single chat message. Apple App Store requires explicit disclosure when health + PII data is sent to third parties. Current Privacy Policy does not specifically state that name and email are sent to OpenAI.
*File:* `raimzeal-mobile/app/(tabs)/ovia.tsx:70-71`

**B6 — `gpt-4.1` is not a valid OpenAI model identifier**
The Ovia route requests `model: "gpt-4.1"` at lines 241 and 282. OpenAI's published models are `gpt-4`, `gpt-4o`, `gpt-4-turbo`, `gpt-4o-mini`, etc. This works only because the Replit AI integration proxy remaps it internally. Switching to a direct OpenAI key, or any change in the proxy, will cause all Ovia requests to fail with a model-not-found error.
*File:* `api-server/src/routes/ovia.ts:241,282`

**B7 — No cascade delete — violates GDPR and App Store health data requirements**
Deleting a Supabase Auth user leaves all rows permanently in `profiles`, `workout_logs`, `meal_logs`, `body_measurements`, `water_intake`, and `ovia_messages`. Apple requires health apps to provide complete data deletion. GDPR/CCPA require data erasure on account deletion. No trigger, function, or cascade is defined in any migration.
*Files:* All Supabase migrations — no cascade or deletion trigger defined

---

### 🟠 HIGH PRIORITY (8)

**H1 — Email system entirely non-functional in production**
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_FROM` are all unset. `nodemailer` returns `null` when host is missing. Every email — welcome messages, OTP verification codes, weekly digests — silently fails. New users cannot verify their email address.
*Required action:* Set 4 secrets in Replit Secrets panel.

**H2 — BRAVE_SEARCH_API_KEY not confirmed in production**
`ovia.ts:330` calls `process.env["BRAVE_SEARCH_API_KEY"]` at runtime for the web search tool. This key is not visible in the Replit Secrets panel. If absent, Ovia's web search tool silently fails or throws, disrupting the AI response.
*Required action:* Add key to Replit Secrets.

**H3 — Ovia rate limiting does not differentiate by subscription tier**
`oviaRateLimit` (30/15min) and `oviaDailyRateLimit` (100/day) are IP-based and apply identically to all users regardless of plan. The product advertises "Unlimited Ovia AI" for Athlete/Elite — this is not implemented. A shared IP (office, school, family) can exhaust the limit for all users behind that IP regardless of their subscription.
*File:* `api-server/src/lib/rateLimiter.ts`

**H4 — No Universal Links (iOS) or App Links (Android) configured**
`app.json` defines `scheme: "raimzeal-mobile"` for custom URL scheme deep links, but `ios.associatedDomains` and `android.intentFilters` are not configured. Supabase password reset emails link to `https://raimzeal.com/...` which opens in the browser, not the app. Users cannot complete password reset inside the mobile app.

**H5 — `storage.ts` and `routes.ts` are unused scaffolding placeholders**
`api-server/src/storage.ts` contains only the bootstrap comment "modify the interface with any CRUD methods you might need" with an in-memory `MemStorage` class that is never used. `routes.ts` contains only "put application routes here". These files are dead weight and indicate incomplete initial setup.

**H6 — No error tracking configured**
Zero error capture in production. Server-side Express crashes, Ovia API failures, Stripe webhook errors, and mobile crashes all vanish silently. No Sentry, Datadog, Bugsnag, or equivalent is integrated. This makes debugging production issues impossible.

**H7 — No analytics configured**
Zero user telemetry. No PostHog, Mixpanel, Firebase Analytics, Amplitude, or equivalent. No way to measure retention, conversion funnels, feature adoption, or crash rates after launch. Required for any data-driven iteration.

**H8 — Web JS bundle is 1,060 KB — no code splitting**
Vite build produces a single 1,060 KB JS chunk (313 KB gzipped), exceeding Vite's 500 KB warning threshold. No dynamic imports or `manualChunks` splitting implemented. This directly impacts Time to Interactive and Lighthouse scores. Target: sub-500 KB initial chunk.
*File:* `artifacts/raimzeal/vite.config.ts`

---

### 🟡 MEDIUM (7)

**M1 — Community feature shows fake data**
Mobile `community.tsx` renders from a hardcoded `DEMO_POSTS` array. Web `store.ts` uses a hardcoded `communityPosts` array. The Supabase `community_posts` table and `db.ts` helpers exist but neither client reads from them. Users see the same static posts regardless of what is actually in the database.

**M2 — `/api/email/send` is a public email-sending API**
No authentication required. Any caller can POST `{ to: "victim@company.com", userName: "Boss", type: "weekly" }` and trigger RAIMZEAL-branded emails to arbitrary addresses. Rate limit of 10/hr per IP provides minimal protection. This endpoint needs at minimum email domain validation or authentication.

**M3 — Source maps shipped in production**
The API server build includes `dist/index.mjs.map` (6.3 MB). These expose the complete original source code to anyone who downloads the production bundle. Source maps should be stripped from the production artifact or served only to authenticated error tracking services.

**M4 — Missing database indexes on high-frequency columns**
`workout_logs.user_id`, `meal_logs.user_id`, `body_measurements.user_id`, `water_intake.user_id` are not indexed in any migration. Every query filtering by `user_id` (which is every user-facing query) performs a full table scan. Will degrade at scale.

**M5 — Hardcoded personal Linktree URL in email templates**
`email.ts:371,372,400,463` contains `linktr.ee/Raimzy` as a hardcoded social link in outgoing email HTML. Should be replaced with an official brand URL (`raimzeal.com` or a proper social profile).

**M6 — App Store assets not prepared**
No 1024×1024 App Store icon verified in assets, no screenshots prepared for required device sizes (iOS: 6.7", 6.5", 5.5", 12.9" iPad; Android: phone + tablet), no App Store Connect listing written, no Google Play store listing written. These take significant time and are required for submission.

**M7 — `INTERNAL_API_SECRET` not confirmed in production secrets**
The `send-now` endpoint checks `x-internal-secret` header against `process.env["INTERNAL_API_SECRET"]`. If this env var is unset, the check becomes `header !== undefined`, which may behave unexpectedly. Needs confirmation it is set in production.

---

### 🔵 LOW (4)

**L1 — `as any` type casting in several files**
`(req as any).userId` in Stripe routes, audio client in OpenAI integration lib. Masks potential runtime errors and defeats TypeScript's value.

**L2 — `console.log` in build scripts and servers**
`scripts/build.js`, `seed-products.ts`, `server.mjs`, and `serve.js` use `console.log` for status output. Acceptable in CLI scripts but not ideal for server processes.

**L3 — Stripe API version is a non-standard beta string**
`stripeClient.ts` uses `"2025-08-27.basil" as any`. This requires the `as any` cast because it is not in the TypeScript SDK's valid version enum, indicating it is a private beta version.

**L4 — No `/support` page or support URL**
App Store Connect requires a working support URL. No `/support` route exists. A simple contact page pointing to `support@raimzeal.com` would satisfy this requirement.

---

## SECTION 9: MOBILE APP CONFIG AUDIT

| Item | Status |
|------|--------|
| `android.package` | ✅ `com.raimzeal.mobile` |
| `ios.bundleIdentifier` | ✅ `com.raimzeal.mobile` |
| `android.versionCode` | ✅ `1` |
| `ios.buildNumber` | ✅ `"1"` |
| `version` | ✅ `1.0.0` |
| `privacyPolicyUrl` | ✅ `https://www.raimzeal.com/privacy` |
| New Architecture | ✅ Enabled |
| Orientation lock | ✅ Portrait |
| Dark theme lock | ✅ `userInterfaceStyle: dark` |
| App icon | ✅ Configured |
| Splash screen | ✅ Configured |
| `expo-notifications` plugin | ✅ Configured with icon + color |
| iOS permissions strings | ✅ All 5 declared in infoPlist |
| Android permissions | ✅ All declared |
| Deep link scheme | ✅ `raimzeal-mobile` |
| iOS Universal Links (`associatedDomains`) | 🟠 Not configured |
| Android App Links (`intentFilters`) | 🟠 Not configured |
| 1024×1024 App Store icon | ❓ File not verified |
| App Store screenshots | 🟠 Not prepared |
| Apple Developer account | ❓ Cannot verify from code |
| Google Play Console account | ❓ Cannot verify from code |
| TypeScript typecheck | ✅ Clean |
| Metro build (lucide import) | ✅ Fixed |

---

## SECTION 10: MASTER ISSUE TABLE

| # | Severity | Issue | Area |
|---|----------|-------|------|
| B1 | 🔴 | No auth on Express API routes (Ovia, Email) | Security |
| B2 | 🔴 | Stripe subscription always returns `free` | Payments |
| B3 | 🔴 | Stripe checkout/portal accept untrusted body params | Security |
| B4 | 🔴 | Community tables have no RLS | Database |
| B5 | 🔴 | Ovia sends PII (name+email) to OpenAI | Privacy |
| B6 | 🔴 | `gpt-4.1` is not a valid OpenAI model name | AI |
| B7 | 🔴 | No cascade delete — GDPR/App Store violation | Database |
| H1 | 🟠 | Email system broken — 4 SMTP secrets unset | Ops |
| H2 | 🟠 | BRAVE_SEARCH_API_KEY unconfirmed in secrets | Ops |
| H3 | 🟠 | Ovia tier limits not enforced (paid = free) | AI |
| H4 | 🟠 | No Universal Links / App Links for password reset | Mobile |
| H5 | 🟠 | `storage.ts` and `routes.ts` are dead scaffolding | API |
| H6 | 🟠 | No error tracking (Sentry) | Ops |
| H7 | 🟠 | No analytics | Ops |
| H8 | 🟠 | JS bundle 1,060 KB — no code splitting | Performance |
| M1 | 🟡 | Community shows hardcoded mock data | Feature |
| M2 | 🟡 | `/api/email/send` is public — email spam risk | Security |
| M3 | 🟡 | Source maps in production build | Security |
| M4 | 🟡 | Missing DB indexes on user_id columns | Database |
| M5 | 🟡 | Hardcoded personal Linktree URL in emails | Content |
| M6 | 🟡 | App Store assets not prepared | Store |
| M7 | 🟡 | `INTERNAL_API_SECRET` not confirmed in production | Ops |
| L1 | 🔵 | `as any` type casting | Code quality |
| L2 | 🔵 | `console.log` in build scripts | Code quality |
| L3 | 🔵 | Non-standard Stripe API version string | Code quality |
| L4 | 🔵 | No `/support` route or support URL | Store |

---

## SUMMARY

| Severity | Count |
|----------|-------|
| 🔴 Blockers | **7** |
| 🟠 High | **8** |
| 🟡 Medium | **7** |
| 🔵 Low | **4** |
| **Total** | **26** |

**Recommendation:** Do not submit to either store until all 7 blockers and H1–H4 are resolved.

Critical path to submission:
1. Fix Stripe auth (B2, B3) — premium users cannot use what they paid for
2. Add auth to Ovia/email endpoints (B1) — free OpenAI usage by anonymous callers
3. Write + apply community RLS (B4) — anyone can delete anyone's posts
4. Fix cascade delete (B7) — Apple will reject health apps without this
5. Remove PII from Ovia context (B5) — App Store privacy disclosure issue
6. Verify/fix model name (B6) — production AI could break on proxy change
7. Set 4 SMTP secrets (H1) — email verification does not work at all

**Phase 1 complete. Awaiting your go-ahead before beginning Phase 2 fixes.**
