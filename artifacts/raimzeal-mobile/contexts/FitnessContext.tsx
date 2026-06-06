/**
 * FitnessContext — mobile state management.
 *
 * Uses the SAME data model and storage key as the web app (artifacts/raimzeal/src/lib/store.ts)
 * so data structures are compatible across platforms.
 *
 * Storage key: "raimzeal_fitness_data" (matches web app localStorage key)
 *
 * Data hierarchy (highest priority wins):
 *  1. Supabase (remote source of truth for authenticated users)
 *  2. AsyncStorage (local cache / offline support)
 *  3. Default state (demo data for unauthenticated users)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchProfile,
  fetchWorkoutLogs,
  fetchMealLogs,
  fetchBodyMeasurements,
  fetchWaterIntake,
  upsertProfile,
  insertWorkoutLog,
  insertMealLog,
  insertBodyMeasurement,
  upsertWaterIntake,
  fetchOviaMessages,
  insertOviaMessage,
  fetchUserPreferences,
  upsertUserPreferences,
  upsertMealLog,
  deleteMealLog,
  deleteWorkoutLog,
  getApiBase,
  advanceEnrolledProgram,
  type UserPreferences,
} from "@/lib/db";

/** Matches web app store.ts WorkoutLog exactly */
export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  exercises: { name: string; sets: number; reps: number; weight?: number }[];
  notes?: string;
}

/** Matches web app store.ts MealLog exactly */
export interface MealLog {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  /** Grams logged when the user entered an amount via the grams input */
  amountGrams?: number;
  /** Per-100g macro snapshot — present when the food came from the API and had both serving and 100g data. Enables the per-100g toggle in the edit modal. */
  nutrients100g?: { calories: number; protein: number; carbs: number; fat: number };
  /** Human-readable serving label saved at log time (e.g. "150g", "1 cup") */
  servingLabel?: string;
  /**
   * ID of the meal log entry this was copied from via "Log Today".
   * Used to propagate name edits back to the original and any sibling copies.
   * Stored locally only (not in Supabase schema).
   */
  sourceMealLogId?: string;
}

/** Matches web app store.ts BodyMeasurement exactly */
export interface BodyMeasurement {
  id: string;
  date: string;
  weight: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
}

/** Matches web app store.ts UserProfile exactly */
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  height: number;
  weight: number;
  fitnessLevel: "beginner" | "intermediate" | "advanced";
  goals: string[];
  units: "imperial" | "metric";
  createdAt: string;
  /** ABO blood group */
  bloodType?: "A" | "B" | "AB" | "O";
  /** Rhesus factor */
  rhFactor?: "+" | "-";
  /** Haemoglobin genotype (sickle-cell locus) */
  genotype?: "AA" | "AS" | "AC" | "SS" | "SC";
  /** Biological sex — used for the sex-specific Mifflin-St Jeor BMR constant */
  biologicalSex?: "male" | "female" | "prefer_not_to_say";
}

/** Mobile-only: Ovia AI conversation history */
export interface OviaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** A quick-add food item in the Nutrition tab quick-add row; same shape as a meal log entry without id/date */
export type QuickFood = Omit<MealLog, "id" | "date">;

/** Default quick-add foods shown to new users */
export const DEFAULT_QUICK_FOODS: QuickFood[] = [
  { name: "Protein Shake",        calories: 180, protein: 25, carbs: 10, fat:  4, mealType: "breakfast",
    servingLabel: "1 scoop (35g)",        nutrients100g: { calories: 514, protein: 71, carbs: 29, fat: 11 } },
  { name: "Chicken Breast (150g)",calories: 248, protein: 46, carbs:  0, fat:  5, mealType: "lunch",
    servingLabel: "1 serving (150g)",     nutrients100g: { calories: 165, protein: 31, carbs:  0, fat:  3 } },
  { name: "Brown Rice (1 cup)",   calories: 215, protein:  5, carbs: 45, fat:  2, mealType: "lunch",
    servingLabel: "1 cup (195g)",         nutrients100g: { calories: 110, protein:  3, carbs: 23, fat:  1 } },
  { name: "Greek Yogurt",         calories: 130, protein: 17, carbs:  8, fat:  3, mealType: "snack",
    servingLabel: "1 container (170g)",   nutrients100g: { calories:  76, protein: 10, carbs:  5, fat:  2 } },
  { name: "Banana",               calories:  89, protein:  1, carbs: 23, fat:  0, mealType: "snack",
    servingLabel: "1 medium (118g)",      nutrients100g: { calories:  75, protein:  1, carbs: 20, fat:  0 } },
  { name: "Almonds (30g)",        calories: 174, protein:  6, carbs:  6, fat: 15, mealType: "snack",
    servingLabel: "1 oz (30g)",           nutrients100g: { calories: 580, protein: 20, carbs: 20, fat: 50 } },
  { name: "Oatmeal (1 cup)",      calories: 147, protein:  5, carbs: 27, fat:  3, mealType: "breakfast",
    servingLabel: "1 cup cooked (240g)", nutrients100g: { calories:  61, protein:  2, carbs: 11, fat:  1 } },
  { name: "Salmon Fillet (150g)", calories: 312, protein: 43, carbs:  0, fat: 15, mealType: "dinner",
    servingLabel: "1 fillet (150g)",      nutrients100g: { calories: 208, protein: 29, carbs:  0, fat: 10 } },
];

