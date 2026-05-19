# RAIMZEAL — Phase 9: Mobile-Specific Audit
**Generated:** May 19, 2026  
**Framework:** Expo SDK 52, React Native, Expo Router  
**Targets:** iOS (App Store) + Android (Google Play)

---

## APP CONFIGURATION (`app.json`)

| Item | Value | Status |
|------|-------|--------|
| `name` | RAIMZEAL | ✅ |
| `slug` | raimzeal-mobile | ✅ |
| `version` | 1.0.0 | ✅ |
| `android.versionCode` | 1 | ✅ |
| `ios.buildNumber` | "1" | ✅ |
| `android.package` | com.raimzeal.mobile | ✅ |
| `ios.bundleIdentifier` | com.raimzeal.mobile | ✅ |
| `orientation` | portrait | ✅ |
| `userInterfaceStyle` | dark | ✅ |
| `privacyPolicyUrl` | https://www.raimzeal.com/privacy | ✅ |
| `newArchEnabled` | true | ✅ |
| `expo-notifications` plugin | Configured | ✅ |
| iOS notification icon | `./assets/images/notification-icon.png` | ✅ |
| iOS `infoPlist` camera permission | `NSCameraUsageDescription` | ✅ |
| iOS `infoPlist` photo library | `NSPhotoLibraryUsageDescription` | ✅ |
| iOS `infoPlist` location when in use | `NSLocationWhenInUseUsageDescription` | ✅ |
| iOS `infoPlist` motion/fitness | `NSMotionUsageDescription` | ✅ |
| iOS `infoPlist` notifications | `NSUserNotificationsUsageDescription` | ✅ |
| Android permissions declared | All present | ✅ |
| Deep link scheme | `raimzeal-mobile` | ✅ |
| iOS `associatedDomains` | ❌ **NOT SET** | 🟠 H4 |
| Android `intentFilters` (App Links) | ❌ **NOT SET** | 🟠 H4 |
| 1024×1024 App Store icon | `/assets/images/app-icon-1024.png` | ⚠️ Exists but verify dimensions |
| Splash screen image | Configured | ✅ |

---

## TYPESCRIPT

```
pnpm --filter @workspace/raimzeal-mobile run typecheck
→ Clean — no errors
```

---

## DEPENDENCY AUDIT

| Package | Version | Status |
|---------|---------|--------|
| expo | ~52.0.42 | ✅ |
| react-native | 0.76.9 | ✅ |
| expo-router | ~4.0.19 | ✅ |
| @supabase/supabase-js | ^2.105.4 | ✅ |
| expo-notifications | ~0.29.14 | ✅ |
| expo-camera | ~16.0.18 | ✅ |
| expo-location | ~18.0.10 | ✅ |
| expo-haptics | ~14.0.1 | ✅ |
| expo-linear-gradient | ~14.0.2 | ✅ |
| react-native-chart-kit | Latest | ✅ |
| lucide-react-native | Latest | ✅ Fixed (Metro bundler import) |
| @react-native-async-storage/async-storage | Latest | ✅ |

---

## SCREEN-LEVEL AUDIT

### Safe Areas
| Screen Type | Status | Notes |
|-------------|--------|-------|
| All tab screens | ✅ | `useSafeAreaInsets()` used throughout |
| Full-screen modals | ✅ | Insets applied to header + content |
| Auth screens | ✅ | Bottom inset on CTAs |
| Dynamic Island (iPhone 15 Pro Max) | ✅ | Expo handles via safe area context |
| Home indicator (all iPhones) | ✅ | Bottom inset prevents overlap |
| Android navigation bar | ✅ | Insets handled |

