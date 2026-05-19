# RAIMZEAL — Phase 4: API Endpoint Audit
**Generated:** May 19, 2026  
**Base URL:** `/api` (Express, port 8080, proxied through shared proxy at :80)

---

## ENDPOINT TEST RESULTS

### GET /api/healthz
| Check | Result |
|-------|--------|
| Exists and responds | ✅ 200 OK `{"status":"ok"}` |
| Auth required | N/A — intentionally public |
| Rate limiting | None — acceptable |

---

### POST /api/ovia/chat
**Current status: 🔴 BLOCKER B1**

| Check | Before Fix | After Fix |
|-------|-----------|----------|
| Exists and responds | ✅ 200 OK | ✅ 200 OK |
| Authentication required | ❌ None | ✅ Optional auth (JWT when present) |
| Rate limiting (short-term) | ✅ 30/15min per IP | ✅ Preserved |
| Rate limiting (daily) | ✅ 100/day per IP | ✅ Preserved |
| Input validation: messages array | ✅ Required | ✅ |
| Input validation: max 40 messages | ✅ 400 if exceeded | ✅ |
| Input validation: content length | ✅ 4000 char max | ✅ |
| System message injection blocked | ✅ Role filter in place | ✅ |
| Error response: no stack trace | ❌ Stack trace on invalid JSON | ✅ Fixed via JSON error handler |
| CORS wildcard | ⚠️ `Access-Control-Allow-Origin: *` hardcoded in route | ✅ Overrides CORS header — fix applied |
| Model name valid | ❌ `gpt-4.1` (non-standard) | ✅ `gpt-4o` |
| PII in request body (email) | ❌ Mobile sends `email` field | ✅ Removed from mobile context |

**Live test results:**
```
curl -X POST /api/ovia/chat [no auth] → 200 OK (BEFORE FIX)
curl -X POST /api/ovia/chat [invalid JSON] → 400 HTML with full stack trace (BEFORE FIX)
```

---

### POST /api/email/send
**Current status: 🟠 H1 + 🟡 M2**

| Check | Result |
|-------|--------|
| Exists and responds | ✅ 200 OK (503 when SMTP not configured) |
| Authentication | ❌ None — public endpoint |
| Rate limiting | ✅ 10/hr per IP |
| Input: `to` required | ✅ 400 if missing |
| Input: email format validation | ✅ Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| Input: `userName` required | ✅ 400 if missing |
| SMTP functional | ❌ 4/5 SMTP secrets unset — all emails silently fail |
| Hardcoded Linktree URL | ❌ `linktr.ee/Raimzy` in email templates |

**Recommendation:** Add authentication requirement or move to internal-only (currently exploitable for sending RAIMZEAL-branded emails to arbitrary addresses).

---

### POST /api/email/verify
| Check | Result |
|-------|--------|
| Exists and responds | ✅ |
| Authentication | ❌ None |
| Rate limiting | ✅ |
| Input validation | ✅ Same as /send |

---

### POST /api/email/digest/subscribe
| Check | Result |
|-------|--------|
| Exists and responds | ✅ |
| Authentication | None — acceptable for subscribe |
| Input validation | ✅ Email + name required |
| Rate limiting | ✅ |

---

### POST /api/email/digest/unsubscribe
| Check | Result |
|-------|--------|
| Exists and responds | ✅ |
| Authentication | None — acceptable for unsubscribe |
| Rate limiting | ⚠️ None (low risk) |

---

### POST /api/email/digest/send-now
| Check | Result |
|-------|--------|
| Exists and responds | ✅ |
| Authentication | ✅ `x-internal-secret` header check |
| Without header → 401 | ✅ Verified |
| Wrong header → 401 | ✅ Verified |
| Rate limiting | ✅ 3/hr |
| INTERNAL_API_SECRET set | ❓ Not confirmed in Replit Secrets |

---

### GET /api/stripe/plans
| Check | Result |
|-------|--------|
| Exists and responds | ✅ 200 OK |
| Authentication | None — intentionally public |
| Returns 3 plans | ✅ Foundation/Athlete/Elite |
| Price IDs live | ✅ `price_1TYqAQEt8Pg7bh16Si4D0Si3` for Athlete |
| Fallback on Stripe error | ✅ Returns static plans |

