import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { logger } from "../lib/logger";
import { generalWriteRateLimit } from "../lib/rateLimiter";

const userProfileRouter = Router();

userProfileRouter.get("/user/profile", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error && error.code === "PGRST116") {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    logger.error({ err }, "GET /user/profile error");
    res.status(500).json({ error: "Could not fetch profile." });
  }
});

const ProfileUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  age: z.number().int().min(1).max(130).optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  fitness_level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  goals: z.array(z.string()).optional(),
  units: z.enum(["imperial", "metric"]).optional(),
  blood_type: z.enum(["A", "B", "AB", "O"]).optional().nullable(),
  rh_factor: z.enum(["+", "-"]).optional().nullable(),
  genotype: z.enum(["AA", "AS", "AC", "SS", "SC"]).optional().nullable(),
  app_settings: z.object({
    dark_mode: z.boolean().optional(),
    text_size: z.enum(["small", "medium", "large"]).optional(),
    notifications: z.boolean().optional(),
    weight_unit: z.enum(["lbs", "kg"]).optional(),
  }).optional(),
  streak: z.number().int().nonnegative().optional(),
});

userProfileRouter.put("/user/profile", requireAuth, generalWriteRateLimit, async (req, res) => {
  const userId = (req as any).userId as string;
  const parse = ProfileUpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.errors[0]?.message ?? "Invalid request." });
    return;
  }
  try {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const d = parse.data;
    if (d.name !== undefined) updates["name"] = d.name;
    if (d.age !== undefined) updates["age"] = d.age;
    if (d.height !== undefined) updates["height"] = d.height;
    if (d.weight !== undefined) updates["weight"] = d.weight;
    if (d.fitness_level !== undefined) updates["fitness_level"] = d.fitness_level;
    if (d.goals !== undefined) updates["goals"] = d.goals;
    if (d.units !== undefined) updates["units"] = d.units;
    if (d.blood_type !== undefined) updates["blood_type"] = d.blood_type;
    if (d.rh_factor !== undefined) updates["rh_factor"] = d.rh_factor;
    if (d.genotype !== undefined) updates["genotype"] = d.genotype;
    if (d.app_settings !== undefined) updates["app_settings"] = d.app_settings;
    if (d.streak !== undefined) updates["streak"] = d.streak;

    let { data, error } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    // PGRST204 = new optional columns not yet in PostgREST schema cache — retry without them.
    if (error && (error as unknown as Record<string, unknown>)["code"] === "PGRST204") {
      logger.warn({ code: "PGRST204" }, "profile update schema cache miss — retrying without optional columns");
      const fallback = { ...updates };
      delete fallback["blood_type"];
      delete fallback["rh_factor"];
      delete fallback["genotype"];
      ({ data, error } = await supabaseAdmin
        .from("profiles")
        .update(fallback)
        .eq("id", userId)
        .select()
        .single());
    }

    if (error) throw error;
    res.json({ profile: data });
  } catch (err) {
    logger.error({ err }, "PUT /user/profile error");
    res.status(500).json({ error: "Could not update profile." });
  }
});

userProfileRouter.get("/user/app-data", requireAuth, async (req, res) => {
  const userId = (req as any).userId as string;
  try {
    const [profileRes, workoutLogsRes, mealLogsRes, bodyMeasRes, waterRes, scheduledRes, coachRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).single(),
      supabaseAdmin.from("workout_logs").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(200),
      supabaseAdmin.from("meal_logs").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(500),
      supabaseAdmin.from("body_measurements").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(100),
      supabaseAdmin.from("water_intake").select("*").eq("user_id", userId).order("date", { ascending: false }).limit(90),
      supabaseAdmin.from("scheduled_workouts").select("*").eq("user_id", userId).order("date", { ascending: true }).limit(200),
      supabaseAdmin.from("coach_messages").select("id,role,content,is_weekly,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(60),
    ]);

    res.json({
      profile: profileRes.data ?? null,
      workout_logs: workoutLogsRes.data ?? [],
      meal_logs: mealLogsRes.data ?? [],
      body_measurements: bodyMeasRes.data ?? [],
      water_intake: waterRes.data ?? [],
      scheduled_workouts: scheduledRes.data ?? [],
      coach_messages: ((coachRes.data ?? []) as unknown[]).reverse(),
    });
  } catch (err) {
    logger.error({ err }, "GET /user/app-data error");
    res.status(500).json({ error: "Could not fetch app data." });
  }
});

export default userProfileRouter;
