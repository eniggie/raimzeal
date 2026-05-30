---
name: DEBUGGER mode
description: Convention for full production QA passes on RAIMZEAL — rules and checklist structure.
---

## Rule
DEBUGGER is the project's name for a full end-to-end QA and bug-fix pass. It is a standing convention that should be instated in all RAIMZEAL project docs and referenced in future sessions.

## DEBUGGER rules (non-negotiable)
1. No full rewrites — surgical fixes only.
2. No feature removal.
3. No schema changes without explicit explanation.
4. Fix only **confirmed** bugs (reproduction path or code-path analysis required).
5. Test (typecheck + screenshot) after every fix batch.
6. Run all four permanent checks (typecheck-api, typecheck-mobile, typecheck-web, healthcheck) before marking a DEBUGGER session complete.

**Why:** Dr. Oviawe established DEBUGGER as a discipline to prevent regressions introduced by sweeping AI changes. "Fix confirmed issues only" keeps the app stable across rapid iteration cycles.

**How to apply:** When a new session starts and the user says "DEBUGGER" or "run DEBUGGER", load this file and follow the rules above. Enumerate all 25+ flows, screenshot each one, log confirmed vs. suspected bugs, then fix confirmed only.
