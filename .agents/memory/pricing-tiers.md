---
name: Pricing — locked tiers
description: Canonical prices for all RAIMZEAL subscription tiers; never change without explicit approval.
---

## Locked prices (as of June 2026)

| Plan | Monthly | Yearly | Yearly equiv/mo |
|------|---------|--------|-----------------|
| Foundation | Free | Free | — |
| Rise | $4.99 | $39.99 | $3.33 |
| Reign | $9.99 | $79.99 | $6.67 |
| Legacy | $19.99 | $149.99 | $12.50 |

**Reign** carries the "Best Value" badge (not "Most Popular").

**Founding Member Offer:** Reign at $4.99/month for the first 1,000 members — displayed as a banner inside the Reign card on both web and mobile.

**Yearly save badge:** "Save up to 37%" (Legacy saves ~37.5%, Rise/Reign save ~33%).

**Why:** Approved by Dr. Ephraim Oviawe. Reflects RAIMZEAL's non-profit mission — prices kept low to maximize access. Any change requires explicit re-approval.

**Single source of truth:** `artifacts/raimzeal/src/lib/plans.ts` (web) and `artifacts/raimzeal-mobile/lib/plans.ts` (mobile). All pricing UI must import from these files — never hardcode prices in individual components.

**Known stale locations found in audit (now fixed):** replit.md intro, scripts/seed-products.ts (used Athlete/Elite names at $9.99/$19.99), mobile profile.tsx ActionRow labels, mobile index.tsx banner (×2), web Home.tsx banner.

**How to apply:** To change a price, update `plans.ts` only — all components that import from it will reflect the change automatically. Stripe price IDs are stored in env vars (`STRIPE_PRICE_*`) and must also be updated in Replit Secrets + Stripe dashboard.
