---
name: EAS Store Submission
description: EAS build and store submission config for RAIMZEAL mobile app (com.econteur.raimzeal)
---

## Key identifiers
- EAS account: econteur (developer@econteur.com)
- EAS project ID: 352f4ec9-8d51-4d18-8c68-97a1b3be0387
- Bundle ID (iOS): com.econteur.raimzeal
- Package (Android): com.econteur.raimzeal
- Apple Team ID: W842SR649M (EPHRAIM OSAGIE OVIAWE, Individual)

## Build process
- EAS CLI available globally: `eas` (v19/20)
- EXPO_TOKEN is set as a secret and handles auth automatically
- Must run from `artifacts/raimzeal-mobile/` directory
- Must use `EAS_NO_VCS=1` to bypass Replit's git-operation block
- Must use `--non-interactive` for non-blocking execution
- Project archive is ~393 MB — upload takes ~8s, full build ~15–30 min
- `autoIncrement: true` in eas.json bumps versionCode/buildNumber during build

## Full build command
```
cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 EAS_BUILD_NO_EXPO_GO_WARNING=true eas build --platform all --profile production --non-interactive
```
Command times out locally (upload+fingerprint >2 min) but builds ARE queued successfully.
Check status with: `cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 eas build:list --limit 4 --non-interactive`

## Submission
- Android: uses `./google-play-service-account.json` (file exists), track: "internal"
- iOS: needs `ASC_APP_ID` env var (App Store Connect numeric app ID — user must provide)
  - Apple Team ID already hardcoded in eas.json as "W842SR649M"

## Submit command (after builds finish)
```
cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 ASC_APP_ID=<id> eas submit --platform all --profile production --non-interactive
```

## Version history
- 1.1.0: versionCode 19, multiple iOS builds (2, 4, 5)
- 1.2.0: versionCode 21, iOS buildNumber 4 (builds ac85bd9c / 1d3555e1, queued 2026-06-01)
- 1.3.0: versionCode 24 (auto-incremented from 23), build 4fdc301f, queued 2026-06-07, auto-submit to Play Store internal track scheduled (submission e0cf7555)

**Why:** Replit blocks git operations from main agent; EAS_NO_VCS=1 is mandatory.

## iOS Bundle ID correction (June 17 2026)
- `app.json` had wrong bundleIdentifier: `app.replit.raimzeal` (Replit scaffold default)
- Correct value is `com.econteur.raimzeal` — fixed
- **Why this breaks submission:** EAS submit matches the built binary's bundle ID against the ASC app entry. A mismatch causes immediate rejection from TestFlight.
- Always verify bundleIdentifier == com.econteur.raimzeal before triggering a production build

## EAS CLI version
- Upgraded from 19.0.1 → 20.2.0 (June 17 2026)
