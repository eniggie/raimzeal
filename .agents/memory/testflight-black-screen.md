---
name: TestFlight Black Screen Causes
description: Confirmed root causes of crash-on-open / blank screen on TestFlight (iOS production build); fixes applied June 2026.
---

# TestFlight Black Screen — Root Causes & Fixes

## Root Cause 1: BootSplash rendered before SafeAreaProvider

`app/_layout.tsx` has an early-return path:
```js
if (!appReady) return <BootSplash />;
```
`BootSplash` uses `SafeAreaView` from react-native-safe-area-context. In v5.6.0 this throws when no `SafeAreaProvider` is in the tree. The throw escapes all ErrorBoundaries, React's tree fails, `SplashScreen.hideAsync()` is never called, and the native splash (backgroundColor `#09090b` = black) stays frozen.

**Fix:** Wrap the early return in its own `<SafeAreaProvider>`.

**Why:** react-native-safe-area-context v5.x made the provider requirement stricter than v4.x.

## Root Cause 2: `reactCompiler: true` in app.json experiments

The React Compiler is experimental. In production EAS builds it can incorrectly memoise the `useFonts` hook callbacks, preventing `fontsLoaded` from ever flipping to `true`. This keeps `appReady = false` forever.

**Fix:** Removed `"reactCompiler": true` from `app.json` experiments. Only `typedRoutes` remains.

**How to apply:** Never re-add `reactCompiler: true` to production builds. If the React Compiler is needed for a specific test, add a `"channel": "development"` override in eas.json only.

## Root Cause 3: `loadBootPreferences()` missing `.catch()`

```js
loadBootPreferences().then(setBootPrefs); // no .catch()
```
If the call rejects for any unexpected reason, `bootPrefs` stays `null` permanently, keeping `appReady = false`.

**Fix:** Added `.catch(() => setBootPrefs(safeDefaults))`.

## Additional defensive fix: font loading timeout

Added a 5-second `fontTimedOut` state that forces `appReady = true` if fonts haven't loaded after the deadline. In production, bundled fonts load in <1 s; the timeout is a pure safety valve.

```js
const appReady = (fontsLoaded || !!fontError || fontTimedOut) && bootPrefs !== null;
```

---

## Root Cause 4: `expo-glass-effect` auto-linked native module (iOS <26 crash)

`expo-glass-effect: ~0.1.4` was in `package.json` but never imported anywhere. Expo's auto-linking still compiles and registers the native module at startup. The module uses iOS 26 `UIViewEffect` APIs, which do not exist on iOS <26 — causing an immediate native crash on launch.

**Fix:** Remove `expo-glass-effect` from package.json entirely.

**Why:** Auto-linked native modules run at startup regardless of JS imports. Any package targeting iOS 26-only APIs will crash every device running iOS 25 or earlier.

**How to apply:** Never add packages that wrap iOS-version-specific APIs (especially `UIViewEffect`, `UIGlassEffect`) without confirming all TestFlight/production devices meet the OS floor. Check `expo doctor` and `npx expo install --check` regularly.

## Root Cause 5: `react-native-keyboard-controller` + iOS 26 keyboard geometry change

`KeyboardProvider` from `react-native-keyboard-controller: 1.18.5` wrapped the entire app in `_layout.tsx`. iOS 26 changed the native keyboard frame geometry in a way that caused a native crash inside this library's frame observer.

**Fix:** Removed `react-native-keyboard-controller` from `package.json`, removed `KeyboardProvider` from `_layout.tsx`, replaced `KeyboardAwareScrollView` in `KeyboardAwareScrollViewCompat.tsx` with a plain React Native `ScrollView`.

**Why:** The nutrition screen's keyboard avoid logic already uses the standard RN `Keyboard` API — not the library — so removal has zero functional impact.

## Root Cause 6: `react-native-worklets` unused auto-linked module

`react-native-worklets: 0.5.1` was in `package.json` but never imported. Auto-linked at native load time, adding startup overhead and potential native conflicts.

**Fix:** Removed from `package.json`.

---

**Important:** All three causes in Root Causes 4–6 require a new **native build** to take effect. Code-push / OTA updates do NOT fix native-layer crashes. A full `eas build --platform all --profile production` is required after these changes.
