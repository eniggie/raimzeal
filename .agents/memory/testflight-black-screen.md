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

## Root Cause 6: `react-native-worklets` explicit direct dependency (double-registration crash)

**RECURRING PATTERN — do NOT re-add react-native-worklets to package.json as a direct dependency.**

`react-native-worklets` was added to `devDependencies` to fix Metro bundler errors during the Replit web deploy (reanimated@4.x has it as a peer dep). When explicitly listed, Expo auto-links it as a standalone native module. But `react-native-reanimated` ALREADY handles worklets native-linking internally — adding worklets explicitly causes the module to register twice at native startup, crashing the app immediately (splash screen only, app exits instantly).

**Fix:** Remove `react-native-worklets` from `package.json` entirely.

**Why:** Reanimated v4.x manages its own worklets integration. The peer-dep warning from pnpm is a false alarm — the native worklets bridge is registered through reanimated's own auto-link, not a separate one. Two registrations = crash.

**How to apply:**
- Never re-add `react-native-worklets` to `dependencies` or `devDependencies`.
- If a web deploy fails with "Cannot find module 'react-native-worklets/plugin'", fix it via Metro resolver or pnpm overrides — NOT by adding worklets as a direct dep.
- A full new native EAS build is required after removing it; OTA/code-push will NOT fix native-layer crashes.

## Root Cause 7: `"autoSubmit": true` in eas.json build profile (EAS CLI 20.x rejects it)

`eas.json` production profile had `"autoSubmit": true`. EAS CLI 20.x no longer accepts this property in build profiles, causing ALL eas commands (including `eas build`) to fail with schema validation errors.

**Fix:** Removed `"autoSubmit": true` from `build.production` in `eas.json`. Use `--auto-submit` CLI flag instead:
```bash
eas build --platform ios --profile production --non-interactive --auto-submit
```

**Why:** `autoSubmit` was deprecated from the build profile schema in EAS CLI v20. The `submit.production` config block is still valid and used by `--auto-submit`.

---

## Root Cause 8: `react@19.2.0` vs `react-native-renderer@19.1.0` strict equality crash

React 19.2.0 added a runtime strict equality check: `react` version must exactly match the `react-native-renderer` version bundled inside react-native. `react-native 0.81.5` bundles renderer@19.1.0. Using `react@19.2.0` → immediate crash on any screen using gesture-handler or reanimated.

**Fix:** Pin mobile `package.json` to `react: "19.1.0"` and `react-dom: "19.1.0"` explicitly. Remove `react` and `react-dom` from the pnpm-workspace.yaml `overrides` section — the global override was forcing 19.2.0 onto all workspace packages including mobile. Web can keep 19.2.0 (no renderer version constraint).

**Why:** pnpm `overrides` is workspace-global and cannot be scoped per-package. Must remove the react override and use explicit per-package pins instead.

## Root Cause 9: `newArchEnabled: false` kills reanimated@4.x (JSI disabled)

`react-native-reanimated@4.x` requires New Architecture (JSI worklets). Setting `newArchEnabled: false` disables the JSI bridge at native startup → `executeOnUIRuntimeSync is not a function` → reanimated crashes on every animated screen.

**Fix:** Keep `newArchEnabled: true`. Never set it to `false` while reanimated@4.x is a dependency.

**Why:** reanimated@4 dropped bridge/legacy architecture support entirely. Any codebase on reanimated@4.x MUST run New Architecture.

---

**Important:** Root Causes 4–9 require a new **native build** to take effect. Code-push / OTA updates do NOT fix native-layer crashes. A full `eas build --platform ios --profile production` is required after these changes.
