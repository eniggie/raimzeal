-- ============================================================
-- community_blocks, community_reports, and is_legacy_post column
-- ============================================================
-- community_blocks: one row per (blocker, blocked) pair.
-- community_reports: one row per abuse report; append-only.
-- is_legacy_post: flag for "Inner Circle" legacy-member posts.
-- ============================================================

-- ── community_blocks ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_blocks (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_user_id  varchar NOT NULL,
  blocked_user_id  varchar NOT NULL,
  post_id          varchar,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_block_per_pair UNIQUE (blocker_user_id, blocked_user_id)
);

ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community blocks — select own"
  ON public.community_blocks FOR SELECT
  TO authenticated
  USING (auth.uid()::text = blocker_user_id);

CREATE POLICY "Community blocks — insert own"
  ON public.community_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = blocker_user_id);

CREATE POLICY "Community blocks — delete own"
  ON public.community_blocks FOR DELETE
  TO authenticated
  USING (auth.uid()::text = blocker_user_id);

-- ── community_reports ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_reports (
  id               varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id varchar NOT NULL,
  reported_user_id varchar NOT NULL,
  post_id          varchar,
  reason           text,
  details          text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community reports — select own"
  ON public.community_reports FOR SELECT
  TO authenticated
  USING (auth.uid()::text = reporter_user_id);

CREATE POLICY "Community reports — insert own"
  ON public.community_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = reporter_user_id);

-- ── is_legacy_post column ────────────────────────────────────────────────────

ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS is_legacy_post boolean NOT NULL DEFAULT false;

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_community_blocks_blocker
  ON public.community_blocks (blocker_user_id);

CREATE INDEX IF NOT EXISTS idx_community_blocks_blocked
  ON public.community_blocks (blocked_user_id);

CREATE INDEX IF NOT EXISTS idx_community_reports_reporter
  ON public.community_reports (reporter_user_id);
