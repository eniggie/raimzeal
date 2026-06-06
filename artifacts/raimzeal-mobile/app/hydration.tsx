import React, { useCallback, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useSyncIndicator } from "@/hooks/useSyncIndicator";

const BASE_GOAL = 10;
const ML_PER_GLASS = 250;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function last14Days(): { key: string; label: string }[] {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().split("T")[0],
      label: i === 0 ? "Today" : d.toLocaleDateString("en", { weekday: "short" }),
    });
  }
  return days;
}

function calcStreak(
  waterIntake: { date: string; glasses: number }[],
  goal: number
): number {
  const map = new Map(waterIntake.map((w) => [w.date, w.glasses]));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const glasses = map.get(key) ?? 0;
    if (i === 0 && glasses < goal) break;
    if (i > 0 && glasses < goal) break;
    streak++;
  }
  return streak;
}

function dynamicGoalTip(
  workoutLogs: { date: string }[],
  weight: number | undefined,
  goal: number
): string {
  const today = todayStr();
  const trainedToday = workoutLogs.some((w) => w.date === today);
  const tips: string[] = [];
  if (trainedToday) tips.push("You trained today — add 2 extra glasses for recovery.");
  if (weight && weight > 90) tips.push("Aim for 1 extra glass per 10 kg over 70 kg.");
  if (tips.length === 0) return `Aim for ${goal} glasses (${goal * ML_PER_GLASS} ml) spread across the day.`;
  return tips.join(" ");
}

