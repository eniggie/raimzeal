import React from "react";
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
import Svg, { Circle, Path, Rect, Text as SvgText } from "react-native-svg";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { usePedometer } from "@/hooks/usePedometer";
import { useFitness } from "@/contexts/FitnessContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const STEP_GOAL = 10000;

function getActivityRingPath(
  cx: number,
  cy: number,
  r: number,
  progress: number
): string {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const angle = clampedProgress * 2 * Math.PI - Math.PI / 2;
  const x = cx + r * Math.cos(angle);
  const y = cy + r * Math.sin(angle);
  const largeArc = clampedProgress > 0.5 ? 1 : 0;
  if (clampedProgress >= 1) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r}`;
  }
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
}

function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
}

function shortDay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split("T")[0];
}

export default function ActivityTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutLogs, getTodayWorkouts } = useFitness();
  const { steps, available: pedoAvailable } = usePedometer();

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const CHART_WIDTH = SCREEN_WIDTH - 48;
  const BAR_WIDTH = Math.floor((CHART_WIDTH - 24) / 7) - 4;
  const BAR_MAX_H = 80;

  const todayWorkouts = getTodayWorkouts();
  const activeMinutes = todayWorkouts.reduce((sum, w) => sum + w.duration, 0);
  const caloriesBurned = todayWorkouts.reduce((sum, w) => sum + w.caloriesBurned, 0);
  const distanceKm = ((steps / 1300) * 0.75).toFixed(2);

  const days = last7Days();
  const weeklyData = days.map((date) => {
    const dayWorkouts = workoutLogs.filter((w) => w.date === date);
    const mins = dayWorkouts.reduce((s, w) => s + w.duration, 0);
    const cals = dayWorkouts.reduce((s, w) => s + w.caloriesBurned, 0);
    return { date, activeMinutes: mins, calories: cals };
  });
  const maxMins = Math.max(...weeklyData.map((d) => d.activeMinutes), 1);

  const thisWeekWorkouts = workoutLogs.filter((w) => {
    const diff = (Date.now() - new Date(w.date).getTime()) / 86400000;
    return diff <= 7;
  });

  const ringProgress = Math.min(1, steps / STEP_GOAL);
  const ringSize = 160;
  const ringCX = ringSize / 2;
  const ringCY = ringSize / 2;
  const trackR = 58;
  const fillR = 54;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Activity Tracker
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Today's Steps Ring */}
        <View style={[styles.ringCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Today's Activity
          </Text>
          <View style={styles.ringCenter}>
            <Svg width={ringSize} height={ringSize}>
              <Circle
                cx={ringCX}
                cy={ringCY}
                r={trackR}
                stroke={colors.border}
                strokeWidth={10}
                fill="none"
              />
              {ringProgress > 0 && (
                <Path
                  d={getActivityRingPath(ringCX, ringCY, fillR, ringProgress)}
                  stroke={colors.primary}
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                />
              )}
              <SvgText
                x={ringCX}
                y={ringCY - 4}
                textAnchor="middle"
                fontSize={24}
                fontFamily="Inter_700Bold"
                fill={colors.foreground}
              >
                {steps >= 1000
                  ? `${(steps / 1000).toFixed(1)}k`
                  : steps.toString()}
              </SvgText>
              <SvgText
                x={ringCX}
                y={ringCY + 16}
                textAnchor="middle"
                fontSize={11}
                fontFamily="Inter_400Regular"
                fill={colors.mutedForeground}
              >
                steps
              </SvgText>
            </Svg>

            <View style={styles.ringStats}>
              <RingStat
                icon="footsteps-outline"
                label="Goal"
                value={`${STEP_GOAL.toLocaleString()} steps`}
                color={colors.primary}
                colors={colors}
              />
              <RingStat
                icon="navigate-outline"
                label="Distance"
                value={`${distanceKm} km`}
                color={colors.secondary}
                colors={colors}
              />
            </View>
          </View>

          {Platform.OS !== "web" && !pedoAvailable && (
            <View style={[styles.pedoNote, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.pedoNoteText, { color: colors.mutedForeground }]}>
                Step tracking requires device motion permissions. Steps may not be available on all devices.
              </Text>
            </View>
          )}
        </View>

        {/* Today's Stats Grid */}
        <View style={styles.statsGrid}>
          <StatBox
            icon="time-outline"
            label="Active Min"
            value={activeMinutes.toString()}
            unit="min"
            color={colors.secondary}
            colors={colors}
          />
          <StatBox
            icon="flame-outline"
            label="Calories"
            value={caloriesBurned.toString()}
            unit="kcal"
            color={colors.warning}
            colors={colors}
          />
          <StatBox
            icon="barbell-outline"
            label="Workouts"
            value={todayWorkouts.length.toString()}
            unit="today"
            color={colors.primary}
            colors={colors}
          />
          <StatBox
            icon="heart-outline"
            label="Streak"
            value={`${useFitnessStreak()}`}
            unit="days"
            color={colors.destructive}
            colors={colors}
          />
        </View>

        {/* Weekly Activity Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Weekly Active Minutes
          </Text>
          <View style={styles.barChart}>
            {weeklyData.map((d, i) => {
              const barH = maxMins > 0 ? (d.activeMinutes / maxMins) * BAR_MAX_H : 0;
              const today = isToday(d.date);
              return (
                <View key={i} style={styles.barCol}>
                  <Text style={[styles.barValue, { color: today ? colors.primary : colors.mutedForeground }]}>
                    {d.activeMinutes > 0 ? d.activeMinutes : ""}
                  </Text>
                  <View style={[styles.barTrack, { height: BAR_MAX_H }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: Math.max(barH, 2),
                          width: BAR_WIDTH,
                          backgroundColor: today
                            ? colors.primary
                            : d.activeMinutes > 0
                            ? colors.primary + "50"
                            : colors.border,
                          borderRadius: 4,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      { color: today ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {shortDay(d.date)}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={[styles.weekTotals, { borderTopColor: colors.border }]}>
            <View style={styles.weekTotal}>
              <Text style={[styles.weekTotalValue, { color: colors.foreground }]}>
                {weeklyData.reduce((s, d) => s + d.activeMinutes, 0)} min
              </Text>
              <Text style={[styles.weekTotalLabel, { color: colors.mutedForeground }]}>
                Total Active
              </Text>
            </View>
            <View style={styles.weekTotal}>
              <Text style={[styles.weekTotalValue, { color: colors.foreground }]}>
                {weeklyData.reduce((s, d) => s + d.calories, 0).toLocaleString()} kcal
              </Text>
              <Text style={[styles.weekTotalLabel, { color: colors.mutedForeground }]}>
                Total Burned
              </Text>
            </View>
            <View style={styles.weekTotal}>
              <Text style={[styles.weekTotalValue, { color: colors.foreground }]}>
                {weeklyData.filter((d) => d.activeMinutes > 0).length}/7
              </Text>
              <Text style={[styles.weekTotalLabel, { color: colors.mutedForeground }]}>
                Active Days
              </Text>
            </View>
          </View>
        </View>

        {/* This Week's Workouts */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          This Week's Workouts
        </Text>
        {thisWeekWorkouts.length === 0 ? (
          <View style={[styles.emptyWorkouts, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="barbell-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyWorkoutsText, { color: colors.mutedForeground }]}>
              No workouts logged this week yet. Start one from the Workouts tab!
            </Text>
          </View>
        ) : (
          thisWeekWorkouts.map((w) => (
            <View
              key={w.id}
              style={[styles.workoutRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.workoutDot, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="barbell-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.workoutInfo}>
                <Text style={[styles.workoutName, { color: colors.foreground }]}>
                  {w.workoutName}
                </Text>
                <Text style={[styles.workoutMeta, { color: colors.mutedForeground }]}>
                  {new Date(w.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </Text>
              </View>
              <View style={styles.workoutStats}>
                <Text style={[styles.workoutStat, { color: colors.foreground }]}>
                  {w.duration}m
                </Text>
                <Text style={[styles.workoutStatSub, { color: colors.mutedForeground }]}>
                  {w.caloriesBurned} kcal
                </Text>
              </View>
            </View>
          ))
        )}

        {/* Activity Goals */}
        <View style={[styles.goalsCard, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
          <Ionicons name="trophy-outline" size={22} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.goalsTitle, { color: colors.foreground }]}>
              WHO Recommended Activity
            </Text>
            <Text style={[styles.goalsBody, { color: colors.mutedForeground }]}>
              150–300 minutes of moderate intensity activity per week. You are at{" "}
              {weeklyData.reduce((s, d) => s + d.activeMinutes, 0)} minutes this week.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function useFitnessStreak() {
  const { streak } = useFitness();
  return streak;
}

function RingStat({
  icon,
  label,
  value,
  color,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={rStyles.row}>
      <View style={[rStyles.iconBox, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={16} color={color} />
      </View>
      <View>
        <Text style={[rStyles.value, { color: colors.foreground }]}>{value}</Text>
        <Text style={[rStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      </View>
    </View>
  );
}
const rStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

function StatBox({
  icon,
  label,
  value,
  unit,
  color,
  colors,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  color: string;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[sbStyles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
      <Text style={[sbStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[sbStyles.unit, { color: color }]}>{unit}</Text>
      <Text style={[sbStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}
const sbStyles = StyleSheet.create({
  box: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 3,
  },
  value: { fontSize: 18, fontFamily: "Inter_700Bold" },
  unit: { fontSize: 10, fontFamily: "Inter_500Medium" },
  label: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  content: { padding: 16, gap: 14 },
  ringCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  ringCenter: { flexDirection: "row", alignItems: "center", gap: 20 },
  ringStats: { flex: 1, gap: 12 },
  pedoNote: {
    flexDirection: "row",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  pedoNoteText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  statsGrid: { flexDirection: "row", gap: 8 },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: 0 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 9, fontFamily: "Inter_400Regular", minHeight: 12 },
  barTrack: { justifyContent: "flex-end", alignItems: "center" },
  barFill: {},
  barLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  weekTotals: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 0,
  },
  weekTotal: { flex: 1, alignItems: "center", gap: 2 },
  weekTotalValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  weekTotalLabel: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  workoutDot: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  workoutInfo: { flex: 1 },
  workoutName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  workoutMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  workoutStats: { alignItems: "flex-end" },
  workoutStat: { fontSize: 15, fontFamily: "Inter_700Bold" },
  workoutStatSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyWorkouts: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  emptyWorkoutsText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  goalsCard: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  goalsTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  goalsBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
