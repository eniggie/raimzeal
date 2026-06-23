---
name: TestFlight Black Screen Causes
description: Three confirmed root causes of a pure black screen on TestFlight (iOS production build); fixes applied June 2026.
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
