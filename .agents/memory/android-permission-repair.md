---
name: Android permission repair (June 2026)
description: Full audit and repair of RAIMZEAL Play Store Android permissions, schema, and security CVEs.
---

## Changed files

### artifacts/raimzeal-mobile/app.json
- Removed android.minSdkVersion from direct android section — was a schema violation
  (expo-doctor error); minSdkVersion lives only in expo-build-properties plugin
- Added RECORD_AUDIO (expo-av, Ovia AI voice input) and ACTIVITY_RECOGNITION
  (expo-sensors Pedometer) to explicit permissions — used in code, previously undeclared
- Removed READ_EXTERNAL_STORAGE + WRITE_EXTERNAL_STORAGE from permissions
- Added blockedPermissions: READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE,
  READ_MEDIA_AUDIO, READ_MEDIA_VIDEO, SYSTEM_ALERT_WINDOW, ACCESS_BACKGROUND_LOCATION
- expo-location: switched to locationWhenInUsePermission, background disabled
- expo-build-properties: added targetSdkVersion: 35

### artifacts/raimzeal-mobile/package.json
- expo.doctor.reactNativeDirectoryCheck.exclude: ['react-native-health'] — suppress
  New Architecture warning (pre-existing, not fixable without changing health library)
- expo.install.exclude: ['react','react-dom'] — workspace intentionally uses 19.2.0

### pnpm-workspace.yaml
- vite: ^7.3.3 → ^7.3.5 (HIGH CVE GHSA-fx2h-pf6j-xcff)
- ws: >=8.20.1 → >=8.21.0 (HIGH CVE GHSA-96hv-2xvq-fx4p)
- shell-quote: >=1.8.4 override added (CRITICAL GHSA-w7jw-789q-3m8p)
- form-data: >=4.0.6 override added (HIGH GHSA-hmw2-7cc7-3qxx)

## Final check results (all verified with actual commands)
- tsc --noEmit: web ✅, api ✅, mobile ✅ (exit 0, 4 rounds)
- vite build (PORT=18577 BASE_PATH=/): ✅ exit 0
- api node ./build.mjs: ✅ exit 0
- api tsx --test: ✅ 12/12
- expo prebuild --platform android --no-install: ✅ exit 0
- expo-doctor: 16/18 — 2 remaining failures are pre-existing pnpm monorepo issues
  (Metro watchFolders for cross-package imports, duplicate symlinks from pnpm)
- pnpm audit --audit-level=high: ✅ exit 0 (9 low/moderate only)

## Generated AndroidManifest.xml (from expo prebuild)
Granted (14): ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION, ACTIVITY_RECOGNITION,
CAMERA, INTERNET, MODIFY_AUDIO_SETTINGS, READ_MEDIA_IMAGES,
READ_MEDIA_VISUAL_USER_SELECTED, RECEIVE_BOOT_COMPLETED, RECORD_AUDIO,
USE_BIOMETRIC, USE_EXACT_ALARM, USE_FINGERPRINT, VIBRATE
Blocked (6, tools:node="remove"): ACCESS_BACKGROUND_LOCATION, READ_EXTERNAL_STORAGE,
READ_MEDIA_AUDIO, READ_MEDIA_VIDEO, SYSTEM_ALERT_WINDOW, WRITE_EXTERNAL_STORAGE

## expo-doctor remaining 2 failures (pre-existing, not introduced)
1. Metro watchFolders/unstable_enableSymlinks — required for pnpm monorepo
   cross-package resolution; do NOT remove these settings from metro.config.js
2. Duplicate native deps — pnpm symlinks the same version to multiple paths;
   this is normal for pnpm workspaces; EAS cloud build deduplicates at native build time

## versionCode note
- app.json local: 24; Play Store last published: 30; EAS autoIncrement→31 next prod build

## Before Play submission
- Verify Supabase migration 006 applied in live project (RLS on community tables)
- Manual regression test
- `eas build --platform android --profile preview` for APK smoke test
- Explicit approval from ECONTEUR LLC