/** A pinned food item; structurally identical to a MealLog entry without id/date */
export type FavoriteFood = Omit<MealLog, "id" | "date"> & {
  /** Human-readable serving size label saved at star time (e.g. "150g", "1 cup") */
  servingLabel?: string;
  /** Server-assigned UUID injected from API on GET/POST. Used for reliable id-based DELETE. */
  _serverId?: string;
  /** Client-generated stable UUID created when the food is first pinned. Used as the
   *  server conflict key so two foods with the same display name don't overwrite each other. */
  _foodId?: string;
};

/** Matches web app store.ts AppState (subset relevant to mobile) */
export interface AppState {
  isOnboarded: boolean;
  isLoggedIn: boolean;
  user: UserProfile | null;
  workoutLogs: WorkoutLog[];
  bodyMeasurements: BodyMeasurement[];
  mealLogs: MealLog[];
  waterIntake: { date: string; glasses: number }[];
  streak: number;
  personalRecords: { exercise: string; weight: number; date: string }[];
  settings: {
    darkMode: boolean;
    notifications: boolean;
    weightUnit: "lbs" | "kg";
    undoWindowSeconds: number;
    showRestoreBadge: boolean;
    reorderHintFrequency: "never" | "monthly" | "weekly";
    /** Whether the "long-press also generates" toggle is on — synced cross-device. */
    longPressAndRun?: boolean;
    /** Auto-generate countdown duration ("off" | "2" | "3" | "5") — synced cross-device. */
    autoTriggerDelay?: string;
    /** Background photo dim level for the share card (0–1) — synced cross-device. */
    backgroundPhotoDimLevel?: number;
    /** Background photo blur radius for the share card — synced cross-device. */
    backgroundPhotoBlurRadius?: number;
    /** Default card action ("share" | "save" | "copy" | "both") — synced cross-device. */
    defaultCardAction?: string;
    /** Selected card theme ID — synced cross-device. */
    cardThemeId?: string;
    /** Visible stats toggles for the progress card — synced cross-device. */
    cardVisibleStats?: Record<string, boolean>;
  };
  /** Mobile-only extension: Ovia AI chat history */
  oviaMessages: OviaMessage[];
  /** Mobile-only extension: pinned favorite foods */
  favoriteFoods: FavoriteFood[];
  /** Hint keys dismissed by the user — persisted and synced cross-device */
  dismissedHints: string[];
  /** Customisable Quick-Add food list in the Nutrition tab */
  quickFoods: QuickFood[];
}

interface FitnessContextType extends AppState {
  /** Timestamp of the most recent successful cloud sync (read or write). Null if none this session. */
  lastSyncedAt: Date | null;
  addWorkoutLog: (log: WorkoutLog, onSyncResult?: (ok: boolean) => void) => void;
  addMealLog: (meal: MealLog, onSyncResult?: (ok: boolean) => void) => void;
  removeMealLog: (id: string, onSyncResult?: (ok: boolean) => void) => void;
  removeMealLogsByName: (name: string, onSyncResult?: (ok: boolean) => void) => void;
  removeWorkoutLog: (id: string, onSyncResult?: (ok: boolean) => void) => void;
  updateMealLog: (id: string, updates: Partial<Omit<MealLog, "id">>, onSyncResult?: (ok: boolean) => void) => void;
  /**
   * Propagate a name change to all meal log entries that are linked to `editedId`
   * via `sourceMealLogId` (i.e. the original entry and any siblings created by "Log Today").
   * Only updates entries that share an explicit ID linkage — never matches by name.
   * `onSyncResult(false)` is called if the cloud upsert for any linked entry fails.
   */
  syncMealName: (editedId: string, newName: string, onSyncResult?: (ok: boolean) => void) => void;
  addBodyMeasurement: (m: BodyMeasurement) => void;
  addOviaMessage: (msg: Omit<OviaMessage, "id" | "timestamp">) => void;
  updateWaterIntake: (glasses: number) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppState["settings"]>) => void;
  toggleFavoriteFood: (food: FavoriteFood) => void;
  reorderFavoriteFoods: (foods: FavoriteFood[]) => void;
  dismissHint: (key: string, timestamp?: number) => void;
  undismissHint: (key: string) => void;
  isHintDismissed: (key: string) => boolean;
  getHintDismissedAt: (key: string) => number | null;
  resetHints: () => void;
  /** Replace the Quick-Add food list and persist it */
  updateQuickFoods: (foods: QuickFood[]) => void;
  getTodayWorkouts: () => WorkoutLog[];
  getTodayMeals: () => MealLog[];
  getTodayMacros: () => { calories: number; protein: number; carbs: number; fat: number };
  getTodayWaterGlasses: () => number;
  getWeekCalories: () => { day: string; date: string; calories: number }[];
  /** True once AsyncStorage has been read — prevents flash-redirect to onboarding */
  stateHydrated: boolean;
  /** Mark the user as having completed health onboarding */
  markOnboarded: () => void;
  /** Wipe all local fitness data and AsyncStorage on logout — prevents ghost-data for the next user */
  resetState: () => void;
  /**
   * Resets all in-memory fitness state (including hints) WITHOUT persisting to
   * AsyncStorage. Use this after an external bulk-remove (e.g. "Clear all app data")
   * to avoid a race where a stale persist() writes data back after the wipe.
   */
  clearAllData: () => void;
  /**
   * Increments each time resetState() or clearAllData() is called so mounted
   * screens can react (e.g. reset filter / history UI state) without remounting.
   */
  dataResetCount: number;
}

/** Same key as the web app — data schemas are compatible */
const STORAGE_KEY = "raimzeal_fitness_data";
const PENDING_REMOVES_KEY = "raimzeal_pending_fav_removes";

