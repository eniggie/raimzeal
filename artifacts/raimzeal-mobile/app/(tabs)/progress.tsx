import React, { useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - 64;
const CHART_HEIGHT = 140;

type Period = "1M" | "3M" | "6M";

export default function ProgressScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    bodyMeasurements,
    workoutLogs,
    streak,
    getWeekCalories,
    user,
  } = useFitness();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("1M");
  const periods: Period[] = ["1M", "3M", "6M"];

  const sliceCount = selectedPeriod === "1M" ? 4 : selectedPeriod === "3M" ? 8 : 12;
  const filteredMeasurements = bodyMeasurements.slice(-sliceCount);

  const weights = filteredMeasurements.map((e) => e.weight);
  const minW = weights.length > 0 ? Math.min(...weights) - 1 : 70;
  const maxW = weights.length > 0 ? Math.max(...weights) + 1 : 90;

  function toPoint(index: number, value: number): { x: number; y: number } {
    const x =
      filteredMeasurements.length > 1
        ? (index / (filteredMeasurements.length - 1)) * CHART_WIDTH
        : CHART_WIDTH / 2;
    const y =
      maxW > minW
        ? CHART_HEIGHT - ((value - minW) / (maxW - minW)) * CHART_HEIGHT
        : CHART_HEIGHT / 2;
    return { x, y };
  }

  const points = filteredMeasurements.map((e, i) => toPoint(i, e.weight));
  const pathD =
    points.length > 1
      ? `M ${points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L ")}`
      : "";

  const weekCalories = getWeekCalories();
  const maxCal = Math.max(...weekCalories.map((d) => d.calories), 1);
  const BAR_HEIGHT = 80;
  const BAR_WIDTH = Math.floor((CHART_WIDTH - 32) / weekCalories.length) - 4;

  const totalWorkouts = workoutLogs.length;
  const thisWeekWorkouts = workoutLogs.filter((w) => {
    const diff =
      (Date.now() - new Date(w.date).getTime()) / 86400000;
    return diff <= 7;
  }).length;

  const currentWeight =
    bodyMeasurements.length > 0
      ? bodyMeasurements[bodyMeasurements.length - 1].weight
      : user?.weight ?? 80;
  const startWeight = bodyMeasurements[0]?.weight ?? currentWeight;
  const weightChange = currentWeight - startWeight;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Progress
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <StatBadge icon="flame" label="Streak" value={`${streak}d`} color={colors.warning} />
        <StatBadge icon="barbell-outline" label="Workouts" value={totalWorkouts.toString()} color={colors.primary} />
        <StatBadge icon="calendar-outline" label="This Week" value={`${thisWeekWorkouts}`} color={colors.secondary} />
        <StatBadge
          icon={weightChange <= 0 ? "trending-down-outline" : "trending-up-outline"}
          label="Change"
          value={`${weightChange > 0 ? "+" : ""}${weightChange.toFixed(1)}kg`}
          color={weightChange <= 0 ? colors.success : colors.destructive}
        />
      </View>

      {/* Weight Chart */}
      <GlassCard style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>
            Body Weight
          </Text>
          <View style={styles.periodRow}>
            {periods.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedPeriod(p);
                }}
                style={[
                  styles.periodBtn,
                  { backgroundColor: selectedPeriod === p ? colors.primary : "transparent" },
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    {
                      color:
                        selectedPeriod === p ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily:
                        selectedPeriod === p ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.currentWeight}>
          <Text style={[styles.weightValue, { color: colors.foreground }]}>
            {currentWeight.toFixed(1)}
          </Text>
          <Text style={[styles.weightUnit, { color: colors.mutedForeground }]}>
            kg
          </Text>
          <View
            style={[
              styles.weightChange,
              {
                backgroundColor:
                  (weightChange <= 0 ? colors.success : colors.destructive) + "20",
              },
            ]}
          >
            <Ionicons
              name={weightChange <= 0 ? "trending-down" : "trending-up"}
              size={12}
              color={weightChange <= 0 ? colors.success : colors.destructive}
            />
            <Text
              style={[
                styles.weightChangeText,
                { color: weightChange <= 0 ? colors.success : colors.destructive },
              ]}
            >
              {Math.abs(weightChange).toFixed(1)} kg
            </Text>
          </View>
        </View>

        <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 20} style={styles.chart}>
          {pathD.length > 0 && (
            <Path
              d={pathD}
              stroke={colors.primary}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {points.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={colors.primary}
              stroke={colors.background}
              strokeWidth={2}
            />
          ))}
          {filteredMeasurements.map((e, i) => {
            const p = points[i];
            if (filteredMeasurements.length > 4 && i % 2 !== 0 && i !== filteredMeasurements.length - 1)
              return null;
            return (
              <SvgText
                key={i}
                x={p.x}
                y={CHART_HEIGHT + 14}
                fontSize={9}
                fill={colors.mutedForeground}
                textAnchor="middle"
                fontFamily="Inter_400Regular"
              >
                {e.date.slice(5)}
              </SvgText>
            );
          })}
        </Svg>
      </GlassCard>

      {/* Weekly Calories Bar Chart */}
      <GlassCard style={styles.chartCard}>
        <Text style={[styles.chartTitle, { color: colors.foreground }]}>
          Weekly Calories
        </Text>
        <View style={styles.barChart}>
          {weekCalories.map((d, i) => {
            const barH = (d.calories / maxCal) * BAR_HEIGHT;
            const isToday = i === weekCalories.length - 1;
            return (
              <View key={i} style={styles.barItem}>
                <View style={[styles.barTrack, { height: BAR_HEIGHT }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: barH,
                        width: BAR_WIDTH,
                        backgroundColor: isToday ? colors.primary : colors.primary + "60",
                        borderRadius: 4,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>
                  {d.day}
                </Text>
              </View>
            );
          })}
        </View>
      </GlassCard>

      {/* Achievements */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Achievements
      </Text>
      <View style={styles.achievements}>
        {[
          { icon: "flame" as const, label: "7-Day Streak", unlocked: streak >= 7, color: colors.warning },
          { icon: "barbell-outline" as const, label: "10 Workouts", unlocked: totalWorkouts >= 10, color: colors.primary },
          { icon: "trophy-outline" as const, label: "First PR", unlocked: true, color: colors.secondary },
          { icon: "body-outline" as const, label: "Consistency King", unlocked: streak >= 14, color: colors.accent },
        ].map((a) => (
          <AchievementBadge key={a.label} {...a} />
        ))}
      </View>
    </ScrollView>
  );
}

function StatBadge({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.statBadge,
        { backgroundColor: color + "15", borderColor: color + "30" },
      ]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statBadgeValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.statBadgeLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function AchievementBadge({
  icon,
  label,
  unlocked,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  unlocked: boolean;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.achievement,
        {
          backgroundColor: unlocked ? color + "15" : colors.muted,
          borderColor: unlocked ? color + "40" : colors.border,
          opacity: unlocked ? 1 : 0.5,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={24}
        color={unlocked ? color : colors.mutedForeground}
      />
      <Text
        style={[
          styles.achievementLabel,
          { color: unlocked ? colors.foreground : colors.mutedForeground },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  header: { marginBottom: 4 },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  statsRow: { flexDirection: "row", gap: 8 },
  statBadge: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  statBadgeValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statBadgeLabel: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center" },
  chartCard: { padding: 16, gap: 12 },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chartTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_600SemiBold" },
  periodRow: { flexDirection: "row", gap: 4 },
  periodBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  periodText: { fontSize: 12 },
  currentWeight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  weightValue: { fontSize: 36, fontFamily: "Inter_700Bold" },
  weightUnit: { fontSize: 14, fontFamily: "Inter_400Regular" },
  weightChange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 4,
  },
  weightChangeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  chart: { alignSelf: "center" },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    paddingTop: 8,
  },
  barItem: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: { justifyContent: "flex-end", alignItems: "center" },
  barFill: {},
  barLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", marginTop: 4 },
  achievements: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  achievement: {
    width: "47%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  achievementLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
});
