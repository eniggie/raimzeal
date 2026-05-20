/**
 * Verify community security hardening was applied to Supabase.
 * Run with: pnpm --filter @workspace/scripts run verify-community-security
 */
const PROJECT_REF = "druogyuqjytmkwihinhg";
const PAT = process.env.SUPABASE_PAT ?? "";

async function sbSql(query: string) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${PAT}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    }
  );
  const body = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(body));
  return body as Record<string, unknown>[];
}

async function run() {
  // 1. Check RLS policies on community_posts
  const policies = await sbSql(`
    SELECT policyname, cmd, qual, with_check
    FROM pg_policies WHERE tablename = 'community_posts'
    ORDER BY cmd, policyname
  `);
  console.log("community_posts policies:");
  for (const p of policies) {
    console.log(`  [${p.cmd}] ${p.policyname}`);
    if (p.qual)       console.log(`    USING:      ${p.qual}`);
    if (p.with_check) console.log(`    WITH CHECK: ${p.with_check}`);
  }

  const updatePolicies = policies.filter(p => p.cmd === "UPDATE");
  const ownerOnly = updatePolicies.every(p =>
    String(p.qual ?? "").includes("auth.uid()") &&
    !String(p.qual ?? "").includes("true")
  );
  console.log(updatePolicies.length > 0 && ownerOnly
    ? "\n✅ UPDATE policy: owner-only (CORRECT)"
    : "\n⚠  UPDATE policy: missing or too permissive"
  );

  // 2. Check triggers
  const triggers = await sbSql(`
    SELECT trigger_name, event_object_table, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table IN ('community_likes', 'community_comments')
    ORDER BY event_object_table, trigger_name
  `);
  console.log("\nTriggers on community_likes / community_comments:");
  for (const t of triggers) {
    console.log(`  ${t.event_object_table} [${t.event_manipulation}] → ${t.trigger_name}`);
  }

  const hasLikesTrigger    = triggers.some(t => t.trigger_name === "trg_sync_likes_count");
  const hasCommentsTrigger = triggers.some(t => t.trigger_name === "trg_sync_comments_count");
  console.log(hasLikesTrigger    ? "✅ likes_count trigger present"    : "⚠  likes_count trigger MISSING");
  console.log(hasCommentsTrigger ? "✅ comments_count trigger present" : "⚠  comments_count trigger MISSING");
}

run().catch(err => { console.error("FAILED:", err.message); process.exit(1); });
