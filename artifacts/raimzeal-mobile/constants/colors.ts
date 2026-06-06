/**
 * Design tokens — RAIMZEAL Punchy Edition
 *
 * Palette:
 * --primary:   Electric Spring Green  #00FF7F  (HSL 153 100% 50%)
 * --secondary: Electric Amber         #FFB800  (HSL  44 100% 50%)
 * --accent:    Electric Violet        #BF00FF  (HSL 285 100% 50%)
 * --background: #070709  (deep black)
 * --card:       #0d0d10
 * --muted:      #1a1a1f
 * --border:     #18181d
 */

const colors = {
  light: {
    text: "#0a0a0a",
    tint: "#00c060",
    background: "#ffffff",
    foreground: "#0a0a0a",
    card: "#f0f0f2",
    cardForeground: "#0a0a0a",
    primary: "#00c060",
    primaryForeground: "#0a0a0a",
    secondary: "#e6a600",
    secondaryForeground: "#0a0a0a",
    muted: "#ebebee",
    mutedForeground: "#606068",
    accent: "#9900cc",
    accentForeground: "#ffffff",
    destructive: "#ff1a1a",
    destructiveForeground: "#ffffff",
    success: "#00c060",
    warning: "#e6a600",
    border: "#d8d8de",
    input: "#d8d8de",
  },
  dark: {
    text: "#fafafa",
    tint: "#00FF7F",
    background: "#070709",
    foreground: "#fafafa",
    card: "#0d0d10",
    cardForeground: "#fafafa",
    primary: "#00FF7F",
    primaryForeground: "#070709",
    secondary: "#FFB800",
    secondaryForeground: "#070709",
    muted: "#1a1a1f",
    mutedForeground: "#8a8a96",
    accent: "#BF00FF",
    accentForeground: "#ffffff",
    destructive: "#FF2020",
    destructiveForeground: "#ffffff",
    success: "#00FF7F",
    warning: "#FFB800",
    border: "#18181d",
    input: "#1a1a1f",
  },
  radius: 12,
};

export default colors;
