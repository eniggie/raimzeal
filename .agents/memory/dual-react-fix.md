---
name: Dual React instance fix (pnpm + Vite)
description: How to fix "null is not an object (evaluating resolveDispatcher().useRef)" caused by two React versions in pnpm workspace
---

## Rule
When pnpm catalog pins react to version X but `node_modules/react` resolves to version Y, any package (e.g. @radix-ui) using the catalog version gets its own React instance. Vite bundles them as separate chunks → dispatcher is null → hooks crash on mobile Safari.

**Fix — three layers:**
1. `pnpm-workspace.yaml` catalog: bump `react`/`react-dom` to match the hoisted version (19.2.0).
2. `pnpm-workspace.yaml` overrides: add `react: 19.2.0` and `react-dom: 19.2.0` to force ALL transitive deps to the same instance.
3. `vite.config.ts`: add `optimizeDeps.dedupe` + `optimizeDeps.include` for `react`, `react-dom`, `react/jsx-runtime` (belt-and-suspenders — `resolve.dedupe` alone doesn't cover Vite's pre-bundler).
4. Run `pnpm install --no-frozen-lockfile` to reconcile lockfile, then restart web workflow.

**Why:** `resolve.dedupe` only affects Vite's module resolution during build/SSR; Vite's `optimizeDeps` pre-bundles deps independently and can pull in a second React. The pnpm override is the root fix; Vite dedupe is defense-in-depth.

**How to apply:** Any time you see `resolveDispatcher` null errors or `Cannot read properties of null (reading 'useRef/useState/useEffect')` in the web app, check for pnpm dual-React first.
