import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface WorkoutLog {
  id: string;
  name: string;
  duration: number;
  calories: number;
  date: string;
  exercises: string[];
}

export interface NutritionLog {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string;
  meal: "breakfast" | "lunch" | "dinner" | "snack";
}

export interface ProgressEntry {
  date: string;
  weight: number;
  bodyFat?: number;
}

export interface OviaMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface UserProfile {
  name: string;
  goal: "lose_weight" | "build_muscle" | "maintain" | "improve_fitness";
  age: number;
  weight: number;
  height: number;
  weeklyTarget: number;
}

interface FitnessState {
  profile: UserProfile;
  workoutLogs: WorkoutLog[];
  nutritionLogs: NutritionLog[];
  progressEntries: ProgressEntry[];
  oviaMessages: OviaMessage[];
  streak: number;
  totalCaloriesToday: number;
  waterIntake: number;
  stepsToday: number;
}

interface FitnessContextType extends FitnessState {
  updateProfile: (profile: Partial<UserProfile>) => void;
  addWorkout: (workout: Omit<WorkoutLog, "id">) => void;
  addNutrition: (entry: Omit<NutritionLog, "id">) => void;
  addProgressEntry: (entry: ProgressEntry) => void;
  addOviaMessage: (msg: Omit<OviaMessage, "id" | "timestamp">) => void;
  setWaterIntake: (ml: number) => void;
  setStepsToday: (steps: number) => void;
  getTodayWorkouts: () => WorkoutLog[];
  getTodayNutrition: () => NutritionLog[];
  getWeekCalories: () => { day: string; calories: number }[];
}

const today = () => new Date().toISOString().split("T")[0];

const defaultProfile: UserProfile = {
  name: "Athlete",
  goal: "build_muscle",
  age: 28,
  weight: 75,
  height: 178,
  weeklyTarget: 4,
};

const sampleWorkouts: WorkoutLog[] = [
  {
    id: "1",
    name: "Upper Body Strength",
    duration: 52,
    calories: 380,
    date: today(),
    exercises: ["Bench Press", "Pull-ups", "Shoulder Press", "Bicep Curls"],
  },
  {
    id: "2",
    name: "HIIT Cardio",
    duration: 30,
    calories: 320,
    date: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    exercises: ["Burpees", "Jump Rope", "Box Jumps", "Sprint Intervals"],
  },
  {
    id: "3",
    name: "Leg Day",
    duration: 65,
    calories: 450,
    date: new Date(Date.now() - 172800000).toISOString().split("T")[0],
    exercises: ["Squats", "Deadlifts", "Lunges", "Leg Press"],
  },
];

const sampleNutrition: NutritionLog[] = [
  {
    id: "1",
    name: "Protein Shake",
    calories: 180,
    protein: 25,
    carbs: 10,
    fat: 4,
    date: today(),
    meal: "breakfast",
  },
  {
    id: "2",
    name: "Chicken & Rice Bowl",
    calories: 520,
    protein: 42,
    carbs: 55,
    fat: 12,
    date: today(),
    meal: "lunch",
  },
  {
    id: "3",
    name: "Greek Yogurt",
    calories: 130,
    protein: 17,
    carbs: 8,
    fat: 3,
    date: today(),
    meal: "snack",
  },
];

const sampleProgress: ProgressEntry[] = Array.from({ length: 12 }, (_, i) => ({
  date: new Date(Date.now() - (11 - i) * 7 * 86400000).toISOString().split("T")[0],
  weight: 78 - i * 0.25 + (Math.random() - 0.5) * 0.5,
  bodyFat: 18 - i * 0.1,
}));

const sampleOviaMessages: OviaMessage[] = [
  {
    id: "1",
    role: "assistant",
    content:
      "Hey! I'm Ovia, your AI fitness coach. I'm here to help you crush your goals. How are you feeling today?",
    timestamp: new Date().toISOString(),
  },
];

const STORAGE_KEY = "raimzeal_mobile_data";

const FitnessContext = createContext<FitnessContextType | null>(null);

export function FitnessProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FitnessState>({
    profile: defaultProfile,
    workoutLogs: sampleWorkouts,
    nutritionLogs: sampleNutrition,
    progressEntries: sampleProgress,
    oviaMessages: sampleOviaMessages,
    streak: 7,
    totalCaloriesToday: 830,
    waterIntake: 1800,
    stepsToday: 8420,
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Partial<FitnessState>;
          setState((prev) => ({ ...prev, ...saved }));
        } catch {}
      }
    });
  }, []);

  const save = useCallback((next: FitnessState) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const updateProfile = useCallback(
    (profile: Partial<UserProfile>) => {
      setState((prev) => {
        const next = { ...prev, profile: { ...prev.profile, ...profile } };
        save(next);
        return next;
      });
    },
    [save]
  );

  const addWorkout = useCallback(
    (workout: Omit<WorkoutLog, "id">) => {
      setState((prev) => {
        const next = {
          ...prev,
          workoutLogs: [
            { ...workout, id: Date.now().toString() },
            ...prev.workoutLogs,
          ],
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const addNutrition = useCallback(
    (entry: Omit<NutritionLog, "id">) => {
      setState((prev) => {
        const newEntry = { ...entry, id: Date.now().toString() };
        const next = {
          ...prev,
          nutritionLogs: [newEntry, ...prev.nutritionLogs],
          totalCaloriesToday: prev.totalCaloriesToday + entry.calories,
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const addProgressEntry = useCallback(
    (entry: ProgressEntry) => {
      setState((prev) => {
        const next = {
          ...prev,
          progressEntries: [...prev.progressEntries, entry],
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const addOviaMessage = useCallback(
    (msg: Omit<OviaMessage, "id" | "timestamp">) => {
      setState((prev) => {
        const next = {
          ...prev,
          oviaMessages: [
            ...prev.oviaMessages,
            {
              ...msg,
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
            },
          ],
        };
        save(next);
        return next;
      });
    },
    [save]
  );

  const setWaterIntake = useCallback(
    (ml: number) => {
      setState((prev) => {
        const next = { ...prev, waterIntake: ml };
        save(next);
        return next;
      });
    },
    [save]
  );

  const setStepsToday = useCallback(
    (steps: number) => {
      setState((prev) => {
        const next = { ...prev, stepsToday: steps };
        save(next);
        return next;
      });
    },
    [save]
  );

  const getTodayWorkouts = useCallback(() => {
    return state.workoutLogs.filter((w) => w.date === today());
  }, [state.workoutLogs]);

  const getTodayNutrition = useCallback(() => {
    return state.nutritionLogs.filter((n) => n.date === today());
  }, [state.nutritionLogs]);

  const getWeekCalories = useCallback(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      const dateStr = d.toISOString().split("T")[0];
      const cal = state.nutritionLogs
        .filter((n) => n.date === dateStr)
        .reduce((s, n) => s + n.calories, 0);
      return { day: days[d.getDay()], calories: cal || Math.floor(Math.random() * 800) + 1400 };
    });
  }, [state.nutritionLogs]);

  return (
    <FitnessContext.Provider
      value={{
        ...state,
        updateProfile,
        addWorkout,
        addNutrition,
        addProgressEntry,
        addOviaMessage,
        setWaterIntake,
        setStepsToday,
        getTodayWorkouts,
        getTodayNutrition,
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
