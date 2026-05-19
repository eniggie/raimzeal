-- Migration 007: Cascade delete — remove all user data when auth.users row is deleted
-- This satisfies Apple App Store health data deletion requirements and GDPR Art. 17.
--
-- NOTE: Supabase does not allow direct ALTER TABLE on auth.users foreign key references
-- via migrations. The correct approach is a PostgreSQL trigger on auth.users deletion
-- that removes rows from all user-data tables in the public schema.

CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.profiles             WHERE id      = OLD.id;
  DELETE FROM public.workout_logs         WHERE user_id = OLD.id;
  DELETE FROM public.meal_logs            WHERE user_id = OLD.id;
  DELETE FROM public.body_measurements    WHERE user_id = OLD.id;
  DELETE FROM public.water_intake         WHERE user_id = OLD.id;
  DELETE FROM public.community_posts      WHERE user_id = OLD.id;
  DELETE FROM public.community_comments   WHERE user_id = OLD.id;
  DELETE FROM public.community_likes      WHERE user_id = OLD.id;
  DELETE FROM public.ovia_messages        WHERE user_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

CREATE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_delete();

-- Verify function created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'handle_user_delete'
  ) THEN
    RAISE EXCEPTION 'handle_user_delete function was not created successfully';
  END IF;
END;
$$;
