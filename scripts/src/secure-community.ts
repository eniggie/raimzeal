/**
 * Security hardening for Supabase community tables.
 * Run with:  pnpm --filter @workspace/scripts run secure-community
 *
 * Tries Supabase Management API (needs SUPABASE_PAT) first.
 * Falls back to pg-meta API with service role key.
 * Prints manual SQL path if neither works.
 */
import pg from "pg";

const { Client } = pg;

const PROJECT_REF = "druogyuqjytmkwihinhg";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
  ?? `https://${PROJECT_REF}.supabase.co`;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PAT = process.env.SUPABASE_PAT ?? "";

// SQL to apply — all in one multi-statement script
const HARDENING_SQL = `
-- 1. Trigger: auto-maintain likes_count
CREATE OR REPLACE FUNCTION fn_sync_likes_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_likes_count ON community_likes;
CREATE TRIGGER trg_sync_likes_count
AFTER INSERT OR DELETE ON community_likes
FOR EACH ROW EXECUTE FUNCTION fn_sync_likes_count();

-- 2. Trigger: auto-maintain comments_count
CREATE OR REPLACE FUNCTION fn_sync_comments_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_comments_count ON community_comments;
CREATE TRIGGER trg_sync_comments_count
AFTER INSERT OR DELETE ON community_comments
FOR EACH ROW EXECUTE FUNCTION fn_sync_comments_count();

-- 3. Drop all over-permissive UPDATE policies on community_posts
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
              WHERE tablename = 'community_posts' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON community_posts', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END;
$$;

-- 4. Add owner-only UPDATE policy (user_id is varchar, auth.uid() is uuid — cast needed)
CREATE POLICY "post_owner_update"
ON community_posts FOR UPDATE TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

-- 5. Reconcile stale counters
UPDATE community_posts cp
SET likes_count = (SELECT COUNT(*) FROM community_likes cl WHERE cl.post_id = cp.id);

UPDATE community_posts cp
SET comments_count = (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id);
`;

async function tryManagementApi(): Promise<boolean> {
  if (!PAT) return false;
  try {
    const r = await fetch(
      `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${PAT}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: HARDENING_SQL }),
      }
    );
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      console.log("Management API failed:", JSON.stringify(err));
      return false;
    }
    return true;
  } catch (e: unknown) {
    console.log("Management API exception:", String(e));
    return false;
  }
}

async function tryPgMeta(): Promise<boolean> {
  if (!SERVICE_ROLE_KEY) return false;
  try {
    // Supabase pg-meta SQL execution endpoint (used by the Supabase Studio SQL editor)
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: HARDENING_SQL }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.log("pg-meta RPC failed:", r.status, body.slice(0, 200));
      return false;
    }
    return true;
  } catch (e: unknown) {
    console.log("pg-meta exception:", String(e));
    return false;
  }
}

async function cleanupReplitPostgres() {
  // Remove the stray triggers/functions created on Replit's heliumdb
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`DROP TRIGGER IF EXISTS trg_sync_likes_count ON community_likes`);
    await client.query(`DROP TRIGGER IF EXISTS trg_sync_comments_count ON community_comments`);
    await client.query(`DROP FUNCTION IF EXISTS fn_sync_likes_count()`);
    await client.query(`DROP FUNCTION IF EXISTS fn_sync_comments_count()`);
    console.log("✓ Cleaned up stray triggers/functions from Replit PostgreSQL");
  } finally {
    await client.end();
  }
}

async function run() {
  // 1. Clean up stray objects created on Replit's own PostgreSQL
  await cleanupReplitPostgres();

  // 2. Try Management API (PAT required)
  console.log("\nTrying Supabase Management API...");
  if (await tryManagementApi()) {
    console.log("✅ Security hardening applied via Management API.");
    return;
  }

  // 3. Try pg-meta RPC
  console.log("Trying Supabase pg-meta RPC...");
  if (await tryPgMeta()) {
    console.log("✅ Security hardening applied via pg-meta.");
    return;
  }

  // 4. Manual fallback
  console.log("\n⚠  Automated SQL execution not available.");
  console.log("   SUPABASE_PAT is not set and exec_sql RPC is not enabled.");
  console.log("\n   ▶ MANUAL STEP REQUIRED:");
  console.log("   1. Go to https://supabase.com/dashboard/project/" + PROJECT_REF + "/sql/new");
  console.log("   2. Paste and run: supabase-community-rls.sql (in the project root)");
  console.log("   3. This adds SECURITY DEFINER triggers + restricts UPDATE to post owners only.");
}

run().catch((err) => {
  console.error("FAILED:", err.message);
  process.exit(1);
});
