import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const personalRecordsRouter = Router();

personalRecordsRouter.get("/user/personal-records", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data, error } = await supabaseAdmin
      .from("personal_records")
      .select("*")
      .eq("user_id", userId)
      .order("achieved_at", { ascending: false });
    if (error) throw error;
    res.json({ records: data ?? [] });
  } catch (err) {
    logger.error({ err }, "GET /user/personal-records error");
    res.status(500).json({ error: "Could not fetch personal records." });
  }
});

const PRSchema = z.object({
  exercise_name: z.string().min(1).max(100),
  value_type: z.enum(["weight", "reps", "time"]),
  value: z.number().positive(),
  achieved_at: z.string().datetime().optional(),
});

personalRecordsRouter.post("/user/personal-records", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = PRSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." }); return; }
  const { exercise_name, value_type, value, achieved_at } = parse.data;
  try {
    const { data, error } = await supabaseAdmin
      .from("personal_records")
      .insert({ user_id: userId, exercise_name, value_type, value, achieved_at: achieved_at ?? new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    res.json({ record: data });
  } catch (err) {
    logger.error({ err }, "POST /user/personal-records error");
    res.status(500).json({ error: "Could not save personal record." });
  }
});

/**
 * Checks a completed workout's exercises against existing PRs.
 * Returns newly set PRs (if any) for the client to celebrate.
 */
personalRecordsRouter.post("/user/personal-records/check", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const exercises = req.body.exercises as Array<{ name: string; weight?: number; reps?: number; duration?: number }> | undefined;
  if (!Array.isArray(exercises)) { res.status(400).json({ error: "exercises array required." }); return; }

  try {
    const newPRs: Array<{ exercise_name: string; value_type: string; value: number }> = [];

    for (const ex of exercises) {
      const checks: Array<{ value_type: "weight" | "reps" | "time"; value: number }> = [];
      if (ex.weight && ex.weight > 0) checks.push({ value_type: "weight", value: ex.weight });
      if (ex.reps && ex.reps > 0) checks.push({ value_type: "reps", value: ex.reps });
      if (ex.duration && ex.duration > 0) checks.push({ value_type: "time", value: ex.duration });

      for (const check of checks) {
        const { data: existing } = await supabaseAdmin
          .from("personal_records")
          .select("value")
          .eq("user_id", userId)
          .eq("exercise_name", ex.name)
          .eq("value_type", check.value_type)
          .order("value", { ascending: false })
          .limit(1)
          .maybeSingle();

        const prevBest = (existing as Record<string, unknown> | null)?.value as number | null;
        if (prevBest == null || check.value > prevBest) {
          await supabaseAdmin.from("personal_records").insert({
            user_id: userId,
            exercise_name: ex.name,
            value_type: check.value_type,
            value: check.value,
            achieved_at: new Date().toISOString(),
          });
          newPRs.push({ exercise_name: ex.name, value_type: check.value_type, value: check.value });
        }
      }
    }

    res.json({ new_prs: newPRs });
  } catch (err) {
    logger.error({ err }, "POST /user/personal-records/check error");
    res.status(500).json({ error: "Could not check personal records." });
  }
});

personalRecordsRouter.delete("/user/personal-records/:id", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  try {
    await supabaseAdmin.from("personal_records").delete().eq("id", id).eq("user_id", userId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/personal-records/:id error");
    res.status(500).json({ error: "Could not delete personal record." });
  }
});

export default personalRecordsRouter;
