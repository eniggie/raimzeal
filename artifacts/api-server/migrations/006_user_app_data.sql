-- Migration 006: User app data tables
-- Adds workout_logs, meal_logs, body_measurements, water_intake, and scheduled_workouts
-- Also adds app_settings and streak columns to profiles

-- ─── workout_logs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id  text NOT NULL,
  workout_name text NOT NULL,
  date        date NOT NULL,
  duration    integer NOT NULL DEFAULT 0,
  calories_burned integer NOT NULL DEFAULT 0,
  exercises   jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workout_logs_user_date_idx ON workout_logs (user_id, date DESC);

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "workout_logs: owner access"
  ON workout_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── meal_logs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  name        text NOT NULL,
  calories    numeric NOT NULL DEFAULT 0,
  protein     numeric NOT NULL DEFAULT 0,
  carbs       numeric NOT NULL DEFAULT 0,
  fat         numeric NOT NULL DEFAULT 0,
  meal_type   text NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS meal_logs_user_date_idx ON meal_logs (user_id, date DESC);

ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "meal_logs: owner access"
  ON meal_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── body_measurements ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS body_measurements (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  weight  numeric NOT NULL,
  chest   numeric,
  waist   numeric,
  hips    numeric,
  arms    numeric,
  thighs  numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS body_measurements_user_date_idx ON body_measurements (user_id, date DESC);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "body_measurements: owner access"
  ON body_measurements FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── water_intake ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS water_intake (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  glasses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS water_intake_user_date_idx ON water_intake (user_id, date DESC);

ALTER TABLE water_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "water_intake: owner access"
  ON water_intake FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── scheduled_workouts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scheduled_workouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id   text NOT NULL,
  workout_name text NOT NULL,
  date         date NOT NULL,
  completed    boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_workouts_user_date_idx ON scheduled_workouts (user_id, date ASC);

ALTER TABLE scheduled_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "scheduled_workouts: owner access"
  ON scheduled_workouts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── profiles: add app_settings and streak ────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS app_settings jsonb,
  ADD COLUMN IF NOT EXISTS streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blood_type text CHECK (blood_type IN ('A','B','AB','O')),
  ADD COLUMN IF NOT EXISTS rh_factor text CHECK (rh_factor IN ('+','-')),
  ADD COLUMN IF NOT EXISTS genotype text CHECK (genotype IN ('AA','AS','AC','SS','SC'));
