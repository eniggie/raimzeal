import React, { useMemo, useState } from "react";
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
import { useRouter } from "expo-router";
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
  const router = useRouter();
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

  // BMI
  const bmi = user && user.weight > 0 && user.height > 0
    ? user.weight / Math.pow(user.height / 100, 2)
    : null;
  const bmiCategory = bmi == null ? "" : bmi < 18.5 ? "Underweight" : bmi < 25 ? "Healthy" : bmi < 30 ? "Overweight" : "Obese";
  const bmiColor = bmi == null ? "#6b7280" : bmi >= 18.5 && bmi < 25 ? "#10b981" : bmi < 18.5 ? "#3b82f6" : bmi < 30 ? "#f59e0b" : "#ef4444";

  // Heatmap — 12 weeks of dates
  const workoutDateCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const w of workoutLogs) {
      counts[w.date] = (counts[w.date] ?? 0) + 1;
    }
    return counts;
  }, [workoutLogs]);

  const heatmapDays = useMemo(() => {
    const days: string[] = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  }, []);

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
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/body-measurements?add=1");
          }}
          style={[styles.addMeasureBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={16} color={colors.primaryForeground} />
          <Text style={[styles.addMeasureBtnText, { color: colors.primaryForeground }]}>
            Measure
          </Text>
        </TouchableOpacity>
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

      {/* BMI Card */}
      {bmi != null && (
        <GlassCard style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>Body Mass Index</Text>
            <View style={[styles.bmiTag, { backgroundColor: bmiColor + "20" }]}>
              <Text style={[styles.bmiTagText, { color: bmiColor }]}>{bmiCategory}</Text>
            </View>
          </View>
          <View style={styles.bmiRow}>
            <Text style={[styles.bmiValue, { color: bmiColor }]}>{bmi.toFixed(1)}</Text>
            <Text style={[styles.bmiUnit, { color: colors.mutedForeground }]}>BMI</Text>
          </View>
          <View style={[styles.bmiScale, { backgroundColor: colors.muted }]}>
            {[
              { label: "Under", end: 18.5, color: "#3b82f6" },
              { label: "Healthy", end: 25, color: "#10b981" },
              { label: "Over", end: 30, color: "#f59e0b" },
              { label: "Obese", end: 40, color: "#ef4444" },
            ].map((seg, i) => {
              const start = i === 0 ? 10 : [10, 18.5, 25, 30][i];
              const width = ((seg.end - start) / 30) * 100;
              return (
                <View key={seg.label} style={[styles.bmiSegment, { width: `${width}%`, backgroundColor: seg.color }]} />
              );
            })}
          </View>
          <Text style={[styles.bmiNote, { color: colors.mutedForeground }]}>
            Based on your profile: {user?.weight ?? "—"}kg · {user?.height ?? "—"}cm
          </Text>
        </GlassCard>
      )}

      {/* Workout Heatmap */}
      {workoutLogs.length > 0 && (
        <GlassCard style={styles.chartCard}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>12-Week Activity</Text>
          <View style={styles.heatmapGrid}>
            {Array.from({ length: 12 }, (_, weekIdx) => (
              <View key={weekIdx} style={styles.heatmapCol}>
                {Array.from({ length: 7 }, (_, dayIdx) => {
                  const dateStr = heatmapDays[weekIdx * 7 + dayIdx];
                  const count = dateStr ? (workoutDateCounts[dateStr] ?? 0) : 0;
                  const isToday = dateStr === new Date().toISOString().split("T")[0];
                  return (
                    <View
                      key={dayIdx}
                      style={[
                        styles.heatCell,
                        {
                          backgroundColor: count === 0
                            ? colors.muted
                            : count === 1
                            ? colors.primary + "80"
                            : colors.primary,
                          borderColor: isToday ? colors.primary : "transparent",
                          borderWidth: isToday ? 1.5 : 0,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.heatmapLegend}>
            <Text style={[styles.heatLegendText, { color: colors.mutedForeground }]}>Less</Text>
            {[0, 1, 2].map((v) => (
              <View
                key={v}
                style={[
                  styles.heatLegendCell,
                  {
                    backgroundColor: v === 0 ? colors.muted : v === 1 ? colors.primary + "80" : colors.primary,
                  },
                ]}
              />
            ))}
            <Text style={[styles.heatLegendText, { color: colors.mutedForeground }]}>More</Text>
          </View>
        </GlassCard>
      )}

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Track Your Transformation
      </Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/progress-photos");
        }}
        style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.navCardIcon, { backgroundColor: "#8B31C7" + "20" }]}>
          <Ionicons name="camera-outline" size={24} color="#8B31C7" />
        </View>
        <View style={styles.navCardText}>
          <Text style={[styles.navCardTitle, { color: colors.foreground }]}>Progress Photos</Text>
          <Text style={[styles.navCardSubtitle, { color: colors.mutedForeground }]}>Track your visual transformation</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/body-measurements");
        }}
        style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.navCardIcon, { backgroundColor: colors.secondary + "20" }]}>
          <Ionicons name="resize-outline" size={24} color={colors.secondary} />
        </View>
        <View style={styles.navCardText}>
          <Text style={[styles.navCardTitle, { color: colors.foreground }]}>Body Measurements</Text>
          <Text style={[styles.navCardSubtitle, { color: colors.mutedForeground }]}>Chest, waist, arms, and more</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Achievements & More */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Insights
      </Text>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/achievements");
        }}
        style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.navCardIcon, { backgroundColor: "#eab308" + "20" }]}>
          <Ionicons name="trophy-outline" size={24} color="#eab308" />
        </View>
        <View style={styles.navCardText}>
          <Text style={[styles.navCardTitle, { color: colors.foreground }]}>Achievements & Badges</Text>
          <Text style={[styles.navCardSubtitle, { color: colors.mutedForeground }]}>Milestones · Unlocked rewards</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/workout-stats");
        }}
        style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.navCardIcon, { backgroundColor: "#3b82f6" + "20" }]}>
          <Ionicons name="stats-chart-outline" size={24} color="#3b82f6" />
        </View>
        <View style={styles.navCardText}>
          <Text style={[styles.navCardTitle, { color: colors.foreground }]}>Workout Statistics</Text>
          <Text style={[styles.navCardSubtitle, { color: colors.mutedForeground }]}>Total time · PRs · Active days</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/sleep-tracker");
        }}
        style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.navCardIcon, { backgroundColor: "#8b5cf6" + "20" }]}>
          <Ionicons name="moon-outline" size={24} color="#8b5cf6" />
        </View>
        <View style={styles.navCardText}>
          <Text style={[styles.navCardTitle, { color: colors.foreground }]}>Sleep Tracker</Text>
          <Text style={[styles.navCardSubtitle, { color: colors.mutedForeground }]}>Log duration · Quality · 7-day view</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
      </TouchableOpacity>
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


const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  addMeasureBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addMeasureBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
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
  navCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
  },
  navCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  navCardText: { flex: 1, gap: 3 },
  navCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  navCardSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bmiTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  bmiTagText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  bmiRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  bmiValue: { fontSize: 42, fontFamily: "SpaceGrotesk_700Bold" },
  bmiUnit: { fontSize: 14, fontFamily: "Inter_400Regular" },
  bmiScale: { height: 8, borderRadius: 4, flexDirection: "row", overflow: "hidden" },
  bmiSegment: { height: "100%" },
  bmiNote: { fontSize: 11, fontFamily: "Inter_400Regular" },

  heatmapGrid: { flexDirection: "row", gap: 3 },
  heatmapCol: { gap: 3 },
  heatCell: { width: 14, height: 14, borderRadius: 3 },
  heatmapLegend: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  heatLegendText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  heatLegendCell: { width: 10, height: 10, borderRadius: 2 },
});
