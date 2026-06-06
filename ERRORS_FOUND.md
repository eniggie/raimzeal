# ERRORS_FOUND.md — RAIMZEAL Audit Log

---

## Phase 2 Audit — June 6, 2026

> OSA MODE full audit: web app, mobile app, API server, security scanners, dependency check.

### SCAN STATUS

| Check | Result |
|---|---|
| TypeScript — Web (`@workspace/raimzeal`) | ✅ ZERO errors |
| TypeScript — API (`@workspace/api-server`) | ✅ ZERO errors |
| TypeScript — Mobile (`@workspace/raimzeal-mobile`) | ✅ ZERO errors |
| API Health (`/api/healthz`) | ✅ supabase:up · stripe:up · twilio:up |
| `pnpm audit` (npm dependency CVEs) | ✅ No known vulnerabilities |
| SAST scan (semgrep) | ⚠️ 7 HIGH, 12 MEDIUM — see triage below |
| HoundDog (privacy/dataflow) | ✅ No actionable findings |
| console.log in server code | ✅ None (only validateEnv.ts at startup — acceptable) |
| Dead navigation routes | ✅ All routes resolve |

### SAST TRIAGE

All HIGH semgrep findings investigated and resolved:

| Finding | Verdict |
|---|---|
| "Tainted SQL" in `ovia.ts` line 788, 847 | FALSE POSITIVE — LLM prompt construction with user's own `firstName`, not SQL |
| "Generic API key" in `.replit` (STRIPE_WEBHOOK_SECRET) | FALSE POSITIVE — Replit secrets management binding, not a hardcoded value |
| "Generic API key" on `@raimzeal_*` AsyncStorage keys | FALSE POSITIVE — AsyncStorage namespace strings, not credentials |
| "Insecure WebSocket" in ffmpeg-core.js | FALSE POSITIVE — vendored WASM binary in video artifact |
| MEDIUM HTML template literals (XSS) | FALSE POSITIVE — server-side email HTML with data from Supabase auth, not user input |

### ISSUES FOUND & FIXED IN THIS SESSION

**D-1 · Dead scaffold: `storage.ts` in api-server** — FIXED ✅
- File deleted: `artifacts/api-server/src/storage.ts`
- `MemStorage` class was original Replit scaffold boilerplate. Zero imports anywhere in the codebase. The project uses Supabase/Drizzle exclusively.

**D-2 · Dead empty directory: `middlewares/`** — FIXED ✅
- Directory deleted: `artifacts/api-server/src/middlewares/` (contained only `.gitkeep`)
- Actual middleware lives in `artifacts/api-server/src/middleware/` (singular)

**Q-1 (partial) · Mobile `index.tsx` hardcoded donation URL** — FIXED ✅
- File: `artifacts/raimzeal-mobile/app/(tabs)/index.tsx` line 33
- Removed local `const STRIPE_DONATION_URL = "..."` and replaced with `import { STRIPE_DONATION_URL } from "@/lib/constants"`
- Web app and mobile `constants.ts` are now the single source of truth; this was the last file using a hardcoded copy

### ITEMS VERIFIED ALREADY FIXED (from Phase 1 — May 21, 2026)

| Item | Status |
|---|---|
| S-1 · `_blank` link missing `rel` in Settings.tsx HTML | ✅ Fixed — all links now have `rel="noopener noreferrer"` |
| S-2 · `rel="noopener"` missing `noreferrer` in Settings.tsx | ✅ Fixed |
| S-3 · Duplicate bare econteur.com link in Settings.tsx | ✅ Fixed — shows as plain text |
| C-1 · Wrong RAIMZY "biggest supporter" description | ✅ Fixed — correct "mind behind RAIMZEAL" copy |
| C-2 · Missing Music in Community resources line | ✅ Fixed — "Books · Music · Courses · Coaching" |
| C-3 · Billing.tsx missing period | ✅ N/A — Billing.tsx no longer exists |
| C-4 · Mobile Ovia raw asterisks in AI responses | ✅ Fixed — `stripMarkdown()` present at line 43 |
| Q-1 · Donation URL duplicated across files (web) | ✅ Fixed — web uses `@/lib/constants` everywhere |
| Q-2 · BRAVE_SEARCH_API_KEY not in validateEnv.ts | ✅ Fixed — present at line 24 as optional |

