ALTER TABLE "enrolled_programs"
  ADD COLUMN IF NOT EXISTS "last_advance_date" varchar(10);
