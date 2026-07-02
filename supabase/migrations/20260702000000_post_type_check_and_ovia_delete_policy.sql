-- Forward migration: two schema fixes that unblock features the app already ships.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste → Run.
-- Both blocks are idempotent and guarded, so re-running is safe.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. community_posts.post_type CHECK constraint
--
-- 20260520000002 created the column with CHECK (post_type IN ('post','question')),
-- but the API (routes/community.ts) and both composers accept five types:
-- 'post', 'question', 'win', 'tip', 'challenge'. Creating a win/tip/challenge
-- post therefore hit a 23514 CHECK violation and returned a 500 — three of the
-- five options the UI offers were completely broken.
--
-- Drop whatever CHECK constraint currently guards post_type (its auto-generated
-- name can differ between databases) and re-add one that allows all five.
DO $$
DECLARE c record;
BEGIN
  IF to_regclass('public.community_posts') IS NULL THEN
    RETURN;
  END IF;

  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'community_posts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%post_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.community_posts DROP CONSTRAINT %I', c.conname);
  END LOOP;

  ALTER TABLE public.community_posts
    ADD CONSTRAINT community_posts_post_type_check
    CHECK (post_type IN ('post', 'question', 'win', 'tip', 'challenge'));
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ovia_messages DELETE policy
--
-- 004_ovia_messages.sql enables RLS with SELECT/INSERT/UPDATE policies but no
-- DELETE policy. The mobile "clear all data" flow deletes ovia_messages with the
-- user's own JWT (anon-key client), so RLS silently filters every row: the wipe
-- reports success while the user's entire private AI chat history remains stored.
-- Add the missing own-row DELETE policy (user_id is uuid here, matching auth.uid()).
DO $$
BEGIN
  IF to_regclass('public.ovia_messages') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Ovia messages — delete own" ON public.ovia_messages;
    CREATE POLICY "Ovia messages — delete own"
      ON public.ovia_messages FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
