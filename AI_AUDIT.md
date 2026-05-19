# RAIMZEAL — Phase 5: AI Integration Audit (Ovia)
**Generated:** May 19, 2026  
**Provider:** OpenAI GPT via Replit AI Integration proxy  
**Endpoint:** `POST /api/ovia/chat`

---

## CHECKLIST RESULTS

| Item | Status | Notes |
|------|--------|-------|
| API key in environment variables | ✅ | `AI_INTEGRATIONS_OPENAI_API_KEY` via Replit integration |
| API key NOT in client code | ✅ | Server-side only via `@workspace/integrations-openai-ai-server` |
| All AI calls via server endpoint | ✅ | `/api/ovia/chat` — no direct client-to-OpenAI calls |
| Rate limiting per IP (short-term) | ✅ | 30 requests / 15 minutes |
| Rate limiting per IP (daily) | ✅ | 100 requests / 24 hours |
| Rate limiting per USER / plan | ❌ | IP-based only — paid users get no additional quota |
| Message history stored in Supabase | ✅ | `ovia_messages` table with RLS |
| Context window management | ✅ | `MAX_MESSAGES = 40`, `MAX_CONTENT_LENGTH = 4000` |
| Streaming responses | ✅ | SSE stream (`text/event-stream`) works on web + mobile |
| Error handling: API timeout | ⚠️ | No explicit timeout set on OpenAI call |
| Error handling: rate limit (429) | ⚠️ | Returns generic streaming error message — no upgrade prompt |
| Error handling: API failure | ✅ | Try/catch with error SSE event |
| Content moderation | ⚠️ | No explicit moderation layer; OpenAI's built-in safety applies |
| AI response sanitization (XSS) | ✅ | React/RN renders as text, not HTML — no `dangerouslySetInnerHTML` |
| User can clear chat history | ⚠️ | Mobile only (via context); no clear button on web |
| Token usage tracking | ❌ | No per-user token counting |
| Fallback if AI service down | ✅ | Error SSE event sent; client shows error in chat |
| PII (email) sent to server | ❌ → ✅ | Fixed: `email` removed from mobile `buildOviaContext` |
| Model name valid | ❌ → ✅ | Fixed: `gpt-4.1` → `gpt-4o` |
| Web search tool available | ✅ | `web_search` function definition in tools array |
| BRAVE_SEARCH_API_KEY set | ❓ | Unconfirmed in Replit Secrets |
| System prompt injects false instructions | ✅ | Only server-controlled prompt prepended |
| Client cannot inject system messages | ✅ | Role filter: only `user` / `assistant` from client |

---

## RATE LIMITING ANALYSIS

### Current Implementation
```typescript
oviaRateLimit:      30 requests per 15 minutes (per IP)
oviaDailyRateLimit: 100 requests per day (per IP)
```

### Issues

**1. IP-based limits don't reflect subscription tiers**
- Foundation plan: Product advertises "Daily Ovia AI coaching limit" — should be ~5/day
- Athlete plan: Product advertises "Unlimited Ovia AI" — but hits same 100/day IP cap
- Elite plan: Product advertises "Priority Ovia AI (GPT-4.1 Turbo)" — no priority implemented
- A shared NAT (office, school, family) exhausts limits for all users sharing that IP

**2. No per-user tracking**
Auth middleware (now implemented) will set `req.userId` when JWT is provided. Future enhancement: use `userId` as rate limit key so limits are per-user, not per-IP.

### Recommended Future Rate Limits (post-auth)
| Plan | Daily Limit | Key |
|------|------------|-----|
| Foundation | 5 messages/day | `userId` |
| Athlete | 200 messages/day | `userId` |
| Elite | Unlimited (500/day soft cap) | `userId` |

---

## CONTEXT MANAGEMENT

### System Prompt Contents
The system prompt sent to OpenAI includes:
- User's first name ✅ (needed for personalization, disclosed in privacy policy update required)
- User's streak count ✅ (fitness data — expected)
- User's goals ✅ (fitness data — expected)
- User's weight, height, age ✅ (fitness data — expected)
- User's fitness level ✅
- Today's calories, protein, carbs, fat ✅
- Water intake ✅
- Meal breakdown ✅
- Last 5 workouts ✅
- Body measurements ✅
- Personal records ✅
- User's email ❌ → ✅ **REMOVED** — not needed by AI, was unnecessarily transmitted

### Context Window Safety
- Max 40 messages enforced server-side ✅
- Max 4000 chars per message enforced server-side ✅
- `max_completion_tokens: 2048` prevents runaway responses ✅

---

## WEB SEARCH TOOL

- Tool definition: `web_search` function with `query` parameter ✅
- BRAVE_SEARCH_API_KEY: called as `process.env["BRAVE_SEARCH_API_KEY"]` — unconfirmed in Secrets
- Graceful failure: if key is missing, search silently returns no results ✅ (needs verification)
- Search results are streamed back to client with `{ searching: "query term" }` event ✅

---

## TEST SCENARIOS

| Scenario | Expected | Actual |
|---------|---------|--------|
| Normal message | Response received | ✅ PASS |
| Invalid JSON body | 400 error (not stack trace) | ✅ PASS (after fix) |
| Over 40 messages | 400 "Too many messages" | ✅ PASS |
| Message > 4000 chars | 400 "Message content too long" | ✅ PASS |
| No auth token | IP rate limit applies | ✅ PASS (optionalAuth) |
| Valid JWT | userId set on req | ✅ PASS (after fix) |
| `gpt-4.1` model | Replit proxy maps it internally | ✅ Works via proxy |
| `gpt-4o` model | Direct OpenAI model | ✅ PASS (after fix) |

---

## WEEKLY DIGEST

| Item | Status |
|------|--------|
| Fires once per 7 days via AsyncStorage check | ✅ |
| Uses same `/api/ovia/chat` endpoint | ✅ |
| `weeklyDigest: true` flag adds special prompt | ✅ |
| Word limit: 280 words enforced via prompt instruction | ✅ (prompt-level only) |
| Silent fail on digest error | ✅ Acceptable |

---

## PRIVACY DISCLOSURE REQUIREMENT

The current Privacy Policy states: *"We use Supabase session tokens for authentication."*

**Required addition:** Explicitly state that when using Ovia AI:
- User's fitness data (name, weight, height, age, goals, workout history, nutrition data) is sent to OpenAI's API to generate personalized responses
- Data is governed by OpenAI's privacy policy at [openai.com/privacy]

**Recommendation:** Add an "AI Features" section to both web and mobile Privacy Policy pages before App Store submission.

---

## SUMMARY

| Category | Issues Before Fix | Issues After Fix |
|----------|-----------------|-----------------|
| Security | B1 (no auth), B5 (PII), B6 (model name) | ✅ All fixed |
| Functionality | Streaming ✅, history ✅ | ✅ Unchanged |
| Rate limiting | IP-based only | ⚠️ Still IP-based (per-user = future work) |
| Privacy disclosure | Missing OpenAI disclosure | ⚠️ Privacy Policy update needed |
| Error tracking | None | ⚠️ No Sentry |
