-- Migration 005: User preferences column for cross-device filter sync
-- Run this in your Supabase SQL Editor to enable search filter sync across devices.
--
-- Adds a `preferences` JSONB column to the `profiles` table.
-- Stores per-user app preferences (active search filters, custom filter presets, etc.)
-- so they travel with the account and restore automatically on new devices.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferences JSONB;

COMMENT ON COLUMN profiles.preferences IS
  'Arbitrary user preferences (JSON). Current shape: { activeFilters: string[], customPresets: [{ id, name, filterKeys }] }';
