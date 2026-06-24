---
name: pnpm root install recovery
description: pnpm install at root level gets killed by Replit resource limits; recovery steps and why postinstall stub exists.
---

# Rule
`pnpm install` at workspace root **without flags** gets killed by Replit resource limits (exit -1, no output). Never use `CI=true pnpm install`.

**Recovery when node_modules symlinks are corrupted:**
```bash
pnpm install --prefer-offline --force --ignore-scripts
```
This uses the cached pnpm store (no downloads), forces re-linking of all virtual node_modules, and skips post-install scripts (which are the resource-intensive part). Usually completes in ~90s.

After recovery, run once more without `--ignore-scripts` to trigger the `postinstall` script that recreates the worklets stub:
```bash
pnpm install --prefer-offline
```

**Why:** A `public-hoist-pattern` change in `.npmrc` + interrupted install deletes all `.pnpm/*/node_modules/` symlinks but never recreates them. pnpm's `.modules.yaml` then claims "Already up to date" on subsequent installs, skipping the broken symlinks. `--force` overrides this.

# The worklets postinstall stub

Root `package.json` has a `postinstall` script: `node scripts/create-worklets-stub.mjs`

This creates `node_modules/react-native-worklets/plugin/index.js` returning `{ visitor: {} }`. It is a **Babel-plugin-only stub** — no native module. It is NOT in any package's `dependencies` or `devDependencies`.

**Why it exists:** `react-native-reanimated@4.x` does `require('react-native-worklets/plugin')` in its Babel plugin. In the Replit pnpm monorepo, `react-native-worklets` is not hoisted (peer dep of reanimated) so the require fails. The stub satisfies the Babel transform step without adding a native module.

**Do NOT add `react-native-worklets` to any package.json as a direct dep.** See Root Cause 6 in `testflight-black-screen.md` — doing so causes a double native-registration crash in TestFlight builds.

**How to apply:** After any `pnpm install --ignore-scripts`, run `node scripts/create-worklets-stub.mjs` manually to recreate the stub, since `--ignore-scripts` skips postinstall.
