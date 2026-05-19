-- ============================================================
-- Migration 005: Row Level Security (RLS) for all user tables
-- ============================================================
-- Run this in your Supabase SQL Editor (https://app.supabase.com)
-- under your project → SQL Editor → New Query
--
-- IMPORTANT: Execute this BEFORE submitting to App Store / Play Store.
-- Without RLS, any authenticated user can read/write any other user's data.
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_delete_own"
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ── workout_logs ──────────────────────────────────────────────────────────────

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workout_logs_select_own" ON workout_logs;
DROP POLICY IF EXISTS "workout_logs_insert_own" ON workout_logs;
DROP POLICY IF EXISTS "workout_logs_update_own" ON workout_logs;
DROP POLICY IF EXISTS "workout_logs_delete_own" ON workout_logs;

CREATE POLICY "workout_logs_select_own"
  ON workout_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "workout_logs_insert_own"
  ON workout_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_logs_update_own"
  ON workout_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_logs_delete_own"
  ON workout_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ── meal_logs ─────────────────────────────────────────────────────────────────

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meal_logs_select_own" ON meal_logs;
DROP POLICY IF EXISTS "meal_logs_insert_own" ON meal_logs;
DROP POLICY IF EXISTS "meal_logs_update_own" ON meal_logs;
DROP POLICY IF EXISTS "meal_logs_delete_own" ON meal_logs;

CREATE POLICY "meal_logs_select_own"
  ON meal_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "meal_logs_insert_own"
  ON meal_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meal_logs_update_own"
  ON meal_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meal_logs_delete_own"
  ON meal_logs FOR DELETE
  USING (auth.uid() = user_id);

-- ── body_measurements ─────────────────────────────────────────────────────────

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "body_measurements_select_own" ON body_measurements;
DROP POLICY IF EXISTS "body_measurements_insert_own" ON body_measurements;
DROP POLICY IF EXISTS "body_measurements_update_own" ON body_measurements;
DROP POLICY IF EXISTS "body_measurements_delete_own" ON body_measurements;

CREATE POLICY "body_measurements_select_own"
  ON body_measurements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "body_measurements_insert_own"
  ON body_measurements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "body_measurements_update_own"
  ON body_measurements FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "body_measurements_delete_own"
  ON body_measurements FOR DELETE
  USING (auth.uid() = user_id);

-- ── water_intake ──────────────────────────────────────────────────────────────

ALTER TABLE water_intake ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "water_intake_select_own" ON water_intake;
DROP POLICY IF EXISTS "water_intake_insert_own" ON water_intake;
DROP POLICY IF EXISTS "water_intake_update_own" ON water_intake;
DROP POLICY IF EXISTS "water_intake_delete_own" ON water_intake;

CREATE POLICY "water_intake_select_own"
  ON water_intake FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "water_intake_insert_own"
  ON water_intake FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_intake_update_own"
  ON water_intake FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_intake_delete_own"
  ON water_intake FOR DELETE
  USING (auth.uid() = user_id);

-- ── Verification query ────────────────────────────────────────────────────────
-- Run this after the migration to confirm all 5 tables have RLS enabled:
--
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles','workout_logs','meal_logs','body_measurements','water_intake');
--
-- All 5 rows should show rowsecurity = true.
-- ============================================================
