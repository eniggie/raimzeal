# RAIMZEAL — Phase 3: Database Audit
**Generated:** May 19, 2026  
**Databases:** Supabase (PostgreSQL — user data) + Replit-managed PostgreSQL via Drizzle ORM (billing data)

---

## SUPABASE TABLES

### Table Inventory

| Table | Migration File | RLS Enabled | Policies | Cascade Delete |
|-------|--------------|-------------|---------|---------------|
| `profiles` | 001_initial_schema.sql | ✅ (Migration 005) | 4 (select/insert/update/delete own) | ❌ Via trigger in 007 |
| `workout_logs` | 001 | ✅ (005) | 4 own-only | ❌ Via trigger in 007 |
| `meal_logs` | 001 | ✅ (005) | 4 own-only | ❌ Via trigger in 007 |
| `body_measurements` | 001 | ✅ (005) | 4 own-only | ❌ Via trigger in 007 |
| `water_intake` | 001 | ✅ (005) | 4 own-only | ❌ Via trigger in 007 |
| `ovia_messages` | 004_ovia_messages.sql | ✅ (In 004) | Policies in 004 | ✅ `REFERENCES auth.users ON DELETE CASCADE` |
| `community_posts` | Unknown | ❌ **NO RLS** | **None** | ❌ Via trigger in 007 |
| `community_comments` | Unknown | ❌ **NO RLS** | **None** | ❌ Via trigger in 007 |
| `community_likes` | Unknown | ❌ **NO RLS** | **None** | ❌ Via trigger in 007 |
| `programs` | Unknown | ❓ Unknown | Unknown | N/A (no user FK) |

### RLS Status Detail

#### ✅ Migrations 001–005 Tables (profiles, workout_logs, meal_logs, body_measurements, water_intake, ovia_messages)
- RLS enabled via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ✅
- Users can only read/write/delete their own rows ✅
- Service role bypasses RLS (server-side use only) ✅
- `anon` key restricted by RLS for all user data tables ✅
- **Status:** Policies written but NOT YET RUN in Supabase SQL Editor

#### ❌ Community Tables (community_posts, community_comments, community_likes)
- **NO RLS policies defined in any migration file**
- Any authenticated user can read, write, update, delete any other user's posts/comments/likes
- **Fix:** Migration 006 (`006_community_rls.sql`) — written, pending run in Supabase

---

## DRIZZLE ORM / REPLIT POSTGRES TABLES

### Table Inventory

| Table | Schema File | Purpose | Used By |
|-------|-----------|---------|---------|
| `users` | `lib/db/src/schema/users.ts` | Billing: Stripe customer/subscription IDs, tier | Stripe routes |
| `digest_subscribers` | `lib/db/src/schema/emails.ts` | Weekly digest subscriptions | Email routes |
| `community_posts` | `lib/db/src/schema/community.ts` | Community posts (Drizzle schema) | Community routes (unused?) |
| `community_comments` | `lib/db/src/schema/community.ts` | Community comments | Community routes |
| `community_likes` | `lib/db/src/schema/community.ts` | Community likes | Community routes |
| `conversations` | `lib/db/src/schema/messages.ts` | Chat conversations | Messages |
| `messages` | `lib/db/src/schema/messages.ts` | Chat messages | Messages |

### Cascade Relationships (Drizzle ORM)

| FK | References | On Delete |
|----|-----------|----------|
| `community_comments.post_id` | `community_posts.id` | ✅ CASCADE |
| `community_likes.post_id` | `community_posts.id` | ✅ CASCADE |
| `messages.conversation_id` | `conversations.id` | ✅ CASCADE |

### Missing Relationships

| Issue | Risk |
|-------|------|
| `users` table (Drizzle) has no FK to Supabase `auth.users` | Stripe billing data cannot be auto-cleaned when Supabase user is deleted |
| No cascade from `users.id` → community/Supabase data | Orphaned billing data on account deletion |

---

## INDEXES

### Present Indexes
```sql
-- ovia_messages (Migration 004)
CREATE INDEX IF NOT EXISTS ovia_messages_user_id_timestamp_idx
  ON ovia_messages (user_id, timestamp ASC);
```

