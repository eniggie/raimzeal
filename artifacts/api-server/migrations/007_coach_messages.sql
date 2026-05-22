-- coach_messages: Ovia AI conversation history per user
-- Run this in the Supabase SQL editor for your project.

CREATE TABLE IF NOT EXISTS coach_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'coach')),
  content     text        NOT NULL,
  is_weekly   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own coach messages"
  ON coach_messages FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_coach_messages_user_created
  ON coach_messages (user_id, created_at DESC);
