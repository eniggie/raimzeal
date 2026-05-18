/**
 * FitnessContext — mobile state management.
 *
 * Uses the SAME data model and storage key as the web app (artifacts/raimzeal/src/lib/store.ts)
 * so data structures are compatible across platforms.
 *
 * Storage key: "raimzeal_fitness_data" (matches web app localStorage key)
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
}

/** Mobile-only: Ovia AI conversation history */
export interface OviaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

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
  };
  /** Mobile-only extension: Ovia AI chat history */
  oviaMessages: OviaMessage[];
}

interface FitnessContextType extends AppState {
  addWorkoutLog: (log: WorkoutLog) => void;
  addMealLog: (meal: MealLog) => void;
  addBodyMeasurement: (m: BodyMeasurement) => void;
  addOviaMessage: (msg: Omit<OviaMessage, "id" | "timestamp">) => void;
  updateWaterIntake: (glasses: number) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  getTodayWorkouts: () => WorkoutLog[];
  getTodayMeals: () => MealLog[];
  getTodayMacros: () => { calories: number; protein: number; carbs: number; fat: number };
  getTodayWaterGlasses: () => number;
  getWeekCalories: () => { day: string; calories: number }[];
}

/** Same key as the web app — data schemas are compatible */
const STORAGE_KEY = "raimzeal_fitness_data";

const todayStr = () => new Date().toISOString().split("T")[0];

const dateOffset = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];

const DEMO_USER: UserProfile = {
  id: "demo",
  name: "Athlete",
  email: "demo@raimzeal.com",
  age: 28,
  height: 178,
  weight: 80,
  fitnessLevel: "intermediate",
  goals: ["build_muscle", "improve_fitness"],
  units: "metric",
  createdAt: dateOffset(30),
};

/** Deterministic sample data — no Math.random() */
const SAMPLE_WORKOUT_LOGS: WorkoutLog[] = [
  {
    id: "wl1",
    workoutId: "w1",
    workoutName: "Full Body Strength",
    date: todayStr(),
    duration: 45,
    caloriesBurned: 320,
    exercises: [
      { name: "Squats", sets: 4, reps: 12, weight: 60 },
      { name: "Bench Press", sets: 4, reps: 10, weight: 70 },
      { name: "Deadlifts", sets: 3, reps: 8, weight: 85 },
    ],
  },
  {
    id: "wl2",
    workoutId: "w2",
    workoutName: "HIIT Cardio Blast",
    date: dateOffset(2),
    duration: 30,
    caloriesBurned: 280,
    exercises: [
      { name: "Burpees", sets: 4, reps: 15 },
      { name: "Mountain Climbers", sets: 4, reps: 20 },
      { name: "Jump Squats", sets: 4, reps: 15 },
    ],
  },
  {
    id: "wl3",
    workoutId: "w3",
    workoutName: "Upper Body Power",
    date: dateOffset(4),
    duration: 50,
    caloriesBurned: 290,
    exercises: [
      { name: "Pull-ups", sets: 4, reps: 8 },
      { name: "Shoulder Press", sets: 4, reps: 10, weight: 45 },
      { name: "Bicep Curls", sets: 3, reps: 12, weight: 16 },
    ],
  },
];

const SAMPLE_MEAL_LOGS: MealLog[] = [
  { id: "ml1", date: todayStr(), name: "Protein Oatmeal", calories: 450, protein: 30, carbs: 55, fat: 12, mealType: "breakfast" },
  { id: "ml2", date: todayStr(), name: "Grilled Chicken Salad", calories: 520, protein: 45, carbs: 25, fat: 22, mealType: "lunch" },
  { id: "ml3", date: todayStr(), name: "Greek Yogurt", calories: 180, protein: 18, carbs: 12, fat: 6, mealType: "snack" },
  { id: "ml4", date: dateOffset(1), name: "Protein Oatmeal", calories: 450, protein: 30, carbs: 55, fat: 12, mealType: "breakfast" },
  { id: "ml5", date: dateOffset(1), name: "Salmon with Quinoa", calories: 620, protein: 42, carbs: 45, fat: 28, mealType: "dinner" },
  { id: "ml6", date: dateOffset(2), name: "Chicken Rice Bowl", calories: 580, protein: 48, carbs: 50, fat: 14, mealType: "lunch" },
];

