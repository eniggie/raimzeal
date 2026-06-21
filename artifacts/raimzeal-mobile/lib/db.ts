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
export async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ─── Profiles ──────────────────────────────────────────────────────────────

export async function upsertProfile(userId: string, profile: Partial<UserProfile>) {
  if (!isSupabaseConfigured) return;
  try {
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
  } catch { /* non-fatal — local state is the source of truth */ }
}

export async function fetchProfile(userId: string): Promise<Partial<UserProfile> | null> {
  if (!isSupabaseConfigured) return null;
  try {
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
  } catch {
    return null;
  }
}

// ─── Workout Logs ──────────────────────────────────────────────────────────

export async function syncWorkoutLogs(userId: string, logs: WorkoutLog[]) {
  if (!isSupabaseConfigured || logs.length === 0) return;
  try {
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
  } catch { /* non-fatal */ }
}

export async function fetchWorkoutLogs(userId: string): Promise<WorkoutLog[]> {
  if (!isSupabaseConfigured) return [];
  try {
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
  } catch {
    return [];
  }
}

export async function insertWorkoutLog(userId: string, log: WorkoutLog) {
  if (!isSupabaseConfigured) return;
  try {
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
  } catch { /* non-fatal */ }
}

// ─── Meal Logs ─────────────────────────────────────────────────────────────

export async function syncMealLogs(userId: string, logs: MealLog[]) {
  if (!isSupabaseConfigured || logs.length === 0) return;
  try {
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
  } catch { /* non-fatal */ }
}

export async function fetchMealLogs(userId: string): Promise<MealLog[]> {
  if (!isSupabaseConfigured) return [];
  try {
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
  } catch {
    return [];
  }
}

export async function insertMealLog(userId: string, meal: MealLog) {
  if (!isSupabaseConfigured) return;
  try {
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
  } catch { /* non-fatal */ }
}

export async function upsertMealLog(userId: string, meal: MealLog) {
  if (!isSupabaseConfigured) return;
  try {
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
  } catch { /* non-fatal */ }
}

export async function deleteMealLog(id: string) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("meal_logs").delete().eq("id", id);
  } catch { /* non-fatal */ }
}

export async function deleteWorkoutLog(id: string) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("workout_logs").delete().eq("id", id);
  } catch { /* non-fatal */ }
}

// ─── Body Measurements ─────────────────────────────────────────────────────

export async function insertBodyMeasurement(userId: string, m: BodyMeasurement) {
  if (!isSupabaseConfigured) return;
  try {
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
  } catch { /* non-fatal */ }
}

export async function syncBodyMeasurements(userId: string, items: BodyMeasurement[]) {
  if (!isSupabaseConfigured || items.length === 0) return;
  try {
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
  } catch { /* non-fatal */ }
}

export async function fetchBodyMeasurements(userId: string): Promise<BodyMeasurement[]> {
  if (!isSupabaseConfigured) return [];
  try {
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
  } catch {
    return [];
  }
}

// ─── Water Intake ──────────────────────────────────────────────────────────

export async function upsertWaterIntake(
  userId: string,
  date: string,
  glasses: number
) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("water_intake").upsert({ user_id: userId, date, glasses });
  } catch { /* non-fatal */ }
}

export async function fetchWaterIntake(
  userId: string
): Promise<{ date: string; glasses: number }[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { data } = await supabase
      .from("water_intake")
      .select("date, glasses")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(30);
    return data ?? [];
  } catch {
    return [];
  }
}

