import { UserProfile } from "@/contexts/FitnessContext";
import { MacroGoals } from "@/contexts/MacroGoalsContext";

export interface TdeeBreakdown {
  bmr: number;
  tdee: number;
  goalAdjustment: number;
  targetCalories: number;
  proteinRatio: number;
  carbRatio: number;
  fatRatio: number;
  activityLabel: string;
}

export interface SuggestedGoalsResult {
  goals: MacroGoals;
  breakdown: TdeeBreakdown;
}

function activityLabel(fitnessLevel: UserProfile["fitnessLevel"]): string {
  const map: Record<UserProfile["fitnessLevel"], string> = {
    beginner: "lightly active (1.375×)",
    intermediate: "moderately active (1.55×)",
    advanced: "very active (1.725×)",
  };
  return map[fitnessLevel] ?? "lightly active (1.375×)";
}

/**
 * Returns suggested macro goals derived from the user's profile using the
 * Mifflin-St Jeor BMR formula (gender-neutral average) multiplied by an
 * activity factor and adjusted for the user's primary fitness goal.
 *
 * Returns null if the profile is missing the required fields.
 */
export function computeSuggestedGoals(user: UserProfile | null): MacroGoals | null {
  const result = computeSuggestedGoalsWithBreakdown(user);
  return result ? result.goals : null;
}

/**
 * Same as computeSuggestedGoals but also returns the intermediate values so
 * the UI can show a step-by-step breakdown.
 */
export function computeSuggestedGoalsWithBreakdown(user: UserProfile | null): SuggestedGoalsResult | null {
  if (!user) return null;

  const { age, weight, height, fitnessLevel, goals, units, biologicalSex } = user;

  if (!age || !weight || !height || age <= 0 || weight <= 0 || height <= 0) {
    return null;
  }

  // Normalise to metric
  const weightKg = units === "imperial" ? weight * 0.453592 : weight;
  const heightCm = units === "imperial" ? height * 2.54 : height;

  // Mifflin-St Jeor BMR constant:
  //   male   → +5
  //   female → −161
  //   unknown/prefer-not-to-say → average (−78)
  const sexConstant =
    biologicalSex === "male" ? 5 : biologicalSex === "female" ? -161 : -78;
  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant);

  // Activity multiplier
  const activityFactor: Record<UserProfile["fitnessLevel"], number> = {
    beginner: 1.375,
    intermediate: 1.55,
    advanced: 1.725,
  };
  const tdee = Math.round(bmr * (activityFactor[fitnessLevel] ?? 1.375));

  // Goal adjustment
  const primaryGoal = goals?.[0] ?? "";
  let goalAdjustment: number;
  if (primaryGoal === "lose_weight") {
    goalAdjustment = -500;
  } else if (primaryGoal === "build_muscle") {
    goalAdjustment = +300;
  } else {
    goalAdjustment = 0;
  }

  let targetCalories = Math.max(1200, Math.round((tdee + goalAdjustment) / 50) * 50);

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

  return {
    goals: { calories: targetCalories, protein, carbs, fat },
    breakdown: {
      bmr,
      tdee,
      goalAdjustment,
      targetCalories,
      proteinRatio,
      carbRatio,
      fatRatio,
      activityLabel: activityLabel(fitnessLevel),
    },
  };
}

export interface GlossaryEntry {
  title: string;
  body: string;
}

/**
 * Plain-language explanations for each term shown in the breakdown card.
 * Keys are stable identifiers referenced by BreakdownRow's glossaryKey prop.
 */
export const BREAKDOWN_GLOSSARY: Record<string, GlossaryEntry> = {
  bmr: {
    title: "Basal Metabolic Rate (BMR)",
    body: "Your BMR is the number of calories your body needs just to keep you alive while at complete rest — breathing, circulation, and cell repair all count. Think of it as the minimum fuel bill your body pays every day, even if you never got out of bed.",
  },
  tdee: {
    title: "Total Daily Energy Expenditure (TDEE)",
    body: "TDEE is your BMR scaled up by how active you are throughout the day. It estimates the total calories you actually burn across everything — workouts, walking around, even fidgeting. Eating at your TDEE keeps your weight stable.",
  },
  goal_adjustment: {
    title: "Goal Adjustment",
    body: "This is a deliberate calorie offset added on top of your TDEE to move you toward your goal. A deficit (negative) puts you in fat-loss mode by burning stored energy; a surplus (positive) gives your muscles the extra fuel they need to grow. The amount is chosen to be effective but sustainable.",
  },
  target_calories: {
    title: "Target Calories",
    body: "Your personalised daily calorie goal — your TDEE plus or minus the goal adjustment, rounded to the nearest 50 kcal for simplicity. Hit this number consistently and your body will trend in the direction of your goal over time.",
  },
  macro_protein: {
    title: "Protein",
    body: "Protein is made up of amino acids, the building blocks your body uses to repair and build muscle. Each gram provides 4 calories. Higher-protein diets also tend to keep you fuller for longer, making it easier to manage your overall intake.",
  },
  macro_carbs: {
    title: "Carbohydrates",
    body: "Carbs are your body's preferred quick-release energy source, especially during exercise. Each gram provides 4 calories. They replenish muscle glycogen after workouts and fuel your brain throughout the day.",
  },
  macro_fat: {
    title: "Fat",
    body: "Dietary fat supports hormone production, vitamin absorption (A, D, E, K), and long-lasting energy between meals. Each gram provides 9 calories — more than twice that of protein or carbs — so a little goes a long way.",
  },
};

/**
 * Returns a plain-text summary of the macro breakdown suitable for sharing
 * via the native share sheet (e.g. screenshot caption, message to a coach).
 */
export function formatBreakdownText(
  breakdown: TdeeBreakdown,
  goals: MacroGoals,
  goalLabel: string
): string {
  const lines: string[] = [
    "📊 My Macro Breakdown",
    "",
    `BMR: ${breakdown.bmr} kcal`,
    `TDEE (${breakdown.activityLabel}): ${breakdown.tdee} kcal`,
  ];
  const sign = breakdown.goalAdjustment > 0 ? "+" : "";
  lines.push(`Goal adjustment (${goalLabel}): ${sign}${breakdown.goalAdjustment} kcal`);
  lines.push(`Target calories: ${breakdown.targetCalories} kcal`);
  lines.push("");
  lines.push("Macro targets:");
  lines.push(`• Protein: ${goals.protein}g (${Math.round(breakdown.proteinRatio * 100)}% of calories)`);
  lines.push(`• Carbs: ${goals.carbs}g (${Math.round(breakdown.carbRatio * 100)}% of calories)`);
  lines.push(`• Fat: ${goals.fat}g (${Math.round(breakdown.fatRatio * 100)}% of calories)`);
  lines.push("");
  lines.push("Generated with RAIMZEAL");
  return lines.join("\n");
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
