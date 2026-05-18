import colors from "@/constants/colors";

/**
 * Returns the RAIMZEAL dark design tokens.
 * RAIMZEAL is always dark-themed — we always return the dark palette.
 */
export function useColors() {
  const palette = (colors as Record<string, typeof colors.light>).dark ?? colors.light;
  return { ...palette, radius: colors.radius };
}
