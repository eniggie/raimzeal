---
name: EAS Store Submission
description: EAS build and store submission config for RAIMZEAL mobile app (app.replit.raimzeal / com.econteur.raimzeal)
---

## Key identifiers
- EAS account: econteur (developer@econteur.com)
- EAS project ID: 352f4ec9-8d51-4d18-8c68-97a1b3be0387
- Bundle ID (iOS): app.replit.raimzeal (per ios-bundle-id.md — DO NOT CHANGE)
- Package (Android): com.econteur.raimzeal
- Apple Team ID: W842SR649M (EPHRAIM OSAGIE OVIAWE, Individual)
- ASC App ID: 6773363801 (hardcoded in eas.json submit.production)

## Build process
- EAS CLI available globally via pnpm exec eas (v20.2.0+)
- EXPO_TOKEN is set as a secret and handles auth automatically
- Must run from `artifacts/raimzeal-mobile/` directory
- Must use `EAS_NO_VCS=1` to bypass Replit's git-operation block
- Must use `--non-interactive` for non-blocking execution
- Project archive is ~90 MB (after pnpm dedupe) — upload takes ~1-2s
- `autoIncrement: true` in eas.json bumps versionCode/buildNumber during build
- `appVersionSource: "remote"` in eas.json — EAS manages version remotely, app.json value ignored

## IMPORTANT: autoSubmit removed from eas.json (June 2026)

`"autoSubmit": true` was removed from `build.production` in eas.json because EAS CLI v20.x
no longer accepts it in the build profile schema (causes validation failure on all eas commands).

**Use `--auto-submit` CLI flag instead** for auto-submission after build:
```bash
cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build --platform ios --profile production --non-interactive --auto-submit
```

## Full build commands (with auto-submit)
```bash
# iOS only (preferred — faster, ~15 min)
cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build --platform ios --profile production --non-interactive --auto-submit

# All platforms
cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build --platform all --profile production --non-interactive --auto-submit
```

Command times out locally (upload+fingerprint >2 min) but builds ARE queued and auto-submit is scheduled on EAS servers — client disconnect does NOT cancel the submission.

Check status: `cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build:list --limit 4 --non-interactive`

## Manual submit (after builds finish, if --auto-submit not used)
```bash
cd artifacts/raimzeal-mobile && EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas submit --platform ios --profile production --non-interactive
```

## Version history
- 1.1.0: versionCode 19, multiple iOS builds (2, 4, 5)
- 1.2.0: versionCode 21, iOS buildNumber 4 (builds ac85bd9c / 1d3555e1, queued 2026-06-01)
- 1.3.0: versionCode 24 (auto-incremented from 23), build 4fdc301f, queued 2026-06-07
- 1.3.0: buildNumber 40 — crashed on TestFlight (worklets double-link + autoSubmit eas.json bug)
- 1.3.0: buildNumber 25 — queued 2026-06-24, fixes worklets removal + eas.json autoSubmit removal

## EAS Build from Replit bash tool — archive size limitation

`EAS_NO_VCS=1` causes pnpm symlinks in `artifacts/raimzeal-mobile/node_modules/`
to be followed into the workspace-root `.pnpm` store. The bash tool has a 120s max
timeout; uploading the archive may exceed this.

**Workaround**: Run from the Replit shell directly (not via the agent bash tool) if needed.
The agent bash tool WILL time out but the build IS queued — timeout ≠ build cancelled.

Background approaches (nohup) fail because pnpm is a Nix store binary not in
PATH of non-interactive shells.
