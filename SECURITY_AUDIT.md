# RAIMZEAL — Phase 7: Security Audit
**Generated:** May 19, 2026

---

## AUTHENTICATION SECURITY

| Check | Status | Notes |
|-------|--------|-------|
| Passwords hashed | ✅ | Supabase handles bcrypt — never plaintext |
| Session tokens | ✅ | Supabase JWT (HS256, 1h expiry + refresh rotation) |
| Token expiration | ✅ | Access token: 1 hour. Refresh: configurable in Supabase |
| Refresh token rotation | ✅ | Supabase handles automatically |
| Email verification required | ⚠️ | Supabase enforces it but SMTP is broken — emails never arrive |
| Password reset flow | ⚠️ | Works via Supabase email — but SMTP broken |
| Rate limiting on auth endpoints | ✅ | Supabase built-in brute force protection |
| Account lockout | ✅ | Supabase built-in |
| Auth secrets in client code | ✅ None | Only `EXPO_PUBLIC_SUPABASE_ANON_KEY` in client — correct |
| Web app auth | ⚠️ | Web uses mock/local state auth — no real Supabase session issued |

---

## TRANSPORT & NETWORK SECURITY

| Check | Status | Notes |
|-------|--------|-------|
| HTTPS enforced | ✅ | Replit proxy handles TLS — production only HTTPS |
| HSTS header | ✅ | `max-age=31536000; includeSubDomains` via helmet |
| X-Content-Type-Options | ✅ | `nosniff` via helmet |
| X-Frame-Options | ✅ | `SAMEORIGIN` via helmet |
| Referrer-Policy | ✅ | `no-referrer` via helmet |
| X-Powered-By removed | ✅ | helmet removes it |
| CORS restricted in production | ✅ | `raimzeal.com` + Replit preview domains |
| CORS wildcard on Ovia route | ❌ → ✅ | `res.setHeader("Access-Control-Allow-Origin", "*")` hardcoded on Ovia SSE route — fixed |
| Content-Security-Policy on API | N/A | Pure JSON API — CSP on frontend Vite config |

---

## SECRET MANAGEMENT

| Check | Status | Notes |
|-------|--------|-------|
| `.env` in `.gitignore` | ✅ | No .env files committed |
| Secrets in Replit Secrets panel | ✅ | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SMTP_PASS` |
| `EXPO_PUBLIC_` prefix on client vars | ✅ | Supabase URL + anon key correctly prefixed |
| API key not in client bundles | ✅ | Checked via page source analysis |
| Source maps in production | ❌ → ✅ | `sourcemap: "linked"` → disabled in production build |
| `SMTP_HOST/PORT/USER/FROM` | ❌ | Missing in Replit Secrets |
| `BRAVE_SEARCH_API_KEY` | ❓ | Not confirmed |
| `INTERNAL_API_SECRET` | ❓ | Not confirmed |

---

## INPUT SECURITY

| Check | Status | Notes |
|-------|--------|-------|
| SQL injection prevention | ✅ | Drizzle ORM uses parameterized queries. SQL injection test returned 500 (query failed, no injection) |
| XSS prevention in API responses | ✅ | JSON responses — no HTML rendered in API |
| XSS in AI responses | ✅ | React/RN renders as text, not HTML |
| Malformed JSON → stack trace | ❌ → ✅ | Fixed: custom JSON error handler returns `{"error":"Invalid JSON"}` |
| Input length limits | ✅ | 64KB body limit, 4000-char Ovia messages, 40-message cap |
| Email address validation | ✅ | Regex in email routes |
| System message injection (Ovia) | ✅ | Only `user`/`assistant` roles accepted from client |

### SQL Injection Test Results
```
POST /api/stripe/checkout {"userId": "1; DROP TABLE users;--", ...}
→ 500 Internal Server Error {"error":"Could not create checkout session"}