### Missing Indexes — HIGH PRIORITY

| Table | Column | Query Pattern | Impact |
|-------|--------|--------------|--------|
| `workout_logs` | `user_id` | Every user-facing read | Full table scan |
| `meal_logs` | `user_id` | Every nutrition query | Full table scan |
| `body_measurements` | `user_id` | Every measurement query | Full table scan |
| `water_intake` | `user_id` | Every water tracking query | Full table scan |
| `community_posts` | `user_id` | Profile page queries | Full table scan |
| `community_posts` | `created_at` | Feed ordering | Full table scan |
| `community_comments` | `post_id` | Per-post comment loading | Full table scan |
| `community_likes` | `post_id` | Per-post like counting | Full table scan |
| `profiles` | `id` | Primary key — auto-indexed ✅ | N/A |

---

## SECURITY TESTS

### Test Results

| Test | Expected | Actual | Status |
|------|---------|--------|--------|
| Anonymous read of `profiles` | BLOCKED by RLS | BLOCKED ✅ (if 005 applied) | ⚠️ Pending |
| User A reads User B `workout_logs` | BLOCKED | BLOCKED ✅ (if 005 applied) | ⚠️ Pending |
| Anonymous read `community_posts` | Should be ALLOWED | ALLOWED (no RLS) | ❌ Issue |
| User A deletes User B post | BLOCKED | **ALLOWED — NO RLS** | ❌ FAIL |
| Delete auth user → health data gone | Cascade removes data | **Orphaned data remains** | ❌ FAIL |
| Drizzle parameterized queries | No SQL injection | ✅ SQL injection test returned 500 error (not injected) | ✅ PASS |

### Notes on Test Limitations
- Cannot run cross-user RLS tests without two Supabase test accounts provisioned
- Migration 005 (RLS) must be confirmed as applied in production Supabase dashboard
- Migration 006 (community RLS) + 007 (cascade delete) have been written and are ready to apply

---

## CRITICAL ACTIONS REQUIRED (must be done manually in Supabase SQL Editor)

### 1. Apply Migration 005 (if not already applied)
File: `artifacts/raimzeal-mobile/supabase/migrations/005_rls_policies.sql`
Run the entire file in Supabase SQL Editor → SQL Editor tab.

### 2. Apply Migration 006 — Community RLS
File: `artifacts/raimzeal-mobile/supabase/migrations/006_community_rls.sql`
This enables RLS on community_posts, community_comments, community_likes and sets ownership-based write policies.

### 3. Apply Migration 007 — Cascade Delete
File: `artifacts/raimzeal-mobile/supabase/migrations/007_cascade_delete.sql`
Creates a `handle_user_delete()` trigger that fires BEFORE DELETE on `auth.users` and removes all user data from all public tables.

### 4. Add Missing Indexes
Run in Supabase SQL Editor:
```sql
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id      ON workout_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_id          ON meal_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id  ON body_measurements (user_id);
CREATE INDEX IF NOT EXISTS idx_water_intake_user_id       ON water_intake (user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_user_id    ON community_posts (user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON community_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_post_id    ON community_likes (post_id);
```

---

## BACKUP & CONNECTION POOLING

| Item | Status | Notes |
|------|--------|-------|
| Supabase backups | ✅ Automatic on Pro plan | Verify in dashboard |
| Connection pooling | ✅ Supabase Pooler (PgBouncer) | Configure via Supabase connection settings |
| Drizzle connection pooling | ❓ Unknown | Uses Replit-managed DB — check POOL_MAX in `lib/db/src/db.ts` |

---

## SUMMARY

| Category | Status |
|----------|--------|
| profiles/workout/meal/body/water RLS | ✅ Written (005) — needs apply |
| community RLS | ❌ → ✅ Written (006) — needs apply |
| cascade delete | ❌ → ✅ Written (007) — needs apply |
| SQL injection prevention | ✅ Drizzle parameterized |
| Missing user_id indexes | ❌ Not created — manual action required |
| Drizzle `users` table | ✅ Present |
| Stripe billing data cascade | ⚠️ No FK link to Supabase auth.users |
