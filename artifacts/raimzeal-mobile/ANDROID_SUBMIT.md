# Android Play Store Submission — Setup & Trigger Guide

## Status
EAS Android submission is **fully automated**. `eas.json` has `autoSubmit: true` on
the production profile — a single build command triggers both the build and Play Store
upload automatically.

**Latest production Android builds (both finished 6/22/2026):**
| Build ID | versionCode | Status |
|---|---|---|
| `2ebf7405-9d3d-4464-b0d8-e8dc300b7fdf` | 27 | finished ✅ |
| `e45b8f5c-2f9d-4fdf-8c44-ea56de40aa57` | 27 | finished ✅ |

**Blocker (key regeneration still required):**
The service account private key in `google-play-service-account.json` is stale
(key ID `6c68d31a00c01a6150f5dd4a941440ef8ef677bf`). Google rejects it with
`{"error":"invalid_grant","error_description":"Invalid JWT Signature."}`.
Once the key is replaced (see below), every new production build will
auto-submit with no further manual steps.

---

## Key regeneration — user action required (one-time)

### Step 1 — Delete the old key in Google Cloud Console
1. Open https://console.cloud.google.com → select the **raimzeal** project
2. Navigate to **IAM & Admin → Service Accounts**
3. Find `raimzeal-play@raimzeal.iam.gserviceaccount.com` → click it
4. Open the **Keys** tab
5. Delete the key with ID `6c68d31a00c01a6150f5dd4a941440ef8ef677bf`

### Step 2 — Create a new key
1. Still on the **Keys** tab → **Add Key → Create new key**
2. Choose **JSON** format → **Create**
3. A `.json` file downloads to your computer automatically

### Step 3 — Confirm Play Store API access (one-time setup)
1. Open https://play.google.com/console → **Setup → API access**
2. Confirm the project is linked to the **raimzeal** Google Cloud project
3. Confirm `raimzeal-play@raimzeal.iam.gserviceaccount.com` has **Release Manager** role
4. The app must have at least one existing manual release on the internal track

### Step 4 — Replace the key file in Replit
Replace the contents of `artifacts/raimzeal-mobile/google-play-service-account.json`
with the downloaded JSON.

> **Security note:** This file contains a private key — it is listed in `.gitignore`
> and must NEVER be committed to a public repository.

---

## Releasing a new version (after key is fixed)

Build and submit are now a **single command** (run from the Replit shell, not the agent
bash tool — the 376 MB upload exceeds the agent's 120s timeout):

```bash
cd artifacts/raimzeal-mobile
EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build \
  --platform android --profile production --non-interactive
```

`autoSubmit: true` in `eas.json` chains the Play Store submission automatically when
the build succeeds. No second `eas submit` command is needed.

## Submitting the already-built versionCode 27 build (once key is fixed)

If you just want to upload the existing build without triggering a new one:

```bash
cd artifacts/raimzeal-mobile
EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas submit \
  --platform android --latest --profile production --non-interactive
```

---

## Configuration reference
- Package name: `com.econteur.raimzeal`
- Service account: `raimzeal-play@raimzeal.iam.gserviceaccount.com`
- Play track: `internal`
- `eas.json` submit config: `serviceAccountKeyPath: ./google-play-service-account.json`
- `eas.json` build config: `autoSubmit: true` (production profile)

## Build & submission monitoring
- All submissions: https://expo.dev/accounts/econteur/projects/raimzeal/submissions
- All builds: https://expo.dev/accounts/econteur/projects/raimzeal/builds

## After submission succeeds
- Open **Google Play Console → Internal testing** to promote the build
- Promoting from internal → production requires at least 20 opted-in testers
  completing the review period (Google policy)
