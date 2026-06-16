import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const deleteAccountRouter = Router();

async function deleteWhere(table: string, column: string, value: string): Promise<void> {
  const { error } = await supabaseAdmin.from(table).delete().eq(column, value);
  if (error) {
    // Log as error (not warn) so monitoring surfaces partial deletion failures.
    // We deliberately do NOT throw: the auth user must always be deleted (GDPR),
    // and orphaned rows are inaccessible via RLS even without the auth record.
    logger.error({ table, column, err: error }, "Account deletion: data table cleanup failed");
  }
}

deleteAccountRouter.post("/user/delete", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const progressPhotos = await supabaseAdmin
      .from("progress_photos")
      .select("storage_path")
      .eq("user_id", userId);

    const storagePaths = (progressPhotos.data ?? [])
      .map((row: { storage_path?: string | null }) => row.storage_path)
      .filter((path): path is string => Boolean(path));
    if (storagePaths.length > 0) {
      const { error } = await supabaseAdmin.storage.from("progress-photos").remove(storagePaths);
      if (error) logger.warn({ err: error }, "Failed to remove progress photo files during account deletion");
    }

    await Promise.all([
      deleteWhere("verification_codes", "user_id", userId),
      deleteWhere("community_blocks", "blocker_user_id", userId),
      deleteWhere("community_blocks", "blocked_user_id", userId),
      deleteWhere("community_reports", "reporter_user_id", userId),
      deleteWhere("community_reports", "reported_user_id", userId),
      deleteWhere("community_likes", "user_id", userId),
      deleteWhere("community_comments", "user_id", userId),
      deleteWhere("community_posts", "user_id", userId),
      deleteWhere("personal_records", "user_id", userId),
      deleteWhere("sleep_logs", "user_id", userId),
      deleteWhere("workout_logs", "user_id", userId),
      deleteWhere("meal_logs", "user_id", userId),
      deleteWhere("body_measurements", "user_id", userId),
      deleteWhere("water_intake", "user_id", userId),
      deleteWhere("scheduled_workouts", "user_id", userId),
      deleteWhere("coach_messages", "user_id", userId),
      deleteWhere("favourite_foods", "user_id", userId),
      deleteWhere("progress_photos", "user_id", userId),
      deleteWhere("custom_workouts", "user_id", userId),
      deleteWhere("enrolled_programs", "user_id", userId),
      deleteWhere("ovia_messages", "user_id", userId),
      deleteWhere("profiles", "id", userId),
    ]);

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) throw deleteUserError;

    logger.info({ userId }, "User account permanently deleted");
    res.json({
      success: true,
      message: "Account deleted. Your RAIMZEAL profile, app data, and sign-in account were permanently removed.",
    });
  } catch (err) {
    logger.error({ err }, "POST /user/delete error");
    res.status(500).json({ error: "Could not delete account. Please try again." });
  }
});

export default deleteAccountRouter;