export default function HydrationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { waterIntake, getTodayWaterGlasses, updateWaterIntake, workoutLogs, user } = useFitness();
  const { syncStatus, startSync, finishSync } = useSyncIndicator();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = todayStr();
  const currentGlasses = getTodayWaterGlasses();

  const weight = user?.weight;
  const extraForWeight = weight && weight > 70 ? Math.floor((weight - 70) / 10) : 0;
  const trainedToday = workoutLogs.some((w) => w.date === today);
  const dynamicGoal = BASE_GOAL + (trainedToday ? 2 : 0) + extraForWeight;

  const streak = calcStreak(waterIntake, BASE_GOAL);
  const pct = Math.min(currentGlasses / dynamicGoal, 1);
  const mlDone = currentGlasses * ML_PER_GLASS;
  const mlGoal = dynamicGoal * ML_PER_GLASS;

  const days = last14Days();
  const maxGlasses = Math.max(...days.map((d) => {
    const e = waterIntake.find((w) => w.date === d.key);
    return e?.glasses ?? 0;
  }), dynamicGoal);

  const handleAdd = useCallback((amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startSync();
    try {
      updateWaterIntake(Math.max(0, currentGlasses + amount));
      finishSync(true);
    } catch {
      finishSync(false);
    }
  }, [currentGlasses, updateWaterIntake, startSync, finishSync]);

  const statusColor =
    pct >= 1 ? "#10b981" :
    pct >= 0.6 ? "#3b82f6" :
    pct >= 0.3 ? "#f59e0b" :
    "#ef4444";

  const statusLabel =
    pct >= 1 ? "Goal reached! 🎉" :
    pct >= 0.6 ? `${dynamicGoal - currentGlasses} glass${dynamicGoal - currentGlasses === 1 ? "" : "es"} to go` :
    pct >= 0.3 ? "Keep drinking — you're behind" :
    "Start hydrating — you need water!";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 40 + 84 : 110 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Hydration</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>
      </View>

      {/* Main Progress Card */}
      <GlassCard style={[styles.mainCard, { borderColor: statusColor + "50" }]}>
        <View style={styles.mainTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.mainGlasses, { color: statusColor }]}>
              {currentGlasses}
              <Text style={[styles.mainGoal, { color: colors.mutedForeground }]}>
                /{dynamicGoal}
              </Text>
            </Text>
            <Text style={[styles.mainUnit, { color: colors.mutedForeground }]}>glasses today</Text>
            <Text style={[styles.mainMl, { color: colors.mutedForeground }]}>
              {mlDone} ml / {mlGoal} ml
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 8 }}>
            {streak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: "#3b82f620", borderColor: "#3b82f640" }]}>
                <Ionicons name="trophy-outline" size={14} color="#3b82f6" />
                <Text style={[styles.streakText, { color: "#3b82f6" }]}>
                  {streak} day{streak === 1 ? "" : "s"} streak
                </Text>
              </View>
            )}
            {trainedToday && (
              <View style={[styles.trainBadge, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" }]}>
                <Ionicons name="barbell-outline" size={12} color={colors.primary} />
                <Text style={[styles.trainBadgeText, { color: colors.primary }]}>Trained today +2</Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress bar */}
        <View style={[styles.track, { backgroundColor: colors.muted }]}>
          <View
            style={[
              styles.fill,
              { width: `${Math.round(pct * 100)}%`, backgroundColor: statusColor },
            ]}
          />
        </View>
        <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>

        {dynamicGoal !== BASE_GOAL && (
          <Text style={[styles.goalTip, { color: colors.mutedForeground }]}>
            {dynamicGoalTip(workoutLogs, weight, dynamicGoal)}
          </Text>
        )}
      </GlassCard>

      {/* Quick Add Buttons */}
      <View style={styles.quickRow}>
        {[
          { label: "-1", amount: -1, color: colors.destructive },
          { label: "+½", amount: 0.5, color: colors.mutedForeground },
          { label: "+1", amount: 1, color: "#3b82f6" },
          { label: "+2", amount: 2, color: colors.primary },
        ].map(({ label, amount, color }) => (
          <AnimatedPressable
            key={label}
            onPress={() => handleAdd(amount)}
            style={[styles.quickBtn, { backgroundColor: color + "18", borderColor: color + "40" }]}
            scale={0.93}
          >
            <Text style={[styles.quickBtnText, { color }]}>{label}</Text>
            <Text style={[styles.quickBtnSub, { color: colors.mutedForeground }]}>
              {amount < 0 ? "glass" : `${Math.abs(amount) * ML_PER_GLASS} ml`}
            </Text>
          </AnimatedPressable>
        ))}
      </View>

      {/* 14-Day History */}
      <GlassCard style={styles.historyCard}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>14-Day History</Text>
        <View style={styles.historyScroll}>
          {days.map((day) => {
            const entry = waterIntake.find((w) => w.date === day.key);
            const glasses = entry?.glasses ?? 0;
            const barPct = maxGlasses > 0 ? glasses / maxGlasses : 0;
            const hitGoal = glasses >= BASE_GOAL;
            const barColor = hitGoal ? "#10b981" : glasses > 0 ? "#3b82f6" : colors.muted;
            const isToday = day.key === today;
            return (
              <View key={day.key} style={styles.barCol}>
                <Text style={[styles.barCount, { color: glasses > 0 ? barColor : colors.mutedForeground }]}>
                  {glasses > 0 ? glasses : ""}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(barPct * 100, 4)}%`,
                        backgroundColor: barColor,
                        opacity: isToday ? 1 : 0.75,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.barLabel,
                    {
                      color: isToday ? colors.primary : colors.mutedForeground,
                      fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {day.label.slice(0, 3)}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#10b981" }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Goal met</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#3b82f6" }]} />
            <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Partial</Text>
          </View>
        </View>
      </GlassCard>

      {/* Hydration Tips */}
      <GlassCard style={styles.tipsCard}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hydration Tips</Text>
        {[
          { icon: "sunny-outline" as const, tip: "Start the day with a glass of water before coffee or food." },
          { icon: "restaurant-outline" as const, tip: "Drink a glass before each meal — it aids digestion and reduces overeating." },
          { icon: "barbell-outline" as const, tip: "Drink 500 ml in the 2 hours before exercise and replace what you sweat out after." },
          { icon: "moon-outline" as const, tip: "Avoid large amounts right before bed — it disrupts sleep quality." },
        ].map(({ icon, tip }, i) => (
          <View key={i} style={[styles.tipRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[styles.tipIcon, { backgroundColor: "#3b82f620" }]}>
              <Ionicons name={icon} size={16} color="#3b82f6" />
            </View>
            <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
          </View>
        ))}
      </GlassCard>
    </ScrollView>
    <SyncIndicator status={syncStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  mainCard: { gap: 12, borderWidth: 1.5 },
  mainTop: { flexDirection: "row", alignItems: "flex-start" },
  mainGlasses: { fontSize: 48, fontFamily: "SpaceGrotesk_700Bold", lineHeight: 52 },
  mainGoal: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold" },
  mainUnit: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },
  mainMl: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  trainBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  trainBadgeText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
  statusLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  goalTip: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  quickRow: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    gap: 3,
  },
  quickBtnText: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  quickBtnSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
  historyCard: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  historyScroll: { flexDirection: "row", gap: 4 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barCount: { fontSize: 9, fontFamily: "Inter_700Bold", minHeight: 12 },
  barTrack: {
    width: "100%",
    height: 64,
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 8, textAlign: "center" },
  legendRow: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  tipsCard: { gap: 0 },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 12,
  },
  tipIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
