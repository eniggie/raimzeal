# RAIMZEAL

Free, non-profit fitness, food therapy, and healthcare awareness platform operated by ECONTEUR LLC. Foundation tier is free forever. Optional paid tiers (Rise $9.99/mo, Reign $19.99/mo, Legacy $49.99/mo) unlock expanded Ovia AI access and full community participation.

---

## Founder — Dr. Ephraim Oviawe

**Full name:** DR. EPHRAIM OVIAWE PHD, MBA, MTS, CST, AMA, DMIPRO, CSM, PMP
**Title:** Doctor of Philosophy (PhD) — NOT a medical doctor, physician, or healthcare practitioner
**Artist/brand name:** RAIMZY (his musician name — RAIMZY = Dr. Ephraim Oviawe)
**Business:** ECONTEUR LLC (registered US business)
**Platform:** RAIMZEAL (created to promote his books, music, courses, and coaching, and to serve as a free health/fitness community platform)

### Bio
Dr. Ephraim Oviawe is an author, strategist, technologist, creative entrepreneur, music artist, educator, and business builder focused on helping people turn intelligence into practical systems. His work connects leadership, AI, marketing, project management, creativity, spirituality, and business execution. Through books, music, brands, and business platforms, Dr. Oviawe teaches creators, entrepreneurs, professionals, and organizations how to combine vision with structure, technology with human wisdom, and creativity with disciplined action.

### Education
- PhD in Leadership & Business Development — Higher-Place Christian University (HPCU)
- Master's in Theology — Higher-Place Christian University (HPCU)
- MBA in Information Technology — Southern New Hampshire University (SNHU)
- Bachelor of Science in Business Administration — Southern New Hampshire University (SNHU)
- Bachelor of Science in Leadership — Higher-Place Christian University (HPCU)
- Digital Marketing Diploma — Open University

### Certifications & Professional Development
- Certified Scrum Master (CSM) — Scrum Alliance
- Certified Surgical Technologist (CST)
- American Marketing Association (AMA)
- Digital Marketing Institute (DMIPRO)
- Project Management Professional (PMP) — PMI
- Google Digital Marketing & E-Commerce
- Google Project Management
- HubSpot SEO, Inbound Marketing, Email Marketing, and Social Media Strategy
- Google IT Support Professional Certificate
- AI Content Creation & Automation
- Adobe Creative Suite
- Web & Mobile App Development
- Data Analytics & Business Intelligence
- Cybersecurity Fundamentals & Cloud Computing
- Healthcare Compliance & Medical Coding and Billing

### Links & Presence
| Resource | URL |
|----------|-----|
| Official Website | https://www.raimzy.com |
| Linktree (all resources) | https://linktr.ee/Raimzy |
| Music | https://unitedmasters.com/raimzy |
| Amazon Author Page | https://www.amazon.com/author/dr.ephraim-oviawe |
| Business (ECONTEUR LLC) | https://www.econteur.com |
| Innovation | https://www.v3edge.com |
| Social | @raimzysocial |
| Donate to RAIMZEAL | https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00 |
| Email | support@raimzeal.com |

---

## RAIMZEAL Platform

**Mission:** Free fitness, food therapy, and healthcare awareness for everyone — forever.
**Legal entity:** ECONTEUR LLC (USA)
**Domain:** raimzeal.com
**Mobile:** Expo (iOS/Android)

### Key copy rules
- RAIMZY = Dr. Ephraim Oviawe (the person / artist name)
- RAIMZEAL = the platform/app
- "Non-profit organization · RAIMZEAL is free forever. We turned down ad deals and investor offers to keep it that way."
- Disclaimer (standard): "RAIMZEAL does not replace any doctor, dietitian, or licensed healthcare professional. We exist to complement their work — not take their place."
- Ovia AI should NOT be called "nutritionist" (protected title) — use "nutrition advisor" or "nutrition guide"
- Always attribute: "Created and powered by ECONTEUR LLC · www.econteur.com"

---

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Bug Detection & Validation

Four permanent checks are registered in the Checks panel (run them any time to catch bugs):

| Check | Command | What it catches |
|-------|---------|-----------------|
| `typecheck-api` | `pnpm --filter @workspace/api-server run typecheck` | Type errors in the API server |
| `typecheck-mobile` | `pnpm --filter @workspace/raimzeal-mobile run typecheck` | Type errors in the mobile app |
| `typecheck-web` | `pnpm --filter @workspace/raimzeal run typecheck` | Type errors in the web app |
| `healthcheck` | `curl -sf http://localhost:80/api/healthz` | API server is up and responding |

**After every significant change**, run all four checks before shipping.

### Bug Fix History (major sessions)

