---
name: Mobile payment compliance
description: iOS/Android App Store rules — Stripe must never be used for digital subscriptions on native mobile.
---

## Rule

**Never call Stripe Checkout from the iOS or Android app for digital subscriptions.**

Apple App Store and Google Play Store policies require that in-app purchases of digital content use their native billing systems (Apple IAP / Google Play Billing). Using Stripe or any external payment processor inside a native app for digital subscriptions violates both stores' rules and risks app rejection or removal.

## Current implementation (as of June 2026)

- `artifacts/raimzeal-mobile/app/membership.tsx` uses `Platform.OS` to detect the runtime.
- **iOS:** Subscribe button shows an `Alert` directing users to Apple In-App Purchase (setup in progress) and offers a link to `raimzeal.com/membership`.
- **Android:** Same but references Google Play Billing and the same web URL.
- No Stripe API calls are made from the mobile app.
- A platform notice banner is shown at the top of the screen explaining the payment method.
- IAP and Play Billing are marked "setup in progress" — placeholder UI exists, real billing not yet wired.

**Why:** App Store review guidelines §3.1.1 and Google Play policy both prohibit alternative payment processors for in-app digital goods. Violation risks permanent removal from the store.

**How to apply:** When Apple IAP or Google Play Billing is eventually set up, replace the `Alert` handler with native purchase flows (e.g. `expo-iap` or `react-native-purchases`). Keep the `Platform.OS` gate — never let Stripe calls reach native platforms.
