-- Migration 004: Ovia AI persistent memory
-- Run this in your Supabase SQL Editor to give Ovia cross-device memory.
--
-- This table stores every Ovia AI message per user so that:
--   • Conversation history survives app reinstalls / device switches
--   • Ovia has full context of past conversations on new sessions
--   • Messages are private to each user via Row Level Security

CREATE TABLE IF NOT EXISTS ovia_messages (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ovia_messages_user_id_timestamp_idx
  ON ovia_messages (user_id, timestamp ASC);

-- Row Level Security: each user can only see and write their own messages
ALTER TABLE ovia_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own ovia messages"  ON ovia_messages;
DROP POLICY IF EXISTS "Users can insert own ovia messages" ON ovia_messages;
DROP POLICY IF EXISTS "Users can upsert own ovia messages" ON ovia_messages;

CREATE POLICY "Users can read own ovia messages"
  ON ovia_messages FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own ovia messages"
  ON ovia_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ovia messages"
  ON ovia_messages FOR UPDATE
  USING (auth.uid() = user_id);
