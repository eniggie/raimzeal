# iOS App Store Build — Setup & Trigger Guide

## Status
EAS iOS production build **requires one-time interactive credential setup** by the Apple Developer account holder before it can run non-interactively.

## What's already configured
- `eas.json` production iOS profile: `buildConfiguration: Release`, `resourceClass: m-medium`
- `app.json` iOS bundle ID: `com.econteur.raimzeal`, EAS owner: `econteur`
- `app.json` `ITSAppUsesNonExemptEncryption: false` — suppresses App Store encryption compliance questionnaire
- EAS project ID: `352f4ec9-8d51-4d18-8c68-97a1b3be0387`

## Blocker
EAS has remote iOS credentials stored, but the Distribution Certificate has not been validated. Non-interactive builds exit with:

```
Distribution Certificate is not validated for non-interactive builds.
Credentials are not set up. Run this command again in interactive mode.
```

## One-time fix (requires Apple Developer account)

Run this **interactively** from `artifacts/raimzeal-mobile/`:

```bash
EAS_NO_VCS=1 eas build --platform ios --profile production --no-wait
```

EAS will prompt you to:
1. Log in with your Apple ID (associated with the `econteur` Apple Developer account)
2. Complete 2FA
3. Select your team / generate or reuse a Distribution Certificate
4. Generate or reuse a Provisioning Profile for `com.econteur.raimzeal`

Once credentials are stored, all future **non-interactive** runs succeed:

```bash
EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
  eas build --platform ios --profile production --non-interactive --no-wait
```

## Monitoring
Build progress: https://expo.dev/accounts/econteur/projects/raimzeal/builds

## After the build completes
Submit to App Store Connect via:

```bash
EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
  eas submit --platform ios --profile production --latest
```

Requires `APPLE_TEAM_ID` and `ASC_APP_ID` environment variables (see `eas.json` submit section).
