CREATE TABLE IF NOT EXISTS "favourite_foods" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "food_id" varchar NOT NULL DEFAULT gen_random_uuid(),
  "food_name" text NOT NULL,
  "food_data" jsonb NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "uniq_fav_food_per_user" UNIQUE("user_id", "food_id")
);
