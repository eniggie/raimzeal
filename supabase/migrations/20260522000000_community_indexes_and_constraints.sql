-- Migration: community_indexes_and_constraints
-- Adds missing FK indexes and unique constraint to community tables
-- so that like/comment lookups don't require full table scans,
-- and duplicate likes in race conditions are rejected at the DB level.

-- Index: community_comments.post_id (used in every comment fetch)
CREATE INDEX IF NOT EXISTS community_comments_post_id_idx
  ON community_comments (post_id);

-- Index: community_likes.post_id (used in count queries and like checks)
CREATE INDEX IF NOT EXISTS community_likes_post_id_idx
  ON community_likes (post_id);

-- Index: community_likes.user_id (used in per-user like lookups)
CREATE INDEX IF NOT EXISTS community_likes_user_id_idx
  ON community_likes (user_id);

-- Unique constraint: one like per (post, user) — prevents race-condition duplicates
ALTER TABLE community_likes
  ADD CONSTRAINT community_likes_post_user_unique
  UNIQUE (post_id, user_id);
