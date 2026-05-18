import React, { forwardRef } from "react";
import { View, Text, Image, StyleSheet } from "react-native";

const CARD_WIDTH = 360;

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
    },
    ref
  ) => {
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

    const showBottomRow = hasWeightDelta || topPR != null;

    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        {/* Background gradient tint at top-left */}
        <View style={styles.glowTL} pointerEvents="none" />
        <View style={styles.glowBR} pointerEvents="none" />

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <View>
              <Text style={styles.brandName}>RAIMZEAL</Text>
              <Text style={styles.brandTagline}>PROGRESS REPORT</Text>
            </View>
          </View>
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{date}</Text>
            <Text style={styles.dateSubtext}>My Fitness Journey</Text>
          </View>
        </View>

        {/* ── User hero ── */}
        <View style={styles.heroSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <Text style={styles.heroName}>{userName}</Text>
          <Text style={styles.heroGoal}>Goal: {goalLabel}</Text>
        </View>

        {/* ── Streak banner ── */}
        <View style={styles.streakBanner}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <View style={styles.streakRight}>
            <Text style={styles.streakLabel}>DAY STREAK</Text>
            <Text style={styles.streakFires}>{streakFires}</Text>
          </View>
        </View>

        {/* ── Stats grid ── */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.statGreen]}>
            <View style={[styles.statAccentBar, { backgroundColor: "#2E8B57" }]} />
            <Text style={styles.statIcon}>🏋️</Text>
            <Text style={[styles.statValue, { color: "#2E8B57" }]}>{totalWorkouts}</Text>
            <Text style={styles.statLabel}>WORKOUTS</Text>
          </View>
          <View style={[styles.statCard, styles.statCyan]}>
            <View style={[styles.statAccentBar, { backgroundColor: "#C9A84C" }]} />
            <Text style={styles.statIcon}>⚡</Text>
            <Text style={[styles.statValue, { color: "#C9A84C" }]}>{calStr}</Text>
            <Text style={styles.statLabel}>CAL BURNED</Text>
          </View>
          <View style={[styles.statCard, styles.statViolet]}>
            <View style={[styles.statAccentBar, { backgroundColor: "#8B31C7" }]} />
            <Text style={styles.statIcon}>⏱️</Text>
            <Text style={[styles.statValue, { color: "#8B31C7" }]}>{timeStr}</Text>
            <Text style={styles.statLabel}>TRAINED</Text>
          </View>
        </View>

        {/* ── Weight / PR row ── */}
        {showBottomRow && (
          <View style={styles.bottomRow}>
            {weightDeltaStr != null && (
              <View style={styles.bottomItem}>
                <Text style={styles.bottomIcon}>⚖️</Text>
                <View>
                  <Text style={styles.bottomItemLabel}>Weight Change</Text>
                  <Text style={styles.bottomItemValue}>{weightDeltaStr}</Text>
                </View>
              </View>
            )}
            {weightDeltaStr != null && topPR != null && <View style={styles.bottomDivider} />}
            {topPR != null && (
              <View style={styles.bottomItem}>
                <Text style={styles.bottomIcon}>🏆</Text>
                <View>
                  <Text style={styles.bottomItemLabel}>Personal Record</Text>
                  <Text style={styles.bottomItemValue}>
                    {topPR.exercise} {topPR.weight}
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
            <View style={styles.footerDot} />
            <Text style={styles.footerBrand}>raimzeal.com</Text>
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
    backgroundColor: "rgba(130,203,21,0.10)",
  },
  glowBR: {
    position: "absolute",
    bottom: -70,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(0,193,214,0.08)",
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
    backgroundColor: "#2E8B57",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontSize: 16, fontWeight: "900", color: "#fafafa", letterSpacing: -0.3 },
  brandTagline: { fontSize: 9, fontWeight: "700", color: "#2E8B57", letterSpacing: 1.5 },
  dateBox: { alignItems: "flex-end" },
  dateText: { fontSize: 10, color: "#878792", fontWeight: "500" },
  dateSubtext: { fontSize: 10, color: "#2E8B57", fontWeight: "700", marginTop: 2 },
  // Hero
  heroSection: { alignItems: "center", gap: 6, paddingVertical: 4 },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(130,203,21,0.15)",
    borderWidth: 2,
    borderColor: "rgba(130,203,21,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarInitial: { fontSize: 26, fontWeight: "900", color: "#2E8B57" },
  heroName: { fontSize: 22, fontWeight: "800", color: "#fafafa", letterSpacing: -0.4 },
  heroGoal: { fontSize: 12, color: "#878792", fontWeight: "500" },
  // Streak
  streakBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "rgba(245,159,10,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.22)",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  streakNumber: { fontSize: 36, fontWeight: "900", color: "#f59f0a", letterSpacing: -1 },
  streakRight: { gap: 2 },
  streakLabel: { fontSize: 10, fontWeight: "700", color: "#f59f0a", letterSpacing: 1.2 },
  streakFires: { fontSize: 14, lineHeight: 18 },
  // Stats grid
  statsGrid: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
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
  statGreen: {},
  statCyan: {},
  statViolet: {},
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
  footerDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#2E8B57" },
  footerBrand: { fontSize: 10, fontWeight: "700", color: "#2E8B57" },
});
