# Android Play Store Submission — Setup & Trigger Guide

## Status
EAS Android submission infrastructure is **fully configured**. The latest production
build is ready (v1.3.0, versionCode 27). Submission is blocked by an expired/deleted
service account key — the fix is to regenerate it in Google Cloud Console (5 min task).

**Latest production Android builds (both finished 6/22/2026):**
| Build ID | versionCode | Status |
|---|---|---|
| `2ebf7405-9d3d-4464-b0d8-e8dc300b7fdf` | 27 | finished ✅ |
| `e45b8f5c-2f9d-4fdf-8c44-ea56de40aa57` | 27 | finished ✅ |

**Last failed submission attempt:**
- Submission ID: `f6b16c4b-faa8-41d8-9220-9bd865e96119`
- Build: v1.1.0, versionCode 19 (now outdated; latest is versionCode 27)
- Error: `{"error":"invalid_grant","error_description":"Invalid JWT Signature."}`
- Cause: Private key in `google-play-service-account.json` (key ID `6c68d31a00c01a6150f5dd4a941440ef8ef677bf`) no longer matches the key Google has on file for `raimzeal-play@raimzeal.iam.gserviceaccount.com`.

---

## Fix — regenerate the service account key (user action required)

### Step 1 — Delete the old key in Google Cloud Console
1. Open https://console.cloud.google.com
2. Select the **raimzeal** project
3. Navigate to **IAM & Admin → Service Accounts**
4. Find `raimzeal-play@raimzeal.iam.gserviceaccount.com` → click it
5. Open the **Keys** tab
6. Delete the key with ID `6c68d31a00c01a6150f5dd4a941440ef8ef677bf` (or any expired keys)

### Step 2 — Create a new key
1. Still on the **Keys** tab → **Add Key → Create new key**
2. Choose **JSON** format → **Create**
3. A `.json` file downloads to your computer automatically

### Step 3 — Confirm Play Store API access (one-time setup)
1. Open https://play.google.com/console → **Setup → API access**
2. Confirm the project is linked to the **raimzeal** Google Cloud project
3. Confirm `raimzeal-play@raimzeal.iam.gserviceaccount.com` has **Release Manager** role
4. The app must have at least one existing manual release on the internal track (needed for API uploads to work)

### Step 4 — Replace the key file in Replit
Replace the contents of `artifacts/raimzeal-mobile/google-play-service-account.json`
with the downloaded JSON file.

> **Security note:** This file contains a private key — it is listed in `.gitignore`
> and must NEVER be committed to a public repository or shared.

### Step 5 — Trigger submission
Run from `artifacts/raimzeal-mobile/`:
```bash
EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
  eas submit --platform android --latest --profile production --non-interactive
```

This will pick up the latest finished build (versionCode 27) automatically and
upload it to the **internal** track on Google Play.

---

## Configuration reference
- Package name: `com.econteur.raimzeal`
- Service account: `raimzeal-play@raimzeal.iam.gserviceaccount.com`
- Play track: `internal`
- `eas.json` submit config: `serviceAccountKeyPath: ./google-play-service-account.json`

## Build monitoring
- All submissions: https://expo.dev/accounts/econteur/projects/raimzeal/submissions
- All builds: https://expo.dev/accounts/econteur/projects/raimzeal/builds

## After submission succeeds
- Open **Google Play Console → Internal testing** to promote the build
- Promoting from internal → production requires at least 20 opted-in testers
  completing the review period (Google policy)

## Triggering a fresh build + submit in one step
```bash
# Build (run from Replit shell, NOT agent bash — upload takes >2 min)
cd artifacts/raimzeal-mobile
EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas build --platform android --profile production --non-interactive

# Once build finishes, submit
EAS_NO_VCS=1 EXPO_TOKEN=$EXPO_TOKEN pnpm exec eas submit --platform android --latest --profile production --non-interactive
```
