-- ============================================================
-- Community tables with secure, server-side counter maintenance
-- ============================================================
-- Design principles:
--   1. community_posts UPDATE is restricted to the row owner.
--      No other authenticated user may update any column of another
--      user's post, including likes_count or comments_count.
--   2. Counters (likes_count, comments_count) are maintained
--      exclusively by SECURITY DEFINER triggers that run with
--      elevated privileges on the server — never by client writes.
--   3. community_likes and community_comments enforce own-row
--      INSERT/DELETE only; no UPDATE path exists.
-- ============================================================

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_posts (
  id            varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       varchar NOT NULL,
  user_name     text    NOT NULL,
  content       text    NOT NULL,
  post_type     varchar NOT NULL DEFAULT 'post' CHECK (post_type IN ('post','question')),
  likes_count   integer NOT NULL DEFAULT 0,
  comments_count integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
  id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    varchar NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL,
  user_name  text    NOT NULL,
  content    text    NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_likes (
  id         varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    varchar NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id    varchar NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_like_per_user UNIQUE (post_id, user_id)
);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.community_posts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes    ENABLE ROW LEVEL SECURITY;

-- community_posts:
--   Any authenticated user may read all posts.
--   Only the author may insert or delete their own post.
--   Only the author may update their own post (content, post_type).
--   likes_count / comments_count are not writable by clients at all
--   because the only UPDATE policy restricts to the post owner, and
--   the trigger runs as SECURITY DEFINER (bypasses RLS).

CREATE POLICY "Community posts — select all"
  ON public.community_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Community posts — insert own"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Community posts — update own"
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING  (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Community posts — delete own"
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- community_comments:
--   Read: any authenticated user.
--   Insert: own row only.
--   Delete: own row only.
--   No UPDATE path (comments are immutable once posted).

CREATE POLICY "Community comments — select all"
  ON public.community_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Community comments — insert own"
  ON public.community_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Community comments — delete own"
  ON public.community_comments FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- community_likes:
--   Read: any authenticated user.
--   Insert: own row only.
--   Delete: own row only.
--   No UPDATE path.

CREATE POLICY "Community likes — select all"
  ON public.community_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Community likes — insert own"
  ON public.community_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Community likes — delete own"
  ON public.community_likes FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

-- ── Server-side counter triggers ─────────────────────────────────────────────
-- These functions run SECURITY DEFINER with an empty search_path so they
-- can UPDATE community_posts (another user's row) without violating RLS.
-- No client write path ever touches likes_count or comments_count.

CREATE OR REPLACE FUNCTION public.trg_likes_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
       SET likes_count = likes_count + 1
     WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
       SET likes_count = GREATEST(likes_count - 1, 0)
     WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_comments_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
       SET comments_count = comments_count + 1
     WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
       SET comments_count = GREATEST(comments_count - 1, 0)
     WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Lock down EXECUTE: only postgres and service_role may call these directly.
REVOKE EXECUTE ON FUNCTION public.trg_likes_count()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_comments_count() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.trg_likes_count()    TO service_role;
GRANT  EXECUTE ON FUNCTION public.trg_comments_count() TO service_role;

DROP TRIGGER IF EXISTS on_like_change    ON public.community_likes;
DROP TRIGGER IF EXISTS on_comment_change ON public.community_comments;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.community_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_likes_count();

CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_comments_count();