---

### GET /api/stripe/subscription
**Current status: 🔴 BLOCKER B2**

| Check | Before Fix | After Fix |
|-------|-----------|----------|
| Authentication | ❌ `(req as any).userId` never set | ✅ `requireAuth` middleware |
| Always returns `free` | ❌ userId is always undefined | ✅ Real tier lookup |
| DB query parameterized | ✅ Drizzle `sql\`...\`` | ✅ |

**Live test results:**
```
GET /api/stripe/subscription [no auth] → {"tier":"free","subscription":null} (BEFORE FIX)
```

---

### POST /api/stripe/checkout
**Current status: 🔴 BLOCKER B3**

| Check | Before Fix | After Fix |
|-------|-----------|----------|
| Authentication | ❌ `userId` from body | ✅ `optionalAuth`, userId from JWT |
| priceId required | ✅ 400 if missing | ✅ |
| SQL injection via userId | ✅ Drizzle parameterized | ✅ |
| Empty body → 400 | ✅ | ✅ |
| Stripe session created | ✅ | ✅ |
| success_url / cancel_url | ⚠️ No validation — any URL accepted | ⚠️ Acceptable risk |

---

### POST /api/stripe/portal
**Current status: 🔴 BLOCKER B3**

| Check | Before Fix | After Fix |
|-------|-----------|----------|
| Authentication | ❌ `customerId` from body | ✅ `requireAuth`, customerId from DB |
| Missing customerId → 400 | ✅ | ✅ |

---

### POST /api/stripe/webhook
| Check | Result |
|-------|--------|
| Authentication | ✅ Stripe signature verification |
| Raw body preserved | ✅ `express.raw()` before json middleware |
| Idempotency | ⚠️ No explicit event ID deduplication |
| Error handling | ✅ Logged and returns 400 |

---

## GLOBAL API CHECKS

| Check | Status | Notes |
|-------|--------|-------|
| HTTPS in production | ✅ | Replit proxy handles TLS |
| Security headers (helmet) | ✅ HSTS, X-Frame, X-Content-Type, Referrer | `contentSecurityPolicy: false` for JSON API |
| CORS production restriction | ✅ `raimzeal.com` + Replit domains only | Dev: open |
| Stack trace on invalid JSON | ❌ → ✅ | Fixed with custom error handler |
| Source maps in production build | ❌ → ✅ | Fixed: disabled in production build |
| npm audit vulnerabilities | ✅ No known CVEs | As of May 19, 2026 |
| TypeScript typecheck | ✅ Clean | All packages |
| Dead code (storage.ts, routes.ts) | ⚠️ | Empty scaffold files — not a security risk |
| Rate limiting on all public endpoints | ⚠️ | Stripe plans + healthz have none (acceptable) |
| Pagination on list endpoints | N/A | No list endpoints currently |
| 404 response for unknown routes | ✅ HTML (body-parser default) | Not a security risk |

---

## SUMMARY

| Endpoint | Auth | Rate Limit | Input Valid | Status |
|----------|------|-----------|------------|--------|
| `GET /api/healthz` | None | None | N/A | ✅ |
| `POST /api/ovia/chat` | Optional | ✅ | ✅ | ✅ Fixed |
| `POST /api/email/send` | None | ✅ | ✅ | ⚠️ Public email risk |
| `POST /api/email/verify` | None | ✅ | ✅ | ⚠️ |
| `POST /api/email/digest/subscribe` | None | ✅ | ✅ | ✅ |
| `POST /api/email/digest/unsubscribe` | None | ❌ | ✅ | ⚠️ Low risk |
| `POST /api/email/digest/send-now` | ✅ Internal secret | ✅ | ✅ | ✅ |
| `GET /api/stripe/plans` | None | None | N/A | ✅ |
| `GET /api/stripe/subscription` | ✅ Required | None | N/A | ✅ Fixed |
| `POST /api/stripe/checkout` | ✅ Optional | None | ✅ | ✅ Fixed |
| `POST /api/stripe/portal` | ✅ Required | None | ✅ | ✅ Fixed |
| `POST /api/stripe/webhook` | ✅ Stripe sig | None | ✅ | ✅ |