---

## Phase 1 Audit — May 21, 2026

> Generated: May 21, 2026 | Scanned: web app, mobile app, API server

### SCAN STATUS

| Check | Result |
|---|---|
| TypeScript — Web (`@workspace/raimzeal`) | ✅ ZERO errors |
| TypeScript — API (`@workspace/api-server`) | ✅ ZERO errors |
| TypeScript — Mobile (`@workspace/raimzeal-mobile`) | ✅ ZERO errors |
| API Health (`/api/healthz`) | ✅ supabase:up · stripe:up · twilio:up |
| API Donation Health (`/api/stripe/donation-health`) | ✅ ok:true |
| Console errors at startup | ✅ None (STRIPE_WEBHOOK_SECRET warning is expected in dev) |
| Broken imports / missing files | ✅ None found |
| Dead navigation routes | ✅ All routes resolve |

### ISSUES FOUND

**S-1 · Settings.tsx HTML report string — `target="_blank"` with no `rel` at all**
- File: `artifacts/raimzeal/src/pages/Settings.tsx`, line 315
- Missing `rel="noopener noreferrer"` — exposes `window.opener` to the external site
- ✅ FIXED

**S-2 · Settings.tsx HTML report string — `rel="noopener"` missing `noreferrer`**
- File: `artifacts/raimzeal/src/pages/Settings.tsx`, lines 304 and 306
- Without `noreferrer`, the `Referer` header leaks the internal page URL to Stripe/Linktree
- ✅ FIXED

**S-3 · Settings.tsx HTML report string — second econteur.com link missing `target` and `rel`**
- File: `artifacts/raimzeal/src/pages/Settings.tsx`, line 315
- ✅ FIXED

**C-1 · Community.tsx — factually wrong RAIMZY description**
- Was: `"RAIMZY is one of RAIMZEAL's biggest supporters"`
- Fixed to: `"RAIMZY — Dr. Ephraim Oviawe — is the mind behind RAIMZEAL. Author, music artist, strategist, and coach."`
- ✅ FIXED

**C-2 · Community.tsx — inconsistent resources line**
- Was: `"Books, courses and coaching at linktr.ee/Raimzy"` (missing Music)
- Fixed to: `"Books · Music · Courses · Coaching at linktr.ee/Raimzy"`
- ✅ FIXED

**C-3 · Billing.tsx — page subtitle missing period**
- ✅ N/A — page removed in later refactor

**C-4 · Mobile Ovia — AI responses display raw asterisks**
- `stripMarkdown()` added to mobile ovia.tsx
- ✅ FIXED

**Q-1 · STRIPE_DONATION_URL duplicated across 7 files**
- Web: resolved by centralising to `@/lib/constants`
- Mobile `index.tsx` last straggler — fixed in Phase 2
- ✅ FULLY FIXED (Phase 2)

**Q-2 · BRAVE_SEARCH_API_KEY used but not documented in validateEnv.ts**
- Added as optional key with startup WARN log
- ✅ FIXED

---

## WHAT IS CLEAN (across both phases)

- ✅ All TypeScript — zero errors across all three packages
- ✅ All workflows running cleanly
- ✅ All API health checks passing
- ✅ Zero npm CVEs (`pnpm audit` clean)
- ✅ All SAST HIGH findings investigated — all confirmed false positives
- ✅ No console.log in server route handlers
- ✅ No TODO / placeholder / lorem ipsum text
- ✅ No dead imports
- ✅ `rel="noopener noreferrer"` correct on all external links
- ✅ Donation URL centralised to constants (single source of truth)
- ✅ Mobile Ovia stripMarkdown() prevents raw asterisks
- ✅ BRAVE_SEARCH_API_KEY documented in startup validator
- ✅ Dead scaffold code removed (storage.ts, middlewares/)