/** Fixed weekly calorie values (deterministic, represents a realistic week) */
const FIXED_WEEK_CALORIES = [1750, 2100, 1950, 2200, 1850, 2050, 1680];

const SAMPLE_BODY_MEASUREMENTS: BodyMeasurement[] = Array.from(
  { length: 12 },
  (_, i) => ({
    id: `bm${i}`,
    date: dateOffset((11 - i) * 7),
    weight: 83 - i * 0.25,
    chest: 100 - i * 0.1,
    waist: 85 - i * 0.2,
  })
);

const SAMPLE_WATER_INTAKE: AppState["waterIntake"] = [
  { date: todayStr(), glasses: 6 },
  { date: dateOffset(1), glasses: 8 },
  { date: dateOffset(2), glasses: 7 },
  { date: dateOffset(3), glasses: 9 },
  { date: dateOffset(4), glasses: 6 },
  { date: dateOffset(5), glasses: 8 },
  { date: dateOffset(6), glasses: 7 },
];

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
  isOnboarded: true,
  isLoggedIn: true,
  user: DEMO_USER,
  workoutLogs: SAMPLE_WORKOUT_LOGS,
  bodyMeasurements: SAMPLE_BODY_MEASUREMENTS,
  mealLogs: SAMPLE_MEAL_LOGS,
  waterIntake: SAMPLE_WATER_INTAKE,
  streak: 7,
  personalRecords: [
    { exercise: "Bench Press", weight: 90, date: dateOffset(5) },
    { exercise: "Squat", weight: 100, date: dateOffset(10) },
    { exercise: "Deadlift", weight: 120, date: dateOffset(15) },
  ],
  settings: {
    darkMode: true,
    notifications: true,
    weightUnit: "kg",
  },
  oviaMessages: INITIAL_OVIA_MESSAGES,
};

const FitnessContext = createContext<FitnessContextType | null>(null);

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(defaultState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<AppState>;
          setState((prev) => ({
            ...prev,
            ...saved,
            settings: { ...prev.settings, ...(saved.settings ?? {}) },
            oviaMessages: saved.oviaMessages ?? prev.oviaMessages,
          }));
        } catch {
          // corrupted storage — keep defaults
        }
      }
    });
  }, []);

  const persist = useCallback((next: AppState) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const addWorkoutLog = useCallback(
    (log: WorkoutLog) => {
      setState((prev) => {
        const next = { ...prev, workoutLogs: [log, ...prev.workoutLogs], streak: prev.streak + 1 };
        persist(next);
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
        return next;
      });
    },
    [persist]
  );

  const addOviaMessage = useCallback(
    (msg: Omit<OviaMessage, "id" | "timestamp">) => {
      setState((prev) => {
        const next = {
          ...prev,
          oviaMessages: [
            ...prev.oviaMessages,
            { ...msg, id: Date.now().toString(), timestamp: new Date().toISOString() },
          ],
        };
        persist(next);
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
        return next;
      });
    },
    [persist]
  );

  const updateProfile = useCallback(
    (updates: Partial<UserProfile>) => {
      setState((prev) => {
        const next = { ...prev, user: prev.user ? { ...prev.user, ...updates } : prev.user };
        persist(next);
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
      // Show logged data or the fixed sample value for days in sample range
      const calories = logged > 0 ? logged : (FIXED_WEEK_CALORIES[i] ?? 0);
      return { day: days[d.getDay()], calories };
    });
  }, [state.mealLogs]);

  return (
    <FitnessContext.Provider
      value={{
        ...state,
        addWorkoutLog,
        addMealLog,
        addBodyMeasurement,
        addOviaMessage,
        updateWaterIntake,
        updateProfile,
        getTodayWorkouts,
        getTodayMeals,
        getTodayMacros,
        getTodayWaterGlasses,
        getWeekCalories,
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
