-- Migration: 20260521000000_drop_duplicate_community_triggers
-- Purpose: Remove stale duplicate SECURITY DEFINER triggers that were left
-- alongside the correctly-named triggers from migration 20260520000002.
--
-- Context:
--   Migration 20260520000002 created:
--     on_like_change    → trg_likes_count()    on community_likes
--     on_comment_change → trg_comments_count() on community_comments
--   A prior set of triggers also existed (from an earlier migration):
--     trg_sync_likes_count    → fn_sync_likes_count()    on community_likes
--     trg_sync_comments_count → fn_sync_comments_count() on community_comments
--   Both sets performed identical increments/decrements on likes_count and
--   comments_count in community_posts. The result was that every like and every
--   comment caused the respective counter to be incremented TWICE, corrupting
--   the denormalized counters (even though the mobile UI was unaffected because
--   it reads live counts via embedded relations, the web UI reads the columns
--   directly and therefore displayed inflated counts).
--
-- Fix:
--   1. Drop the stale duplicate triggers.
--   2. Drop their backing functions.
--   3. Recalibrate both counter columns from the source-of-truth tables so
--      all existing rows reflect the true counts going forward.

-- ── 1. Drop stale triggers ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_sync_likes_count    ON public.community_likes;
DROP TRIGGER IF EXISTS trg_sync_comments_count ON public.community_comments;

-- ── 2. Drop stale backing functions ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.fn_sync_likes_count();
DROP FUNCTION IF EXISTS public.fn_sync_comments_count();

-- ── 3. Recalibrate counters from source-of-truth tables (idempotent) ─────────
UPDATE public.community_posts cp
SET likes_count = (
  SELECT COUNT(*) FROM public.community_likes cl WHERE cl.post_id = cp.id
);

UPDATE public.community_posts cp
SET comments_count = (
  SELECT COUNT(*) FROM public.community_comments cc WHERE cc.post_id = cp.id
);