/** Pending-remove entries are scoped by userId so account switching never corrupts the queue. */
type PendingRemove = { serverId: string; foodId: string; userId: string };

function generateFoodId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function queuePendingRemove(serverId: string, foodId: string, userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_REMOVES_KEY);
    const existing: PendingRemove[] = raw ? (JSON.parse(raw) as PendingRemove[]) : [];
    if (!existing.some((r) => r.serverId === serverId)) {
      await AsyncStorage.setItem(PENDING_REMOVES_KEY, JSON.stringify([...existing, { serverId, foodId, userId }]));
    }
  } catch (err) {
    console.warn("[FitnessContext] addPendingRemove failed:", err);
  }
}

const todayStr = () => new Date().toISOString().split("T")[0];

const dateOffset = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];

const INITIAL_OVIA_MESSAGES: OviaMessage[] = [
  {
    id: "ov1",
    role: "assistant",
    content:
      "Hey! I'm Ovia, your AI fitness coach. I'm here to help you crush your goals. How are you feeling today?",
    timestamp: new Date().toISOString(),
  },
];

const defaultState: AppState = {
  isOnboarded: false,
  isLoggedIn: false,
  user: null,
  workoutLogs: [],
  bodyMeasurements: [],
  mealLogs: [],
  waterIntake: [],
  streak: 0,
  personalRecords: [],
  settings: {
    darkMode: true,
    notifications: true,
    weightUnit: "kg",
    undoWindowSeconds: 3,
    showRestoreBadge: true,
    reorderHintFrequency: "monthly",
  },
  oviaMessages: INITIAL_OVIA_MESSAGES,
  favoriteFoods: [],
  dismissedHints: [],
  quickFoods: DEFAULT_QUICK_FOODS,
};

