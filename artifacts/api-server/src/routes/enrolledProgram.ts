import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const enrolledProgramRouter = Router();

const DAYS_PER_WEEK = 5;

enrolledProgramRouter.get("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  try {
    const { data, error } = await supabaseAdmin
      .from("enrolled_programs")
      .select("*")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json({ enrollment: data ?? null });
  } catch (err) {
    logger.error({ err }, "GET /user/enrolled-program error");
    res.status(500).json({ error: "Could not fetch enrolled program." });
  }
});

const EnrollSchema = z.object({
  program_id: z.string().min(1),
  program_name: z.string().min(1).max(300),
  program_data: z.record(z.unknown()),
});

enrolledProgramRouter.post("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const parse = EnrollSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { program_id, program_name, program_data } = parse.data;
  try {
    await supabaseAdmin
      .from("enrolled_programs")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("completed_at", null);

    const { data, error } = await supabaseAdmin
      .from("enrolled_programs")
      .insert({ user_id: userId, program_id, program_name, program_data, current_week: 1, current_day: 1 })
      .select()
      .single();
    if (error) throw error;
    res.json({ enrollment: data });
  } catch (err) {
    logger.error({ err }, "POST /user/enrolled-program error");
    res.status(500).json({ error: "Could not enroll in program." });
  }
});

// Keywords drawn from program phase descriptions that indicate which muscle groups / training
// modalities are expected for that phase. The set is intentionally broad so that minor naming
// differences in custom workouts still match.
const PHASE_KEYWORDS = new Set([
  "chest", "shoulder", "shoulders", "tricep", "triceps",
  "back", "bicep", "biceps", "lat", "lats",
  "legs", "leg", "squat", "deadlift", "lunge", "glute", "glutes", "hamstring", "hamstrings", "calf", "calves",
  "core", "abs", "plank",
  "push", "pull", "upper", "lower",
  "hiit", "cardio", "circuit", "full", "compound",
  "bench", "press", "row", "curl", "extension", "dip", "raise",
  "strength", "hypertrophy", "power", "endurance",
]);

/**
 * Extract the relevant keywords from a phase focus text.
 * Returns the set of known phase-keyword tokens found in the text.
 * If fewer than 2 are found, the phase is considered "generic" and any
 * workout is accepted (prevents locking out users on weeks like "Deload").
 */
function extractPhaseKeywords(focus: string): Set<string> {
  const lower = focus.toLowerCase();
  const found = new Set<string>();
  for (const kw of PHASE_KEYWORDS) {
    if (lower.includes(kw)) found.add(kw);
  }
  return found;
}

/**
 * Returns true when the workout is considered a valid match for the given phase keywords.
 * Matching rules:
 *  - If the phase has fewer than 2 specific keywords → generic phase → any substantive workout matches.
 *  - Otherwise at least one keyword must appear in the workout name or any exercise name.
 */
function workoutMatchesPhase(
  workoutName: string,
  exercises: { name: string }[],
  phaseKeywords: Set<string>
): boolean {
  if (phaseKeywords.size < 2) return true; // generic / deload / test-week phases
  const haystack = [
    workoutName,
    ...exercises.map((e) => e.name),
  ].join(" ").toLowerCase();
  for (const kw of phaseKeywords) {
    if (haystack.includes(kw)) return true;
  }
  return false;
}

const AdvanceSchema = z.object({
  workout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "workout_date must be YYYY-MM-DD"),
  workout_name: z.string().min(1).max(300),
  exercises: z.array(z.object({ name: z.string().min(1) })).min(1),
});

enrolledProgramRouter.patch("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  const parse = AdvanceSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  const { workout_date, workout_name, exercises } = parse.data;
  try {
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("enrolled_programs")
      .select("*")
      .eq("user_id", userId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!current) {
      res.json({ enrollment: null });
      return;
    }
    const row = current as {
      id: string;
      current_week: number;
      current_day: number;
      last_advance_date: string | null;
      program_data: {
        durationWeeks?: number;
        schedule?: Array<{ week: string; phase: string; focus: string }> | null;
      };
    };

    // Idempotency guard: only advance once per calendar day
    if (row.last_advance_date && row.last_advance_date >= workout_date) {
      res.json({ enrollment: current, skipped: true, reason: "already_advanced_today" });
      return;
    }

    // Phase-keyword match guard: validate the logged workout fits the current program phase.
    // Find the phase entry whose week range covers current_week (e.g. "1–2", "3–4").
    const schedule = row.program_data?.schedule ?? null;
    if (schedule && schedule.length > 0) {
      const currentPhase = schedule.find((s) => {
        const [startStr, endStr] = s.week.split(/[–\-]/);
        const start = parseInt(startStr ?? "1", 10);
        const end = endStr ? parseInt(endStr, 10) : start;
        return row.current_week >= start && row.current_week <= end;
      }) ?? schedule[schedule.length - 1];

      const phaseKeywords = extractPhaseKeywords(currentPhase?.focus ?? "");
      if (!workoutMatchesPhase(workout_name, exercises, phaseKeywords)) {
        res.json({ enrollment: current, skipped: true, reason: "no_phase_match" });
        return;
      }
    }

    const durationWeeks: number = row.program_data?.durationWeeks ?? 8;
    let newDay = row.current_day + 1;
    let newWeek = row.current_week;
    let completedAt: string | null = null;
    if (newDay > DAYS_PER_WEEK) {
      newDay = 1;
      newWeek += 1;
    }
    if (newWeek > durationWeeks) {
      completedAt = new Date().toISOString();
    }
    const updates: Record<string, unknown> = {
      current_day: newDay,
      current_week: newWeek,
      last_advance_date: workout_date,
    };
    if (completedAt) updates["completed_at"] = completedAt;
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("enrolled_programs")
      .update(updates)
      .eq("id", row.id)
      .select()
      .single();
    if (updateErr) throw updateErr;
    res.json({ enrollment: updated });
  } catch (err) {
    logger.error({ err }, "PATCH /user/enrolled-program error");
    res.status(500).json({ error: "Could not advance program." });
  }
});

enrolledProgramRouter.delete("/user/enrolled-program", requireAuth, async (req, res) => {
  const userId = req.userId as string;
  try {
    await supabaseAdmin
      .from("enrolled_programs")
      .update({ completed_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("completed_at", null);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "DELETE /user/enrolled-program error");
    res.status(500).json({ error: "Could not unenroll from program." });
  }
});

export default enrolledProgramRouter;