| Date | Area | Fix |
|------|------|-----|
| 2026-05 | All platforms | Removed all tier/paywall gates — every feature now free for all signed-in users |
| 2026-05 | API: community.ts | Inner Circle no longer 403s non-legacy users |
| 2026-05 | API: ovia.ts | Flattened tier-based AI quota → 100 msgs/day for everyone |
| 2026-05 | API: workoutLogs.ts | Removed Foundation 90-entry history cap (now 500 for all) |
| 2026-05 | Mobile: 15 screens | Removed gate screens: cycle-sync, PCOS, menopause, mindfulness, weekly-report, adaptive-workout, meal-plan, pregnancy-wellness, body-measurements, macro-goals, legacy, progress-photos, community (image upload + Inner Circle), profile (PDF export + digest toggle), nutrition (macro drilldown) |
| 2026-05 | Mobile: ovia.tsx | Added AI Tools section: Workout Plan, Meal Plan, Body Analysis cards |
| 2026-05 | expo-speech | Updated to 14.0.8 (SDK 54 compatible) |

### Known pitfalls to watch
- `CardCustomizationModal.tsx` is ~3400+ lines — read in sections, never rewrite in full
- API server crashes with `EADDRINUSE` if restarted while old process is alive — run `fuser -k 8080/tcp` to clear the port
- Never run `pnpm dev` at workspace root — always use `restart_workflow`
- `tier.ts` `getUserTier()` / `canAccess()` still exist for Stripe/subscription display logic — do NOT remove them; just never use them as content gates

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React + Vite (`artifacts/raimzeal`)
- Mobile: Expo React Native (`artifacts/raimzeal-mobile`)
- API: Express 5 (`artifacts/api-server`)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Primary color: #2E8B57 (green) — mobile always dark theme
- Stripe account name: **ECONTEUR LLC** (updated from "new business")
- Stripe Account ID: `acct_1TZ9dvEhqrHThI5N`
- Stripe donation URL: https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00

## Where things live

- `artifacts/raimzeal/src/pages/` — all web pages
- `artifacts/raimzeal-mobile/app/` — all mobile screens
- `artifacts/raimzeal-mobile/components/CardCustomizationModal.tsx` — progress card sharing modal (large, complex)
- `artifacts/api-server/src/routes/` — API routes
- `lib/db/src/schema.ts` — database schema (source of truth)
- `lib/api-spec/` — OpenAPI spec + codegen

## Subscription model

RAIMZEAL has 4 tiers (prices locked — do not change):
- **Foundation** — $0, free forever. Ovia: 15 msgs/day (gpt-4o-mini). Community: read + like only.
- **Rise** — $9.99/mo or $99/yr. Unlimited Ovia (gpt-4o). Full community. Full library.
- **Reign** — $19.99/mo or $199/yr. Everything in Rise + priority Ovia + AI meal plans + custom workouts + weekly digest.
- **Legacy** — $49.99/mo or $499/yr. Everything in Reign + adaptive programs + wearable (Coming Soon) + founder's circle.

Stripe price IDs are stored in env vars: `STRIPE_PRICE_RISE_MONTHLY`, `STRIPE_PRICE_RISE_YEARLY`, `STRIPE_PRICE_REIGN_MONTHLY`, `STRIPE_PRICE_REIGN_YEARLY`, `STRIPE_PRICE_LEGACY_MONTHLY`, `STRIPE_PRICE_LEGACY_YEARLY`. Set these in Replit Secrets before enabling checkout.

Tier logic lives in `artifacts/api-server/src/lib/tier.ts` — use `getUserTier(userId)` and `canAccess(userTier, requiredTier)` everywhere. Never scatter tier checks.

Core features (workouts, tracking, basic Ovia) remain free forever — Foundation is still free.

## User preferences

- Primary green: #2E8B57
- Mobile is always dark theme
- Use "RAIMZEAL" for the app, "RAIMZY" for the creator/artist
- Ovia AI = the in-app AI coach (powered by Claude/OpenAI via API server)
- Never call Ovia AI a "nutritionist" (legally protected title in many jurisdictions)
- Donation via Stripe; linktree + raimzy.com + unitedmasters for RAIMZY resources
- support@raimzeal.com is the single contact email (consolidates privacy@ and support@)
- ECONTEUR LLC is Dr. Oviawe's registered US business — always attribute correctly

## Gotchas

- CardCustomizationModal.tsx is ~3400+ lines — read in sections, never rewrite in full
- `showConfirmation(msg, variant, icon, retryFn, actionFn, actionLabel)` — 6 params; retryFn and actionFn are separate; both must be `() => void`, not strings
- Do not run `pnpm dev` at the workspace root — use `restart_workflow` instead
- Mobile always uses `colors.mutedForeground` from `useColors()` hook — never hardcode grey
- `holdDuration` in toast: 4500ms when retryFn OR actionFn is present

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
