import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function modeOf<T>(arr: T[]): T | undefined {
  if (!arr.length) return undefined;
  const freq: Map<T, number> = new Map();
  for (const x of arr) freq.set(x, (freq.get(x) ?? 0) + 1);
  let best: T = arr[0];
  let bestCount = 0;
  for (const [val, count] of freq) {
    if (count > bestCount) { best = val; bestCount = count; }
  }
  return best;
}

function formatMinutes(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function longestStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates)].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr.getTime() - prev.getTime()) / 86400000;
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else cur = 1;
  }
  return best;
}

function StatCard({
  icon, label, value, sub, color, colors,
}: {
  icon: IoniconsName;
  label: string;
  value: string;
  sub?: string;
  color: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[scStyles.card, { backgroundColor: color + "14", borderColor: color + "30" }]}>
      <View style={[scStyles.iconWrap, { backgroundColor: color + "25" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[scStyles.value, { color: colors.foreground }]}>{value}</Text>
      <Text style={[scStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      {sub ? <Text style={[scStyles.sub, { color: color }]}>{sub}</Text> : null}
    </View>
  );
}

const scStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  label: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sub: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

export default function WorkoutStatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutLogs, personalRecords, streak } = useFitness();

  const stats = useMemo(() => {
    const total = workoutLogs.length;
    const totalMins = workoutLogs.reduce((s, w) => s + (w.duration ?? 0), 0);
    const totalCal = workoutLogs.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0);
    const totalSets = workoutLogs.reduce((s, w) =>
      s + w.exercises.reduce((es, e) => es + (e.sets ?? 0), 0), 0);
    const avgDuration = total > 0 ? Math.round(totalMins / total) : 0;

    const workoutNames = workoutLogs.map((w) => w.workoutName);
    const favoriteWorkout = modeOf(workoutNames);

    const dayOfWeek = workoutLogs.map((w) => new Date(w.date).getDay());
    const mostActiveDay = modeOf(dayOfWeek);
    const mostActiveDayName = mostActiveDay !== undefined ? DAY_NAMES[mostActiveDay] : "—";

    const dates = workoutLogs.map((w) => w.date);
    const bestStreak = longestStreak(dates);

    const thisMonth = workoutLogs.filter((w) => {
      const d = new Date(w.date);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const thisWeek = workoutLogs.filter((w) => {
      const diff = (Date.now() - new Date(w.date).getTime()) / 86400000;
      return diff <= 7;
    }).length;

    // Day-of-week breakdown
    const dayBreakdown = Array(7).fill(0);
    for (const d of dayOfWeek) dayBreakdown[d]++;
    const maxDay = Math.max(...dayBreakdown, 1);

    // Workout type breakdown
    const nameFreq: Record<string, number> = {};
    for (const n of workoutNames) nameFreq[n] = (nameFreq[n] ?? 0) + 1;
    const top5 = Object.entries(nameFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      total, totalMins, totalCal, totalSets, avgDuration,
      favoriteWorkout, mostActiveDayName, bestStreak,
      thisMonth, thisWeek, dayBreakdown, maxDay, top5,
    };
  }, [workoutLogs]);

  const BAR_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f97316", "#ec4899"];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Workout Stats</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {workoutLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No workouts yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Complete your first workout to see your stats here.
            </Text>
          </View>
        ) : (
          <>
            {/* Main stats grid */}
            <View style={styles.statGrid}>
              <StatCard icon="barbell" label="Total Workouts" value={stats.total.toString()}
                color="#3b82f6" colors={colors} />
              <StatCard icon="time" label="Total Time" value={formatMinutes(stats.totalMins)}
                color="#8b5cf6" colors={colors} />
              <StatCard icon="flame" label="Calories Burned" value={stats.totalCal.toLocaleString()}
                sub="total kcal" color="#f97316" colors={colors} />
              <StatCard icon="fitness" label="Total Sets" value={stats.totalSets.toLocaleString()}
                color="#10b981" colors={colors} />
              <StatCard icon="timer-outline" label="Avg Duration" value={`${stats.avgDuration}m`}
                sub="per session" color="#ec4899" colors={colors} />
              <StatCard icon="calendar" label="This Month" value={stats.thisMonth.toString()}
                sub="workouts" color="#f59e0b" colors={colors} />
              <StatCard icon="flash" label="This Week" value={stats.thisWeek.toString()}
                sub="workouts" color="#06b6d4" colors={colors} />
              <StatCard icon="flame-outline" label="Best Streak" value={`${stats.bestStreak}d`}
                sub="consecutive days" color="#ef4444" colors={colors} />
            </View>

            {/* Day-of-week breakdown */}
            <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Most Active Day
              </Text>
              <Text style={[styles.sectionHighlight, { color: colors.primary }]}>
                {stats.mostActiveDayName}
              </Text>
              <View style={styles.dayBars}>
                {DAY_NAMES.map((day, i) => {
                  const count = stats.dayBreakdown[i];
                  const pct = count / stats.maxDay;
                  const isActive = i === DAY_NAMES.indexOf(stats.mostActiveDayName);
                  return (
                    <View key={day} style={styles.dayBarCol}>
                      <Text style={[styles.dayBarCount, { color: count > 0 ? colors.mutedForeground : "transparent" }]}>
                        {count}
                      </Text>
                      <View style={[styles.dayBarTrack, { backgroundColor: colors.muted }]}>
                        <View
                          style={[
                            styles.dayBarFill,
                            {
                              height: `${pct * 100}%`,
                              backgroundColor: isActive ? colors.primary : colors.primary + "50",
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.dayBarLabel, { color: isActive ? colors.primary : colors.mutedForeground,
                        fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                        {day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Top workouts */}
            {stats.top5.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Favorite Workouts
                </Text>
                <View style={styles.topList}>
                  {stats.top5.map(([name, count], i) => {
                    const pct = count / (stats.top5[0]?.[1] ?? 1);
                    return (
                      <View key={name} style={styles.topRow}>
                        <Text style={[styles.topRank, { color: BAR_COLORS[i] }]}>#{i + 1}</Text>
                        <View style={styles.topBarWrap}>
                          <Text style={[styles.topName, { color: colors.foreground }]} numberOfLines={1}>
                            {name}
                          </Text>
                          <View style={[styles.topBarTrack, { backgroundColor: colors.muted }]}>
                            <View
                              style={[
                                styles.topBarFill,
                                { width: `${pct * 100}%`, backgroundColor: BAR_COLORS[i] },
                              ]}
                            />
                          </View>
                        </View>
                        <Text style={[styles.topCount, { color: colors.mutedForeground }]}>
                          {count}×
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* PRs */}
            {personalRecords.length > 0 && (
              <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Personal Records
                </Text>
                <View style={styles.prList}>
                  {personalRecords.slice(0, 8).map((pr, i) => (
                    <View
                      key={i}
                      style={[
                        styles.prRow,
                        i < personalRecords.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      ]}
                    >
                      <Ionicons name="medal-outline" size={16} color="#eab308" />
                      <Text style={[styles.prExercise, { color: colors.foreground }]} numberOfLines={1}>
                        {pr.exercise}
                      </Text>
                      <Text style={[styles.prWeight, { color: colors.primary }]}>
                        {pr.weight} kg
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  sectionCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sectionHighlight: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  dayBars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  dayBarCol: { alignItems: "center", gap: 4 },
  dayBarCount: { fontSize: 9, fontFamily: "Inter_400Regular" },
  dayBarTrack: { width: 26, height: 56, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  dayBarFill: { width: "100%", borderRadius: 6, minHeight: 4 },
  dayBarLabel: { fontSize: 10 },
  topList: { gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  topRank: { width: 24, fontSize: 13, fontFamily: "Inter_700Bold" },
  topBarWrap: { flex: 1, gap: 4 },
  topName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  topBarTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  topBarFill: { height: "100%", borderRadius: 3 },
  topCount: { fontSize: 12, fontFamily: "Inter_400Regular", width: 28, textAlign: "right" },
  prList: { gap: 0 },
  prRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  prExercise: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  prWeight: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
