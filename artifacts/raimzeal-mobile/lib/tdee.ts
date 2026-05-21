import { UserProfile } from "@/contexts/FitnessContext";
import { MacroGoals } from "@/contexts/MacroGoalsContext";

/**
 * Returns suggested macro goals derived from the user's profile using the
 * Mifflin-St Jeor BMR formula (gender-neutral average) multiplied by an
 * activity factor and adjusted for the user's primary fitness goal.
 *
 * Returns null if the profile is missing the required fields.
 */
export function computeSuggestedGoals(user: UserProfile | null): MacroGoals | null {
  if (!user) return null;

  const { age, weight, height, fitnessLevel, goals, units } = user;

  if (!age || !weight || !height || age <= 0 || weight <= 0 || height <= 0) {
    return null;
  }

  // Normalise to metric
  const weightKg = units === "imperial" ? weight * 0.453592 : weight;
  const heightCm = units === "imperial" ? height * 2.54 : height;

  // Mifflin-St Jeor (gender-neutral: average of male/female constants → -78)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78;

  // Activity multiplier
  const activityFactor: Record<UserProfile["fitnessLevel"], number> = {
    beginner: 1.375,
    intermediate: 1.55,
    advanced: 1.725,
  };
  const tdee = bmr * (activityFactor[fitnessLevel] ?? 1.375);

  // Goal adjustment
  const primaryGoal = goals?.[0] ?? "";
  let targetCalories: number;
  if (primaryGoal === "lose_weight") {
    targetCalories = tdee - 500;
  } else if (primaryGoal === "build_muscle") {
    targetCalories = tdee + 300;
  } else {
    targetCalories = tdee;
  }

  targetCalories = Math.max(1200, Math.round(targetCalories / 50) * 50);

  // Macro split ratios (protein/carbs/fat as fraction of total calories)
  let proteinRatio: number;
  let carbRatio: number;
  let fatRatio: number;

  if (primaryGoal === "build_muscle") {
    proteinRatio = 0.35;
    carbRatio = 0.45;
    fatRatio = 0.20;
  } else if (primaryGoal === "lose_weight") {
    proteinRatio = 0.40;
    carbRatio = 0.35;
    fatRatio = 0.25;
  } else {
    proteinRatio = 0.25;
    carbRatio = 0.50;
    fatRatio = 0.25;
  }

  // Convert calories → grams (protein 4 kcal/g, carbs 4 kcal/g, fat 9 kcal/g)
  const protein = Math.round((targetCalories * proteinRatio) / 4 / 5) * 5;
  const carbs = Math.round((targetCalories * carbRatio) / 4 / 5) * 5;
  const fat = Math.round((targetCalories * fatRatio) / 9 / 5) * 5;

  return { calories: targetCalories, protein, carbs, fat };
}

/** Human-readable label for the first goal in the goals array */
export function primaryGoalLabel(goals: string[]): string {
  const map: Record<string, string> = {
    lose_weight: "weight loss",
    build_muscle: "muscle gain",
    improve_fitness: "general fitness",
    maintain: "maintenance",
  };
  return map[goals?.[0] ?? ""] ?? "your goals";
}
