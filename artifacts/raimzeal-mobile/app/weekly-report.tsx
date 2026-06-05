import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import { useFitness } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBase, getAccessToken } from "@/lib/db";

const SLEEP_PREFIX = "@raimzeal_sleep_v1_";
const WELLNESS_PREFIX = "@raimzeal_wellness_v1_";
const AI_NARRATIVE_KEY = "@raimzeal_weekly_narrative_v1";

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
  avgMood: number | null;
  avgEnergy: number | null;
  avgStress: number | null;
  topReadinessDays: number;
  workoutOnHighReadiness: number;
  workoutOnLowReadiness: number;
  wellnessByDay: Record<string, WellnessEntry | null>;
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
  const { workoutLogs, mealLogs, waterIntake } = useFitness();
  const { user: authUser } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [weekData, setWeekData] = useState<WeekData | null>(null);
  const [focusTip, setFocusTip] = useState("");

  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCachedAt, setAiCachedAt] = useState<string | null>(null);

  const weekLabel = (() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    const end = new Date();
    return `${start.toLocaleDateString("en", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
  })();

  const currentWeekKey = last7DayKeys()[0];

  useEffect(() => {
    const days = last7DayKeys();
    Promise.all([
      AsyncStorage.multiGet(days.map((d) => SLEEP_PREFIX + d)),
      AsyncStorage.multiGet(days.map((d) => WELLNESS_PREFIX + d)),
      AsyncStorage.getItem(AI_NARRATIVE_KEY),
    ]).then(([sleepResults, wellnessResults, narrativeRaw]) => {
      const sleepEntries: number[] = [];
      const readinessScores: number[] = [];
      const moodScores: number[] = [];
      const energyScores: number[] = [];
      const stressScores: number[] = [];
      const wellnessByDay: Record<string, WellnessEntry | null> = {};

      sleepResults.forEach(([, v]) => {
        if (v) { const e: SleepEntry = JSON.parse(v); sleepEntries.push(sleepHours(e)); }
      });

      days.forEach((day, idx) => {
        const v = wellnessResults[idx][1];
        if (v) {
          const e: WellnessEntry = JSON.parse(v);
          wellnessByDay[day] = e;
          readinessScores.push(readiness(e));
          moodScores.push(e.mood);
          energyScores.push(e.energy);
          stressScores.push(e.stress);
        } else {
          wellnessByDay[day] = null;
        }
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

      let workoutOnHighReadiness = 0;
      let workoutOnLowReadiness = 0;
      let topReadinessDays = 0;
      days.forEach((day) => {
        const wellness = wellnessByDay[day];
        if (wellness) {
          const score = readiness(wellness);
          const hadWorkout = workoutLogs.some((w) => w.date === day);
          if (score >= 70) {
            topReadinessDays++;
            if (hadWorkout) workoutOnHighReadiness++;
          } else {
            if (hadWorkout) workoutOnLowReadiness++;
          }
        }
      });

      const data: WeekData = {
        workouts: weekWorkouts,
        avgCalories: Math.round(avg(caloriesByDay)),
        avgProtein: Math.round(avg(proteinByDay)),
        waterDays,
        avgSleep: avg(sleepEntries),
        avgReadiness: Math.round(avg(readinessScores)),
        sleepDays: sleepEntries.length,
        readinessDays: readinessScores.length,
        avgMood: moodScores.length > 0 ? avg(moodScores) : null,
        avgEnergy: energyScores.length > 0 ? avg(energyScores) : null,
        avgStress: stressScores.length > 0 ? avg(stressScores) : null,
        topReadinessDays,
        workoutOnHighReadiness,
        workoutOnLowReadiness,
        wellnessByDay,
      };
      setWeekData(data);

      const tips: string[] = [];
      if (weekWorkouts < 3) tips.push("Try to get 3+ workouts in next week.");
      if (data.avgSleep < 7 && data.sleepDays > 0) tips.push("Your average sleep was below 7h — aim for an earlier bedtime.");
      if (waterDays < 5) tips.push("Hydration was inconsistent — aim to hit 8+ glasses daily.");
      if (data.avgReadiness > 0 && data.avgReadiness < 60) tips.push("Low readiness trend — consider a deload week.");
      if (caloriesByDay.length < 4) tips.push("Log meals more consistently for better nutrition insights.");
      setFocusTip(tips[0] ?? "Great week! Keep your momentum going into next week.");

      if (narrativeRaw) {
        try {
          const parsed = JSON.parse(narrativeRaw) as { weekKey: string; narrative: string; generatedAt: string };
          if (parsed.weekKey === currentWeekKey) {
            setAiNarrative(parsed.narrative);
            setAiCachedAt(parsed.generatedAt);
          }
        } catch {}
      }
    });
  }, [workoutLogs, mealLogs, waterIntake]);

  async function generateAiNarrative() {
    if (!weekData || aiLoading) return;
    setAiLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) { setAiNarrative("Sign in to unlock your personalised AI wellness narrative. 🔐"); return; }

      const payload = {
        type: "weekly_report",
        data: {
          workouts: weekData.workouts,
          avgCalories: weekData.avgCalories,
          avgProtein: weekData.avgProtein,
          avgSleep: weekData.avgSleep,
          sleepDays: weekData.sleepDays,
          avgReadiness: weekData.avgReadiness,
          readinessDays: weekData.readinessDays,
          waterDays: weekData.waterDays,
          avgMood: weekData.avgMood,
          avgEnergy: weekData.avgEnergy,
          avgStress: weekData.avgStress,
          topReadinessDays: weekData.topReadinessDays,
          workoutOnHighReadinessDays: weekData.workoutOnHighReadiness,
          workoutOnLowReadinessDays: weekData.workoutOnLowReadiness,
        },
      };

      const res = await fetch(`${getApiBase()}/api/ai/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      if (res.status === 429) { setAiNarrative("Daily AI limit reached — come back tomorrow! ⏰"); return; }
      if (!res.ok) throw new Error("API error");
      const json = await res.json() as { insight: string };
      setAiNarrative(json.insight);
      const generatedAt = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setAiCachedAt(generatedAt);
      await AsyncStorage.setItem(AI_NARRATIVE_KEY, JSON.stringify({
        weekKey: currentWeekKey,
        narrative: json.insight,
        generatedAt,
      }));
    } catch {
      setAiNarrative("Couldn't generate report right now — try again shortly. 🔄");
    } finally {
      setAiLoading(false);
    }
  }

  function getMindBodyInsight(): { message: string; icon: keyof typeof Ionicons.glyphMap; color: string } | null {
    if (!weekData || weekData.readinessDays < 2) return null;
    const { topReadinessDays, workoutOnHighReadiness, workoutOnLowReadiness, workouts } = weekData;
    if (topReadinessDays === 0) return null;

    const highRate = topReadinessDays > 0 ? workoutOnHighReadiness / topReadinessDays : 0;
    const lowDays = weekData.readinessDays - topReadinessDays;

    if (highRate >= 0.6 && workoutOnHighReadiness > workoutOnLowReadiness) {
      return {
        message: `You trained on ${workoutOnHighReadiness}/${topReadinessDays} high-readiness days. Your body is telling you when it's ready — keep listening to it! 🎯`,
        icon: "trending-up",
        color: "#10b981",
      };
    }
    if (highRate < 0.3 && topReadinessDays >= 2) {
      return {
        message: `You had ${topReadinessDays} high-readiness day${topReadinessDays > 1 ? "s" : ""} but only trained on ${workoutOnHighReadiness}. Schedule workouts on days your readiness is 70+! 💡`,
        icon: "bulb-outline",
        color: "#f59e0b",
      };
    }
    if (workouts > 0 && lowDays > 0 && workoutOnLowReadiness > 0) {
      return {
        message: `You pushed through ${workoutOnLowReadiness} workout${workoutOnLowReadiness > 1 ? "s" : ""} on low-readiness days. That resilience is admirable — just watch for overtraining. 💪`,
        icon: "fitness-outline",
        color: "#8b5cf6",
      };
    }
    if (weekData.avgReadiness > 0 && weekData.avgMood !== null) {
      const correlation = weekData.avgReadiness > 65 && weekData.avgMood >= 3.5
        ? "Your high readiness scores align with strong mood this week — mind and body in sync! 🔄"
        : weekData.avgReadiness < 55 && weekData.avgMood !== null && weekData.avgMood < 3
        ? "Low readiness and lower mood tracked together this week. Prioritise sleep and recovery next week. 🛌"
        : null;
      if (correlation) return { message: correlation, icon: "sync-outline", color: "#3b82f6" };
    }
    return null;
  }

  const mindBodyInsight = weekData ? getMindBodyInsight() : null;

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
            {weekData.avgMood !== null && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={rowStyles.row}>
                  <View style={[rowStyles.iconWrap, { backgroundColor: "#ec489920" }]}>
                    <Ionicons name="heart-outline" size={18} color="#ec4899" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[rowStyles.label, { color: colors.mutedForeground }]}>Mind metrics</Text>
                    <View style={styles.moodRow}>
                      {[
                        { label: "Mood", val: weekData.avgMood, color: "#ec4899" },
                        { label: "Energy", val: weekData.avgEnergy, color: "#f59e0b" },
                        { label: "Stress", val: weekData.avgStress, color: "#ef4444" },
                      ].map(({ label, val, color }) => val !== null ? (
                        <View key={label} style={[styles.moodChip, { backgroundColor: color + "15" }]}>
                          <Text style={[styles.moodChipVal, { color }]}>{val.toFixed(1)}</Text>
                          <Text style={[styles.moodChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
                        </View>
                      ) : null)}
                    </View>
                  </View>
                </View>
              </>
            )}
          </GlassCard>

          {/* Mind-Body Sync */}
          {mindBodyInsight && (
            <View style={[styles.mindBodyCard, { backgroundColor: mindBodyInsight.color + "12", borderColor: mindBodyInsight.color + "35" }]}>
              <View style={styles.mindBodyHeader}>
                <View style={[styles.mindBodyIcon, { backgroundColor: mindBodyInsight.color + "25" }]}>
                  <Ionicons name={mindBodyInsight.icon} size={18} color={mindBodyInsight.color} />
                </View>
                <Text style={[styles.mindBodyTitle, { color: colors.foreground }]}>Mind-Body Sync</Text>
              </View>
              <Text style={[styles.mindBodyText, { color: colors.foreground }]}>{mindBodyInsight.message}</Text>
              {weekData.readinessDays >= 3 && (
                <View style={styles.readinessMiniChart}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
                  {last7DayKeys().map((day, i) => {
                    const wellness = weekData.wellnessByDay[day];
                    const score = wellness ? readiness(wellness) : 0;
                    const hadWorkout = workoutLogs.some((w) => w.date === day);
                    const barColor = score === 0 ? colors.border : score >= 70 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
                    const dayLabel = i === 6 ? "T" : new Date(day + "T12:00:00").toLocaleDateString("en", { weekday: "narrow" });
                    return (
                      <View key={day} style={styles.miniBarCol}>
                        {hadWorkout && <View style={[styles.workoutDot, { backgroundColor: mindBodyInsight.color }]} />}
                        <View style={styles.miniBarTrack}>
                          <View style={[styles.miniBarFill, { height: score > 0 ? `${score}%` : "4%", backgroundColor: barColor }]} />
                        </View>
                        <Text style={[styles.miniBarLabel, { color: colors.mutedForeground }]}>{dayLabel}</Text>
                      </View>
                    );
                  })}
                  </View>
                  <View style={styles.miniLegend}>
                    <View style={styles.miniLegendItem}>
                      <View style={[styles.miniDot, { backgroundColor: mindBodyInsight.color }]} />
                      <Text style={[styles.miniLegendText, { color: colors.mutedForeground }]}>Workout</Text>
                    </View>
                    <View style={styles.miniLegendItem}>
                      <View style={[styles.miniDot, { backgroundColor: "#10b981" }]} />
                      <Text style={[styles.miniLegendText, { color: colors.mutedForeground }]}>High readiness</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* AI Weekly Narrative */}
          <View style={[styles.aiCard, { backgroundColor: colors.card, borderColor: colors.primary + "35" }]}>
            <View style={styles.aiHeader}>
              <View style={[styles.aiIconWrap, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.aiTitle, { color: colors.foreground }]}>Ovia AI Weekly Report</Text>
                <Text style={[styles.aiSub, { color: colors.mutedForeground }]}>
                  {aiCachedAt ? `Generated at ${aiCachedAt}` : "AI-powered personalised analysis"}
                </Text>
              </View>
            </View>
            {aiNarrative ? (
              <Text style={[styles.aiNarrative, { color: colors.foreground }]}>{aiNarrative}</Text>
            ) : (
              <Text style={[styles.aiPlaceholder, { color: colors.mutedForeground }]}>
                Get a personalised AI analysis of your week — what went well, what needs work, and what to prioritise next week.
              </Text>
            )}
            <TouchableOpacity
              onPress={generateAiNarrative}
              disabled={aiLoading}
              style={[styles.aiBtn, { backgroundColor: aiLoading ? colors.muted : colors.primary }]}
              activeOpacity={0.8}
            >
              {aiLoading ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Ionicons name="sparkles" size={15} color={colors.primaryForeground} />
              )}
              <Text style={[styles.aiBtnText, { color: aiLoading ? colors.mutedForeground : colors.primaryForeground }]}>
                {aiLoading ? "Analysing your week…" : aiNarrative ? "Regenerate Report" : "Generate AI Report"}
              </Text>
            </TouchableOpacity>
          </View>

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
  moodRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  moodChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignItems: "center", gap: 2 },
  moodChipVal: { fontSize: 15, fontFamily: "SpaceGrotesk_700Bold" },
  moodChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  mindBodyCard: { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 12 },
  mindBodyHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  mindBodyIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  mindBodyTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  mindBodyText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  readinessMiniChart: { gap: 8, marginTop: 4 },
  miniBarCol: { alignItems: "center", gap: 3, flex: 1 },
  workoutDot: { width: 6, height: 6, borderRadius: 3 },
  miniBarTrack: { width: 22, height: 50, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.08)", justifyContent: "flex-end", overflow: "hidden" },
  miniBarFill: { width: "100%", borderRadius: 6, minHeight: 2 },
  miniBarLabel: { fontSize: 9, fontFamily: "Inter_400Regular" },
  miniLegend: { flexDirection: "row", gap: 16, marginTop: 4, justifyContent: "center" },
  miniLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  miniDot: { width: 7, height: 7, borderRadius: 4 },
  miniLegendText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  aiCard: { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 12 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  aiSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  aiNarrative: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  aiPlaceholder: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, fontStyle: "italic" },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12 },
  aiBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  focusCard: { gap: 8, borderWidth: 1.5 },
  focusHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  focusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  focusTip: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  readinessMiniChartRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
});
