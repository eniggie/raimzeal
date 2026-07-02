import cron from "node-cron";
import { db, digestSubscribers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";
import { sendWeeklyDigest } from "./routes/email";
import { runDonationHealthProbe } from "./lib/healthProbe";
import { supabaseAdmin } from "./lib/supabaseAdmin";
import { sendPushToTokens } from "./lib/push";

const PAID_TIERS = ["rise", "reign", "legacy"] as const;
const ACTIVE_STATUSES = ["active", "trialing"] as const;

// Re-engagement push cadence guards.
const REENGAGE_LAPSE_DAYS = 3;   // notify a user whose last activity was this long ago
const REENGAGE_COOLDOWN_DAYS = 5; // never push the same device more often than this

/**
 * Re-engagement push: nudge users who registered a device, were recently active,
 * but have now lapsed for REENGAGE_LAPSE_DAYS with no workout/meal logged — the
 * cohort most likely to return. Timezone-insensitive (multi-day window) and rate
 * limited per device via last_engagement_push_at.
 *
 * Gated behind ENABLE_REENGAGEMENT_PUSH=true so the cadence/copy can be reviewed
 * before it fires in production. Never throws.
 */
async function runReengagementPush(): Promise<void> {
  const now = Date.now();
  const dayMs = 86_400_000;
  const lapseCutoffIso = new Date(now - REENGAGE_LAPSE_DAYS * dayMs).toISOString().slice(0, 10);
  const cooldownIso = new Date(now - REENGAGE_COOLDOWN_DAYS * dayMs).toISOString();

  // Candidate devices: not pushed within the cooldown window.
  const { data: tokenRows, error: tokErr } = await supabaseAdmin
    .from("push_tokens")
    .select("token, user_id, last_engagement_push_at");
  if (tokErr) {
    logger.warn({ err: tokErr }, "re-engagement: could not load push tokens");
    return;
  }
  const candidates = (tokenRows ?? []).filter(
    (t) => !t.last_engagement_push_at || (t.last_engagement_push_at as string) < cooldownIso,
  );
  if (candidates.length === 0) return;

  const userIds = Array.from(new Set(candidates.map((t) => t.user_id as string)));

  // A user is "still active" if they logged a workout or meal on/after the lapse
  // cutoff — those users are excluded from the re-engagement nudge.
  const [workoutRes, mealRes] = await Promise.all([
    supabaseAdmin.from("workout_logs").select("user_id").in("user_id", userIds).gte("date", lapseCutoffIso),
    supabaseAdmin.from("meal_logs").select("user_id").in("user_id", userIds).gte("date", lapseCutoffIso),
  ]);
  const activeUsers = new Set<string>([
    ...((workoutRes.data ?? []).map((r) => r.user_id as string)),
    ...((mealRes.data ?? []).map((r) => r.user_id as string)),
  ]);

  const lapsedTokens = candidates.filter((t) => !activeUsers.has(t.user_id as string));
  if (lapsedTokens.length === 0) {
    logger.info("re-engagement: no lapsed devices to notify");
    return;
  }

  const { sent } = await sendPushToTokens(
    lapsedTokens.map((t) => t.token as string),
    {
      title: "We miss you at RAIMZEAL 💚",
      body: "Your health journey is waiting. Log a quick meal or workout today and keep the momentum going!",
      data: { type: "reengagement" },
    },
  );

  // Stamp the cooldown so we don't re-notify these devices for REENGAGE_COOLDOWN_DAYS.
  const nowIso = new Date(now).toISOString();
  await Promise.all(
    lapsedTokens.map((t) =>
      supabaseAdmin
        .from("push_tokens")
        .update({ last_engagement_push_at: nowIso })
        .eq("token", t.token as string),
    ),
  ).catch((err) => logger.warn({ err }, "re-engagement: failed to stamp cooldown"));

  logger.info({ candidates: candidates.length, lapsed: lapsedTokens.length, sent }, "re-engagement push complete");
}

/**
 * Fetch all paid subscribers who should receive digest emails.
 *
 * Source of truth: Supabase `profiles` — anyone on a paid tier with an
 * active/trialing subscription is included automatically (no manual opt-in
 * required). Users who explicitly unsubscribed (`digest_subscribers.active =
 * false`) are excluded.
 */
async function getPaidRecipients(): Promise<Array<{ email: string; name: string; streak?: number }>> {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("email, name, streak")
    .in("subscription_tier", PAID_TIERS as unknown as string[])
    .in("subscription_status", ACTIVE_STATUSES as unknown as string[]);

  if (error) {
    throw new Error(`Supabase profiles query failed: ${error.message}`);
  }

  const validProfiles = (profiles ?? []).filter(
    (p): p is { email: string; name: string; streak: number | null } =>
      typeof p.email === "string" && p.email.length > 0,
  );

  if (validProfiles.length === 0) return [];

  const optedOutRows = await db
    .select({ email: digestSubscribers.email })
    .from(digestSubscribers)
    .where(eq(digestSubscribers.active, false));

  const optedOut = new Set(optedOutRows.map((r) => r.email.toLowerCase()));

  return validProfiles
    .filter((p) => !optedOut.has(p.email.toLowerCase()))
    .map((p) => ({ email: p.email, name: p.name ?? "Friend", streak: (p as { streak?: number }).streak ?? 0 }));
}

export function startScheduler(): void {
  // ── Saturday 08:00 WAT (07:00 UTC) — full weekly digest ───────────────────
  cron.schedule(
    "0 7 * * 6",
    async () => {
      logger.info("Saturday weekly digest job starting");
      try {
        const recipients = await getPaidRecipients();

        if (recipients.length === 0) {
          logger.info("No paid subscribers — skipping Saturday digest");
          return;
        }

        let sent = 0;
        let failed = 0;

        for (const { email, name, streak } of recipients) {
          try {
            await sendWeeklyDigest(email, name, { streak });
            sent++;
          } catch (err) {
            failed++;
            logger.warn({ email, err }, "Saturday digest send failed for subscriber");
          }
        }

        logger.info({ sent, failed, total: recipients.length }, "Saturday digest job complete");
      } catch (err) {
        logger.error({ err }, "Saturday digest job crashed");
      }
    },
    { timezone: "UTC" },
  );

  // ── Every 15 minutes — donation / payment health probe ────────────────────
  cron.schedule(
    "*/15 * * * *",
    async () => {
      try {
        await runDonationHealthProbe();
      } catch (err) {
        logger.error({ err }, "Donation health probe job crashed");
      }
    },
    { timezone: "UTC" },
  );

  // ── Daily 16:00 UTC — re-engagement push (opt-in) ─────────────────────────
  // Off unless ENABLE_REENGAGEMENT_PUSH=true, so the copy/cadence can be
  // reviewed before it goes live. Requires the push_tokens table.
  if (process.env["ENABLE_REENGAGEMENT_PUSH"] === "true") {
    cron.schedule(
      "0 16 * * *",
      async () => {
        try {
          await runReengagementPush();
        } catch (err) {
          logger.error({ err }, "Re-engagement push job crashed");
        }
      },
      { timezone: "UTC" },
    );
  }

  logger.info(
    {
      reengagementPush: process.env["ENABLE_REENGAGEMENT_PUSH"] === "true" ? "on (16:00 UTC)" : "off",
    },
    "Scheduler started — Saturday digest: 07:00 UTC (08:00 WAT) · Donation health probe: every 15 min",
  );
}
