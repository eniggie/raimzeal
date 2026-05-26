import AsyncStorage from "@react-native-async-storage/async-storage";
import { ThumbnailSize } from "@/hooks/useThumbnailSize";
import { MacroGoals, DEFAULT_MACRO_GOALS } from "@/contexts/MacroGoalsContext";

const THUMB_SIZE_KEY = "@raimzeal_card_thumb_size";
const PER100G_KEY = "@raimzeal_default_per100g";
const MACRO_GOALS_KEY = "raimzeal_macro_goals";
const RATIONALE_DISMISSED_KEY = "camera_roll_rationale_dismissed";

const VALID_THUMB_SIZES: ThumbnailSize[] = ["s", "m", "l"];
const DEFAULT_THUMB_SIZE: ThumbnailSize = "m";

export interface BootPreferences {
  thumbnailSize: ThumbnailSize;
  defaultPer100g: boolean;
  macroGoals: MacroGoals;
  cameraRollRationaleDismissed: boolean;
}

/**
 * Reads all boot-time preferences from AsyncStorage in a single `multiGet`
 * call. Call this once before rendering the app shell so every provider can
 * be seeded with the correct persisted value on the very first render —
 * no per-provider sequential reads, no null states, no flashes.
 */
export async function loadBootPreferences(): Promise<BootPreferences> {
  const keys = [
    THUMB_SIZE_KEY,
    PER100G_KEY,
    MACRO_GOALS_KEY,
    RATIONALE_DISMISSED_KEY,
  ] as const;

  let results: readonly [string, string | null][];
  try {
    results = await AsyncStorage.multiGet(keys);
  } catch {
    return {
      thumbnailSize: DEFAULT_THUMB_SIZE,
      defaultPer100g: false,
      macroGoals: DEFAULT_MACRO_GOALS,
      cameraRollRationaleDismissed: false,
    };
  }

  const map = Object.fromEntries(results.map(([k, v]) => [k, v]));

  // --- thumbnail size ---
  const rawThumb = map[THUMB_SIZE_KEY];
  const thumbnailSize: ThumbnailSize =
    rawThumb && VALID_THUMB_SIZES.includes(rawThumb as ThumbnailSize)
      ? (rawThumb as ThumbnailSize)
      : DEFAULT_THUMB_SIZE;

  // --- per-100g default ---
  const defaultPer100g = map[PER100G_KEY] === "true";

  // --- macro goals ---
  let macroGoals: MacroGoals = DEFAULT_MACRO_GOALS;
  const rawMacros = map[MACRO_GOALS_KEY];
  if (rawMacros) {
    try {
      const parsed = JSON.parse(rawMacros) as Partial<MacroGoals>;
      macroGoals = {
        calories: parsed.calories ?? DEFAULT_MACRO_GOALS.calories,
        protein: parsed.protein ?? DEFAULT_MACRO_GOALS.protein,
        carbs: parsed.carbs ?? DEFAULT_MACRO_GOALS.carbs,
        fat: parsed.fat ?? DEFAULT_MACRO_GOALS.fat,
      };
    } catch {
      // corrupted — keep defaults
    }
  }

  // --- camera roll rationale dismissed ---
  const cameraRollRationaleDismissed =
    map[RATIONALE_DISMISSED_KEY] === "true";

  return {
    thumbnailSize,
    defaultPer100g,
    macroGoals,
    cameraRollRationaleDismissed,
  };
}
