-- Migration: 20260520000003_community_column_security
-- Purpose: Lock down column-level UPDATE privileges on all three community tables.
--
-- Prior state (vulnerability):
--   Both `anon` and `authenticated` had table-level UPDATE on community_posts,
--   community_comments, and community_likes, exposing every column including
--   likes_count, comments_count, user_id, user_name, id, created_at.
--   A post owner could PATCH their own likes_count to any arbitrary value.
--   An authenticated user with a captured JWT could attempt to UPDATE
--   protected identity fields on rows they own.
--
-- Fix applied (executed 2026-05-20 via Management API):
--   1. REVOKE UPDATE on all three tables from anon and authenticated.
--   2. GRANT UPDATE (content, post_type) on community_posts to authenticated
--      so post owners can edit the text/type of their own posts
--      (still gated by the existing "Community posts — update own" RLS policy).
--   3. No UPDATE grant for community_comments (no edit feature in the app).
--   4. No UPDATE grant for community_likes (insert/delete only).
--
-- The SECURITY DEFINER triggers trg_likes_count and trg_comments_count run as
-- the postgres role and therefore bypass both RLS and column-level grants —
-- counter maintenance is unaffected.

-- community_posts: revoke full UPDATE, grant only editable content columns
REVOKE UPDATE ON public.community_posts FROM anon, authenticated;
GRANT  UPDATE (content, post_type) ON public.community_posts TO authenticated;

-- community_comments: revoke entirely (no edit feature; insert/delete only)
REVOKE UPDATE ON public.community_comments FROM anon, authenticated;

-- community_likes: revoke entirely (insert/delete only; no columns editable)
REVOKE UPDATE ON public.community_likes FROM anon, authenticated;
