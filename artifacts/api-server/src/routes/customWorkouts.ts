import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const customWorkoutsRouter = Router();

customWorkoutsRouter.get("/user/workouts", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  try {
    const { data, error } = await supabaseAdmin
      .from("custom_workouts")
      .select("*, custom_workout_exercises(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    res.json({ workouts: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/workouts error");
    res.status(500).json({ error: "Could not fetch workouts." });
  }
});

const ExerciseSchema = z.object({
  exercise_name: z.string().min(1).max(100),
  sets: z.number().int().min(1).max(100).default(3),
  reps: z.number().int().min(1).max(1000).optional().nullable(),
  duration_sec: z.number().int().min(1).optional().nullable(),
  weight_kg: z.number().nonnegative().optional().nullable(),
  notes: z.string().max(200).optional().nullable(),
  sort_order: z.number().int().default(0),
});

const WorkoutSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  estimated_duration_min: z.number().int().min(1).optional().nullable(),
  exercises: z.array(ExerciseSchema).min(1).max(50),
});

customWorkoutsRouter.post("/user/workouts", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const parse = WorkoutSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." }); return; }
  const { name, description, estimated_duration_min, exercises } = parse.data;

  try {
    const { data: workout, error: wError } = await supabaseAdmin
      .from("custom_workouts")
      .insert({ user_id: userId, name, description, estimated_duration_min })
      .select()
      .single();
    if (wError) throw wError;

    const row = workout as { id: string };
    const exerciseRows = exercises.map((ex, i) => ({
      workout_id: row.id,
      exercise_name: ex.exercise_name,
      sets: ex.sets,
      reps: ex.reps ?? null,
      duration_sec: ex.duration_sec ?? null,
      weight_kg: ex.weight_kg ?? null,
      notes: ex.notes ?? null,
      sort_order: ex.sort_order ?? i,
    }));

    const { error: exError } = await supabaseAdmin
      .from("custom_workout_exercises")
      .insert(exerciseRows);
    if (exError) throw exError;

    res.json({ workout: { ...row, custom_workout_exercises: exerciseRows } });
  } catch (err) {
    logger.error({ err }, "POST /user/workouts error");
    res.status(500).json({ error: "Could not save workout." });
  }
});

customWorkoutsRouter.delete("/user/workouts/:id", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const id = req.params["id"] as string;
  try {
    await supabaseAdmin.from("custom_workouts").delete().eq("id", id).eq("user_id", userId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/workouts/:id error");
    res.status(500).json({ error: "Could not delete workout." });
  }
});

export default customWorkoutsRouter;