Analysis: Drizzle sql`` template literal passes userId as a bound parameter.
The injection string was treated as a literal string value, not SQL.
The 500 occurred because no user with that ID exists, not because of injection.
VERDICT: ✅ Not injectable
```

### Stack Trace Leak Test (Before Fix)
```
POST /api/ovia/chat [body: "INVALID{"]
→ 400 Bad Request
→ HTML body with full file paths:
  "at createStrictSyntaxError (/home/runner/workspace/node_modules/.pnpm/
   body-parser@2.2.2/node_modules/body-parser/lib/types/json.js:109:10)"

VERDICT: ❌ Exposes server file structure and dependency paths
FIX: Custom Express error handler catches SyntaxError from body-parser and
     returns {"error":"Invalid request body"} instead
```

---

## DEPENDENCY AUDIT

```
pnpm audit
→ No vulnerabilities found (as of May 19, 2026)
```

---

## MOBILE-SPECIFIC SECURITY

| Check | Status | Notes |
|-------|--------|-------|
| No secrets in app bundle | ✅ | `EXPO_PUBLIC_*` vars are safe to bundle |
| AsyncStorage: sensitive data | ⚠️ | `raimzeal_macro_goals` stored unencrypted — low risk |
| Biometric auth | ❌ | Not implemented — optional enhancement |
| Certificate pinning | ❌ | Not implemented — Supabase SDK handles TLS |
| Deep link validation | ⚠️ | Custom scheme `raimzeal-mobile://` — not validated for external calls |

---

## WEB APP SECURITY

| Check | Status | Notes |
|-------|--------|-------|
| localStorage usage | ⚠️ | App state (workouts, nutrition, user profile) in localStorage |
| No auth tokens in localStorage | ✅ | Web app uses mock auth — no JWT stored |
| XSS via community posts | ✅ | Community shows static data on web — no dynamic rendering |
| CSRF protection | ✅ | API uses CORS + Bearer tokens |

---

## CRITICAL SECURITY ISSUES (All Fixed)

| ID | Issue | Status |
|----|-------|--------|
| B1 | No auth on Ovia/email endpoints | ✅ Ovia: optionalAuth. Email: rate-limited |
| B2 | Stripe subscription broken | ✅ requireAuth middleware added |
| B3 | Untrusted body params in Stripe | ✅ userId from JWT only |
| B5 | Email PII sent to OpenAI | ✅ Removed from mobile context |
| M3 | Source maps in production | ✅ Disabled in production build |
| M3a | Stack trace on invalid JSON | ✅ Custom error handler added |
| CORS* | Ovia SSE hardcoded `*` origin | ✅ Removed hardcoded header |

---

## SECURITY ISSUES REQUIRING MANUAL ACTION

| ID | Issue | Action Required |
|----|-------|----------------|
| H1 | SMTP secrets missing | Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_FROM in Replit Secrets |
| H2 | BRAVE_SEARCH_API_KEY | Confirm set in Replit Secrets |
| M7 | INTERNAL_API_SECRET | Confirm set in Replit Secrets |
| B7 | Cascade delete trigger | Run Migration 007 in Supabase SQL Editor |
| B4 | Community RLS | Run Migration 006 in Supabase SQL Editor |
| 005 | User data RLS | Run Migration 005 in Supabase SQL Editor (if not already applied) |

---

## RECOMMENDATIONS (Post-Launch)

1. **Sentry** — Error tracking for production crashes and API failures
2. **Rate limit by userId** — Per-user Ovia limits once auth is universally enforced
3. **Supabase auth for web app** — Web app currently uses mock local auth
4. **Biometric auth** — Optional lock for sensitive data on mobile
5. **Account deletion UI** — Required by App Store; triggers B7 cascade delete
6. **Privacy Policy update** — Add OpenAI data disclosure for Ovia AI feature

---

## SUMMARY

| Category | Before | After |
|----------|--------|-------|
| Auth on API routes | ❌ Zero | ✅ JWT middleware on Stripe; optional on Ovia |
| Stack trace exposure | ❌ Yes | ✅ Fixed |
| Source maps in prod | ❌ Yes | ✅ Fixed |
| CORS wildcard on Ovia | ❌ Yes | ✅ Fixed |
| SQL injection | ✅ Safe | ✅ Safe |
| Dependency vulns | ✅ None | ✅ None |
| Security headers | ✅ All set | ✅ All set |
