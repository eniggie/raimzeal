# RAIMZEAL Pre-Deploy Checklist

Run through every item below before publishing a new version of RAIMZEAL.

## Pages & Routes
- [ ] **Home** (`/`) — loads, shows free-forever banner, streak, and donation button
- [ ] **Login** (`/login`) — sign-in form works, no placeholder text, no raw JSON
- [ ] **Sign Up** (`/onboarding`) — all 6 steps complete, account created, confirmation email sent
- [ ] **Reset Password** — password reset flow sends email, link redirects correctly
- [ ] **Membership** (`/membership`) — shows Foundation Plan, all features listed, donation button works
- [ ] **Community** (`/community`) — posts load, composer works, RAIMZY linktree link opens
- [ ] **Settings** (`/settings`) — all sections render, no broken links, export works
- [ ] **Ovia AI Coach** (`/coach`) — sends a message, receives clean plain-text response (no `*` or `**` in output)
- [ ] **Privacy Policy** (`/privacy`) — page loads with full content
- [ ] **Terms of Service** (`/terms`) — page loads with full content
- [ ] **Donation Link** — clicking Donate opens Stripe donation page correctly

## Ovia AI Checks
- [ ] Ovia response contains zero asterisks (`*`) or markdown symbols
- [ ] Off-topic message returns the correct redirect: "I am here to help with your health, fitness, food therapy, and wellness journey. Let us stay focused on that."
- [ ] Medical question returns the medical redirect, not a diagnosis

## Content & Copy
- [ ] No placeholder text visible anywhere (e.g., "Lorem ipsum", "TODO", "Coming soon" without context)
- [ ] No raw JSON or XML visible to users
- [ ] No "Access Denied" error shown to logged-in users
- [ ] "Foundation Plan is free forever" wording consistent on Home, Membership, Community, Settings
- [ ] Medical disclaimer visible on Home, Onboarding, and Coach pages

## Links
- [ ] `https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00` — opens correctly
- [ ] `https://linktr.ee/Raimzy` — opens correctly
- [ ] Email verification link from signup works

## API & Performance
- [ ] `/api/healthz` returns 200
- [ ] `/api/stripe/donation-health` returns `{ ok: true }`
- [ ] No console errors on Home, Coach, Community pages
- [ ] Images are lazy-loaded; no heavy video/audio embedded directly in the app

## Typecheck (must pass before every deploy)
```
pnpm --filter @workspace/raimzeal run typecheck
pnpm --filter @workspace/api-server run typecheck
```
