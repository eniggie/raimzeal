/**
 * Supabase database helpers — mirrors the web app schema exactly.
 * All functions are no-ops when Supabase is not configured.
 */
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  WorkoutLog,
  MealLog,
  BodyMeasurement,
  UserProfile,
} from "@/contexts/FitnessContext";

// ─── Profiles ──────────────────────────────────────────────────────────────

export async function upsertProfile(userId: string, profile: Partial<UserProfile>) {
  if (!isSupabaseConfigured) return;
  await supabase.from("profiles").upsert({
    id: userId,
    name: profile.name,
    age: profile.age,
    height: profile.height,
    weight: profile.weight,
    fitness_level: profile.fitnessLevel,
    goals: profile.goals,
    units: profile.units,
    updated_at: new Date().toISOString(),
  });
}

export async function fetchProfile(userId: string): Promise<Partial<UserProfile> | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    age: data.age,
    height: data.height,
    weight: data.weight,
    fitnessLevel: data.fitness_level,
    goals: data.goals ?? [],
    units: data.units,
  };
}

// ─── Workout Logs ──────────────────────────────────────────────────────────

export async function syncWorkoutLogs(userId: string, logs: WorkoutLog[]) {
  if (!isSupabaseConfigured || logs.length === 0) return;
  await supabase.from("workout_logs").upsert(
    logs.map((l) => ({
      id: l.id,
      user_id: userId,
      workout_id: l.workoutId,
      workout_name: l.workoutName,
      date: l.date,
      duration: l.duration,
      calories_burned: l.caloriesBurned,
      exercises: l.exercises,
    }))
  );
}

export async function fetchWorkoutLogs(userId: string): Promise<WorkoutLog[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("workout_logs")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    workoutId: r.workout_id,
    workoutName: r.workout_name,
    date: r.date,
    duration: r.duration,
    caloriesBurned: r.calories_burned,
    exercises: r.exercises ?? [],
  }));
}

export async function insertWorkoutLog(userId: string, log: WorkoutLog) {
  if (!isSupabaseConfigured) return;
  await supabase.from("workout_logs").insert({
    id: log.id,
    user_id: userId,
    workout_id: log.workoutId,
    workout_name: log.workoutName,
    date: log.date,
    duration: log.duration,
    calories_burned: log.caloriesBurned,
    exercises: log.exercises,
  });
}

// ─── Meal Logs ─────────────────────────────────────────────────────────────

export async function syncMealLogs(userId: string, logs: MealLog[]) {
  if (!isSupabaseConfigured || logs.length === 0) return;
  await supabase.from("meal_logs").upsert(
    logs.map((m) => ({
      id: m.id,
      user_id: userId,
      date: m.date,
      name: m.name,
      calories: m.calories,
      protein: m.protein,
      carbs: m.carbs,
      fat: m.fat,
      meal_type: m.mealType,
    }))
  );
}

export async function fetchMealLogs(userId: string): Promise<MealLog[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("meal_logs")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    name: r.name,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    mealType: r.meal_type as MealLog["mealType"],
  }));
}

export async function insertMealLog(userId: string, meal: MealLog) {
  if (!isSupabaseConfigured) return;
  await supabase.from("meal_logs").insert({
    id: meal.id,
    user_id: userId,
    date: meal.date,
    name: meal.name,
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
    meal_type: meal.mealType,
  });
}

// ─── Body Measurements ─────────────────────────────────────────────────────

export async function syncBodyMeasurements(userId: string, items: BodyMeasurement[]) {
  if (!isSupabaseConfigured || items.length === 0) return;
  await supabase.from("body_measurements").upsert(
    items.map((m) => ({
      id: m.id,
      user_id: userId,
      date: m.date,
      weight: m.weight,
      chest: m.chest,
      waist: m.waist,
      hips: m.hips,
      arms: m.arms,
      thighs: m.thighs,
    }))
  );
}

export async function fetchBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    weight: r.weight,
    chest: r.chest,
    waist: r.waist,
    hips: r.hips,
    arms: r.arms,
    thighs: r.thighs,
  }));
}

// ─── Water Intake ──────────────────────────────────────────────────────────

export async function upsertWaterIntake(
  userId: string,
  date: string,
  glasses: number
) {
  if (!isSupabaseConfigured) return;
  await supabase.from("water_intake").upsert({ user_id: userId, date, glasses });
}

export async function fetchWaterIntake(
  userId: string
): Promise<{ date: string; glasses: number }[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("water_intake")
    .select("date, glasses")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(30);
  return data ?? [];
}
