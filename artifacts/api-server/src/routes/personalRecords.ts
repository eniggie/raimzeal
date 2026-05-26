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

const CheckExerciseSchema = z.object({
  name: z.string().min(1).max(100),
  weight: z.number().positive().optional(),
  reps: z.number().int().positive().optional(),
  duration: z.number().positive().optional(),
});

const CheckPRSchema = z.object({
  exercises: z.array(CheckExerciseSchema).max(50, "Too many exercises — max 50 per check."),
});

/**
 * Checks a completed workout's exercises against existing PRs.
 * Returns newly set PRs (if any) for the client to celebrate.
 * Batches all existing-PR lookups into a single query to avoid N+1.
 */
personalRecordsRouter.post("/user/personal-records/check", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = CheckPRSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { exercises } = parse.data;

  try {
    const newPRs: Array<{ exercise_name: string; value_type: string; value: number }> = [];

    // Collect all (exercise_name, value_type, value) candidates to check
    type Candidate = { exercise_name: string; value_type: "weight" | "reps" | "time"; value: number };
    const candidates: Candidate[] = [];
    for (const ex of exercises) {
      if (ex.weight) candidates.push({ exercise_name: ex.name, value_type: "weight", value: ex.weight });
      if (ex.reps)   candidates.push({ exercise_name: ex.name, value_type: "reps",   value: ex.reps });
      if (ex.duration) candidates.push({ exercise_name: ex.name, value_type: "time", value: ex.duration });
    }
    if (candidates.length === 0) { res.json({ new_prs: [] }); return; }

    // Fetch all existing PRs for this user in a single query, then compare in-memory
    const exerciseNames = [...new Set(candidates.map((c) => c.exercise_name))];
    const { data: existingRecords, error: fetchError } = await supabaseAdmin
      .from("personal_records")
      .select("exercise_name, value_type, value")
      .eq("user_id", userId)
      .in("exercise_name", exerciseNames);
    if (fetchError) throw fetchError;

    const bestMap = new Map<string, number>();
    for (const r of (existingRecords ?? []) as Array<{ exercise_name: string; value_type: string; value: number }>) {
      const key = `${r.exercise_name}||${r.value_type}`;
      bestMap.set(key, Math.max(bestMap.get(key) ?? 0, r.value));
    }

    const inserts: Array<{ user_id: string; exercise_name: string; value_type: string; value: number; achieved_at: string }> = [];
    const now = new Date().toISOString();
    for (const c of candidates) {
      const key = `${c.exercise_name}||${c.value_type}`;
      const prevBest = bestMap.get(key) ?? null;
      if (prevBest == null || c.value > prevBest) {
        inserts.push({ user_id: userId, exercise_name: c.exercise_name, value_type: c.value_type, value: c.value, achieved_at: now });
        newPRs.push({ exercise_name: c.exercise_name, value_type: c.value_type, value: c.value });
      }
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabaseAdmin.from("personal_records").insert(inserts);
      if (insertError) throw insertError;
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
