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
  getApiBase,
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
}

/** Mobile-only: Ovia AI conversation history */
export interface OviaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** A pinned food item; structurally identical to a MealLog entry without id/date */
export type FavoriteFood = Omit<MealLog, "id" | "date"> & {
  /** Human-readable serving size label saved at star time (e.g. "150g", "1 cup") */
  servingLabel?: string;
  /** Server-assigned UUID injected from API on GET/POST. Used for reliable id-based DELETE. */
  _serverId?: string;
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
    undoWindowSeconds: 3 | 5 | 10;
    showRestoreBadge: boolean;
    reorderHintFrequency: "never" | "monthly" | "weekly";
  };
  /** Mobile-only extension: Ovia AI chat history */
  oviaMessages: OviaMessage[];
  /** Mobile-only extension: pinned favorite foods */
  favoriteFoods: FavoriteFood[];
}

interface FitnessContextType extends AppState {
  addWorkoutLog: (log: WorkoutLog) => void;
  addMealLog: (meal: MealLog) => void;
  removeMealLog: (id: string) => void;
  updateMealLog: (id: string, updates: Partial<Omit<MealLog, "id" | "date">>) => void;
  addBodyMeasurement: (m: BodyMeasurement) => void;
  addOviaMessage: (msg: Omit<OviaMessage, "id" | "timestamp">) => void;
  updateWaterIntake: (glasses: number) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateSettings: (updates: Partial<AppState["settings"]>) => void;
  toggleFavoriteFood: (food: FavoriteFood) => void;
  reorderFavoriteFoods: (foods: FavoriteFood[]) => void;
  getTodayWorkouts: () => WorkoutLog[];
  getTodayMeals: () => MealLog[];
  getTodayMacros: () => { calories: number; protein: number; carbs: number; fat: number };
  getTodayWaterGlasses: () => number;
  getWeekCalories: () => { day: string; calories: number }[];
  /** True once AsyncStorage has been read — prevents flash-redirect to onboarding */
  stateHydrated: boolean;
  /** Mark the user as having completed health onboarding */
  markOnboarded: () => void;
  /** Wipe all local fitness data and AsyncStorage on logout — prevents ghost-data for the next user */
  resetState: () => void;
}

/** Same key as the web app — data schemas are compatible */
const STORAGE_KEY = "raimzeal_fitness_data";
const PENDING_REMOVES_KEY = "raimzeal_pending_fav_removes";

type PendingRemove = { serverId: string; foodName: string };

async function queuePendingRemove(serverId: string, foodName: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_REMOVES_KEY);
    const existing: PendingRemove[] = raw ? (JSON.parse(raw) as PendingRemove[]) : [];
    if (!existing.some((r) => r.serverId === serverId)) {
      await AsyncStorage.setItem(PENDING_REMOVES_KEY, JSON.stringify([...existing, { serverId, foodName }]));
    }
  } catch {}
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
};

