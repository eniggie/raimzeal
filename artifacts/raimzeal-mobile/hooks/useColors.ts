import colors from "@/constants/colors";

/**
 * Stable singleton so callers always receive the same object reference.
 * RAIMZEAL is always dark-themed — we always return the dark palette.
 */
const stableColors = { ...colors.dark, radius: colors.radius };

/**
 * Returns the RAIMZEAL dark design tokens.
 * The returned reference is stable across renders, so memo comparators in
 * child components (e.g. ThemeSwatchItem, PresetChipItem) can short-circuit
 * immediately when only unrelated state has changed.
 */
export function useColors() {
  return stableColors;
}
