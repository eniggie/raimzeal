import colors from "@/constants/colors";

/**
 * Returns the RAIMZEAL dark design tokens.
 * RAIMZEAL is always dark-themed — we always return the dark palette.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius };
}