// ─── Community Types ────────────────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  content: string;
  postType: "post" | "question" | "win" | "tip" | "challenge";
  imageUrl?: string | null;
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  authorTier?: "foundation" | "rise" | "reign" | "legacy";
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
  postType?: "post" | "question" | "win" | "tip" | "challenge",
  limit = 30,
  legacyOnly = false
): Promise<CommunityPost[]> {
  // Fetch via the API server (admin client, bypasses RLS) instead of querying
  // Supabase directly — this eliminates RLS failures and relationship-query issues.
  const params = new URLSearchParams({
    limit: String(limit),
    legacyOnly: String(legacyOnly),
  });
  if (postType) params.set("postType", postType);

  // Inner Circle requires an authenticated Legacy user — send token so the
  // server can enforce the tier gate. Public feed (legacyOnly=false) is auth-free.
  const headers: Record<string, string> = {};
  if (legacyOnly) {
    const token = await getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBase()}/community/posts?${params.toString()}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch posts (${res.status})`);
  const body = await res.json() as { posts: CommunityPost[] };
  return body.posts ?? [];
}

export async function createCommunityPost(
  _userId: string,
  userName: string,
  content: string,
  postType: "post" | "question" | "win" | "tip" | "challenge",
  imageUrl?: string | null
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
      body: JSON.stringify({ userName, content, postType, imageUrl: imageUrl ?? undefined }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { post: Record<string, unknown> };
    const d = json.post;
    return {
      id: d.id as string,
      userId: d.user_id as string,
      userName: d.user_name as string,
      content: d.content as string,
      postType: d.post_type as "post" | "question" | "win" | "tip" | "challenge",
      imageUrl: (d.image_url as string | null | undefined) ?? null,
      likesCount: 0,
      commentsCount: 0,
      createdAt: d.created_at as string,
    };
  } catch {
    return null;
  }
}

export async function createLegacyCommunityPost(
  _userId: string,
  userName: string,
  content: string,
  postType: "post" | "question" | "win" | "tip" | "challenge",
  imageUrl?: string | null
): Promise<CommunityPost | null> {
  if (!isSupabaseConfigured) return null;
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/legacy/community/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userName, content, postType, imageUrl: imageUrl ?? undefined }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { post: Record<string, unknown> };
    const d = json.post;
    return {
      id: d.id as string,
      userId: d.user_id as string,
      userName: d.user_name as string,
      content: d.content as string,
      postType: d.post_type as "post" | "question" | "win" | "tip" | "challenge",
      imageUrl: (d.image_url as string | null | undefined) ?? null,
      likesCount: 0,
      commentsCount: 0,
      createdAt: d.created_at as string,
    };
  } catch {
    return null;
  }
}

export async function getImageUploadUrl(
  ext: string
): Promise<{ uploadUrl: string; publicUrl: string } | null> {
  if (!isSupabaseConfigured) return null;
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const res = await fetch(`${getApiBase()}/community/image-upload-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ext }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { uploadUrl: string; publicUrl: string };
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
  try {
    const { data } = await supabase
      .from("community_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);
    return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
  } catch {
    return new Set();
  }
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
  try {
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
  } catch {
    return [];
  }
}

export async function insertOviaMessage(
  userId: string,
  message: OviaMessageRow
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from("ovia_messages").upsert({
      id: message.id,
      user_id: userId,
      role: message.role,
      content: message.content,
      timestamp: message.timestamp,
    });
  } catch { /* non-fatal */ }
}

// ─── User Preferences ──────────────────────────────────────────────────────

/**
 * Minimal card-preset shape stored in the cloud.
 * Structurally compatible with CardPreset from CardCustomizationModal.
 */
export interface StoredCardPreset {
  id: string;
  name: string;
  visibleStats: Record<string, boolean>;
  customMessage: string;
  themeId: string;
  createdAt: number;
  backgroundPhotoUri?: string;
  backgroundPhotoDimLevel?: number;
  backgroundPhotoBlurRadius?: number;
  backgroundPhotoCrop?: { scale: number; panX: number; panY: number };
}