const FitnessContext = createContext<FitnessContextType | null>(null);

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);
  const [stateHydrated, setStateHydrated] = useState(false);

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

        // Process pending removes: foods the user removed locally but whose DELETE may have failed
        const pendingRemoves: PendingRemove[] = (() => {
          try { return pendingRemovesRaw ? (JSON.parse(pendingRemovesRaw) as PendingRemove[]) : []; }
          catch { return []; }
        })();
        const pendingRemoveNames = new Set(pendingRemoves.map((r) => r.foodName));

        // Retry pending removes in background (best-effort; queue cleared on success)
        pendingRemoves
          .filter((r) => favouritesRemote.some((f) => f.name === r.foodName))
          .forEach(({ serverId, foodName }) => {
            fetch(`${getApiBase()}/user/favourite-foods/${encodeURIComponent(serverId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then((res) => {
              if (res.ok) {
                AsyncStorage.getItem(PENDING_REMOVES_KEY).then((raw) => {
                  const cur: PendingRemove[] = raw ? (JSON.parse(raw) as PendingRemove[]) : [];
                  AsyncStorage.setItem(PENDING_REMOVES_KEY, JSON.stringify(cur.filter((r) => r.foodName !== foodName))).catch(() => {});
                }).catch(() => {});
              }
            }).catch(() => {});
          });

        // True merge: local-only foods (not yet on server) + filtered server foods (pending removes excluded)
        // Remote wins on conflict (same food name present both locally and on server).
        const filteredServerFoods = favouritesRemote.filter((f) => !pendingRemoveNames.has(f.name));
        const hydratedFavs: FavoriteFood[] = hydrated.favoriteFoods ?? [];
        const remoteByName = new Map(filteredServerFoods.map((f) => [f.name, f]));
        const localOnlyFoods = hydratedFavs.filter((lf) => !remoteByName.has(lf.name));
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
            // Merge cloud-backed settings (remote wins over local for synced fields)
            settings: {
              ...prev.settings,
              ...(remoteSettings != null
                ? {
                    ...(remoteSettings.showRestoreBadge != null
                      ? { showRestoreBadge: remoteSettings.showRestoreBadge }
                      : {}),
                  }
                : {}),
            },
          };
        });

        // Retry failed adds: push local-only foods to server and cache their server ids
        localOnlyFoods.forEach((f) => {
          fetch(`${getApiBase()}/user/favourite-foods`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ food: f }),
          }).then(async (res) => {
            if (res.ok) {
              const body = await res.json() as { id?: string };
              if (body.id) {
                setState((prev) => {
                  const favoriteFoods = prev.favoriteFoods.map((ff) =>
                    ff.name === f.name ? { ...ff, _serverId: body.id } : ff
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
  }, []);

  const addWorkoutLog = useCallback(
    (log: WorkoutLog) => {
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
            if (session?.user) insertWorkoutLog(session.user.id, log).catch(() => {});
          });
        }
        return next;
      });
    },
    [persist]
  );

  const addMealLog = useCallback(
    (meal: MealLog) => {
      setState((prev) => {
        const next = { ...prev, mealLogs: [meal, ...prev.mealLogs] };
        persist(next);
        // Background push to Supabase
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) insertMealLog(session.user.id, meal).catch(() => {});
          });
        }
        return next;
      });
    },
    [persist]
  );

  const removeMealLog = useCallback(
    (id: string) => {
      setState((prev) => {
        const next = { ...prev, mealLogs: prev.mealLogs.filter((m) => m.id !== id) };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const updateMealLog = useCallback(
    (id: string, updates: Partial<Omit<MealLog, "id" | "date">>) => {
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
              upsertMealLog(session.user.id, merged).catch(() => {});
            }
          });
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
            if (session?.user) insertBodyMeasurement(session.user.id, m).catch(() => {});
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
              insertOviaMessage(session.user.id, newMsg).catch(() => {});
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
            if (session?.user) upsertWaterIntake(session.user.id, today, glasses).catch(() => {});
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
      setState((prev) => {
        capturedExists = prev.favoriteFoods.some((f) => f.name === food.name);
        capturedServerId = (prev.favoriteFoods.find((f) => f.name === food.name) as (FavoriteFood & { _serverId?: string }) | undefined)?._serverId;
        const favoriteFoods = capturedExists
          ? prev.favoriteFoods.filter((f) => f.name !== food.name)
          : [food, ...prev.favoriteFoods];
        const next = { ...prev, favoriteFoods };
        persist(next);
        return next;
      });
      if (!isSupabaseConfigured) return;
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;
        if (capturedExists) {
          // Delete by server id; food without a server id was never synced — no action needed
          if (capturedServerId) {
            fetch(`${getApiBase()}/user/favourite-foods/${encodeURIComponent(capturedServerId)}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${session.access_token}` },
            }).then((res) => {
              if (!res.ok) {
                void queuePendingRemove(capturedServerId!, food.name);
              }
            }).catch(() => {
              void queuePendingRemove(capturedServerId!, food.name);
            });
          }
        } else {
          // Add: POST and persist the server id for reliable future deletes
          fetch(`${getApiBase()}/user/favourite-foods`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ food }),
          }).then(async (res) => {
            if (res.ok) {
              const body = await res.json() as { id?: string };
              if (body.id) {
                setState((prev) => {
                  const favoriteFoods = prev.favoriteFoods.map((ff) =>
                    ff.name === food.name ? { ...ff, _serverId: body.id } : ff
                  );
                  const next = { ...prev, favoriteFoods };
                  persist(next);
                  return next;
                });
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

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      setState((prev) => {
        const next = { ...prev, user: prev.user ? { ...prev.user, ...updates } : prev.user };
        persist(next);
        // Background push to Supabase
        if (next.user && isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) upsertProfile(session.user.id, next.user!).catch(() => {});
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
        // Push synced settings fields to Supabase so they persist across devices
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user) return;
            const appSettings: { showRestoreBadge?: boolean } = {};
            if ("showRestoreBadge" in updates) {
              appSettings.showRestoreBadge = updates.showRestoreBadge;
            }
            if (Object.keys(appSettings).length > 0) {
              // Merge into existing preferences so other preference keys are preserved
              fetchUserPreferences(session.user.id)
                .then((existing) =>
                  upsertUserPreferences(session.user.id, {
                    ...existing,
                    appSettings: { ...(existing?.appSettings ?? {}), ...appSettings },
                  })
                )
                .catch(() => {});
            }
          });
        }
        return next;
      });
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
      return { day: days[d.getDay()], calories };
    });
  }, [state.mealLogs]);

  return (
    <FitnessContext.Provider
      value={{
        ...state,
        addWorkoutLog,
        addMealLog,
        removeMealLog,
        updateMealLog,
        addBodyMeasurement,
        addOviaMessage,
        updateWaterIntake,
        updateProfile,
        updateSettings,
        toggleFavoriteFood,
        reorderFavoriteFoods,
        getTodayWorkouts,
        getTodayMeals,
        getTodayMacros,
        getTodayWaterGlasses,
        getWeekCalories,
        stateHydrated,
        markOnboarded,
        resetState,
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
