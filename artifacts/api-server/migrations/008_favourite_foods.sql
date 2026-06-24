-- Migration 008: Favourite foods sync table
-- Allows users to save favourite foods that sync across devices via the API.
-- NOTE: This table is separate from the heliumdb (Drizzle) favourite_foods table.

CREATE TABLE IF NOT EXISTS favourite_foods (
  id          text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  food_id     text        NOT NULL DEFAULT gen_random_uuid()::text,
  food_name   text        NOT NULL,
  food_data   jsonb       NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_fav_food_per_user UNIQUE (user_id, food_id)
);

CREATE INDEX IF NOT EXISTS idx_favourite_foods_user
  ON favourite_foods (user_id, sort_order ASC);

ALTER TABLE favourite_foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "favourite_foods: owner access" ON favourite_foods;
CREATE POLICY "favourite_foods: owner access"
  ON favourite_foods FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
