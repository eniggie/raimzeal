# RAIMZEAL App Review Response - June 2026

Submission ID: `d848710b-8180-4844-bade-d6d330cb1619`

Reviewed version: `1.3.0 (22)`

## Release Identity

- iOS bundle identifier: `app.replit.raimzeal`
- Source of truth: `artifacts/raimzeal-mobile/app.json` at `expo.ios.bundleIdentifier`
- Every iOS build and App Store submission must preserve this exact identifier.

## Reply to App Review

Hello App Review Team,

Thank you for identifying these issues. We corrected every item from the June 18 review and submitted a new binary.

### Guideline 2.1(a) - Sign in with Apple

- Native Sign in with Apple now declares the required iOS entitlement.
- The native token exchange now uses a cryptographically generated SHA-256 nonce and passes the matching raw nonce to Supabase Auth.
- The production Supabase configuration and Apple provider must be present in the EAS production environment used for the replacement build.

### Guideline 1.2 - User-Generated Content

- Users must accept the Terms of Use and Community Guidelines before password, biometric, or Apple sign-in.
- Every community post from another user has a visible Safety action.
- Safety offers `Report objectionable content` and `Block abusive user`.
- Reporting immediately hides the post and sends it to moderation for review within 24 hours.
- Blocking immediately removes that user's posts from the viewer's feed and records the block server-side.
- The production moderation API was corrected to match the deployed Supabase schema.

### Guideline 2.1 - Demo Account

- The demo account listed in App Review Information now exists in production.
- Its email is confirmed and password authentication was verified against the production Supabase Auth endpoint.
- It has a complete review profile with access to the app's features.

A physical-device screen recording demonstrating Terms acceptance, reporting a post, and blocking a user is included in App Review Information Notes.

Please review the replacement build. Thank you.