export interface UserPreferences {
  activeFilters?: string[];
  customPresets?: Array<{ id: string; name: string; filterKeys: string[] }>;
  /** Custom filter threshold values keyed by filter key (e.g. { highProtein: 20 }) */
  filterThresholds?: Record<string, number>;
  /** Daily macro/calorie goals synced cross-device in real time */
  macroGoals?: { calories: number; protein: number; carbs: number; fat: number };
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
    undoWindowSeconds?: number;
    reorderHintFrequency?: "never" | "monthly" | "weekly";
    /** Hint keys dismissed by the user — synced cross-device */
    dismissedHints?: string[];
    /**
     * Whether the "long-press also generates" toggle is on.
     * Synced cross-device so the preference survives reinstalls.
     */
    longPressAndRun?: boolean;
    /**
     * Auto-generate countdown duration preference ("off" | "2" | "3" | "5").
     * Synced cross-device so the setting survives reinstalls.
     */
    autoTriggerDelay?: string;
    /**
     * Default card action ("share" | "save" | "copy" | "both").
     * Synced cross-device so the preference survives reinstalls.
     */
    defaultCardAction?: string;
    /**
     * Background photo dim level for the share card (0–1).
     * Synced cross-device so the preference survives reinstalls.
     */
    backgroundPhotoDimLevel?: number;
    /**
     * Background photo blur radius for the share card.
     * Synced cross-device so the preference survives reinstalls.
     */
    backgroundPhotoBlurRadius?: number;
    /**
     * Selected card theme ID ("forest" | "midnight" | "ember" | "royal" | "crimson").
     * Synced cross-device so the customisation survives reinstalls.
     */
    cardThemeId?: string;
    /**
     * Visible stats toggles for the progress card.
     * Synced cross-device so the customisation survives reinstalls.
     */
    cardVisibleStats?: Record<string, boolean>;
    /** Customisable Quick-Add food list for the mobile Nutrition tab */
    quickFoods?: Array<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      mealType: string;
      amountGrams?: number;
      nutrients100g?: { calories: number; protein: number; carbs: number; fat: number };
      servingLabel?: string;
    }>;
    /**
     * User-created card presets (stat combinations, themes, messages).
     * Synced cross-device so presets survive reinstalls.
     */
    cardPresets?: StoredCardPreset[];
    /**
     * Supabase Storage path for the user's custom card background photo
     * (e.g. "userId/card_bg_1234567890.jpg"). Synced cross-device so the
     * background photo can be restored on a fresh install.
     */
    cardBgPhotoStoragePath?: string;
    /**
     * Custom caption/message shown on the progress card.
     * Synced cross-device so the message survives reinstalls.
     */
    cardCustomMessage?: string;
  };
}

export async function fetchUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();
    if (!data?.preferences) return null;
    return data.preferences as UserPreferences;
  } catch {
    return null;
  }
}

export async function upsertUserPreferences(
  userId: string,
  prefs: UserPreferences
): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    await supabase
      .from("profiles")
      .upsert({ id: userId, preferences: prefs, updated_at: new Date().toISOString() });
  } catch { /* non-fatal */ }
}

// ─── Card Preset Cloud Sync ──────────────────────────────────────────────────

/**
 * Reads the user's current cloud preferences, merges the given preset list into
 * appSettings, and writes back. Returns true on success, false on any error.
 * Uses a read-then-write pattern so other appSettings fields are never clobbered.
 */
export async function syncPresetsToCloud(
  userId: string,
  presets: StoredCardPreset[]
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const existing = (await fetchUserPreferences(userId)) ?? {};
    await upsertUserPreferences(userId, {
      ...existing,
      appSettings: { ...(existing.appSettings ?? {}), cardPresets: presets },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the user's saved card presets from the cloud, or null when not
 * configured, unauthenticated, or no presets have been stored yet.
 */
export async function fetchPresetsFromCloud(
  userId: string
): Promise<StoredCardPreset[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const prefs = await fetchUserPreferences(userId);
    if (!Array.isArray(prefs?.appSettings?.cardPresets)) return null;
    return prefs!.appSettings!.cardPresets!;
  } catch {
    return null;
  }
}

// ─── Program Enrollment ─────────────────────────────────────────────────────

export interface EnrolledProgram {
  id: string;
  programId: string;
  programName: string;
  programData: ProgramItem;
  startedAt: string;
  currentWeek: number;
  currentDay: number;
  completedAt: string | null;
}

function mapEnrollmentRow(r: Record<string, unknown>): EnrolledProgram {
  return {
    id: r["id"] as string,
    programId: r["program_id"] as string,
    programName: r["program_name"] as string,
    programData: r["program_data"] as ProgramItem,
    startedAt: r["started_at"] as string,
    currentWeek: r["current_week"] as number,
    currentDay: r["current_day"] as number,
    completedAt: (r["completed_at"] as string | null) ?? null,
  };
}

export async function fetchEnrolledProgram(): Promise<EnrolledProgram | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch(`${getApiBase()}/user/enrolled-program`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json() as { enrollment?: Record<string, unknown> | null };
    return body.enrollment ? mapEnrollmentRow(body.enrollment) : null;
  } catch {
    return null;
  }
}

export async function enrollProgram(
  programId: string,
  programName: string,
  programData: ProgramItem
): Promise<EnrolledProgram | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch(`${getApiBase()}/user/enrolled-program`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ program_id: programId, program_name: programName, program_data: programData }),
    });
    if (!res.ok) return null;
    const body = await res.json() as { enrollment?: Record<string, unknown> };
    return body.enrollment ? mapEnrollmentRow(body.enrollment) : null;
  } catch {
    return null;
  }
}

