import React, { forwardRef, memo } from "react";
import { View, Text, Image, StyleSheet } from "react-native";

export const CARD_WIDTH = 360;

export interface CardVisibleStats {
  streak: boolean;
  workouts: boolean;
  calories: boolean;
  time: boolean;
  weightChange: boolean;
  topPR: boolean;
}

export const DEFAULT_VISIBLE_STATS: CardVisibleStats = {
  streak: true,
  workouts: true,
  calories: true,
  time: true,
  weightChange: true,
  topPR: true,
};

export type CardThemeId = "forest" | "midnight" | "ember" | "royal" | "crimson";

export interface CardTheme {
  id: CardThemeId;
  label: string;
  accent: string;
  glowTL: string;
  glowBR: string;
  statColors: [string, string, string];
  avatarBg: string;
  avatarBorder: string;
  messageBg: string;
  messageBorder: string;
  messageText: string;
}

export const CARD_THEMES: CardTheme[] = [
  {
    id: "forest",
    label: "Forest",
    accent: "#2E8B57",
    glowTL: "rgba(130,203,21,0.10)",
    glowBR: "rgba(0,193,214,0.08)",
    statColors: ["#2E8B57", "#C9A84C", "#8B31C7"],
    avatarBg: "rgba(130,203,21,0.15)",
    avatarBorder: "rgba(130,203,21,0.30)",
    messageBg: "rgba(130,203,21,0.08)",
    messageBorder: "rgba(130,203,21,0.20)",
    messageText: "#c8e6a0",
  },
  {
    id: "midnight",
    label: "Midnight",
    accent: "#3B82F6",
    glowTL: "rgba(59,130,246,0.12)",
    glowBR: "rgba(99,102,241,0.08)",
    statColors: ["#3B82F6", "#06B6D4", "#8B5CF6"],
    avatarBg: "rgba(59,130,246,0.15)",
    avatarBorder: "rgba(59,130,246,0.30)",
    messageBg: "rgba(59,130,246,0.08)",
    messageBorder: "rgba(59,130,246,0.20)",
    messageText: "#BFDBFE",
  },
  {
    id: "ember",
    label: "Ember",
    accent: "#F97316",
    glowTL: "rgba(249,115,22,0.12)",
    glowBR: "rgba(251,191,36,0.08)",
    statColors: ["#F97316", "#EAB308", "#EF4444"],
    avatarBg: "rgba(249,115,22,0.15)",
    avatarBorder: "rgba(249,115,22,0.30)",
    messageBg: "rgba(249,115,22,0.08)",
    messageBorder: "rgba(249,115,22,0.20)",
    messageText: "#FED7AA",
  },
  {
    id: "royal",
    label: "Royal",
    accent: "#8B5CF6",
    glowTL: "rgba(139,92,246,0.12)",
    glowBR: "rgba(236,72,153,0.08)",
    statColors: ["#8B5CF6", "#EC4899", "#06B6D4"],
    avatarBg: "rgba(139,92,246,0.15)",
    avatarBorder: "rgba(139,92,246,0.30)",
    messageBg: "rgba(139,92,246,0.08)",
    messageBorder: "rgba(139,92,246,0.20)",
    messageText: "#DDD6FE",
  },
  {
    id: "crimson",
    label: "Crimson",
    accent: "#EF4444",
    glowTL: "rgba(239,68,68,0.12)",
    glowBR: "rgba(249,115,22,0.08)",
    statColors: ["#EF4444", "#F97316", "#FBBF24"],
    avatarBg: "rgba(239,68,68,0.15)",
    avatarBorder: "rgba(239,68,68,0.30)",
    messageBg: "rgba(239,68,68,0.08)",
    messageBorder: "rgba(239,68,68,0.20)",
    messageText: "#FECACA",
  },
];

export const DEFAULT_THEME_ID: CardThemeId = "forest";

function getTheme(themeId?: CardThemeId): CardTheme {
  return CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];
}

export interface BackgroundPhotoCrop {
  scale: number;
  panX: number;
  panY: number;
}

