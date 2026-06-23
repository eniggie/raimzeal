---
name: Expo Web Duplicate-React Fix (pnpm monorepo)
description: Metro + pnpm symlinks cause "Invalid hook call" white-screen crash on the Expo web preview — two-line metro.config.js fix.
---

# Rule
In a pnpm monorepo, Metro sees separate module-cache entries for the same physical React file when it arrives via different symlink paths. This causes React's dispatcher to be null when a second copy initialises, producing:

> TypeError: Cannot read properties of null (reading 'useState') at RootLayout

Two additions to `metro.config.js` together fix it:

1. **`config.resolver.unstable_enableSymlinks = true;`**  
   Tells Metro to follow symlinks to their physical target before caching, so both symlinks that point to the same pnpm-store file become ONE module instance.

2. **`config.resolver.resolveRequest` pin for React**  
   Overrides resolution of `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, and `react-dom/client` to always resolve from the workspace root via `require.resolve(name, { paths: [workspaceRoot] })`. Ensures any package that imports React from a deeply-nested path still gets the same instance.

**Why:** pnpm uses content-addressed symlinks; Metro caches by resolved path, not inode. Without symlink following, two symlink paths → two module instances → broken dispatcher.

**How to apply:** Any time the Expo web preview shows a white screen with "Invalid hook call" / "Cannot read properties of null (reading 'useState')", check `metro.config.js` for these two settings first.

## Companion native-package web stubs (same crash pattern)
Native-only packages imported at module level also create a competing React instance on web:
- **RevenueCat** (`react-native-purchases`): create `lib/revenuecat.web.ts` that exports stub no-ops; Metro's platform-extension resolution picks it over the native version on web.
- **expo-av**: create `lib/audio-compat.ts` (re-exports expo-av Audio for native) + `lib/audio-compat.web.ts` (stub with no-op methods); update all imports to use `@/lib/audio-compat`.
