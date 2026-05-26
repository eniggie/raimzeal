import cron from "node-cron";
import { db, digestSubscribers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";
import { sendWeeklyDigest, sendMidWeekMotivation } from "./routes/email";
import { runDonationHealthProbe } from "./lib/healthProbe";
import { supabaseAdmin } from "./lib/supabaseAdmin";

const PAID_TIERS = ["rise", "reign", "legacy"] as const;
const ACTIVE_STATUSES = ["active", "trialing"] as const;

/**
 * Fetch all paid subscribers who should receive digest emails.
 *
 * Source of truth: Supabase `profiles` — anyone on a paid tier with an
 * active/trialing subscription is included automatically (no manual opt-in
 * required). Users who explicitly unsubscribed (`digest_subscribers.active =
 * false`) are excluded.
 */
async function getPaidRecipients(): Promise<Array<{ email: string; name: string }>> {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("email, name")
    .in("subscription_tier", PAID_TIERS as unknown as string[])
    .in("subscription_status", ACTIVE_STATUSES as unknown as string[]);

  if (error) {
    throw new Error(`Supabase profiles query failed: ${error.message}`);
  }

  const validProfiles = (profiles ?? []).filter(
    (p): p is { email: string; name: string } =>
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
    .map((p) => ({ email: p.email, name: p.name ?? "Friend" }));
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

        for (const { email, name } of recipients) {
          try {
            await sendWeeklyDigest(email, name);
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

  // ── Wednesday 12:00 UTC (13:00 WAT) — mid-week motivation push ────────────
  cron.schedule(
    "0 12 * * 3",
    async () => {
      logger.info("Wednesday mid-week motivation job starting");
      try {
        const recipients = await getPaidRecipients();

        if (recipients.length === 0) {
          logger.info("No paid subscribers — skipping Wednesday mid-week push");
          return;
        }

        let sent = 0;
        let failed = 0;

        for (const { email, name } of recipients) {
          try {
            await sendMidWeekMotivation(email, name);
            sent++;
          } catch (err) {
            failed++;
            logger.warn({ email, err }, "Mid-week motivation send failed for subscriber");
          }
        }

        logger.info({ sent, failed, total: recipients.length }, "Wednesday mid-week job complete");
      } catch (err) {
        logger.error({ err }, "Wednesday mid-week job crashed");
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

  logger.info(
    "Scheduler started — Saturday digest: 07:00 UTC (08:00 WAT) · Wednesday motivation: 12:00 UTC (13:00 WAT) · Donation health probe: every 15 min",
  );
}
