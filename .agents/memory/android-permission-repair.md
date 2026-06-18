---
name: Android permission repair (June 2026)
description: Results of the June 2026 Android permission audit and app.json repair for RAIMZEAL Play Store submission.
---

## What was changed in app.json

### Removed from `permissions` (blocked instead):
- `READ_EXTERNAL_STORAGE` — not needed minSdk=26
- `WRITE_EXTERNAL_STORAGE` — not needed minSdk=26

### Added to `permissions` (newly explicit):
- `RECORD_AUDIO` — expo-av, Ovia AI voice input
- `ACTIVITY_RECOGNITION` — expo-sensors Pedometer step counting

### Added `blockedPermissions`:
- `READ_EXTERNAL_STORAGE`
- `WRITE_EXTERNAL_STORAGE`
- `READ_MEDIA_AUDIO` — expo-media-library adds this; app only needs images
- `READ_MEDIA_VIDEO` — same, no video files used
- `SYSTEM_ALERT_WINDOW` — from native deps, never called in app code
- `ACCESS_BACKGROUND_LOCATION` — foreground-only workout tracking

### expo-location plugin:
- Changed `locationAlwaysAndWhenInUsePermission` → `locationWhenInUsePermission`
- Added `isAndroidBackgroundLocationEnabled: false`
- Added `isAndroidForegroundServiceEnabled: false`

### expo-build-properties:
- Added `targetSdkVersion: 35` (Play Store requires ≥35 for 2025+ updates)

## versionCode note
- app.json local value: 24
- Last Play Store build: 1.3.0 versionCode 30
- EAS `autoIncrement: true` → next prod EAS build will be versionCode 31

## Typecheck timeout note
- Mobile typecheck needs 300s+ (not 120s) under normal load due to project size
- API typecheck also needs 300s+ for same reason
- Both confirmed exit 0 when given adequate time

## Community auth status
- All community mutations gated by `requireAuth` middleware (JWT validation)
- userId always extracted from JWT, never from request body
- RLS policies defined in migration 006 — must verify applied in live Supabase
- Owner checks before delete/edit: `post.user_id !== userId` → 403

## Pending before Play submission
- Manually verify migration 006 applied in live Supabase dashboard
- Manual regression test of auth, community, camera, notifications, donation URL
- Explicit approval from Dr. Oviawe/ECONTEUR LLC
