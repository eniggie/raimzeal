import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useFitness } from "@/contexts/FitnessContext";
import { useTier } from "@/hooks/useTier";
import { useAuth } from "@/contexts/AuthContext";

const SLEEP_PREFIX = "@raimzeal_sleep_v1_";
const WELLNESS_PREFIX = "@raimzeal_wellness_v1_";

interface SleepEntry { bedHour: number; bedMin: number; wakeHour: number; wakeMin: number; quality: 1|2|3|4|5; }
interface WellnessEntry { mood: 1|2|3|4|5; energy: 1|2|3|4|5; stress: 1|2|3|4|5; recovery: 1|2|3|4|5; }

function last7DayKeys(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });
}

function sleepHours(e: SleepEntry): number {
  let diff = (e.wakeHour * 60 + e.wakeMin) - (e.bedHour * 60 + e.bedMin);
  if (diff < 0) diff += 24 * 60;
  return parseFloat((diff / 60).toFixed(1));
}

function readiness(e: WellnessEntry): number {
  return Math.round((e.mood + e.energy + (6 - e.stress) + e.recovery) / 4 * 20);
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

interface WeekData {
  workouts: number;
  avgCalories: number;
  avgProtein: number;
  waterDays: number;
  avgSleep: number;
  avgReadiness: number;
  sleepDays: number;
  readinessDays: number;
}

function ReportRow({ icon, label, value, sub, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; sub?: string; color: string }) {
  const colors = useColors();
  return (
    <View style={rowStyles.row}>
      <View style={[rowStyles.iconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[rowStyles.value, { color: colors.foreground }]}>{value}</Text>
        {sub && <Text style={[rowStyles.sub, { color: colors.mutedForeground }]}>{sub}</Text>}
      </View>
    </View>
  );
}
const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  label: { fontSize: 11, fontFamily: "Inter_400Regular", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold", marginTop: 1 },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
});

export default function WeeklyReportScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutLogs, mealLogs, waterIntake, getTodayMacros } = useFitness();
  const { user: authUser } = useAuth();
  const { tier } = useTier(authUser?.id ?? null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [focusTip, setFocusTip] = useState("");

  const isRise = tier === "rise" || tier === "reign" || tier === "legacy";

  useEffect(() => {
    const days = last7DayKeys();
    Promise.all([
      AsyncStorage.multiGet(days.map((d) => SLEEP_PREFIX + d)),
      AsyncStorage.multiGet(days.map((d) => WELLNESS_PREFIX + d)),
    ]).then(([sleepResults, wellnessResults]) => {
      const sleepEntries: number[] = [];
      const readinessScores: number[] = [];
      sleepResults.forEach(([, v]) => {
        if (v) { const e: SleepEntry = JSON.parse(v); sleepEntries.push(sleepHours(e)); }
      });
      wellnessResults.forEach(([, v]) => {
        if (v) { const e: WellnessEntry = JSON.parse(v); readinessScores.push(readiness(e)); }
      });

      const weekWorkouts = workoutLogs.filter((w) => days.includes(w.date)).length;
      const weekMeals = mealLogs.filter((m) => days.includes(m.date));
      const caloriesByDay = days.map((d) => {
        const dayMeals = weekMeals.filter((m) => m.date === d);
        return dayMeals.reduce((s, m) => s + (m.calories ?? 0), 0);
      }).filter((c) => c > 0);
      const proteinByDay = days.map((d) => {
        const dayMeals = weekMeals.filter((m) => m.date === d);
        return dayMeals.reduce((s, m) => s + (m.protein ?? 0), 0);
      }).filter((p) => p > 0);
      const waterDays = waterIntake.filter((w) => days.includes(w.date) && w.glasses >= 8).length;

      const data: WeekData = {
        workouts: weekWorkouts,
        avgCalories: Math.round(avg(caloriesByDay)),
        avgProtein: Math.round(avg(proteinByDay)),
        waterDays,
        avgSleep: avg(sleepEntries),
        avgReadiness: Math.round(avg(readinessScores)),
        sleepDays: sleepEntries.length,
        readinessDays: readinessScores.length,
      };
      setWeekData(data);

      const tips: string[] = [];
      if (weekWorkouts < 3) tips.push("Try to get 3+ workouts in next week.");
      if (data.avgSleep < 7 && data.sleepDays > 0) tips.push("Your average sleep was below 7h — aim for an earlier bedtime.");
      if (waterDays < 5) tips.push("Hydration was inconsistent — aim to hit 8+ glasses daily.");
      if (data.avgReadiness > 0 && data.avgReadiness < 60) tips.push("Low readiness trend — consider a deload week.");
      if (caloriesByDay.length < 4) tips.push("Log meals more consistently for better nutrition insights.");
      setFocusTip(tips[0] ?? "Great week! Keep your momentum going into next week.");
    });
  }, [workoutLogs, mealLogs, waterIntake]);

  const weekLabel = (() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const end = new Date();
    return `${start.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
  })();

  if (!isRise) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.headerRow, { paddingTop: topPad + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground }]}>Weekly Wellness Report</Text>
        </View>
        <View style={styles.gateWrap}>
          <Ionicons name="bar-chart-outline" size={48} color={colors.primary} />
          <Text style={[styles.gateTitle, { color: colors.foreground }]}>Rise Plan & Above</Text>
          <Text style={[styles.gateSub, { color: colors.mutedForeground }]}>
            Your weekly summary of workouts, nutrition, sleep, hydration, and readiness — available on the Rise plan ($9.99/mo).
          </Text>
          <AnimatedPressable onPress={() => router.push("/membership")} style={[styles.gateBtn, { backgroundColor: colors.primary }]} scale={0.97}>
            <Text style={styles.gateBtnText}>Upgrade to Rise</Text>
          </AnimatedPressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 40 + 84 : 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Weekly Report</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{weekLabel}</Text>
        </View>
      </View>

      {!weekData ? (
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Compiling your week...</Text>
        </View>
      ) : (
        <>
          {/* Summary Grid */}
          <View style={styles.statGrid}>
            {[
              { icon: "barbell-outline" as const, label: "Workouts", value: weekData.workouts.toString(), color: colors.primary },
              { icon: "restaurant-outline" as const, label: "Avg Calories", value: weekData.avgCalories > 0 ? `${weekData.avgCalories} kcal` : "—", color: "#f97316" },
              { icon: "water-outline" as const, label: "Hydration Days", value: `${weekData.waterDays}/7`, color: "#3b82f6" },
              { icon: "moon-outline" as const, label: "Avg Sleep", value: weekData.avgSleep > 0 ? `${weekData.avgSleep}h` : "—", color: "#8b5cf6" },
            ].map(({ icon, label, value, color }) => (
              <GlassCard key={label} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </GlassCard>
            ))}
          </View>

          {/* Detail Card */}
          <GlassCard style={styles.detailCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>This Week in Detail</Text>
            <ReportRow icon="barbell-outline" label="Training" value={`${weekData.workouts} session${weekData.workouts === 1 ? "" : "s"}`} sub={weekData.workouts >= 3 ? "On track ✓" : "Aim for 3+ next week"} color={colors.primary} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ReportRow icon="restaurant-outline" label="Average calories" value={weekData.avgCalories > 0 ? `${weekData.avgCalories} kcal/day` : "Not enough data"} sub={weekData.avgProtein > 0 ? `Avg protein: ${weekData.avgProtein}g/day` : undefined} color="#f97316" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ReportRow icon="water-outline" label="Hydration" value={`${weekData.waterDays}/7 days at goal`} sub={weekData.waterDays >= 5 ? "Well hydrated ✓" : "Aim for 5+ days"} color="#3b82f6" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ReportRow icon="moon-outline" label="Sleep" value={weekData.avgSleep > 0 ? `${weekData.avgSleep}h average` : "No sleep logged"} sub={weekData.sleepDays > 0 ? `Logged ${weekData.sleepDays}/7 nights` : "Start logging for insights"} color="#8b5cf6" />
            {weekData.avgReadiness > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <ReportRow icon="happy-outline" label="Readiness" value={`${weekData.avgReadiness}/100 average`} sub={`From ${weekData.readinessDays} check-ins`} color="#10b981" />
              </>
            )}
          </GlassCard>

          {/* Focus tip */}
          <GlassCard style={[styles.focusCard, { borderColor: colors.primary + "40" }]}>
            <View style={styles.focusHeader}>
              <Ionicons name="bulb-outline" size={18} color={colors.primary} />
              <Text style={[styles.focusTitle, { color: colors.foreground }]}>Next Week Focus</Text>
            </View>
            <Text style={[styles.focusTip, { color: colors.mutedForeground }]}>{focusTip}</Text>
          </GlassCard>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  loading: { paddingVertical: 60, alignItems: "center" },
  loadingText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "47%", alignItems: "center", gap: 6, paddingVertical: 16 },
  statIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  detailCard: { gap: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  divider: { height: 1 },
  focusCard: { gap: 8, borderWidth: 1.5 },
  focusHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  focusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  focusTip: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  gateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
