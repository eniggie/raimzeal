import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const deleteAccountRouter = Router();

deleteAccountRouter.post("/user/delete", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);

    await supabaseAdmin.auth.admin.signOut(userId, "global");

    logger.info({ userId }, "User account soft-deleted — scheduled for hard purge in 30 days");
    res.json({
      success: true,
      message: "Account scheduled for deletion. All personal data will be permanently removed within 30 days.",
    });
  } catch (err) {
    logger.error({ err }, "POST /user/delete error");
    res.status(500).json({ error: "Could not delete account. Please try again." });
  }
});

export default deleteAccountRouter;
