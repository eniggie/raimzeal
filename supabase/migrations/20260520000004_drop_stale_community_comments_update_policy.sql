-- Migration: 20260520000004_drop_stale_community_comments_update_policy
-- Purpose: Remove the legacy UPDATE policy on community_comments that was
-- created by the old mobile migration (006_community_rls.sql).
--
-- Context:
--   The mobile-local migration 006_community_rls.sql created:
--     "community_comments_update_own" — allows authenticated users to UPDATE
--     rows they own in community_comments.
--   Comments in RAIMZEAL are intentionally immutable once posted (no edit UI).
--   Allowing any UPDATE path on community_comments is therefore unnecessary and
--   widens the attack surface. Migration 20260520000002 deliberately did not
--   create an UPDATE policy for comments; this migration cleans up the stale one.
--
-- The SECURITY DEFINER trigger trg_comments_count continues to maintain
-- comments_count atomically and is unaffected (triggers bypass RLS entirely).

DROP POLICY IF EXISTS "community_comments_update_own" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments update own"  ON public.community_comments;
DROP POLICY IF EXISTS "Community comments — update own" ON public.community_comments;

-- Revoke UPDATE from both roles as an explicit belt-and-suspenders guarantee.
-- Migration 20260520000003 already revoked this; repeating here is idempotent.
REVOKE UPDATE ON public.community_comments FROM anon, authenticated;