export interface ShareProgressCardProps {
  userName: string;
  goalLabel: string;
  streak: number;
  totalWorkouts: number;
  totalCalBurned: number;
  totalMinutes: number;
  weightDelta: number;
  weightUnit: string;
  topPR: { exercise: string; weight: number } | null;
  date: string;
  visibleStats?: Partial<CardVisibleStats>;
  customMessage?: string;
  themeId?: CardThemeId;
  /**
   * When provided, all internal dimensions (font sizes, padding, radii, etc.)
   * are multiplied by this factor and the card renders natively at
   * `CARD_WIDTH * renderScale` wide — no CSS transform required.
   * Use this for thumbnail previews to get pixel-crisp output.
   */
  renderScale?: number;
  /**
   * When provided, the image at this URI is rendered as a blurred, dimmed
   * background behind all card content.
   */
  backgroundPhotoUri?: string;
  /**
   * When provided together with backgroundPhotoUri, applies pan/zoom crop
   * transforms so the user-framed portion of the image fills the card.
   */
  backgroundPhotoCrop?: BackgroundPhotoCrop;
  /**
   * Opacity of the dark overlay applied on top of the background photo.
   * Range: 0–1. Defaults to 0.62 when not specified.
   */
  backgroundPhotoDimLevel?: number;
  /**
   * Blur radius applied to the background photo.
   * Range: 0–24. Defaults to 18 when not specified.
   */
  backgroundPhotoBlurRadius?: number;
}

// Cache scaled StyleSheet objects to avoid re-creation on every render.
const styleCache = new Map<number, ReturnType<typeof buildStyles>>();

function buildStyles(s: number) {
  return StyleSheet.create({
    card: {
      width: CARD_WIDTH * s,
      backgroundColor: "#0a0a0b",
      borderRadius: 20 * s,
      padding: 24 * s,
      gap: 16 * s,
      overflow: "hidden",
      position: "relative",
    },
    glowTL: {
      position: "absolute",
      top: -80 * s,
      left: -60 * s,
      width: 240 * s,
      height: 240 * s,
      borderRadius: 120 * s,
    },
    glowBR: {
      position: "absolute",
      bottom: -70 * s,
      right: -60 * s,
      width: 200 * s,
      height: 200 * s,
      borderRadius: 100 * s,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 10 * s },
    logoImage: { width: 34 * s, height: 34 * s },
    logoBox: {
      width: 38 * s,
      height: 38 * s,
      borderRadius: 10 * s,
      alignItems: "center",
      justifyContent: "center",
    },
    brandName: {
      fontSize: Math.max(4, 16 * s),
      fontWeight: "900",
      color: "#fafafa",
      letterSpacing: -0.3 * s,
    },
    brandTagline: {
      fontSize: Math.max(3, 9 * s),
      fontWeight: "700",
      letterSpacing: 1.5 * s,
    },
    dateBox: { alignItems: "flex-end" },
    dateText: { fontSize: Math.max(3, 10 * s), color: "#878792", fontWeight: "500" },
    dateSubtext: { fontSize: Math.max(3, 10 * s), fontWeight: "700", marginTop: 2 * s },
    heroSection: { alignItems: "center", gap: 6 * s, paddingVertical: 4 * s },
    avatarCircle: {
      width: 56 * s,
      height: 56 * s,
      borderRadius: 16 * s,
      borderWidth: Math.max(0.5, 2 * s),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4 * s,
    },
    avatarInitial: { fontSize: Math.max(4, 26 * s), fontWeight: "900" },
    heroName: {
      fontSize: Math.max(4, 22 * s),
      fontWeight: "800",
      color: "#fafafa",
      letterSpacing: -0.4 * s,
    },
    heroGoal: { fontSize: Math.max(3, 12 * s), color: "#878792", fontWeight: "500" },
    customMessageBox: {
      borderWidth: Math.max(0.5, 1 * s),
      borderRadius: 10 * s,
      paddingVertical: 10 * s,
      paddingHorizontal: 14 * s,
    },
    customMessageText: {
      fontSize: Math.max(3, 12 * s),
      fontStyle: "italic",
      fontWeight: "500",
      textAlign: "center",
      lineHeight: Math.max(4, 18 * s),
    },
    streakBanner: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12 * s,
      borderWidth: Math.max(0.5, 1 * s),
      borderRadius: 14 * s,
      paddingVertical: 12 * s,
      paddingHorizontal: 20 * s,
    },
    streakNumber: {
      fontSize: Math.max(5, 36 * s),
      fontWeight: "900",
      letterSpacing: -1 * s,
    },
    streakRight: { gap: 2 * s },
    streakLabel: {
      fontSize: Math.max(3, 10 * s),
      fontWeight: "700",
      letterSpacing: 1.2 * s,
    },
    streakFires: { fontSize: Math.max(3, 14 * s), lineHeight: Math.max(4, 18 * s) },
    statsGrid: { flexDirection: "row", gap: 10 * s },
    statCard: {
      backgroundColor: "#111113",
      borderWidth: Math.max(0.5, 1 * s),
      borderColor: "#1d1d20",
      borderRadius: 14 * s,
      padding: 12 * s,
      alignItems: "center",
      gap: 3 * s,
      overflow: "hidden",
      position: "relative",
    },
    statAccentBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: Math.max(0.5, 2 * s),
    },
    statIcon: { fontSize: Math.max(3, 14 * s), marginTop: 4 * s },
    statValue: {
      fontSize: Math.max(4, 20 * s),
      fontWeight: "800",
      letterSpacing: -0.5 * s,
    },
    statLabel: {
      fontSize: Math.max(2, 9 * s),
      fontWeight: "600",
      color: "#878792",
      letterSpacing: 0.8 * s,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#111113",
      borderWidth: Math.max(0.5, 1 * s),
      borderColor: "#1d1d20",
      borderRadius: 12 * s,
      padding: 12 * s,
      gap: 8 * s,
    },
    bottomItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 * s },
    bottomIcon: { fontSize: Math.max(3, 14 * s) },
    bottomItemLabel: {
      fontSize: Math.max(2, 9 * s),
      color: "#878792",
      fontWeight: "600",
      letterSpacing: 0.5 * s,
    },
    bottomItemValue: {
      fontSize: Math.max(3, 12 * s),
      color: "#fafafa",
      fontWeight: "700",
      marginTop: 1 * s,
    },
    bottomDivider: { width: Math.max(0.5, 1 * s), height: 30 * s, backgroundColor: "#1d1d20" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    footerLeft: { fontSize: Math.max(2, 9 * s), color: "#878792", fontWeight: "500" },
    footerRight: { flexDirection: "row", alignItems: "center", gap: 5 * s },
    footerDot: { width: 5 * s, height: 5 * s, borderRadius: 3 * s },
    footerBrand: { fontSize: Math.max(2, 10 * s), fontWeight: "700" },
  });
}

