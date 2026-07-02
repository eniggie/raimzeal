import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const deleteAccountRouter = Router();

deleteAccountRouter.post("/user/delete", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  try {
    await Promise.allSettled([
      supabaseAdmin.from("workout_logs").delete().eq("user_id", userId),
      supabaseAdmin.from("meal_logs").delete().eq("user_id", userId),
      supabaseAdmin.from("body_measurements").delete().eq("user_id", userId),
      supabaseAdmin.from("water_intake").delete().eq("user_id", userId),
      supabaseAdmin.from("ovia_messages").delete().eq("user_id", userId),
      supabaseAdmin.from("personal_records").delete().eq("user_id", userId),
      supabaseAdmin.from("favourite_foods").delete().eq("user_id", userId),
      supabaseAdmin.from("progress_photos").delete().eq("user_id", userId),
      supabaseAdmin.from("sleep_logs").delete().eq("user_id", userId),
      supabaseAdmin.from("push_tokens").delete().eq("user_id", userId),
    ]);

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      logger.error({ err: deleteError, userId }, "auth.admin.deleteUser failed");
      res.status(500).json({ error: "Could not delete account. Please try again." });
      return;
    }

    logger.info({ userId }, "User account permanently deleted");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "POST /user/delete error");
    res.status(500).json({ error: "Could not delete account. Please try again." });
  }
});

export default deleteAccountRouter;
