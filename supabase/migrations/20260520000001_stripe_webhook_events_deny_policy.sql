-- Migration: add explicit deny-all policy to stripe_webhook_events
--
-- stripe_webhook_events is a server-side-only idempotency table accessed
-- exclusively via the service_role key (which bypasses RLS entirely).
-- Adding a RESTRICTIVE USING(false) policy for the 'public' role:
--   1. Satisfies the Supabase linter (rls_enabled_no_policy)
--   2. Documents intent — no client should ever read or write this table directly
--   3. Does not affect service_role operations (service_role is exempt from RLS)

CREATE POLICY "No direct client access — service role only"
  ON public.stripe_webhook_events
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (false);