### Keyboard Avoidance
| Screen | Status |
|--------|--------|
| Ovia chat input | ✅ `KeyboardAvoidingView` + `behavior="padding"` on iOS |
| Auth forms | ✅ `KeyboardAvoidingView` |
| Edit profile | ✅ |
| Nutrition food add | ✅ |
| Body measurements | ✅ |
| Macro goals | ✅ `KeyboardAvoidingView` (task #98) |

### Pull-to-Refresh
| Screen | Status |
|--------|--------|
| Community feed | ⚠️ Listed as feature but community shows mock data |
| Workout library | N/A — static data |
| Progress charts | N/A — local data |

---

## PERMISSIONS AUDIT

| Permission | Platform | Screen That Requests | Status |
|-----------|----------|---------------------|--------|
| Camera | iOS + Android | Barcode scanner (nutrition) | ✅ |
| Photo Library | iOS | Progress photos | ✅ |
| Location When In Use | iOS + Android | Activity tracker | ✅ |
| Motion / Fitness | iOS | Activity tracker | ✅ |
| Notifications | iOS + Android | Reminders screen | ✅ |

---

## PUSH NOTIFICATIONS

| Item | Status | Notes |
|------|--------|-------|
| Local notifications (scheduled) | ✅ | Workout reminders |
| Remote push (server-side) | ❌ | No push token registration to server |
| Notification deep links | ⚠️ | Not fully configured |
| Permission request flow | ✅ | Triggered on reminder screen |

---

## DEEP LINKS

| Scheme | Path | Works |
|--------|------|-------|
| `raimzeal-mobile://` | Custom scheme | ✅ Declared |
| `https://raimzeal.com` | Universal Link (iOS) | ❌ `associatedDomains` not set |
| `https://raimzeal.com` | App Link (Android) | ❌ `intentFilters` not set |

**Impact:** Password reset and email verification links open in Safari/Chrome instead of in the app. Users cannot complete the flow without switching between browser and app.

**Fix — `app.json` additions needed:**
```json
"ios": {
  "associatedDomains": ["applinks:raimzeal.com"]
},
"android": {
  "intentFilters": [{
    "action": "VIEW",
    "data": [{ "scheme": "https", "host": "raimzeal.com" }],
    "category": ["BROWSABLE", "DEFAULT"]
  }]
}
```
Note: Also requires an `apple-app-site-association` file served from `https://raimzeal.com/.well-known/apple-app-site-association`.

---

## OFFLINE BEHAVIOUR

| Feature | Offline Status | Notes |
|---------|---------------|-------|
| View existing workouts | ✅ | Static data |
| View nutrition logs | ✅ | AsyncStorage |
| Log food | ✅ | Local state |
| Ovia AI chat | ❌ | Requires network — shows error on failure |
| Community | ✅ | Shows cached mock data (all data is currently mock) |
| Auth | ❌ | Requires Supabase connection |

---

## APP STORE SUBMISSION CHECKLIST

### iOS App Store
- [x] Bundle identifier: `com.raimzeal.mobile`
- [x] Version: 1.0.0, Build: 1
- [x] Privacy Policy URL configured in app.json
- [x] Required permission strings declared in infoPlist
- [x] New Architecture enabled
- [ ] 1024×1024 icon verified (non-transparent, no alpha)
- [ ] Screenshots prepared: iPhone 6.7" (required), 6.5" (required), 5.5" (optional), iPad 12.9" (required for iPad support)
- [ ] App Store Connect listing created (name, description, keywords, category)
- [ ] Age rating questionnaire completed
- [ ] Apple Developer account active
- [ ] Privacy nutrition labels filled in App Store Connect
- [ ] TestFlight beta tested on real device
- [ ] `associatedDomains` added for Universal Links
- [ ] `apple-app-site-association` file deployed at raimzeal.com
- [ ] Health data deletion confirmed working (B7 trigger deployed)
- [ ] "Delete Account" feature implemented
- [ ] RevenueCat / native IAP integrated (Apple requires IAP for subscription apps) **OR** use web-only checkout with App Store exemption
- [ ] Support URL configured (requires /support page)

### Google Play Store
- [x] Package: `com.raimzeal.mobile`
- [x] Version code: 1
- [ ] Screenshots prepared: phone + tablet
- [ ] Play Console listing created
- [ ] Data safety section filled in Play Console
- [ ] Target API level: 34+ (Android 14)
- [ ] Android App Links (`intentFilters`) configured
- [ ] Release build signed with upload key
- [ ] Internal testing track set up

---

## CRITICAL ISSUES FOR APP STORE SUBMISSION

| # | Issue | Blocks |
|---|-------|--------|
| 1 | No "Delete Account" feature | 🔴 Apple App Store will reject |
| 2 | Community shows mock data, no RLS | 🔴 Misleading to users |
| 3 | RevenueCat / native IAP not integrated | 🔴 Apple requires in-app purchase for subscriptions sold in app |
| 4 | SMTP broken — no email verification | 🟠 Users cannot verify email |
| 5 | Universal Links not configured | 🟠 Password reset broken on mobile |
| 6 | No App Store screenshots prepared | 🟠 Required before submission |
| 7 | App Store Connect listing not created | 🟠 Required before submission |
| 8 | No TestFlight testing | 🟠 Required before submission |

---

## SUMMARY

| Category | Status |
|----------|--------|
| TypeScript | ✅ Clean |
| Metro build | ✅ Clean (lucide-react-native fixed) |
| App.json config | ✅ (missing associatedDomains) |
| Safe areas | ✅ |
| Keyboard avoidance | ✅ |
| Permissions | ✅ All declared |
| Push notifications | ⚠️ Local only |
| Deep links | ⚠️ Custom scheme only |
| App Store readiness | ❌ Multiple blockers remain |
