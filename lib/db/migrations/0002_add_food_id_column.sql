ALTER TABLE "favourite_foods"
  ADD COLUMN IF NOT EXISTS "food_id" varchar NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "favourite_foods"
  DROP CONSTRAINT IF EXISTS "uniq_fav_food_per_user";

ALTER TABLE "favourite_foods"
  ADD CONSTRAINT "uniq_fav_food_per_user" UNIQUE("user_id", "food_id");
