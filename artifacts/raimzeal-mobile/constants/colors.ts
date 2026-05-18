/**
 * Design tokens extracted from artifacts/raimzeal/src/index.css (.dark theme).
 * Values are exact HSL→hex conversions of the web app's CSS custom properties.
 *
 * --primary: 84 81% 44%         → #82cb15  (lime green)
 * --secondary: 186 100% 42%     → #00c1d6  (cyan)
 * --accent: 270 70% 55%         → #8c3cdd  (violet)
 * --background: 240 6% 4%       → #0a0a0b
 * --foreground: 0 0% 98%        → #fafafa
 * --card: 240 6% 7%             → #111113
 * --muted: 240 5% 14%           → #222225
 * --muted-foreground: 240 5% 55%→ #878792
 * --border: 240 6% 12%          → #1d1d20
 * --success: 142 71% 45%        → #21c45d
 * --warning: 38 92% 50%         → #f59f0a
 * --destructive: 0 72% 51%      → #dc2828
 *
 * Font: 'Space Grotesk' for display/headings, 'Inter' for body (matches web)
 * Radius: 0.75rem = 12px
 */

const colors = {
  light: {
    text: "#0a0a0a",
    tint: "#82cb15",
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#f4f4f5",
    cardForeground: "#0a0a0a",
    primary: "#82cb15",
    primaryForeground: "#0a0a0a",
    secondary: "#00c1d6",
    secondaryForeground: "#0a0a0a",
    muted: "#f4f4f5",
    mutedForeground: "#71717a",
    accent: "#8c3cdd",
    accentForeground: "#ffffff",
    destructive: "#dc2828",
    destructiveForeground: "#ffffff",
    success: "#21c45d",
    warning: "#f59f0a",
    border: "#e4e4e7",
    input: "#e4e4e7",
  },
  dark: {
    text: "#fafafa",
    tint: "#82cb15",
    background: "#0a0a0b",
    foreground: "#fafafa",
    card: "#111113",
    cardForeground: "#fafafa",
    primary: "#82cb15",
    primaryForeground: "#0a0a0b",
    secondary: "#00c1d6",
    secondaryForeground: "#0a0a0b",
    muted: "#222225",
    mutedForeground: "#878792",
    accent: "#8c3cdd",
    accentForeground: "#fafafa",
    destructive: "#dc2828",
    destructiveForeground: "#fafafa",
    success: "#21c45d",
    warning: "#f59f0a",
    border: "#1d1d20",
    input: "#222225",
  },
  radius: 12,
};

export default colors;
