import cron from "node-cron";
import { db, digestSubscribers } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";
import { sendWeeklyDigest } from "./routes/email";

export function startScheduler(): void {
  // Every Saturday at 08:00 WAT (West Africa Time = UTC+1 → 07:00 UTC)
  cron.schedule(
    "0 7 * * 6",
    async () => {
      logger.info("Saturday digest job starting");
      try {
        const subscribers = await db
          .select()
          .from(digestSubscribers)
          .where(eq(digestSubscribers.active, true));

        if (subscribers.length === 0) {
          logger.info("No active digest subscribers — skipping");
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
            logger.warn({ email: sub.email, err }, "Weekly digest send failed for subscriber");
          }
        }

        logger.info({ sent, failed, total: subscribers.length }, "Saturday digest job complete");
      } catch (err) {
        logger.error({ err }, "Saturday digest job crashed");
      }
    },
    { timezone: "UTC" },
  );

  logger.info("Scheduler started — Saturday digest fires at 07:00 UTC (08:00 WAT)");
}
