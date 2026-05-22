import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const scheduledWorkoutsRouter = Router();

scheduledWorkoutsRouter.get("/user/scheduled-workouts", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const limit = Math.min(Number(req.query.limit) || 100, 365);
  try {
    const { data, error } = await supabaseAdmin
      .from("scheduled_workouts")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: true })
      .limit(limit);
    if (error) throw error;
    res.json({ workouts: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/scheduled-workouts error");
    res.status(500).json({ error: "Could not fetch scheduled workouts." });
  }
});

const ScheduledWorkoutSchema = z.object({
  id: z.string().uuid().optional(),
  workout_id: z.string().min(1),
  workout_name: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  completed: z.boolean().default(false),
});

scheduledWorkoutsRouter.post("/user/scheduled-workouts", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = ScheduledWorkoutSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { id, workout_id, workout_name, date, completed } = parse.data;

  try {
    // Ownership check: reject if a different user already owns this ID.
    if (id) {
      const { data: existing } = await supabaseAdmin
        .from("scheduled_workouts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (existing) {
        const row = existing as { id: string; user_id: string };
        if (row.user_id !== userId) {
          res.status(403).json({ error: "Forbidden." });
          return;
        }
        res.json({ workout: existing });
        return;
      }
    }

    const row: Record<string, unknown> = { user_id: userId, workout_id, workout_name, date, completed };
    if (id) row["id"] = id;

    const { data, error } = await supabaseAdmin
      .from("scheduled_workouts")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    res.json({ workout: data });
  } catch (err) {
    logger.error({ err }, "POST /user/scheduled-workouts error");
    res.status(500).json({ error: "Could not save scheduled workout." });
  }
});

scheduledWorkoutsRouter.put("/user/scheduled-workouts/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const parse = ScheduledWorkoutSchema.omit({ id: true }).partial().safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from("scheduled_workouts")
      .update(parse.data)
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    res.json({ workout: data });
  } catch (err) {
    logger.error({ err }, "PUT /user/scheduled-workouts/:id error");
    res.status(500).json({ error: "Could not update scheduled workout." });
  }
});

scheduledWorkoutsRouter.delete("/user/scheduled-workouts/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  try {
    const { error } = await supabaseAdmin
      .from("scheduled_workouts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/scheduled-workouts/:id error");
    res.status(500).json({ error: "Could not delete scheduled workout." });
  }
});

export default scheduledWorkoutsRouter;
