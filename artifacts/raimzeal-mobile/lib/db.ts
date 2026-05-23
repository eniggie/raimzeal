/**
 * Supabase database helpers — mirrors the web app schema exactly.
 * All functions are no-ops when Supabase is not configured.
 *
 * Security note: community mutations (createCommunityPost, toggleLike,
 * createComment) are routed through the trusted API server instead of
 * calling Supabase directly. This prevents any authenticated client from
 * performing cross-user row updates on community_posts.
 */
import { Platform } from "react-native";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type {
  WorkoutLog,
  MealLog,
  BodyMeasurement,
  UserProfile,
} from "@/contexts/FitnessContext";

// ─── API base URL (mirrors the pattern used in ovia.tsx / membership.tsx) ──

export function getApiBase(): string {
  if (Platform.OS === "web") return "/api";
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  const explicit = process.env["EXPO_PUBLIC_API_BASE"];
  if (explicit) return explicit;
  return "http://localhost:80/api";
}

/**
 * Returns the current session's access token so community mutation calls
 * can present a Bearer token to requireAuth on the API server.
 */
async function getAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

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

export async function upsertMealLog(userId: string, meal: MealLog) {
  if (!isSupabaseConfigured) return;
  await supabase.from("meal_logs").upsert({
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

export async function insertBodyMeasurement(userId: string, m: BodyMeasurement) {
  if (!isSupabaseConfigured) return;
  await supabase.from("body_measurements").upsert({
    id: m.id,
    user_id: userId,
    date: m.date,
    weight: m.weight,
    chest: m.chest ?? null,
    waist: m.waist ?? null,
    hips: m.hips ?? null,
    arms: m.arms ?? null,
    thighs: m.thighs ?? null,
  });
}

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
  _userId: string,
  userName: string,
  content: string,
  postType: "post" | "question"
): Promise<CommunityPost | null> {
  if (!isSupabaseConfigured) return null;
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/community/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userName, content, postType }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { post: Record<string, unknown> };
    const d = json.post;
    return {
      id: d.id as string,
      userId: d.user_id as string,
      userName: d.user_name as string,
      content: d.content as string,
      postType: d.post_type as "post" | "question",
      likesCount: 0,
      commentsCount: 0,
      createdAt: d.created_at as string,
    };
  } catch {
    return null;
  }
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
  _userId: string,
  userName: string,
  content: string
): Promise<CommunityComment | null> {
  if (!isSupabaseConfigured) return null;
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/community/posts/${encodeURIComponent(postId)}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userName, content }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { comment: Record<string, unknown> };
    const d = json.comment;
    return {
      id: d.id as string,
      postId: d.post_id as string,
      userId: d.user_id as string,
      userName: d.user_name as string,
      content: d.content as string,
      createdAt: d.created_at as string,
    };
  } catch {
    return null;
  }
}

export async function toggleLike(
  postId: string,
  _userId: string
): Promise<{ liked: boolean; newCount: number }> {
  if (!isSupabaseConfigured) return { liked: false, newCount: 0 };
  const token = await getAccessToken();
  if (!token) return { liked: false, newCount: -1 };
  try {
    const res = await fetch(`${getApiBase()}/community/posts/${encodeURIComponent(postId)}/likes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return { liked: false, newCount: -1 };
    const json = (await res.json()) as { liked: boolean; count: number };
    return { liked: json.liked, newCount: json.count };
  } catch {
    return { liked: false, newCount: -1 };
  }
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

// ─── User Preferences ──────────────────────────────────────────────────────

export interface UserPreferences {
  activeFilters?: string[];
  customPresets?: Array<{ id: string; name: string; filterKeys: string[] }>;
  /** Custom filter threshold values keyed by filter key (e.g. { highProtein: 20 }) */
  filterThresholds?: Record<string, number>;
  /** App-level settings synced to the cloud profile */
  appSettings?: {
    showRestoreBadge?: boolean;
    /**
     * Whether the user previously dismissed the in-app camera-roll rationale
     * sheet. Stored here so a returning user on a fresh install still skips
     * the pre-prompt they already declined.
     */
    cameraRollRationaleDismissed?: boolean;
    darkMode?: boolean;
    notifications?: boolean;
    weightUnit?: "lbs" | "kg";
    undoWindowSeconds?: 3 | 5 | 10;
    reorderHintFrequency?: "never" | "monthly" | "weekly";
  };
}

export async function fetchUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();
  if (!data?.preferences) return null;
  return data.preferences as UserPreferences;
}

export async function upsertUserPreferences(
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from("profiles")
    .upsert({ id: userId, preferences: prefs, updated_at: new Date().toISOString() });
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