/**
 * Attempts to advance the enrolled program progress for the given workout.
 * The server validates:
 *  1. workout_date is newer than last_advance_date (idempotency — once per calendar day)
 *  2. The logged workout's name / exercises match the keywords expected for the
 *     current program phase (e.g. push-day exercises for a "Push day" phase)
 * Returns null when skipped or not enrolled.
 */
export async function advanceEnrolledProgram(
  workoutDate: string,
  workoutName: string,
  exercises: { name: string }[]
): Promise<EnrolledProgram | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const token = await getAccessToken();
    if (!token) return null;
    const res = await fetch(`${getApiBase()}/user/enrolled-program`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ workout_date: workoutDate, workout_name: workoutName, exercises }),
    });
    if (!res.ok) return null;
    const body = await res.json() as { enrollment?: Record<string, unknown> | null };
    return body.enrollment ? mapEnrollmentRow(body.enrollment) : null;
  } catch {
    return null;
  }
}

export async function unenrollProgram(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const token = await getAccessToken();
    if (!token) return;
    await fetch(`${getApiBase()}/user/enrolled-program`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* non-fatal */ }
}

// ─── Full User Data Wipe ─────────────────────────────────────────────────────

/**
 * AsyncStorage key used to remember a pending cloud-data wipe that could not
 * be executed (e.g. because the device was offline when the user tapped
 * "Clear Everything"). On the next profile-screen mount while online the key
 * is detected and the wipe is retried automatically.
 */
export const PENDING_CLOUD_WIPE_KEY = "@pending_cloud_wipe";

/**
 * Deletes all personal health data for `userId` from every Supabase table.
 * Runs all deletions in parallel. Throws if network / auth prevents any of
 * them so the caller can schedule a retry via PENDING_CLOUD_WIPE_KEY.
 *
 * Tables cleared:
 *   workout_logs, meal_logs, body_measurements, water_intake,
 *   ovia_messages, personal_records, favourite_foods, progress_photos
 *
 * Profile row: preferences column is nulled out and personal fields are reset
 * so no stale data re-hydrates into the app on next sign-in.
 */
export async function clearAllUserData(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const results = await Promise.allSettled([
    supabase.from("workout_logs").delete().eq("user_id", userId),
    supabase.from("meal_logs").delete().eq("user_id", userId),
    supabase.from("body_measurements").delete().eq("user_id", userId),
    supabase.from("water_intake").delete().eq("user_id", userId),
    supabase.from("ovia_messages").delete().eq("user_id", userId),
    supabase.from("personal_records").delete().eq("user_id", userId),
    supabase.from("favourite_foods").delete().eq("user_id", userId),
    supabase.from("progress_photos").delete().eq("user_id", userId),
    supabase.from("profiles").update({
      preferences: null,
      age: null,
      height: null,
      weight: null,
      fitness_level: null,
      goals: null,
      updated_at: new Date().toISOString(),
    }).eq("id", userId),
  ]);

  const failed = results.filter((r) => {
    if (r.status === "rejected") return true;
    const v = (r as PromiseFulfilledResult<{ error: unknown }>).value;
    return v?.error != null;
  });

  if (failed.length > 0) {
    throw new Error(`Cloud wipe incomplete — ${failed.length} table(s) could not be cleared`);
  }
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
  try {
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
  } catch {
    return [];
  }
}
