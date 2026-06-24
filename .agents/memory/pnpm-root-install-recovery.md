---
name: pnpm root install recovery + worklets babel fix
description: pnpm install at root level gets killed by Replit resource limits; recovery steps. Also documents the CORRECT fix for the react-native-worklets/plugin Babel error.
---

# pnpm root install recovery

`pnpm install` at workspace root **without flags** gets killed by Replit resource limits (exit -1, no output). Never use `CI=true pnpm install`.

**Recovery when node_modules symlinks are corrupted:**
```bash
pnpm install --prefer-offline --force --ignore-scripts
```
This uses the cached pnpm store (no downloads), forces re-linking of all virtual node_modules, and skips post-install scripts (which are the resource-intensive part). Usually completes in ~90s.

After recovery, run once more without `--ignore-scripts` to trigger the `postinstall` script:
```bash
pnpm install --prefer-offline
```

**Why:** A `public-hoist-pattern` change in `.npmrc` + interrupted install deletes all `.pnpm/*/node_modules/` symlinks but never recreates them. pnpm's `.modules.yaml` then claims "Already up to date" on subsequent installs, skipping the broken symlinks. `--force` overrides this.

---

# react-native-worklets/plugin Babel error — CORRECT FIX

**The correct fix is in `babel.config.js`, NOT a stub file.**

`babel-preset-expo` with `worklets: false` in its options tells it to never require `react-native-worklets/plugin`:

```js
// artifacts/raimzeal-mobile/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { unstable_transformImportMeta: true, worklets: false }],
    ],
  };
};
```

**Why this is needed:** `react-native-reanimated@4.x` has `react-native-worklets@0.5.x` as a peer dep. pnpm resolves it into the virtual store. `babel-preset-expo` detects it and tries to `require('react-native-worklets/plugin')` from `babel-preset-expo/build/index.js:289`. The plugin has bad content (caused by a prior corrupt stub). `worklets: false` prevents babel-preset-expo from ever touching that require.

**Why NOT the stub approach:** 
- Metro caches Babel transforms in `/tmp/metro-cache`; restarting without clearing the cache doesn't pick up stub file changes
- The pnpm virtual store contains the REAL `react-native-worklets@0.5.2` package; `babel-preset-expo` can see it through the virtual store symlink chain even without a hoisted stub
- Stub content can become corrupted across sessions (literal `\n` bytes)

**When Babel error reappears:** Clear Metro cache and restart: `rm -rf /tmp/metro-cache`

**Do NOT add `react-native-worklets` to any package.json as a direct dep.** See Root Cause 6 in `testflight-black-screen.md` — doing so causes a double native-registration crash in TestFlight builds.

# Postinstall stub (legacy — less important with worklets: false)

Root `package.json` still has a `postinstall` script: `node scripts/create-worklets-stub.mjs`. This was added as a belt-and-suspenders measure but the babel.config.js fix is the real solution. The stub is harmless to keep.