const FitnessContext = createContext<FitnessContextType | null>(null);

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [stateHydrated, setStateHydrated] = useState(false);
  const [dataResetCount, setDataResetCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Debounce refs for settings cloud sync — accumulates rapid changes so only
  // one fetch+write round-trip happens per burst, eliminating the race where
  // two concurrent reads both see the old value and one write clobbers the other.
  const pendingSettingsPatchRef = useRef<NonNullable<import("@/lib/db").UserPreferences["appSettings"]>>({});
  const settingsDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Step 1: hydrate from AsyncStorage (fast, works offline)
    AsyncStorage.getItem(STORAGE_KEY).then(async (raw) => {
      let parsed: Partial<AppState> = {};
      if (raw) {
        try {
          parsed = JSON.parse(raw) as Partial<AppState>;
        } catch {
          // corrupted storage — ignore
        }
      }
      const hydrated: AppState = {
        ...defaultState,
        ...parsed,
        settings: { ...defaultState.settings, ...(parsed.settings ?? {}) },
        oviaMessages: parsed.oviaMessages ?? defaultState.oviaMessages,
        favoriteFoods: parsed.favoriteFoods ?? [],
        dismissedHints: parsed.dismissedHints ?? [],
        quickFoods: Array.isArray(parsed.quickFoods) ? (parsed.quickFoods as QuickFood[]).slice(0, 8) : DEFAULT_QUICK_FOODS,
      };
      setState(hydrated);
      setStateHydrated(true);

      // Step 2: sync from Supabase (source of truth for authenticated users)
      if (!isSupabaseConfigured) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        const userId = session.user.id;
        const [profile, workouts, meals, bodyMeasurementsRemote, waterRemote, oviaRemote, prefs, favouritesRemote, pendingRemovesRaw] = await Promise.all([
          fetchProfile(userId),
          fetchWorkoutLogs(userId),
          fetchMealLogs(userId),
          fetchBodyMeasurements(userId),
          fetchWaterIntake(userId),
          fetchOviaMessages(userId),
          fetchUserPreferences(userId),
          (async (): Promise<FavoriteFood[]> => {
            try {
              const res = await fetch(`${getApiBase()}/user/favourite-foods`, {
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (!res.ok) return [];
              const body = await res.json() as { foods: FavoriteFood[] };
              return Array.isArray(body.foods) ? body.foods : [];
            } catch { return []; }
          })(),
          AsyncStorage.getItem(PENDING_REMOVES_KEY).catch(() => null),
        ]);
        // Restore the camera-roll rationale flag to AsyncStorage so
        // PermissionsContext picks it up on this fresh install.
        if (prefs?.appSettings?.cameraRollRationaleDismissed != null) {
          const value = prefs.appSettings.cameraRollRationaleDismissed ? "true" : null;
          if (value) {
            AsyncStorage.setItem("camera_roll_rationale_dismissed", value).catch(() => {});
          } else {
            AsyncStorage.removeItem("camera_roll_rationale_dismissed").catch(() => {});
          }
        }

        // Process pending removes: foods the user removed locally but whose DELETE may have failed.
        // Entries are scoped by userId — account switching cannot corrupt this queue.
        const pendingRemoves: PendingRemove[] = (() => {
          try { return pendingRemovesRaw ? (JSON.parse(pendingRemovesRaw) as PendingRemove[]) : []; }
          catch { return []; }
        })();
        const myPendingRemoves = pendingRemoves.filter((r) => r.userId === userId);
        const pendingRemoveFoodIds = new Set(myPendingRemoves.map((r) => r.foodId));

        // Retry pending removes in background (best-effort; queue cleared on success)
        myPendingRemoves
          .filter((r) => favouritesRemote.some((f) => f._foodId === r.foodId))
          .forEach(({ serverId, foodId }) => {
            fetch(`${getApiBase()}/user/favourite-foods/${encodeURIComponent(serverId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then((res) => {
              if (res.ok) {
                AsyncStorage.getItem(PENDING_REMOVES_KEY).then((raw) => {
                  const cur: PendingRemove[] = raw ? (JSON.parse(raw) as PendingRemove[]) : [];
                  AsyncStorage.setItem(PENDING_REMOVES_KEY, JSON.stringify(cur.filter((r) => r.foodId !== foodId || r.userId !== userId))).catch(() => {});
                }).catch(() => {});
              }
            }).catch(() => {});
          });

        // True merge: local-only foods (not yet on server) + filtered server foods (pending removes excluded).
        // Remote wins on conflict. _foodId is the primary match key; falls back to name for pre-migration entries.
        const filteredServerFoods = favouritesRemote.filter((f) => !f._foodId || !pendingRemoveFoodIds.has(f._foodId));
        const hydratedFavs: FavoriteFood[] = hydrated.favoriteFoods ?? [];
        const remoteByFoodId = new Map(filteredServerFoods.filter((f) => f._foodId).map((f) => [f._foodId!, f]));
        const remoteByName = new Map(filteredServerFoods.map((f) => [f.name, f]));
        const localOnlyFoods = hydratedFavs.filter((lf) => {
          if (lf._foodId) return !remoteByFoodId.has(lf._foodId);
          return !remoteByName.has(lf.name); // Fallback for entries without _foodId
        });
        const mergedFavs = [...localOnlyFoods, ...filteredServerFoods];

        setState((prev) => {
          const remoteSettings = prefs?.appSettings;
          return {
            ...prev,
            ...(profile
              ? {
                  user: {
                    ...(prev.user ?? {} as UserProfile),
                    ...profile,
                    id: userId,
                    email: session.user.email ?? prev.user?.email ?? "",
                  },
                }
              : {}),
            workoutLogs: workouts.length > 0 ? workouts : prev.workoutLogs,
            mealLogs: meals.length > 0 ? meals : prev.mealLogs,
            bodyMeasurements: bodyMeasurementsRemote.length > 0 ? bodyMeasurementsRemote : prev.bodyMeasurements,
            waterIntake: waterRemote.length > 0 ? waterRemote : prev.waterIntake,
            oviaMessages: oviaRemote.length > 0 ? oviaRemote : prev.oviaMessages,
            favoriteFoods: mergedFavs,
            // Merge cloud-backed settings (remote wins over local for every synced field)
            settings: {
              ...prev.settings,
              ...(remoteSettings != null
                ? {
                    ...(remoteSettings.darkMode != null ? { darkMode: remoteSettings.darkMode } : {}),
                    ...(remoteSettings.notifications != null ? { notifications: remoteSettings.notifications } : {}),
                    ...(remoteSettings.weightUnit != null ? { weightUnit: remoteSettings.weightUnit } : {}),
                    ...(remoteSettings.undoWindowSeconds != null ? { undoWindowSeconds: remoteSettings.undoWindowSeconds } : {}),
                    ...(remoteSettings.showRestoreBadge != null ? { showRestoreBadge: remoteSettings.showRestoreBadge } : {}),
                    ...(remoteSettings.reorderHintFrequency != null ? { reorderHintFrequency: remoteSettings.reorderHintFrequency } : {}),
                    ...(remoteSettings.longPressAndRun != null ? { longPressAndRun: remoteSettings.longPressAndRun } : {}),
                    ...(remoteSettings.autoTriggerDelay != null ? { autoTriggerDelay: remoteSettings.autoTriggerDelay } : {}),
                    ...(remoteSettings.backgroundPhotoDimLevel != null ? { backgroundPhotoDimLevel: remoteSettings.backgroundPhotoDimLevel } : {}),
                    ...(remoteSettings.backgroundPhotoBlurRadius != null ? { backgroundPhotoBlurRadius: remoteSettings.backgroundPhotoBlurRadius } : {}),
                    ...(remoteSettings.defaultCardAction != null ? { defaultCardAction: remoteSettings.defaultCardAction } : {}),
                    ...(remoteSettings.cardThemeId != null ? { cardThemeId: remoteSettings.cardThemeId } : {}),
                    ...(remoteSettings.cardVisibleStats != null ? { cardVisibleStats: remoteSettings.cardVisibleStats } : {}),
                  }
                : {}),
            },
            dismissedHints: Array.isArray(remoteSettings?.dismissedHints)
              ? remoteSettings.dismissedHints
              : prev.dismissedHints,
            quickFoods: Array.isArray(remoteSettings?.quickFoods)
              ? (remoteSettings.quickFoods as QuickFood[]).slice(0, 8)
              : prev.quickFoods,
          };
        });
        setLastSyncedAt(new Date());

        // Retry failed adds: push local-only foods to server and cache _serverId + _foodId on success
        localOnlyFoods.forEach((f) => {
          const foodWithId: FavoriteFood = f._foodId ? f : { ...f, _foodId: generateFoodId() };
          fetch(`${getApiBase()}/user/favourite-foods`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ food: foodWithId }),
          }).then(async (res) => {
            if (res.ok) {
              const body = await res.json() as { id?: string; foodId?: string };
              if (body.id) {
                setState((prev) => {
                  const favoriteFoods = prev.favoriteFoods.map((ff) =>
                    ff.name === f.name
                      ? { ...ff, _serverId: body.id, _foodId: body.foodId ?? ff._foodId ?? foodWithId._foodId }
                      : ff
                  );
                  const next = { ...prev, favoriteFoods };
                  persist(next);
                  return next;
                });
              }
            }
          }).catch(() => {});
        });
      } catch {
        // Non-fatal: keep local data if Supabase sync fails
      }
    });
  }, []);

  const persist = useCallback((next: AppState) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const resetState = useCallback(() => {
    setState({ ...defaultState, isOnboarded: true }); // keep onboarded flag so health-onboarding doesn't re-fire
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    setDataResetCount((c) => c + 1);
  }, []);

  /**
   * Resets all in-memory state WITHOUT calling persist(). Safe to call after an
   * external AsyncStorage.multiRemove/clear because no stale setItem can race
   * against the external wipe.
   */
  const clearAllData = useCallback(() => {
    setState({ ...defaultState, isOnboarded: true });
    setDataResetCount((c) => c + 1);
  }, []);

  const addWorkoutLog = useCallback(
    (log: WorkoutLog, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const today = todayStr();
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const lastDate = prev.workoutLogs[0]?.date ?? null;
        let newStreak: number;
        if (!lastDate) {
          newStreak = 1;
        } else if (lastDate === today) {
          newStreak = prev.streak; // already logged today — don't double-count
        } else if (lastDate === yesterday) {
          newStreak = prev.streak + 1; // consecutive day
        } else {
          newStreak = 1; // gap — reset
        }
        const next = { ...prev, workoutLogs: [log, ...prev.workoutLogs], streak: newStreak };
        persist(next);
        // Background push to Supabase
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              insertWorkoutLog(session.user.id, log)
                .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
                .catch(() => onSyncResult?.(false));
            } else {
              onSyncResult?.(false);
            }
          }).catch(() => onSyncResult?.(false));
          // Advance enrolled program: server validates date idempotency AND
          // that the workout exercises match the current phase's expected muscle groups.
          advanceEnrolledProgram(log.date, log.workoutName, log.exercises).catch(() => {});
        } else {
          onSyncResult?.(false);
        }
        return next;
      });
    },
    [persist]
  );

  const addMealLog = useCallback(
    (meal: MealLog, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const next = { ...prev, mealLogs: [meal, ...prev.mealLogs] };
        persist(next);
        // Background push to Supabase
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              insertMealLog(session.user.id, meal)
                .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
                .catch(() => onSyncResult?.(false));
            } else {
              onSyncResult?.(false);
            }
          }).catch(() => onSyncResult?.(false));
        } else {
          onSyncResult?.(false);
        }
        return next;
      });
    },
    [persist]
  );

  const removeMealLog = useCallback(
    (id: string, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const next = { ...prev, mealLogs: prev.mealLogs.filter((m) => m.id !== id) };
        persist(next);
        if (isSupabaseConfigured) {
          deleteMealLog(id)
            .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
            .catch(() => onSyncResult?.(false));
        } else {
          onSyncResult?.(false);
        }
        return next;
      });
    },
    [persist]
  );

  const removeMealLogsByName = useCallback(
    (name: string, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const toRemove = prev.mealLogs.filter((m) => m.name === name);
        if (toRemove.length === 0) { onSyncResult?.(false); return prev; }
        const next = { ...prev, mealLogs: prev.mealLogs.filter((m) => m.name !== name) };
        persist(next);
        if (isSupabaseConfigured) {
          Promise.all(toRemove.map((m) => deleteMealLog(m.id)))
            .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
            .catch(() => onSyncResult?.(false));
        } else {
          onSyncResult?.(false);
        }
        return next;
      });
    },
    [persist]
  );

  const removeWorkoutLog = useCallback(
    (id: string, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const next = { ...prev, workoutLogs: prev.workoutLogs.filter((w) => w.id !== id) };
        persist(next);
        if (isSupabaseConfigured) {
          deleteWorkoutLog(id)
            .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
            .catch(() => onSyncResult?.(false));
        } else {
          onSyncResult?.(false);
        }
        return next;
      });
    },
    [persist]
  );

  const updateMealLog = useCallback(
    (id: string, updates: Partial<Omit<MealLog, "id">>, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const updatedMeal = prev.mealLogs.find((m) => m.id === id);
        const next = {
          ...prev,
          mealLogs: prev.mealLogs.map((m) => (m.id === id ? { ...m, ...updates } : m)),
        };
        persist(next);
        if (updatedMeal && isSupabaseConfigured) {
          const merged = { ...updatedMeal, ...updates };
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              upsertMealLog(session.user.id, merged)
                .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
                .catch(() => onSyncResult?.(false));
            } else {
              onSyncResult?.(false);
            }
          }).catch(() => onSyncResult?.(false));
        } else {
          onSyncResult?.(false);
        }
        return next;
      });
    },
    [persist]
  );

  const syncMealName = useCallback(
    (editedId: string, newName: string, onSyncResult?: (ok: boolean) => void) => {
      setState((prev) => {
        const edited = prev.mealLogs.find((m) => m.id === editedId);
        if (!edited) {
          // Entry not found — nothing to propagate, not a cloud error.
          onSyncResult?.(true);
          return prev;
        }

        const sourceId = edited.sourceMealLogId;

        // Collect IDs of all linked entries (excluding the already-updated editedId).
        // An entry is linked when it:
        //   (a) is the original that editedId was copied from, OR
        //   (b) is another copy that shares the same sourceMealLogId (sibling), OR
        //   (c) was itself copied from editedId.
        const linkedIds = new Set<string>();
        for (const m of prev.mealLogs) {
          if (m.id === editedId) continue;
          if (
            (sourceId && m.id === sourceId) ||
            (sourceId && m.sourceMealLogId === sourceId) ||
            m.sourceMealLogId === editedId
          ) {
            linkedIds.add(m.id);
          }
        }

        if (linkedIds.size === 0) {
          // No linked entries to propagate — not a cloud error.
          onSyncResult?.(true);
          return prev;
        }

        const affected = prev.mealLogs.filter((m) => linkedIds.has(m.id));
        const updatedLogs = prev.mealLogs.map((m) =>
          linkedIds.has(m.id) ? { ...m, name: newName } : m
        );
        const next = { ...prev, mealLogs: updatedLogs };
        persist(next);

        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              const userId = session.user.id;
              Promise.all(affected.map((m) => upsertMealLog(userId, { ...m, name: newName })))
                .then(() => { setLastSyncedAt(new Date()); onSyncResult?.(true); })
                .catch(() => onSyncResult?.(false));
            } else {
              onSyncResult?.(false);
            }
          }).catch(() => onSyncResult?.(false));
        } else {
          // Supabase not configured — can't reach the cloud.
          onSyncResult?.(false);
        }

        return next;
      });
    },
    [persist]
  );

  const addBodyMeasurement = useCallback(
    (m: BodyMeasurement) => {
      setState((prev) => {
        const next = { ...prev, bodyMeasurements: [m, ...prev.bodyMeasurements] };
        persist(next);
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) insertBodyMeasurement(session.user.id, m).then(() => setLastSyncedAt(new Date())).catch(() => {});
          });
        }
        return next;
      });
    },
    [persist]
  );

  const addOviaMessage = useCallback(
    (msg: Omit<OviaMessage, "id" | "timestamp">) => {
      setState((prev) => {
        const newMsg: OviaMessage = {
          ...msg,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        };
        const next = {
          ...prev,
          oviaMessages: [...prev.oviaMessages, newMsg],
        };
        persist(next);
        // Background push to Supabase for persistent cross-device memory
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
              insertOviaMessage(session.user.id, newMsg).then(() => setLastSyncedAt(new Date())).catch(() => {});
            }
          });
        }
        return next;
      });
    },
    [persist]
  );

  const updateWaterIntake = useCallback(
    (glasses: number) => {
      const today = todayStr();
      setState((prev) => {
        const existing = prev.waterIntake.find((w) => w.date === today);
        const waterIntake = existing
          ? prev.waterIntake.map((w) => (w.date === today ? { ...w, glasses } : w))
          : [{ date: today, glasses }, ...prev.waterIntake];
        const next = { ...prev, waterIntake };
        persist(next);
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) upsertWaterIntake(session.user.id, today, glasses).then(() => setLastSyncedAt(new Date())).catch(() => {});
          });
        }
        return next;
      });
    },
    [persist]
  );

  const toggleFavoriteFood = useCallback(
    (food: FavoriteFood) => {
      let capturedExists = false;
      let capturedServerId: string | undefined;
      let capturedFoodId: string | undefined;
      let capturedNewFood: FavoriteFood | undefined;
      setState((prev) => {
        capturedExists = prev.favoriteFoods.some((f) => f.name === food.name);
        const existingFood = prev.favoriteFoods.find((f) => f.name === food.name);
        capturedServerId = existingFood?._serverId;
        capturedFoodId = existingFood?._foodId;
        let favoriteFoods: FavoriteFood[];
        if (capturedExists) {
          favoriteFoods = prev.favoriteFoods.filter((f) => f.name !== food.name);
        } else {
          // Generate a stable _foodId on first pin; reuse if already present
          capturedNewFood = { ...food, _foodId: food._foodId ?? generateFoodId() };
          favoriteFoods = [capturedNewFood, ...prev.favoriteFoods];
        }
        const next = { ...prev, favoriteFoods };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;
        const uid = session.user?.id ?? "";
        if (capturedExists) {
          // Delete by server id; food without a server id was never synced — no server action needed
          if (capturedServerId && capturedFoodId) {
            fetch(`${getApiBase()}/user/favourite-foods/${encodeURIComponent(capturedServerId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then((res) => {
              if (res.ok) {
                setLastSyncedAt(new Date());
              } else {
                void queuePendingRemove(capturedServerId!, capturedFoodId!, uid);
              }
            }).catch(() => {
              void queuePendingRemove(capturedServerId!, capturedFoodId!, uid);
            });
          }
        } else if (capturedNewFood) {
          // Add: POST with stable _foodId; cache server id for reliable future deletes
          fetch(`${getApiBase()}/user/favourite-foods`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ food: capturedNewFood }),
          }).then(async (res) => {
            if (res.ok) {
              const body = await res.json() as { id?: string; foodId?: string };
              if (body.id) {
                setState((prev) => {
                  const favoriteFoods = prev.favoriteFoods.map((ff) =>
                    ff.name === food.name
                      ? { ...ff, _serverId: body.id, _foodId: body.foodId ?? ff._foodId }
                      : ff
                  );
                  const next = { ...prev, favoriteFoods };
                  persist(next);
                  return next;
                });
                setLastSyncedAt(new Date());
              }
            }
          }).catch(() => {});
        }
      });
    },
    [persist]
  );

  const reorderFavoriteFoods = useCallback(
    (foods: FavoriteFood[]) => {
      setState((prev) => {
        const next = { ...prev, favoriteFoods: foods };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;
        fetch(`${getApiBase()}/user/favourite-foods/reorder`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ foods }),
        }).then(async (res) => {
          if (res.ok) {
            setLastSyncedAt(new Date());
            const body = await res.json() as { foods?: (FavoriteFood & { _serverId?: string })[] };
            if (Array.isArray(body.foods) && body.foods.length > 0) {
              // Refresh _serverId for all foods (PUT reorder deletes+reinserts rows)
              const serverIdMap = new Map(body.foods.map((f) => [f.name, f._serverId]));
              setState((prev) => {
                const favoriteFoods = prev.favoriteFoods.map((f) => ({
                  ...f,
                  _serverId: serverIdMap.get(f.name) ?? f._serverId,
                }));
                const next = { ...prev, favoriteFoods };
                persist(next);
                return next;
              });
            }
          }
        }).catch(() => {});
      });
    },
    [persist]
  );

  const updateQuickFoods = useCallback(
    (foods: QuickFood[]) => {
      const clamped = foods.slice(0, 8);
      setState((prev) => {
        const next = { ...prev, quickFoods: clamped };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        fetchUserPreferences(session.user.id)
          .then((existing) =>
            upsertUserPreferences(session.user.id, {
              ...existing,
              appSettings: {
                ...(existing?.appSettings ?? {}),
                quickFoods: foods as NonNullable<UserPreferences["appSettings"]>["quickFoods"],
              },
            })
          )
          .then(() => setLastSyncedAt(new Date()))
          .catch(() => {});
      });
    },
    [persist]
  );

  const dismissHint = useCallback(
    (key: string, timestamp?: number) => {
      const entry = timestamp != null ? `${key}:${timestamp}` : key;
      setState((prev) => {
        const filtered = prev.dismissedHints.filter(
          (h) => h !== key && !h.startsWith(`${key}:`)
        );
        const next = { ...prev, dismissedHints: [...filtered, entry] };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        fetchUserPreferences(session.user.id)
          .then((existing) =>
            upsertUserPreferences(session.user.id, {
              ...existing,
              appSettings: {
                ...(existing?.appSettings ?? {}),
                dismissedHints: [
                  ...(existing?.appSettings?.dismissedHints ?? []).filter(
                    (h) => h !== key && !h.startsWith(`${key}:`)
                  ),
                  entry,
                ],
              },
            })
          )
          .then(() => setLastSyncedAt(new Date()))
          .catch(() => {});
      });
    },
    [persist]
  );

  const undismissHint = useCallback(
    (key: string) => {
      setState((prev) => {
        const filtered = prev.dismissedHints.filter(
          (h) => h !== key && !h.startsWith(`${key}:`)
        );
        const next = { ...prev, dismissedHints: filtered };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        fetchUserPreferences(session.user.id)
          .then((existing) =>
            upsertUserPreferences(session.user.id, {
              ...existing,
              appSettings: {
                ...(existing?.appSettings ?? {}),
                dismissedHints: (existing?.appSettings?.dismissedHints ?? []).filter(
                  (h) => h !== key && !h.startsWith(`${key}:`)
                ),
              },
            })
          )
          .then(() => setLastSyncedAt(new Date()))
          .catch(() => {});
      });
    },
    [persist]
  );

  const isHintDismissed = useCallback(
    (key: string): boolean =>
      state.dismissedHints.some((h) => h === key || h.startsWith(`${key}:`)),
    [state.dismissedHints]
  );

  const getHintDismissedAt = useCallback(
    (key: string): number | null => {
      const entry = state.dismissedHints.find((h) => h.startsWith(`${key}:`));
      if (!entry) return null;
      const ts = parseInt(entry.slice(key.length + 1), 10);
      return isNaN(ts) ? null : ts;
    },
    [state.dismissedHints]
  );

  const resetHints = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissedHints: [] };
      persist(next);
      return next;
    });
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      fetchUserPreferences(session.user.id)
        .then((existing) =>
          upsertUserPreferences(session.user.id, {
            ...existing,
            appSettings: { ...(existing?.appSettings ?? {}), dismissedHints: [] },
          })
        )
        .then(() => setLastSyncedAt(new Date()))
        .catch(() => {});
    });
  }, [persist]);

  // Reset hints when a different user signs in on the same device.
  // Supabase fires SIGNED_IN for every new session, including account switches
  // that bypass an explicit sign-out (deep links, OAuth redirects, session
  // expiry re-logins). We compare the incoming UID against the last known UID
  // and wipe dismissed hints whenever identity changes.
  //
  // The listener is registered inside the getSession() callback so that
  // prevUserIdRef is always seeded before any SIGNED_IN event can fire,
  // eliminating the mount-time race where an early SIGNED_IN would see a null
  // ref and incorrectly treat the current user as a "new" identity.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let unsubscribe: (() => void) | undefined;
    supabase.auth.getSession().then(({ data: { session } }) => {
      prevUserIdRef.current = session?.user?.id ?? null;
      const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
        if (event === "SIGNED_OUT") {
          prevUserIdRef.current = null;
          return;
        }
        if (event !== "SIGNED_IN") return;
        const incomingId = newSession?.user?.id ?? null;
        if (incomingId && incomingId !== prevUserIdRef.current) {
          resetHints();
        }
        prevUserIdRef.current = incomingId;
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    });
    return () => unsubscribe?.();
  }, [resetHints]);

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      setState((prev) => {
        const next = { ...prev, user: prev.user ? { ...prev.user, ...updates } : prev.user };
        persist(next);
        // Background push to Supabase
        if (next.user && isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) upsertProfile(session.user.id, next.user!).then(() => setLastSyncedAt(new Date())).catch(() => {});
          });
        }
        return next;
      });
    },
    [persist]
  );

  const markOnboarded = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, isOnboarded: true };
      persist(next);
      return next;
    });
  }, [persist]);

  const updateSettings = useCallback(
    (updates: Partial<AppState["settings"]>) => {
      setState((prev) => {
        const next = { ...prev, settings: { ...prev.settings, ...updates } };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      // Build the cloud-synced subset of changed settings fields
      const appSettings: NonNullable<UserPreferences["appSettings"]> = {};
      if ("darkMode" in updates) appSettings.darkMode = updates.darkMode;
      if ("notifications" in updates) appSettings.notifications = updates.notifications;
      if ("weightUnit" in updates) appSettings.weightUnit = updates.weightUnit;
      if ("undoWindowSeconds" in updates) appSettings.undoWindowSeconds = updates.undoWindowSeconds;
      if ("showRestoreBadge" in updates) appSettings.showRestoreBadge = updates.showRestoreBadge;
      if ("reorderHintFrequency" in updates) appSettings.reorderHintFrequency = updates.reorderHintFrequency;
      if ("longPressAndRun" in updates) appSettings.longPressAndRun = updates.longPressAndRun;
      if ("autoTriggerDelay" in updates) appSettings.autoTriggerDelay = updates.autoTriggerDelay;
      if ("backgroundPhotoDimLevel" in updates) appSettings.backgroundPhotoDimLevel = updates.backgroundPhotoDimLevel;
      if ("backgroundPhotoBlurRadius" in updates) appSettings.backgroundPhotoBlurRadius = updates.backgroundPhotoBlurRadius;
      if ("defaultCardAction" in updates) appSettings.defaultCardAction = updates.defaultCardAction;
      if ("cardThemeId" in updates) appSettings.cardThemeId = updates.cardThemeId;
      if ("cardVisibleStats" in updates) appSettings.cardVisibleStats = updates.cardVisibleStats;
      if (Object.keys(appSettings).length === 0) return;

      // Accumulate all changes from this burst into the pending patch ref.
      // This merges new keys on top of any changes that arrived before the
      // debounce timer fires, so nothing is lost even when settings are toggled
      // in rapid succession.
      pendingSettingsPatchRef.current = { ...pendingSettingsPatchRef.current, ...appSettings };

      // Cancel any in-flight debounce timer and restart it.  Only the final
      // flush after 600 ms of inactivity actually hits Supabase — a single
      // fetch + write that carries every accumulated change, eliminating the
      // read-before-write race condition.
      if (settingsDebounceTimerRef.current !== null) {
        clearTimeout(settingsDebounceTimerRef.current);
      }
      settingsDebounceTimerRef.current = setTimeout(() => {
        settingsDebounceTimerRef.current = null;
        const patch = pendingSettingsPatchRef.current;
        pendingSettingsPatchRef.current = {};
        if (Object.keys(patch).length === 0) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session?.user) return;
          fetchUserPreferences(session.user.id)
            .then((existing) =>
              upsertUserPreferences(session.user.id, {
                ...existing,
                appSettings: { ...(existing?.appSettings ?? {}), ...patch },
              })
            )
            .then(() => setLastSyncedAt(new Date()))
            .catch(() => {});
        });
      }, 600);
    },
    [persist]
  );

  const getTodayWorkouts = useCallback(
    () => state.workoutLogs.filter((w) => w.date === todayStr()),
    [state.workoutLogs]
  );

  const getTodayMeals = useCallback(
    () => state.mealLogs.filter((m) => m.date === todayStr()),
    [state.mealLogs]
  );

  const getTodayMacros = useCallback(() => {
    const meals = state.mealLogs.filter((m) => m.date === todayStr());
    return meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [state.mealLogs]);

  const getTodayWaterGlasses = useCallback(() => {
    const entry = state.waterIntake.find((w) => w.date === todayStr());
    return entry?.glasses ?? 0;
  }, [state.waterIntake]);

  const getWeekCalories = useCallback(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      const logged = state.mealLogs
        .filter((m) => m.date === dateStr)
        .reduce((s, m) => s + m.calories, 0);
      const calories = logged > 0 ? logged : 0;
      return { day: days[d.getDay()], date: dateStr, calories };
    });
  }, [state.mealLogs]);

  return (
    <FitnessContext.Provider
      value={{
        ...state,
        addWorkoutLog,
        addMealLog,
        removeMealLog,
        removeMealLogsByName,
        removeWorkoutLog,
        updateMealLog,
        syncMealName,
        addBodyMeasurement,
        addOviaMessage,
        updateWaterIntake,
        updateProfile,
        updateSettings,
        toggleFavoriteFood,
        reorderFavoriteFoods,
        updateQuickFoods,
        dismissHint,
        undismissHint,
        isHintDismissed,
        getHintDismissedAt,
        resetHints,
        getTodayWorkouts,
        getTodayMeals,
        getTodayMacros,
        getTodayWaterGlasses,
        getWeekCalories,
        stateHydrated,
        markOnboarded,
        resetState,
        clearAllData,
        dataResetCount,
        lastSyncedAt,
      }}
    >
      {children}
    </FitnessContext.Provider>
  );
}

export function useFitness() {
  const ctx = useContext(FitnessContext);
  if (!ctx) throw new Error("useFitness must be used within FitnessProvider");
  return ctx;
}
