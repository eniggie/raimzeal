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
      amount_grams: m.amountGrams ?? null,
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
    ...(r.amount_grams != null ? { amountGrams: r.amount_grams as number } : {}),
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
    amount_grams: meal.amountGrams ?? null,
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

// ─── Community Types ────────────────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  content: string;
  postType: "post" | "question";
  likesCount: number;
  commentsCount: number;
  createdAt: string;
}

export interface CommunityComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

// ─── Community CRUD ─────────────────────────────────────────────────────────

export async function fetchCommunityPosts(
  postType?: "post" | "question",
  limit = 30
): Promise<CommunityPost[]> {
  if (!isSupabaseConfigured) return [];
  let query = supabase
    .from("community_posts")
    .select("*, community_likes(count), community_comments(count)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (postType) query = (query as typeof query).eq("post_type", postType);
  const { data } = await query;
  return (data ?? []).map((r) => {
    const raw = r as typeof r & {
      community_likes: Array<{ count: number }>;
      community_comments: Array<{ count: number }>;
    };
    return {
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      content: r.content,
      postType: r.post_type as "post" | "question",
      likesCount: raw.community_likes?.[0]?.count ?? 0,
      commentsCount: raw.community_comments?.[0]?.count ?? 0,
      createdAt: r.created_at,
    };
  });
}

export async function createCommunityPost(
  userId: string,
  userName: string,
  content: string,
  postType: "post" | "question"
): Promise<CommunityPost | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("community_posts")
    .insert({ user_id: userId, user_name: userName, content, post_type: postType })
    .select()
    .single();
  if (error || !data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    userName: data.user_name,
    content: data.content,
    postType: data.post_type as "post" | "question",
    likesCount: 0,
    commentsCount: 0,
    createdAt: data.created_at,
  };
}

export async function fetchComments(postId: string): Promise<CommunityComment[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    postId: r.post_id,
    userId: r.user_id,
    userName: r.user_name,
    content: r.content,
    createdAt: r.created_at,
  }));
}

export async function createComment(
  postId: string,
  userId: string,
  userName: string,
  content: string
): Promise<CommunityComment | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("community_comments")
    .insert({ post_id: postId, user_id: userId, user_name: userName, content })
    .select()
    .single();
  if (error || !data) return null;
  // Count is maintained by the caller's local state and/or a server-side trigger.
  // We intentionally do NOT update community_posts.comments_count here because
  // that would allow any authenticated user to write to another user's post row.
  return {
    id: data.id,
    postId: data.post_id,
    userId: data.user_id,
    userName: data.user_name,
    content: data.content,
    createdAt: data.created_at,
  };
}

export async function toggleLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; newCount: number }> {
  if (!isSupabaseConfigured) return { liked: false, newCount: 0 };
  const { data: existing } = await supabase
    .from("community_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("community_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    if (error) return { liked: true, newCount: -1 };
  } else {
    const { error } = await supabase
      .from("community_likes")
      .insert({ post_id: postId, user_id: userId });
    if (error) return { liked: false, newCount: -1 };
  }

  // Read the authoritative count directly from community_likes — never from
  // community_posts, which would require a cross-user UPDATE to stay current.
  const { count } = await supabase
    .from("community_likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  return { liked: !existing, newCount: count ?? 0 };
}

export async function checkUserLikes(
  postIds: string[],
  userId: string
): Promise<Set<string>> {
  if (!isSupabaseConfigured || postIds.length === 0) return new Set();
  const { data } = await supabase
    .from("community_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}

// ─── Ovia AI Messages ───────────────────────────────────────────────────────

export interface OviaMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export async function fetchOviaMessages(userId: string): Promise<OviaMessageRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("ovia_messages")
    .select("id, role, content, timestamp")
    .eq("user_id", userId)
    .order("timestamp", { ascending: true })
    .limit(200);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    role: r.role as "user" | "assistant",
    content: r.content as string,
    timestamp: r.timestamp as string,
  }));
}

export async function insertOviaMessage(
  userId: string,
  message: OviaMessageRow
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from("ovia_messages").upsert({
    id: message.id,
    user_id: userId,
    role: message.role,
    content: message.content,
    timestamp: message.timestamp,
  });
}

// ─── Programs ───────────────────────────────────────────────────────────────

export interface ProgramWeek {
  week: string;
  phase: string;
  focus: string;
}

export interface ProgramItem {
  id: string;
  title: string;
  description: string;
  level: "beginner" | "intermediate" | "advanced";
  durationWeeks: number;
  goals: string[];
  schedule: ProgramWeek[] | null;
  isActive: boolean;
}

export async function fetchPrograms(): Promise<ProgramItem[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from("programs")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    level: r.level as ProgramItem["level"],
    durationWeeks: r.duration_weeks,
    goals: r.goals ?? [],
    schedule: r.schedule as ProgramItem["schedule"],
    isActive: r.is_active,
  }));
}
