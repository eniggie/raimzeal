import { Router, type Request, type Response, type NextFunction, type IRouter } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/**
 * requireAdminRole — must be chained after requireAuth.
 * Verifies the authenticated user has app_metadata.role === "admin"
 * by looking up the user via the service-role client (bypasses JWT claims
 * so it always reflects the current Supabase state).
 */
async function requireAdminRole(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).userId as string | undefined;
  if (!userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    logger.warn({ userId, err: error }, "Admin role check: failed to fetch user");
    res.status(401).json({ error: "Could not verify admin status." });
    return;
  }

  const role = (data.user.app_metadata as Record<string, unknown> | undefined)?.role;
  if (role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}

const APP_CONFIG_TABLE = "app_config";
const ALERT_EMAIL_KEY = "alert_email";

const UpdateAlertSettingsSchema = z.object({
  alertEmail: z.string().email("Must be a valid email address."),
});

router.get("/admin/alert-settings", requireAuth, requireAdminRole, async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from(APP_CONFIG_TABLE)
    .select("value")
    .eq("key", ALERT_EMAIL_KEY)
    .maybeSingle();

  if (error) {
    logger.error({ err: error }, "Failed to read alert email from app_config");
    res.status(500).json({ error: "Failed to read alert settings." });
    return;
  }

  const alertEmail: string | null =
    data?.value ?? process.env["ALERT_EMAIL"] ?? process.env["SMTP_USER"] ?? null;
  const source: "database" | "env" | "unset" =
    data?.value ? "database"
    : (process.env["ALERT_EMAIL"] ?? process.env["SMTP_USER"]) ? "env"
    : "unset";

  res.json({ alertEmail, source });
});

router.put("/admin/alert-settings", requireAuth, requireAdminRole, async (req, res) => {
  const result = UpdateAlertSettingsSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.errors[0]?.message ?? "Invalid request body." });
    return;
  }

  const { alertEmail } = result.data;

  const { error } = await supabaseAdmin
    .from(APP_CONFIG_TABLE)
    .upsert({ key: ALERT_EMAIL_KEY, value: alertEmail }, { onConflict: "key" });

  if (error) {
    logger.error({ err: error }, "Failed to save alert email to app_config");
    res.status(500).json({ error: "Failed to save alert settings." });
    return;
  }

  logger.info({ alertEmail, userId: (req as any).userId }, "Alert email updated via admin API");
  res.json({ alertEmail, source: "database" });
});

export default router;
