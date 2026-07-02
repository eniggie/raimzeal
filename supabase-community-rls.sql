-- =============================================================================
-- ⚠️  SUPERSEDED — DO NOT RUN THIS FILE.
--
-- The counter triggers below (fn_sync_likes_count / fn_sync_comments_count and
-- their trg_sync_* triggers) are the SAME ones that migration
-- supabase/migrations/20260521000000_drop_duplicate_community_triggers.sql
-- removed because, running alongside the canonical on_like_change /
-- on_comment_change triggers from 20260520000002, they double-counted every
-- like and comment. Re-applying this file reintroduces that drift.
--
-- The live community schema, RLS, indexes and triggers are defined by the
-- timestamped migrations in supabase/migrations/. Use those. This file is kept
-- only for historical reference.
-- =============================================================================

-- RAIMZEAL Community Security Hardening (historical — see banner above)
-- =============================================================================

-- ── 1. Auto-maintain likes_count via trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_likes_count ON community_likes;
CREATE TRIGGER trg_sync_likes_count
AFTER INSERT OR DELETE ON community_likes
FOR EACH ROW EXECUTE FUNCTION fn_sync_likes_count();

-- ── 2. Auto-maintain comments_count via trigger ───────────────────────────
CREATE OR REPLACE FUNCTION fn_sync_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comments_count ON community_comments;
CREATE TRIGGER trg_sync_comments_count
AFTER INSERT OR DELETE ON community_comments
FOR EACH ROW EXECUTE FUNCTION fn_sync_comments_count();

-- ── 3. Drop any over-permissive UPDATE policies on community_posts ────────
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'community_posts' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON community_posts', pol.policyname);
    RAISE NOTICE 'Dropped UPDATE policy: %', pol.policyname;
  END LOOP;
END;
$$;

-- ── 4. Add restrictive UPDATE policy: only the post owner may update ──────
-- Note: user_id is varchar; auth.uid() returns uuid — explicit cast required
CREATE POLICY "post_owner_update"
ON community_posts
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- ── 5. Reconcile stale counter columns (one-time fix) ────────────────────
UPDATE community_posts cp
SET likes_count = (SELECT COUNT(*) FROM community_likes cl WHERE cl.post_id = cp.id);

UPDATE community_posts cp
SET comments_count = (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id);

-- ── 6. Verify final state ─────────────────────────────────────────────────
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'community_posts'
ORDER BY cmd, policyname;

SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('community_likes', 'community_comments')
ORDER BY event_object_table, trigger_name;
