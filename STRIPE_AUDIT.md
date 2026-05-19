# RAIMZEAL — Phase 6: Stripe Integration Audit
**Generated:** May 19, 2026

---

## CHECKLIST RESULTS

| Item | Status | Notes |
|------|--------|-------|
| Stripe keys in env vars | ✅ | Replit Connector managed — not in code |
| No Stripe keys in client code | ✅ | All Stripe calls are server-side |
| Webhook endpoint configured | ✅ | `POST /api/stripe/webhook` |
| Webhook signature verification | ✅ | `stripe.webhooks.constructEvent()` with signing secret |
| Subscription creation | ✅ | Checkout Session with `mode: "subscription"` |
| Subscription upgrade (plan change) | ⚠️ | Handled via Stripe Customer Portal only — no API-level upgrade |
| Subscription downgrade | ⚠️ | Portal only |
| Subscription cancellation | ✅ | Via Customer Portal |
| Failed payment handling | ⚠️ | Webhook fires — no grace period UI implemented |
| Trial period | N/A | Not implemented |
| Annual vs monthly | ⚠️ | Monthly only — no annual option |
| Tax calculation (Stripe Tax) | ❓ | Not explicitly enabled in checkout session |
| Customer Portal accessible | ✅ | `POST /api/stripe/portal` |
| Invoice generation | ✅ | Stripe automatic |
| Refund flow documented | ❌ | No refund policy page or flow |
| User entitlements update after payment | ⚠️ | Webhook updates `membership_tier` in DB; no live push to client |
| Webhook idempotency | ⚠️ | No explicit event ID deduplication |
| `allow_promotion_codes: true` | ✅ | Discount codes work at checkout |

---

## BLOCKER ANALYSIS

### B2 — Subscription Always Returns `free` (FIXED)

**Root cause:** `GET /api/stripe/subscription` reads `(req as any).userId` — this property was never set by any middleware. The fallback `if (!userId) return res.json({ tier: "free" })` executed for every request.

**Fix applied:** `requireAuth` middleware now validates the Supabase JWT in the `Authorization` header and sets `req.userId` before the route handler runs. The subscription lookup now functions correctly.

**Before:**
```
GET /api/stripe/subscription → {"tier":"free","subscription":null} (always)
```
**After:**
```
GET /api/stripe/subscription [no token]  → 401 Unauthorized
GET /api/stripe/subscription [valid JWT] → {"tier":"athlete","subscription":{...}}
```

### B3 — Untrusted Body Parameters (FIXED)

**Root cause (checkout):** `POST /api/stripe/checkout` extracted `userId` from `req.body`. Any caller could pass any userId to create a Stripe session linked to an arbitrary account.

**Fix applied:** 
- `userId` is now sourced from `req.userId` set by `optionalAuth` middleware — no longer trusted from body
- `email` can still be provided in body (needed for anonymous web checkout when no JWT)

**Root cause (portal):** `POST /api/stripe/portal` took `customerId` from `req.body`. Any caller who knew a Stripe customer ID could gain billing portal access.

**Fix applied:**
- `requireAuth` now required on portal
- `customerId` looked up from DB using the verified `req.userId` — body `customerId` ignored

---

## TEST CARD RESULTS

| Card | Expected | Actual | Status |
|------|---------|--------|--------|
| 4242 4242 4242 4242 | Success | ✅ Checkout session created | ✅ |
| 4000 0000 0000 0002 | Declined | ⚠️ Cannot test without live card entry | ⚠️ Manual |
| 4000 0000 0000 9995 | Insufficient funds | ⚠️ Manual | ⚠️ Manual |
| 4000 0027 6000 3184 | 3DS required | ⚠️ Manual | ⚠️ Manual |
| Subscription created webhook | `membership_tier` updated | ✅ Webhook handler logs event | ⚠️ Manual verify |
| Subscription canceled webhook | Tier downgraded on period end | ⚠️ Manual | ⚠️ Manual |

---

## WEBHOOK HANDLER ANALYSIS

**File:** `artifacts/api-server/src/webhookHandlers.ts`

Webhook events handled:
- `customer.subscription.created` — updates `membership_tier` in DB
- `customer.subscription.updated` — updates tier
- `customer.subscription.deleted` — resets to `free`

**Missing:**
- `invoice.payment_failed` — no user notification when payment fails
- `invoice.payment_succeeded` — no confirmation email  
- Idempotency guard (event ID stored in DB to prevent duplicate processing on retry)

---

## STRIPE PLANS CONFIGURATION

| Plan | Price ID | Stripe Product Metadata.tier | Status |
|------|----------|------------------------------|--------|
| Foundation | null | N/A | ✅ Free |
| Athlete | `price_1TYqAQEt8Pg7bh16Si4D0Si3` | `athlete` | ✅ |
| Elite | (from Stripe live) | `elite` | ⚠️ Verify in Stripe dashboard |

**Plan naming mismatch:** Codebase uses `athlete`/`elite` tier IDs. One Stripe plan description reads "GPT-4.1 Turbo" — update to "GPT-4o" to match the fixed model name.

---

## ENTITLEMENT FLOW

```
User clicks "Start Athlete" → POST /api/stripe/checkout (with JWT)
→ Stripe Checkout Session created → user redirected to Stripe
→ Payment succeeds → Stripe fires webhook to /api/stripe/webhook
→ WebhookHandlers.processWebhook() → UPDATE users SET membership_tier = 'athlete'
→ User returns to /membership?success=1
→ Client calls GET /api/stripe/subscription (with JWT) → returns {"tier":"athlete"}
→ UI unlocks Athlete features
```

**Gap:** The `?success=1` landing does not immediately refresh the subscription status from the API. Client shows a static success message but doesn't re-query the tier. Could lead to user confusion if they expect immediate unlock.

---

## PRODUCTION CHECKLIST BEFORE STORE SUBMISSION

- [ ] Confirm Elite plan price ID is set in Stripe and metadata `tier: "elite"` is set
- [ ] Enable Stripe Tax in dashboard (Settings → Tax)
- [ ] Test all 3 subscription tiers end-to-end with test cards
- [ ] Verify webhook endpoint is registered in Stripe Dashboard → Developers → Webhooks
- [ ] Confirm webhook signing secret is in Replit Secrets
- [ ] Add payment failure handling (email user via SMTP after H1 is fixed)
- [ ] Add refund policy to Privacy/Terms pages
- [ ] Update plan description in Stripe Dashboard: "GPT-4.1 Turbo" → "GPT-4o"

---

## SUMMARY

| Issue | Severity | Status |
|-------|----------|--------|
| B2: Subscription always returns `free` | 🔴 BLOCKER | ✅ FIXED |
| B3: Untrusted userId/customerId from body | 🔴 BLOCKER | ✅ FIXED |
| Missing annual billing option | 🟡 MEDIUM | ⚠️ Future work |
| No Stripe Tax configuration | 🟡 MEDIUM | ⚠️ Dashboard action |
| Webhook idempotency | 🟡 MEDIUM | ⚠️ Future work |
| Payment failure notification | 🟠 HIGH | ⚠️ Needs SMTP fix first |
| Success page doesn't refresh tier | 🔵 LOW | ⚠️ Future work |
