import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const workoutLogsRouter = Router();

workoutLogsRouter.get("/user/workout-logs", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const maxLimit = 500;
  const limit = Math.min(Number(req.query.limit) || 100, maxLimit);
  try {
    const { data, error } = await supabaseAdmin
      .from("workout_logs")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    res.json({ logs: data ?? [], historyLimit: maxLimit });
  } catch (err) {
    logger.error({ err }, "GET /user/workout-logs error");
    res.status(500).json({ error: "Could not fetch workout logs." });
  }
});

const ExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  sets: z.number().int().nonnegative().max(999),
  reps: z.number().int().nonnegative().max(9999),
  weight: z.number().nonnegative().max(9999).optional(),
});

const WorkoutLogSchema = z.object({
  id: z.string().uuid().optional(),
  workout_id: z.string().min(1).max(100),
  workout_name: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  duration: z.number().int().nonnegative().max(1440),
  calories_burned: z.number().int().nonnegative().max(99999),
  exercises: z.array(ExerciseSchema).max(100, "Too many exercises — max 100 per log."),
});

workoutLogsRouter.post("/user/workout-logs", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = WorkoutLogSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { id, workout_id, workout_name, date, duration, calories_burned, exercises } = parse.data;

  try {
    // If client supplies an ID, verify it either doesn't exist or already belongs to this user.
    // This prevents IDOR: an attacker knowing another user's record ID cannot overwrite it.
    if (id) {
      const { data: existing } = await supabaseAdmin
        .from("workout_logs")
        .select("id, user_id")
        .eq("id", id)
        .maybeSingle();

      if (existing) {
        const row = existing as { id: string; user_id: string };
        if (row.user_id !== userId) {
          res.status(403).json({ error: "Forbidden." });
          return;
        }
        // Already synced for this user — return idempotently
        res.json({ log: existing });
        return;
      }
    }

    const row: Record<string, unknown> = {
      user_id: userId, workout_id, workout_name, date, duration, calories_burned, exercises,
    };
    if (id) row["id"] = id;

    const { data, error } = await supabaseAdmin
      .from("workout_logs")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.json({ log: data });
  } catch (err) {
    logger.error({ err }, "POST /user/workout-logs error");
    res.status(500).json({ error: "Could not save workout log." });
  }
});

workoutLogsRouter.delete("/user/workout-logs/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from("workout_logs")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/workout-logs/:id error");
    res.status(500).json({ error: "Could not delete workout log." });
  }
});

export default workoutLogsRouter;
