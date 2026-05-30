---
name: OSA MODE
description: Advanced production QA and bug-fix convention for RAIMZEAL — one confirmed fix at a time, multi-model, never skip, never lie.
---

## What is OSA MODE?

OSA MODE is RAIMZEAL's standing convention for running a full end-to-end production QA and surgical bug-fix pass. It replaces and supersedes what was previously called "DEBUGGER mode." The name OSA MODE must be used in all project docs, commit messages, memory files, and future sessions — never revert to "DEBUGGER."

## Core Principles (non-negotiable)

1. **One bug at a time.** Find one confirmed bug → fix it → verify it is gone → only then move to the next. Never batch fixes across unconfirmed issues.
2. **Confirm before you move.** Every fix must be validated (typecheck + screenshot or log check) before the next bug is opened. If the fix fails, retry on the same bug — do not skip.
3. **Never lie, never skip.** If a bug cannot be reproduced, say so explicitly. If a fix did not work, admit it and try a different approach. Never mark a bug as fixed unless the verification step passed.
4. **No rewrites.** Surgical edits only. Preserve existing structure.
5. **No feature removal.** Removing code to "solve" a bug is not acceptable unless the removed code was itself the bug.
6. **No schema changes without explanation.** Any DB migration must be described to the user with impact analysis before execution.
7. **Fix confirmed issues only.** Suspected bugs require a reproduction path or code-path analysis before a fix is applied.
8. **Run all four permanent checks after every fix:**
   - `typecheck-api` — `pnpm --filter @workspace/api-server run typecheck`
   - `typecheck-mobile` — `pnpm --filter @workspace/raimzeal-mobile run typecheck`
   - `typecheck-web` — `pnpm --filter @workspace/raimzeal run typecheck`
   - `healthcheck` — `curl -sf http://localhost:80/api/healthz`
9. **Screenshot key pages after each batch.** Visual confirmation is required for UI bugs.

## Intelligence & Tools

OSA MODE always uses the most capable available AI intelligence at the time:
- **Claude** (Anthropic) — primary reasoning, code analysis, and code generation
- **OpenAI GPT-4o / GPT-4.1** — second-opinion analysis, code review subagent, exploration
- **Replit agent modes** — explore subagent for codebase-wide analysis, code_review subagent for architecture review, delegation subagent for parallel workstreams
- When a bug is ambiguous or multi-layered, spawn an explore subagent for deep analysis before applying any fix
- Use multiple models in parallel for independent subtasks (e.g., mobile vs. web vs. API bugs)

## OSA MODE Session Flow

```
1. SCAN     — Take screenshots of all major flows; read recent logs; check all typechecks.
2. LIST     — Enumerate every visible issue. Separate "confirmed" from "suspected."
3. PRIORITIZE — Order bugs: auth/data-loss > UX breakage > visual glitches > dead code.
4. FIX LOOP (per confirmed bug):
     a. State the bug clearly (file, line, root cause).
     b. Apply the minimal fix.
     c. Run relevant typecheck(s).
     d. Screenshot or log-verify the fix.
     e. Mark as FIXED only if verification passed.
     f. Move to next bug.
5. REPORT   — Produce a final table: bug / fix / verification status.
6. MEMORY   — Update .agents/memory/ with any new durable lessons.
```

## OSA MODE Audit Checklist (25 flows)

| # | Flow | Check |
|---|------|-------|
| 1 | Onboarding | Renders, CTA works |
| 2 | Signup | Form submits, redirects to verify-email |
| 3 | Email verify | "Check inbox" page renders, resend works |
| 4 | Auth callback | Exchanges code, routes SIGNED_IN→/ and PASSWORD_RECOVERY→/reset-password |
| 5 | Login | signInWithPassword works, wrong-password error shown |
| 6 | Forgot password | resetPasswordForEmail sends email, redirectTo=/auth/callback |
| 7 | Reset password | PASSWORD_RECOVERY event detected, new password saved |
| 8 | OAuth setup | Profile form saves fitness data, routes to app |
| 9 | Home/Dashboard | Macros, calories, hydration ring render |
| 10 | Food search | Results load, log button works |
| 11 | Quick-add foods | Card shows correct macros, serving toggle persists |
| 12 | Barcode scanner | Camera opens, food auto-populated |
| 13 | Meal log | Entry saved, totals update |
| 14 | Workout log | Set/rep entry saved, streak updates |
| 15 | Hydration | Log intake, ring animates |
| 16 | Progress photos | Upload, view gallery |
| 17 | Body measurements | Save weight/height, history chart |
| 18 | Ovia AI chat | SSE stream renders, quota counter updates |
| 19 | Ovia workout plan | Plan generated and displayed |
| 20 | Ovia meal plan | Plan generated and displayed |
| 21 | Community feed | Posts load, like/comment work |
| 22 | Community post | Image upload URL generated, post saved |
| 23 | Settings/Profile | Avatar upload, name save, phone verify |
| 24 | Enrolled program | Phase display correct, workout check-off works |
| 25 | Logout | Session cleared, redirected to Onboarding |

**Why OSA MODE exists:** Dr. Ephraim Oviawe established OSA MODE as a discipline to prevent regressions from sweeping AI changes. "One bug at a time, confirmed fix only" keeps RAIMZEAL stable across rapid iteration cycles.
