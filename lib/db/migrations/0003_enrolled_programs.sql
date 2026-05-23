CREATE TABLE IF NOT EXISTS "enrolled_programs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "program_id" varchar NOT NULL,
  "program_name" text NOT NULL,
  "program_data" jsonb NOT NULL,
  "started_at" timestamp NOT NULL DEFAULT now(),
  "current_week" integer NOT NULL DEFAULT 1,
  "current_day" integer NOT NULL DEFAULT 1,
  "completed_at" timestamp
);
