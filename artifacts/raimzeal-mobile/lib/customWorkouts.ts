import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WorkoutTemplate } from "@/constants/workoutTemplates";

export const CUSTOM_WORKOUTS_STORAGE_KEY = "@raimzeal_custom_workouts_v1";

export async function loadCustomWorkouts(): Promise<WorkoutTemplate[]> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOM_WORKOUTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WorkoutTemplate[];
  } catch {
    return [];
  }
}

export async function saveCustomWorkouts(workouts: WorkoutTemplate[]): Promise<void> {
  await AsyncStorage.setItem(CUSTOM_WORKOUTS_STORAGE_KEY, JSON.stringify(workouts));
}

export async function deleteCustomWorkout(workoutId: string): Promise<void> {
  const existing = await loadCustomWorkouts();
  await saveCustomWorkouts(existing.filter((w) => w.workoutId !== workoutId));
}
