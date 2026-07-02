-- Push notification device tokens.
--
-- Apply via: Supabase Dashboard → SQL Editor → paste → Run. Idempotent.
--
-- Tokens are written and read ONLY by the API server (service role) via
-- /api/notifications/register-token — the mobile client never touches this table
-- directly — so RLS is enabled with no anon/authenticated policies (service role
-- bypasses RLS). Rows cascade-delete with the user.

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token                    text NOT NULL UNIQUE,
  platform                 text,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- Anti-spam marker for the optional re-engagement campaign (see scheduler).
  last_engagement_push_at  timestamptz
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id_idx ON public.push_tokens(user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Account deletion also removes tokens explicitly via the deletion flow; the FK
-- cascade above is the backstop.