function getStyles(scale: number) {
  const key = Math.round(scale * 10000) / 10000;
  if (!styleCache.has(key)) {
    styleCache.set(key, buildStyles(key));
  }
  return styleCache.get(key)!;
}

const ShareProgressCardBase = forwardRef<View, ShareProgressCardProps>(
  (
    {
      userName,
      goalLabel,
      streak,
      totalWorkouts,
      totalCalBurned,
      totalMinutes,
      weightDelta,
      weightUnit,
      topPR,
      date,
      visibleStats,
      customMessage,
      themeId,
      renderScale,
      backgroundPhotoUri,
      backgroundPhotoCrop,
      backgroundPhotoDimLevel,
      backgroundPhotoBlurRadius,
    },
    ref
  ) => {
    const s = renderScale ?? 1;
    const styles = getStyles(s);
    const vis: CardVisibleStats = { ...DEFAULT_VISIBLE_STATS, ...visibleStats };
    const theme = getTheme(themeId);

    const initial = (userName || "A").charAt(0).toUpperCase();

    const calStr =
      totalCalBurned >= 1000
        ? `${(totalCalBurned / 1000).toFixed(1)}k`
        : String(totalCalBurned);

    const timeStr =
      totalMinutes >= 60 ? `${Math.round(totalMinutes / 60)}h` : `${totalMinutes}m`;

    const hasWeightDelta = weightDelta !== 0;
    const weightDeltaStr = hasWeightDelta
      ? `${weightDelta > 0 ? "↓" : "↑"} ${Math.abs(weightDelta)} ${weightUnit}`
      : null;

    const streakFires = streak > 0 ? "🔥".repeat(Math.min(streak, 6)) : "🔥";

    const showWeightItem = vis.weightChange && weightDeltaStr != null;
    const showPRItem = vis.topPR && topPR != null;
    const showBottomRow = showWeightItem || showPRItem;

    const gridStats: Array<{
      color: string;
      icon: string;
      value: string;
      label: string;
      show: boolean;
    }> = [
      { color: theme.statColors[0], icon: "🏋️", value: String(totalWorkouts), label: "WORKOUTS", show: vis.workouts },
      { color: theme.statColors[1], icon: "⚡", value: calStr, label: "CAL BURNED", show: vis.calories },
      { color: theme.statColors[2], icon: "⏱️", value: timeStr, label: "TRAINED", show: vis.time },
    ];
    const visibleGridStats = gridStats.filter((gs) => gs.show);

    return (
      <View
        ref={ref}
        style={[styles.card, backgroundPhotoUri ? { backgroundColor: "transparent" } : undefined]}
        collapsable={false}
      >
        {/* Background photo (blurred + dimmed) */}
        {backgroundPhotoUri ? (
          <>
            <Image
              source={{ uri: backgroundPhotoUri }}
              style={[
                StyleSheet.absoluteFillObject,
                { borderRadius: 20 * s },
                backgroundPhotoCrop
                  ? {
                      transform: [
                        { scale: backgroundPhotoCrop.scale },
                        { translateX: backgroundPhotoCrop.panX * s },
                        { translateY: backgroundPhotoCrop.panY * s },
                      ],
                    }
                  : undefined,
              ]}
              resizeMode="cover"
              blurRadius={backgroundPhotoBlurRadius ?? 18}
            />
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: `rgba(0,0,0,${(backgroundPhotoDimLevel ?? 0.62).toFixed(2)})`, borderRadius: 20 * s },
              ]}
            />
          </>
        ) : null}
        {/* Background gradient tint */}
        <View style={[styles.glowTL, { backgroundColor: theme.glowTL, pointerEvents: "none" }]} />
        <View style={[styles.glowBR, { backgroundColor: theme.glowBR, pointerEvents: "none" }]} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brandName}>RAIMZEAL</Text>
              <Text style={[styles.brandTagline, { color: theme.accent }]}>PROGRESS REPORT</Text>
            </View>
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{date}</Text>
            <Text style={[styles.dateSubtext, { color: theme.accent }]}>My Fitness Journey</Text>
          </View>
        </View>

        {/* ── User hero ── */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.avatarCircle,
              { backgroundColor: theme.avatarBg, borderColor: theme.avatarBorder },
            ]}
          >
            <Text style={[styles.avatarInitial, { color: theme.accent }]}>{initial}</Text>
          </View>
          <Text style={styles.heroName}>{userName}</Text>
          <Text style={styles.heroGoal}>Goal: {goalLabel}</Text>
        </View>

        {/* ── Custom message ── */}
        {customMessage ? (
          <View
            style={[
              styles.customMessageBox,
              { backgroundColor: theme.messageBg, borderColor: theme.messageBorder },
            ]}
          >
            <Text style={[styles.customMessageText, { color: theme.messageText }]}>
              "{customMessage}"
            </Text>
          </View>
        ) : null}

        {/* ── Streak banner ── */}
        {vis.streak && (
          <View
            style={[
              styles.streakBanner,
              {
                backgroundColor: theme.accent + "1F",
                borderColor: theme.accent + "38",
              },
            ]}
          >
            <Text style={[styles.streakNumber, { color: theme.accent }]}>{streak}</Text>
            <View style={styles.streakRight}>
              <Text style={[styles.streakLabel, { color: theme.accent }]}>DAY STREAK</Text>
              <Text style={styles.streakFires}>{streakFires}</Text>
            </View>
          </View>
        )}

        {/* ── Stats grid ── */}
        {visibleGridStats.length > 0 && (
          <View style={styles.statsGrid}>
            {visibleGridStats.map((gs) => (
              <View key={gs.label} style={[styles.statCard, { flex: 1 }]}>
                <View style={[styles.statAccentBar, { backgroundColor: gs.color }]} />
                <Text style={styles.statIcon}>{gs.icon}</Text>
                <Text style={[styles.statValue, { color: gs.color }]}>{gs.value}</Text>
                <Text style={styles.statLabel}>{gs.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Weight / PR row ── */}
        {showBottomRow && (
          <View style={styles.bottomRow}>
            {showWeightItem && (
              <View style={styles.bottomItem}>
                <Text style={styles.bottomIcon}>⚖️</Text>
                <View>
                  <Text style={styles.bottomItemLabel}>Weight Change</Text>
                  <Text style={styles.bottomItemValue}>{weightDeltaStr}</Text>
                </View>
              </View>
            )}
            {showWeightItem && showPRItem && <View style={styles.bottomDivider} />}
            {showPRItem && (
              <View style={styles.bottomItem}>
                <Text style={styles.bottomIcon}>🏆</Text>
                <View>
                  <Text style={styles.bottomItemLabel}>Personal Record</Text>
                  <Text style={styles.bottomItemValue}>
                    {topPR!.exercise} {topPR!.weight}
                    {weightUnit}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>Powered by RAIMZEAL AI</Text>
          <View style={styles.footerRight}>
            <View style={[styles.footerDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.footerBrand, { color: theme.accent }]}>raimzeal.com</Text>
          </View>
        </View>
      </View>
    );
  }
);

ShareProgressCardBase.displayName = "ShareProgressCard";

function shareProgressCardPropsAreEqual(
  prev: ShareProgressCardProps,
  next: ShareProgressCardProps
): boolean {
  const keys = Object.keys(next) as (keyof ShareProgressCardProps)[];
  for (const k of keys) {
    if (k === "visibleStats" || k === "topPR") {
      const a = prev[k] as Record<string, unknown> | null | undefined;
      const b = next[k] as Record<string, unknown> | null | undefined;
      if (a === b) continue;
      if (!a || !b) return false;
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length) return false;
      for (const sk of aKeys) {
        if (a[sk] !== b[sk]) return false;
      }
    } else if (prev[k] !== next[k]) {
      return false;
    }
  }
  return true;
}

const ShareProgressCard = memo(ShareProgressCardBase, shareProgressCardPropsAreEqual);
export default ShareProgressCard;
