---
name: Phase 2 Audit Results
description: June 6 2026 full OSA MODE audit findings — what was real, what was false positive, what was fixed
---

## What was scanned
- All three typechecks (web, mobile, API)
- `pnpm audit` (npm CVEs)
- `runDependencyAudit()`, `runSastScan()`, `runHoundDogScan()` security scanners
- Manual explore-subagent review of api-server, mobile app, and web app

## Key findings

### False positives to ignore on future scans
- Semgrep "generic-api-key" on `@raimzeal_*` AsyncStorage key strings — these are storage namespaces, not credentials
- Semgrep "generic-api-key" on `.replit` STRIPE_WEBHOOK_SECRET line — this is Replit secrets management binding
- Semgrep "tainted SQL string" in `ovia.ts` for LLM prompt construction — the scanner misidentifies template literals sent to OpenAI as SQL; no actual SQL involved
- Semgrep "insecure WebSocket" in ffmpeg-core.js — vendored WASM binary in video artifact, not our code
- `runDependencyAudit()` reported "7 high" — `pnpm audit` shows zero CVEs; the scanner's dep results are unreliable for this project

### Real issues fixed
1. `artifacts/api-server/src/storage.ts` — dead scaffold boilerplate (`MemStorage`), zero imports, deleted
2. `artifacts/api-server/src/middlewares/` — empty directory (only `.gitkeep`), deleted
3. `artifacts/raimzeal-mobile/app/(tabs)/index.tsx` — last file with hardcoded `STRIPE_DONATION_URL`; converted to import from `@/lib/constants`

### Confirmed clean
- Zero npm CVEs (`pnpm audit` is authoritative)
- Zero TypeScript errors across all three packages
- No console.log in server route handlers (validateEnv.ts startup use is acceptable)
- All SAST HIGH findings were false positives — no real security bugs found

**Why:** Future audit sessions should skip re-investigating the false-positive patterns listed above; they are known non-issues in this codebase.
