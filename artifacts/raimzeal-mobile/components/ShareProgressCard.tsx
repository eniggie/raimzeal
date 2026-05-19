import React, { forwardRef } from "react";
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
}

const ShareProgressCard = forwardRef<View, ShareProgressCardProps>(
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
    },
    ref
  ) => {
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
    const visibleGridStats = gridStats.filter((s) => s.show);

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* Background gradient tint */}
        <View style={[styles.glowTL, { backgroundColor: theme.glowTL, pointerEvents: "none" }]} />
        <View style={[styles.glowBR, { backgroundColor: theme.glowBR, pointerEvents: "none" }]} />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={[styles.logoBox, { backgroundColor: theme.accent }]}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
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
            {visibleGridStats.map((s) => (
              <View key={s.label} style={[styles.statCard, { flex: 1 }]}>
                <View style={[styles.statAccentBar, { backgroundColor: s.color }]} />
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
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

ShareProgressCard.displayName = "ShareProgressCard";
export default ShareProgressCard;

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#0a0a0b",
    borderRadius: 20,
    padding: 24,
    gap: 16,
    overflow: "hidden",
    position: "relative",
  },
  glowTL: {
    position: "absolute",
    top: -80,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  glowBR: {
    position: "absolute",
    bottom: -70,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoImage: { width: 34, height: 34 },
  logoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 16, fontWeight: "900", color: "#fafafa", letterSpacing: -0.3 },
  brandTagline: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  dateBox: { alignItems: "flex-end" },
  dateText: { fontSize: 10, color: "#878792", fontWeight: "500" },
  dateSubtext: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  // Hero
  heroSection: { alignItems: "center", gap: 6, paddingVertical: 4 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarInitial: { fontSize: 26, fontWeight: "900" },
  heroName: { fontSize: 22, fontWeight: "800", color: "#fafafa", letterSpacing: -0.4 },
  heroGoal: { fontSize: 12, color: "#878792", fontWeight: "500" },
  // Custom message
  customMessageBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  customMessageText: {
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
  // Streak
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  streakNumber: { fontSize: 36, fontWeight: "900", letterSpacing: -1 },
  streakRight: { gap: 2 },
  streakLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2 },
  streakFires: { fontSize: 14, lineHeight: 18 },
  // Stats grid
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: {
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#1d1d20",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 3,
    overflow: "hidden",
    position: "relative",
  },
  statAccentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  statIcon: { fontSize: 14, marginTop: 4 },
  statValue: { fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  statLabel: { fontSize: 9, fontWeight: "600", color: "#878792", letterSpacing: 0.8 },
  // Bottom row
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111113",
    borderWidth: 1,
    borderColor: "#1d1d20",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  bottomItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  bottomIcon: { fontSize: 14 },
  bottomItemLabel: { fontSize: 9, color: "#878792", fontWeight: "600", letterSpacing: 0.5 },
  bottomItemValue: { fontSize: 12, color: "#fafafa", fontWeight: "700", marginTop: 1 },
  bottomDivider: { width: 1, height: 30, backgroundColor: "#1d1d20" },
  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: { fontSize: 9, color: "#878792", fontWeight: "500" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 5 },
  footerDot: { width: 5, height: 5, borderRadius: 3 },
  footerBrand: { fontSize: 10, fontWeight: "700" },
});
