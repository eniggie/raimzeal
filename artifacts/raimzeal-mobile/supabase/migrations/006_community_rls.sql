-- Migration 006: Row Level Security for community tables
-- community_posts: authenticated users can read all posts; only owner can insert/update/delete
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts_select_all"  ON community_posts;
DROP POLICY IF EXISTS "community_posts_insert_own"  ON community_posts;
DROP POLICY IF EXISTS "community_posts_update_own"  ON community_posts;
DROP POLICY IF EXISTS "community_posts_delete_own"  ON community_posts;

CREATE POLICY "community_posts_select_all"
  ON community_posts FOR SELECT
  USING (true);

CREATE POLICY "community_posts_insert_own"
  ON community_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_posts_update_own"
  ON community_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_posts_delete_own"
  ON community_posts FOR DELETE
  USING (auth.uid() = user_id);

-- community_comments
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_comments_select_all"  ON community_comments;
DROP POLICY IF EXISTS "community_comments_insert_own"  ON community_comments;
DROP POLICY IF EXISTS "community_comments_update_own"  ON community_comments;
DROP POLICY IF EXISTS "community_comments_delete_own"  ON community_comments;

CREATE POLICY "community_comments_select_all"
  ON community_comments FOR SELECT
  USING (true);

CREATE POLICY "community_comments_insert_own"
  ON community_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_comments_update_own"
  ON community_comments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_comments_delete_own"
  ON community_comments FOR DELETE
  USING (auth.uid() = user_id);

-- community_likes: users can see all likes; can only create/delete their own
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_likes_select_all"  ON community_likes;
DROP POLICY IF EXISTS "community_likes_insert_own"  ON community_likes;
DROP POLICY IF EXISTS "community_likes_delete_own"  ON community_likes;

CREATE POLICY "community_likes_select_all"
  ON community_likes FOR SELECT
  USING (true);

CREATE POLICY "community_likes_insert_own"
  ON community_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "community_likes_delete_own"
  ON community_likes FOR DELETE
  USING (auth.uid() = user_id);
