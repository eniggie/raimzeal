# Android Play Store Submission — Setup & Trigger Guide

## Status
EAS Android submission infrastructure is **fully configured and working**. The submission was scheduled, the AAB (v1.1.0, version code 19) was found and uploaded to Google's servers, but authentication failed because the service account private key in `google-play-service-account.json` is invalid.

**Last submission attempt:**
- Submission ID: `f6b16c4b-faa8-41d8-9220-9bd865e96119`
- Build ID: `47f36b6b-2dcb-4809-a3cb-b64cc4e1c5ef` (v1.1.0, versionCode 19)
- Submission details: https://expo.dev/accounts/econteur/projects/raimzeal/submissions/f6b16c4b-faa8-41d8-9220-9bd865e96119

## What's already configured
- `eas.json` submit.production.android: `track: internal`, `serviceAccountKeyPath: ./google-play-service-account.json`
- `google-play-service-account.json` present at `artifacts/raimzeal-mobile/`
- Package name: `com.econteur.raimzeal`
- Service account email: `raimzeal-play@raimzeal.iam.gserviceaccount.com`

## Blocker: Invalid JWT Signature
Google's API rejected the service account key:
```
{"error":"invalid_grant","error_description":"Invalid JWT Signature."}
```
This means the private key in `google-play-service-account.json` doesn't match what Google Cloud Console has for the `raimzeal-play` service account. The key needs to be regenerated.

## Fix — regenerate the service account key

### Step 1 — Go to Google Cloud Console
1. Open https://console.cloud.google.com
2. Select the **raimzeal** project
3. Navigate to **IAM & Admin → Service Accounts**
4. Find `raimzeal-play@raimzeal.iam.gserviceaccount.com`

### Step 2 — Create a new key
1. Click the service account → **Keys** tab
2. Click **Add Key → Create new key**
3. Choose **JSON** format → **Create**
4. A `.json` file downloads to your computer

### Step 3 — Grant Play Store API access (if not already done)
1. In **Google Play Console** → **Setup → API access**
2. Link to the **raimzeal** Google Cloud project
3. Grant the `raimzeal-play` service account the **Release manager** role (or at minimum **Releases** permission)
4. The app must have at least one existing release (even on internal track) before API uploads work

### Step 4 — Replace the key file
Replace `artifacts/raimzeal-mobile/google-play-service-account.json` with the downloaded JSON.

> **Security note:** This file contains a private key — never commit it to a public repository.
> It is listed in `.gitignore` so it won't be accidentally pushed.

### Step 5 — Trigger submission
Run from `artifacts/raimzeal-mobile/`:
```bash
EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
  eas submit --platform android --latest --profile production --non-interactive
```

## Build monitoring
- All submissions: https://expo.dev/accounts/econteur/projects/raimzeal/submissions
- All builds: https://expo.dev/accounts/econteur/projects/raimzeal/builds

## After submission succeeds
- Open **Google Play Console → Internal testing** to promote the build
- Promoting from internal → production requires at least 20 opted-in testers completing the review period (Google policy)

## Triggering a fresh build + submit in one step
```bash
# Build
EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
  eas build --platform android --profile production --non-interactive --no-wait

# Wait for build to complete, then submit latest
EAS_NO_VCS=1 EXPO_TOKEN="$EXPO_TOKEN" \
  eas submit --platform android --latest --profile production --non-interactive
```
