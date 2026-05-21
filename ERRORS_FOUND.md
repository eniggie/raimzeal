# ERRORS_FOUND.md — Phase 1 Full Audit Report
> Generated: May 21, 2026 | Scanned: web app, mobile app, API server

---

## SCAN STATUS

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

---

## ISSUES FOUND

### 🔴 SECURITY — 3 items

**S-1 · Settings.tsx HTML report string — `target="_blank"` with no `rel` at all**
- File: `artifacts/raimzeal/src/pages/Settings.tsx`, line 315
- Code: `<a href="https://www.econteur.com" target="_blank">ECONTEUR LLC</a>`
- Missing `rel="noopener noreferrer"` — exposes `window.opener` to the external site
- Fix: add `rel="noopener noreferrer"` to that anchor

**S-2 · Settings.tsx HTML report string — `rel="noopener"` missing `noreferrer`**
- File: `artifacts/raimzeal/src/pages/Settings.tsx`, lines 304 and 306
- Code: `rel="noopener"` (missing the `noreferrer` part)
- Without `noreferrer`, the `Referer` header leaks the internal page URL to Stripe/Linktree
- Fix: change both to `rel="noopener noreferrer"`

**S-3 · Settings.tsx HTML report string — second econteur.com link missing `target` and `rel`**
- File: `artifacts/raimzeal/src/pages/Settings.tsx`, line 315
- Code: `<a href="https://www.econteur.com">www.econteur.com</a>` — opens in same tab, no rel
- Same sentence already has one link to econteur.com that opens in `_blank`; this second one is inconsistent and unnecessary
- Fix: remove the duplicate link; just show `www.econteur.com` as plain text

---

### 🟡 COPY / WORDING — 4 items

**C-1 · Community.tsx — factually wrong RAIMZY description**
- File: `artifacts/raimzeal/src/pages/Community.tsx`, line 151
- Current: `"RAIMZY is one of RAIMZEAL's biggest supporters. Access books, music, courses, and coaching."`
- Problem: RAIMZY is the **creator** of RAIMZEAL, not a "supporter" — this is factually wrong and undersells him
- Fix: `"RAIMZY — Dr. Ephraim Oviawe — is the mind behind RAIMZEAL. Author, music artist, strategist, and coach."`

**C-2 · Community.tsx — inconsistent resources line**
- File: `artifacts/raimzeal/src/pages/Community.tsx`, line 347
- Current: `"Books, courses and coaching at linktr.ee/Raimzy"`
- Problem: Missing "Music", uses comma instead of the `·` separator used everywhere else, no "Resources" label
- Fix: `"Books · Music · Courses · Coaching at linktr.ee/Raimzy"` (matches all other 6 donation sections)

**C-3 · Billing.tsx — page subtitle missing period**
- File: `artifacts/raimzeal/src/pages/Billing.tsx`, line 27
- Current: `"RAIMZEAL is free forever"`
- Problem: No period; every other instance across the app ends with a period
- Fix: `"RAIMZEAL is free forever."`

**C-4 · Mobile Ovia — AI responses display raw asterisks**
- File: `artifacts/raimzeal-mobile/app/(tabs)/ovia.tsx`
- Problem: The web Coach page has a `stripMarkdown()` function that removes `**bold**` and `*italic*` asterisks before rendering. The mobile Ovia screen has no equivalent — so if the AI returns markdown formatting, users see raw `**word**` or `*word*` characters in the chat.
- Fix: Add the same `stripMarkdown()` sanitizer to the mobile message rendering pipeline

---

### 🔵 CODE QUALITY / MAINTENANCE — 2 items

**Q-1 · STRIPE_DONATION_URL duplicated across 7 files**
- Files: `Home.tsx`, `Community.tsx`, `Membership.tsx`, `Settings.tsx`, `Billing.tsx` (web) + `membership.tsx`, `community.tsx` (mobile)
- Same string `'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00'` copy-pasted 7 times
- Same for `RAIMZY_LINKTREE = 'https://linktr.ee/Raimzy'` (3 web files) and the mobile donation URL
- Risk: If the URL ever changes, it must be updated in 7 places — easy to miss one
- Fix: Create `artifacts/raimzeal/src/lib/constants.ts` and `artifacts/raimzeal-mobile/lib/constants.ts` with these values; import everywhere

**Q-2 · BRAVE_SEARCH_API_KEY used but not documented in validateEnv.ts**
- File: `artifacts/api-server/src/routes/ovia.ts`, line 446
- The key is read from env but not listed in the startup validator
- Has a graceful fallback ("Web search is not configured"), so it does NOT crash
- Risk: Someone deploying won't know to set it; web search silently disabled with no startup warning
- Fix: Add to `validateEnv.ts` as an optional key with a startup `WARN` log when absent

---

## WHAT IS NOT BROKEN

- ✅ All TypeScript — zero errors
- ✅ All 4 workflows running cleanly
- ✅ All API health checks passing
- ✅ All 25+ page routes load (web), all 37 screens registered (mobile)
- ✅ All external links valid (Stripe, Linktree, ECONTEUR, UnitedMasters, Amazon, raimzy.com)
- ✅ All donation buttons functional with correct URL
- ✅ Auth flow (login, signup, OTP, OAuth, reset) — untouched per your rules
- ✅ Payment code — untouched per your rules
- ✅ Donation ACTIVE flag logic correct (evaluates true, "coming soon" fallbacks never shown)
- ✅ `rel="noopener noreferrer"` correct on ALL JSX links (issues only in the HTML string inside the PDF report section)
- ✅ No console.log in server route handlers (only in startup/fatal error paths — acceptable)
- ✅ No TODO / placeholder / lorem ipsum text anywhere
- ✅ No dead imports
- ✅ Mobile API base URL has proper env var injection via workflow

---

## SUMMARY

| Severity | Count | Items |
|---|---|---|
| 🔴 Security | 3 | S-1, S-2, S-3 |
| 🟡 Copy/Wording | 4 | C-1, C-2, C-3, C-4 |
| 🔵 Code Quality | 2 | Q-1, Q-2 |
| **Total** | **9** | |
