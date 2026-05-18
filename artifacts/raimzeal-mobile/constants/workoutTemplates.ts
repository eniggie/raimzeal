import { Ionicons } from "@expo/vector-icons";

export interface WorkoutTemplate {
  workoutId: string;
  name: string;
  duration: number;
  calories: number;
  exercises: { name: string; sets: number; reps: number; weight?: number }[];
  icon: keyof typeof Ionicons.glyphMap;
}

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    workoutId: "w1",
    name: "Upper Body Strength",
    duration: 50,
    calories: 380,
    exercises: [
      { name: "Bench Press", sets: 4, reps: 10, weight: 70 },
      { name: "Pull-ups", sets: 4, reps: 8 },
      { name: "Shoulder Press", sets: 3, reps: 12, weight: 45 },
      { name: "Bicep Curls", sets: 3, reps: 12, weight: 16 },
      { name: "Tricep Dips", sets: 3, reps: 12 },
    ],
    icon: "barbell-outline",
  },
  {
    workoutId: "w2",
    name: "Leg Day",
    duration: 65,
    calories: 460,
    exercises: [
      { name: "Squats", sets: 4, reps: 12, weight: 60 },
      { name: "Deadlifts", sets: 3, reps: 8, weight: 85 },
      { name: "Lunges", sets: 3, reps: 12 },
      { name: "Leg Press", sets: 3, reps: 15 },
      { name: "Calf Raises", sets: 4, reps: 20 },
    ],
    icon: "body-outline",
  },
  {
    workoutId: "w3",
    name: "HIIT Cardio",
    duration: 30,
    calories: 320,
    exercises: [
      { name: "Burpees", sets: 4, reps: 15 },
      { name: "Jump Rope", sets: 4, reps: 100 },
      { name: "Box Jumps", sets: 4, reps: 10 },
      { name: "Sprint Intervals", sets: 6, reps: 1 },
      { name: "Mountain Climbers", sets: 4, reps: 20 },
    ],
    icon: "flash-outline",
  },
  {
    workoutId: "w4",
    name: "Core & Abs",
    duration: 25,
    calories: 180,
    exercises: [
      { name: "Plank", sets: 3, reps: 1 },
      { name: "Crunches", sets: 4, reps: 20 },
      { name: "Leg Raises", sets: 3, reps: 15 },
      { name: "Russian Twists", sets: 3, reps: 20 },
      { name: "Bicycle Crunches", sets: 3, reps: 20 },
    ],
    icon: "fitness-outline",
  },
  {
    workoutId: "w5",
    name: "Full Body",
    duration: 60,
    calories: 420,
    exercises: [
      { name: "Deadlifts", sets: 3, reps: 8, weight: 85 },
      { name: "Push-ups", sets: 4, reps: 15 },
      { name: "Rows", sets: 4, reps: 10 },
      { name: "Squat Jumps", sets: 3, reps: 12 },
      { name: "Shoulder Press", sets: 3, reps: 10, weight: 45 },
    ],
    icon: "body-outline",
  },
  {
    workoutId: "w6",
    name: "Active Recovery",
    duration: 35,
    calories: 150,
    exercises: [
      { name: "Yoga Flow", sets: 1, reps: 1 },
      { name: "Foam Rolling", sets: 1, reps: 1 },
      { name: "Light Stretching", sets: 1, reps: 1 },
      { name: "Walking", sets: 1, reps: 1 },
      { name: "Mobility Work", sets: 1, reps: 1 },
    ],
    icon: "leaf-outline",
  },
];
