import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";

const macrosRouter = Router();

export function computeMacros(profile: {
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  fitness_level?: string | null;
  goals?: string[] | null;
  units?: string | null;
}): { calories: number; protein: number; carbs: number; fat: number } {
  let weightKg = Number(profile.weight) || 70;
  let heightCm = Number(profile.height) || 170;
  const age = Number(profile.age) || 25;
  const units = profile.units ?? "metric";

  if (units !== "metric") {
    weightKg = weightKg * 0.453592;
    heightCm = heightCm * 2.54;
  }

  // Mifflin-St Jeor (male formula — ~5% higher than female, safe default)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;

  const level = profile.fitness_level ?? "beginner";
  const activityMultiplier = level === "advanced" ? 1.8 : level === "intermediate" ? 1.6 : 1.4;

  const tdee = bmr * activityMultiplier;

  const goals = profile.goals ?? [];
  const wantsLose = goals.includes("lose_weight");
  const wantsGain = goals.includes("build_muscle") || goals.includes("gain_weight");
  const calorieMultiplier = wantsLose ? 0.85 : wantsGain ? 1.15 : 1.0;

  const calories = Math.round(tdee * calorieMultiplier);
  const protein = Math.round(weightKg * 2.0);
  const fat = Math.round(weightKg * 0.8);
  const carbCals = calories - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(carbCals / 4));

  return { calories, protein, carbs, fat };
}

macrosRouter.get("/user/macros", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("age,height,weight,fitness_level,goals,units,macro_targets")
      .eq("id", userId)
      .single();

    const row = data as Record<string, unknown> | null;
    if (!row) { res.status(404).json({ error: "Profile not found." }); return; }

    const stored = row.macro_targets as Record<string, unknown> | null;
    if (stored && stored.auto === false) {
      res.json({ ...stored, source: "manual" });
      return;
    }

    const computed = computeMacros(row as Parameters<typeof computeMacros>[0]);
    res.json({ ...computed, auto: true, source: "computed" });
  } catch (err) {
    logger.error({ err }, "GET /user/macros error");
    res.status(500).json({ error: "Could not fetch macro targets." });
  }
});

const MacrosSchema = z.object({
  calories: z.number().positive(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  auto: z.boolean().optional(),
});

macrosRouter.put("/user/macros", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = MacrosSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." }); return; }
  const { calories, protein, carbs, fat, auto } = parse.data;
  try {
    await supabaseAdmin.from("profiles").update({ macro_targets: { calories, protein, carbs, fat, auto: auto ?? false } }).eq("id", userId);
    res.json({ calories, protein, carbs, fat, auto: auto ?? false, source: "manual" });
  } catch (err) {
    logger.error({ err }, "PUT /user/macros error");
    res.status(500).json({ error: "Could not save macro targets." });
  }
});

macrosRouter.delete("/user/macros", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    await supabaseAdmin.from("profiles").update({ macro_targets: null }).eq("id", userId);
    res.json({ success: true, message: "Reverted to auto-computed targets." });
  } catch (err) {
    logger.error({ err }, "DELETE /user/macros error");
    res.status(500).json({ error: "Could not reset macro targets." });
  }
});

export default macrosRouter;
