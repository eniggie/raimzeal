-- Migration 008: Fix the account-deletion trigger installed by 007.
--
-- Two problems with 007's handle_user_delete():
--   1. The community tables (community_posts/comments/likes) declare user_id as
--      `varchar`, but OLD.id (auth.users.id) is `uuid`. Postgres has no
--      `varchar = uuid` operator, so the plpgsql body raised 42883 at DELETE
--      time. Because it is a BEFORE DELETE trigger on auth.users, that exception
--      aborted the whole delete — so every account-deletion request failed with
--      a 500 on any database where 007 was applied.
--   2. community_blocks and community_reports were never cleaned up, leaving a
--      user's blocks and abuse reports behind after a "full erasure" delete.
--
-- Casting both sides to text makes the comparison work whether user_id is
-- varchar or uuid across the repo's divergent community schemas. Idempotent:
-- CREATE OR REPLACE just re-defines the function.

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles             WHERE id = OLD.id;
  DELETE FROM public.workout_logs         WHERE user_id = OLD.id;
  DELETE FROM public.meal_logs            WHERE user_id = OLD.id;
  DELETE FROM public.body_measurements    WHERE user_id = OLD.id;
  DELETE FROM public.water_intake         WHERE user_id = OLD.id;
  DELETE FROM public.ovia_messages        WHERE user_id = OLD.id;
  -- Community tables: user_id is varchar in the canonical schema; cast both
  -- sides to text so the comparison is valid regardless of the column type.
  DELETE FROM public.community_posts      WHERE user_id::text = OLD.id::text;
  DELETE FROM public.community_comments   WHERE user_id::text = OLD.id::text;
  DELETE FROM public.community_likes      WHERE user_id::text = OLD.id::text;

  -- Newer moderation tables (added in 20260524000000). Guarded so this function
  -- still installs on databases where they don't yet exist.
  IF to_regclass('public.community_blocks') IS NOT NULL THEN
    DELETE FROM public.community_blocks
      WHERE blocker_user_id::text = OLD.id::text
         OR blocked_user_id::text = OLD.id::text;
  END IF;
  IF to_regclass('public.community_reports') IS NOT NULL THEN
    DELETE FROM public.community_reports
      WHERE reporter_user_id::text = OLD.id::text
         OR reported_user_id::text = OLD.id::text;
  END IF;

  RETURN OLD;
END;
$$;

-- Trigger definition unchanged; re-assert it so this migration is self-contained.
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();
