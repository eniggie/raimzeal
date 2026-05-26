import cron from "node-cron";
import { db, digestSubscribers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";
import { sendWeeklyDigest, sendMidWeekMotivation } from "./routes/email";
import { runDonationHealthProbe } from "./lib/healthProbe";

export function startScheduler(): void {
  // ── Saturday 08:00 WAT (07:00 UTC) — full weekly digest ───────────────────
  cron.schedule(
    "0 7 * * 6",
    async () => {
      logger.info("Saturday weekly digest job starting");
      try {
        const subscribers = await db
          .select()
          .from(digestSubscribers)
          .where(eq(digestSubscribers.active, true));

        if (subscribers.length === 0) {
          logger.info("No active digest subscribers — skipping Saturday digest");
          return;
        }

        let sent = 0;
        let failed = 0;

        for (const sub of subscribers) {
          try {
            await sendWeeklyDigest(sub.email, sub.userName);
            sent++;
          } catch (err) {
            failed++;
            logger.warn({ email: sub.email, err }, "Saturday digest send failed for subscriber");
          }
        }

        logger.info({ sent, failed, total: subscribers.length }, "Saturday digest job complete");
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
        const subscribers = await db
          .select()
          .from(digestSubscribers)
          .where(eq(digestSubscribers.active, true));

        if (subscribers.length === 0) {
          logger.info("No active subscribers — skipping Wednesday mid-week push");
          return;
        }

        let sent = 0;
        let failed = 0;

        for (const sub of subscribers) {
          try {
            await sendMidWeekMotivation(sub.email, sub.userName);
            sent++;
          } catch (err) {
            failed++;
            logger.warn({ email: sub.email, err }, "Mid-week motivation send failed for subscriber");
          }
        }

        logger.info({ sent, failed, total: subscribers.length }, "Wednesday mid-week job complete");
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
