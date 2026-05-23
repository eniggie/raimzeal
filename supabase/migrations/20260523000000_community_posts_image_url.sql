-- Add optional image attachment to community posts.
-- Uses ADD COLUMN IF NOT EXISTS so the migration is safe to re-run.
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS image_url text;
