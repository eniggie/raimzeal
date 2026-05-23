import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, type WorkoutLog } from "@/contexts/FitnessContext";
import { WorkoutCard } from "@/components/WorkoutCard";
import { WORKOUT_TEMPLATES } from "@/constants/workoutTemplates";
import type { WorkoutTemplate } from "@/constants/workoutTemplates";
import {
  fetchPrograms,
  fetchEnrolledProgram,
  enrollProgram,
  unenrollProgram,
  ProgramItem,
  ProgramWeek,
  type EnrolledProgram,
} from "@/lib/db";
import { loadCustomWorkouts, deleteCustomWorkout } from "@/lib/customWorkouts";

type ActiveTab = "library" | "programs" | "history";
type HistoryViewMode = "week" | "month";

// ── Grouping types ────────────────────────────────────────────────────────────
type WorkoutWeekGroup = {
  weekKey: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  logs: WorkoutLog[];
  totalDuration: number;
  totalCalories: number;
};

type WorkoutMonthGroup = {
  monthKey: string;
  monthLabel: string;
  logs: WorkoutLog[];
  totalDuration: number;
  totalCalories: number;
};

// ── Pure grouping utilities ───────────────────────────────────────────────────
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LONG  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function groupWorkoutsByWeek(logs: WorkoutLog[]): WorkoutWeekGroup[] {
  const map = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const key = getMondayOfWeek(log.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([weekKey, weekLogs]) => {
      const endD = new Date(weekKey + "T12:00:00");
      endD.setDate(endD.getDate() + 6);
      const d = new Date(weekKey + "T12:00:00");
      return {
        weekKey,
        weekLabel: `Week of ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
        startDate: weekKey,
        endDate: endD.toISOString().split("T")[0],
        logs: [...weekLogs].sort((a, b) => (a.date > b.date ? -1 : 1)),
        totalDuration: weekLogs.reduce((s, l) => s + l.duration, 0),
        totalCalories: weekLogs.reduce((s, l) => s + l.caloriesBurned, 0),
      };
    });
}

function groupWorkoutsByMonth(weekGroups: WorkoutWeekGroup[]): WorkoutMonthGroup[] {
  const map = new Map<string, WorkoutLog[]>();
  for (const wg of weekGroups) {
    const monthKey = wg.endDate.slice(0, 7);
    if (!map.has(monthKey)) map.set(monthKey, []);
    map.get(monthKey)!.push(...wg.logs);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([monthKey, mLogs]) => {
      const [yr, mo] = monthKey.split("-");
      return {
        monthKey,
        monthLabel: `${MONTH_LONG[parseInt(mo) - 1]} ${yr}`,
        logs: mLogs,
        totalDuration: mLogs.reduce((s, l) => s + l.duration, 0),
        totalCalories: mLogs.reduce((s, l) => s + l.caloriesBurned, 0),
      };
    });
}

// ── Section components ────────────────────────────────────────────────────────
function WorkoutWeekSection({
  group,
  expanded,
  onToggle,
  colors,
}: {
  group: WorkoutWeekGroup;
  expanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[secStyles.container, { borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={[secStyles.header, { backgroundColor: colors.card }]}
      >
        <View style={secStyles.headerLeft}>
          <Text style={[secStyles.headerLabel, { color: colors.foreground }]}>
            {group.weekLabel}
          </Text>
          <View style={secStyles.metaRow}>
            <View style={secStyles.metaChip}>
              <Ionicons name="barbell-outline" size={11} color={colors.mutedForeground} />
              <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                {group.logs.length} workout{group.logs.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={secStyles.metaChip}>
              <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
              <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                {group.totalDuration}m
              </Text>
            </View>
            <View style={secStyles.metaChip}>
              <Ionicons name="flame-outline" size={11} color={colors.warning} />
              <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                {group.totalCalories} kcal
              </Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={17}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={[secStyles.logList, { backgroundColor: colors.background }]}>
          {group.logs.map((log) => (
            <WorkoutCard key={log.id} workout={log} />
          ))}
        </View>
      )}
    </View>
  );
}

function WorkoutMonthSection({
  group,
  expanded,
  onToggle,
  colors,
}: {
  group: WorkoutMonthGroup;
  expanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[secStyles.container, { borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.75}
        style={[secStyles.header, { backgroundColor: colors.card }]}
      >
        <View style={secStyles.headerLeft}>
          <Text style={[secStyles.headerLabel, { color: colors.foreground }]}>
            {group.monthLabel}
          </Text>
          <View style={secStyles.metaRow}>
            <View style={secStyles.metaChip}>
              <Ionicons name="barbell-outline" size={11} color={colors.mutedForeground} />
              <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                {group.logs.length} workout{group.logs.length !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={secStyles.metaChip}>
              <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
              <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                {group.totalDuration}m
              </Text>
            </View>
            <View style={secStyles.metaChip}>
              <Ionicons name="flame-outline" size={11} color={colors.warning} />
              <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                {group.totalCalories} kcal
              </Text>
            </View>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={17}
          color={colors.mutedForeground}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={[secStyles.logList, { backgroundColor: colors.background }]}>
          {group.logs.map((log) => (
            <WorkoutCard key={log.id} workout={log} />
          ))}
        </View>
      )}
    </View>
  );
}

const secStyles = StyleSheet.create({
  container: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 2 },
  header: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  headerLeft: { flex: 1, gap: 5 },
  headerLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  logList: { padding: 10, gap: 8 },
});

const LEVEL_COLORS: Record<ProgramItem["level"], string> = {
  beginner: "#2E8B57",
  intermediate: "#C9A84C",
  advanced: "#8B31C7",
};

const DEFAULT_PROGRAMS: ProgramItem[] = [
  {
    id: "default-prog-1",
    title: "8-Week Beginner Builder",
    description:
      "Build your fitness foundation with progressive training designed for beginners. Focuses on compound movements, proper form, and building a sustainable training habit from scratch.",
    level: "beginner",
    durationWeeks: 8,
    goals: ["Build Muscle", "Improve Fitness"],
    schedule: [
      {
        week: "1–2",
        phase: "Foundation",
        focus:
          "3 days/week. Learn the basics: Push day (chest, shoulders, triceps), Pull day (back, biceps), Legs & Core. Focus on technique over weight.",
      },
      {
        week: "3–4",
        phase: "Strength",
        focus:
          "3 days/week. Add weight weekly on Squat, Deadlift, Bench Press, and Overhead Press. Rest 2–3 minutes between sets.",
      },
      {
        week: "5–6",
        phase: "Hypertrophy",
        focus:
          "4 days/week. Upper/Lower split. Increase sets to 4×10–12. Add accessory work for weak points.",
      },
      {
        week: "7–8",
        phase: "Peak & Test",
        focus:
          "Max effort week followed by a deload. Test your 1-rep max on the main lifts to benchmark your progress.",
      },
    ],
    isActive: true,
  },
  {
    id: "default-prog-2",
    title: "12-Week Strength Power",
    description:
      "A serious strength program for intermediate trainees built around progressive overload on the big 4 lifts. Designed to maximise muscle mass and functional strength simultaneously.",
    level: "intermediate",
    durationWeeks: 12,
    goals: ["Build Muscle", "Increase Strength"],
    schedule: [
      {
        week: "1–3",
        phase: "Accumulation",
        focus:
          "4 days/week. High volume — 4×12 on all major compound lifts. Build work capacity and muscle endurance.",
      },
      {
        week: "4–6",
        phase: "Intensification",
        focus:
          "4 days/week. Moderate volume, higher intensity — 5×5. Focus on loading the bar and perfecting technique under fatigue.",
      },
      {
        week: "7–9",
        phase: "Realisation",
        focus:
          "5 days/week. Heavy singles, doubles, and triples. Peak strength expression on Squat, Bench, Deadlift, OHP.",
      },
      {
        week: "10–11",
        phase: "Peaking",
        focus:
          "Reduce volume by 40%. Maintain intensity. Sharpen the nervous system for maximum output. Priority sleep and nutrition.",
      },
      {
        week: "12",
        phase: "Test Week",
        focus:
          "1RM testing on Squat, Bench Press, Deadlift, and Overhead Press. Record your new personal records in RAIMZEAL.",
      },
    ],
    isActive: true,
  },
  {
    id: "default-prog-3",
    title: "6-Week Fat Loss Sprint",
    description:
      "High-intensity 6-week program combining resistance training and metabolic conditioning to maximise fat loss while preserving every kg of lean muscle. Caloric deficit required.",
    level: "intermediate",
    durationWeeks: 6,
    goals: ["Lose Weight", "Improve Endurance"],
    schedule: [
      {
        week: "1–2",
        phase: "Metabolic Base",
        focus:
          "4 days/week. Full-body circuit training + 20-minute steady-state cardio. Establish caloric deficit of 400–600 kcal/day.",
      },
      {
        week: "3–4",
        phase: "High Intensity",
        focus:
          "5 days/week. HIIT sessions 3× per week + strength circuits 2×. Protein at 2g per kg bodyweight to protect muscle.",
      },
      {
        week: "5–6",
        phase: "Sprint Finish",
        focus:
          "5 days/week. Superset strength training + LISS cardio on alternate days. Final push — track every meal in RAIMZEAL.",
      },
    ],
    isActive: true,
  },
];

export default function WorkoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutLogs } = useFitness();

  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [expandedProgramId, setExpandedProgramId] = useState<string | null>(null);
  const [customWorkouts, setCustomWorkouts] = useState<WorkoutTemplate[]>([]);
  const [enrolledProgram, setEnrolledProgram] = useState<EnrolledProgram | null>(null);
  const [enrollLoading, setEnrollLoading] = useState<string | null>(null);
  const [historyViewMode, setHistoryViewMode] = useState<HistoryViewMode>("week");
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const expandedInitRef = useRef(false);

  const weekGroups = useMemo(() => groupWorkoutsByWeek(workoutLogs), [workoutLogs]);
  const monthGroups = useMemo(() => groupWorkoutsByMonth(weekGroups), [weekGroups]);

  useEffect(() => {
    if (expandedInitRef.current || weekGroups.length === 0) return;
    expandedInitRef.current = true;
    setExpandedKeys(new Set(weekGroups.slice(0, 2).map((g) => g.weekKey)));
  }, [weekGroups]);

  function toggleKey(key: string) {
    Haptics.selectionAsync();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadCustomWorkouts().then(setCustomWorkouts);
    }, [])
  );

  useEffect(() => {
    if (activeTab === "programs") {
      if (programs.length === 0) loadPrograms();
      loadEnrolledProgram();
    }
  }, [activeTab]);

  async function loadPrograms() {
    setProgramsLoading(true);
    try {
      const remote = await fetchPrograms();
      setPrograms(remote.length > 0 ? remote : DEFAULT_PROGRAMS);
    } catch {
      setPrograms(DEFAULT_PROGRAMS);
    } finally {
      setProgramsLoading(false);
    }
  }

  async function loadEnrolledProgram() {
    const ep = await fetchEnrolledProgram().catch(() => null);
    setEnrolledProgram(ep);
  }

  function handleStartWorkout(workoutId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/workout-player", params: { workoutId } });
  }

  async function handleEnrollProgram(prog: ProgramItem) {
    if (enrollLoading) return;
    if (enrolledProgram && enrolledProgram.programId === prog.id) return;
    const doEnroll = async () => {
      setEnrollLoading(prog.id);
      try {
        const ep = await enrollProgram(prog.id, prog.title, prog);
        setEnrolledProgram(ep);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert("Error", "Could not enroll. Please try again.");
      } finally {
        setEnrollLoading(null);
      }
    };
    if (enrolledProgram) {
      Alert.alert(
        "Switch Program?",
        `You're currently enrolled in "${enrolledProgram.programName}". Switch to "${prog.title}"? Your current progress will be reset.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Switch", style: "destructive", onPress: doEnroll },
        ]
      );
    } else {
      await doEnroll();
    }
  }

  async function handleUnenroll() {
    Alert.alert(
      "Leave Program?",
      `Stop "${enrolledProgram?.programName}"? Your progress will be saved but the program will no longer be active.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            await unenrollProgram().catch(() => {});
            setEnrolledProgram(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Workouts
        </Text>
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["library", "programs", "history"] as ActiveTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(tab);
              }}
              style={[
                styles.tabBtn,
                activeTab === tab && { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      activeTab === tab
                        ? colors.foreground
                        : colors.mutedForeground,
                    fontFamily:
                      activeTab === tab ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {tab === "library" ? "Library" : tab === "programs" ? "Programs" : "History"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === "library" && (
        <ScrollView
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Build Workout button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/workout-builder");
            }}
            style={[styles.buildBtn, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
          >
            <View style={[styles.buildBtnIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.buildBtnText}>
              <Text style={[styles.templateName, { color: colors.primary }]}>Build Workout</Text>
              <Text style={[styles.templateMeta, { color: colors.primary + "99" }]}>Create your own custom workout</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </TouchableOpacity>

          {/* My Workouts */}
          {customWorkouts.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>My Workouts</Text>
              {customWorkouts.map((item) => (
                <TouchableOpacity
                  key={item.workoutId}
                  activeOpacity={0.8}
                  onPress={() => handleStartWorkout(item.workoutId)}
                  style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.templateIcon, { backgroundColor: "#10b981" + "20" }]}>
                    <Ionicons name={item.icon} size={24} color="#10b981" />
                  </View>
                  <View style={styles.templateInfo}>
                    <Text style={[styles.templateName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[styles.templateMeta, { color: colors.mutedForeground }]}>
                      {item.exercises.slice(0, 3).map((e) => e.name).join(" · ")}
                      {item.exercises.length > 3 ? ` +${item.exercises.length - 3}` : ""}
                    </Text>
                    <View style={styles.templateStats}>
                      <View style={styles.templateStat}>
                        <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>{item.duration}m</Text>
                      </View>
                      <View style={styles.templateStat}>
                        <Ionicons name="flame-outline" size={12} color={colors.warning} />
                        <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>~{item.calories} kcal</Text>
                      </View>
                    </View>
                  </View>
                  <View style={{ gap: 6, alignItems: "center" }}>
                    <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                      <Ionicons name="play" size={16} color={colors.primaryForeground} />
                    </View>
                    <TouchableOpacity
                      hitSlop={8}
                      onPress={() => {
                        Alert.alert("Delete Workout", `Delete "${item.name}"? This cannot be undone.`, [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              await deleteCustomWorkout(item.workoutId);
                              setCustomWorkouts((prev) => prev.filter((w) => w.workoutId !== item.workoutId));
                            },
                          },
                        ]);
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* Templates */}
          <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>Templates</Text>
          {WORKOUT_TEMPLATES.map((item) => (
            <TouchableOpacity
              key={item.workoutId}
              activeOpacity={0.8}
              onPress={() => handleStartWorkout(item.workoutId)}
              style={[styles.templateCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.templateIcon, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name={item.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.templateInfo}>
                <Text style={[styles.templateName, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.templateMeta, { color: colors.mutedForeground }]}>
                  {item.exercises.slice(0, 3).map((e) => e.name).join(" · ")}
                  {item.exercises.length > 3 ? ` +${item.exercises.length - 3}` : ""}
                </Text>
                <View style={styles.templateStats}>
                  <View style={styles.templateStat}>
                    <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>{item.duration}m</Text>
                  </View>
                  <View style={styles.templateStat}>
                    <Ionicons name="flame-outline" size={12} color={colors.warning} />
                    <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>~{item.calories} kcal</Text>
                  </View>
                </View>
              </View>
              <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="play" size={16} color={colors.primaryForeground} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {activeTab === "programs" && (
        programsLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Loading programs...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
              Structured training plans to guide your journey. Follow the weekly schedule and log your workouts.
            </Text>

            {/* ── Current Program card ── */}
            {enrolledProgram && (
              <View style={[styles.activeProgramCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "40" }]}>
                <View style={styles.activeProgramHeader}>
                  <View style={[styles.activeProgramBadge, { backgroundColor: colors.primary + "20" }]}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                    <Text style={[styles.activeProgramBadgeText, { color: colors.primary }]}>ACTIVE</Text>
                  </View>
                  <TouchableOpacity onPress={handleUnenroll} hitSlop={8}>
                    <Text style={[styles.unenrollText, { color: colors.destructive }]}>Leave</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.activeProgramName, { color: colors.foreground }]} numberOfLines={1}>
                  {enrolledProgram.programName}
                </Text>
                <Text style={[styles.activeProgramProgress, { color: colors.mutedForeground }]}>
                  Week {enrolledProgram.currentWeek} of {enrolledProgram.programData?.durationWeeks ?? "?"} · Day {enrolledProgram.currentDay} of 5
                </Text>
                {(() => {
                  const totalDays = (enrolledProgram.programData?.durationWeeks ?? 8) * 5;
                  const doneDays = (enrolledProgram.currentWeek - 1) * 5 + enrolledProgram.currentDay - 1;
                  const pct = Math.min(doneDays / totalDays, 1);
                  return (
                    <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${Math.round(pct * 100)}%` as unknown as number }]} />
                    </View>
                  );
                })()}
              </View>
            )}

            {programs.map((prog) => {
              const levelColor = LEVEL_COLORS[prog.level];
              const isExpanded = expandedProgramId === prog.id;
              const isActive = enrolledProgram?.programId === prog.id;
              return (
                <View
                  key={prog.id}
                  style={[
                    styles.programCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.programHeader}>
                    <View
                      style={[
                        styles.levelBadge,
                        { backgroundColor: levelColor + "20" },
                      ]}
                    >
                      <Text
                        style={[styles.levelBadgeText, { color: levelColor }]}
                      >
                        {prog.level.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.programDuration}>
                      <Ionicons
                        name="calendar-outline"
                        size={12}
                        color={colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.programDurationText,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {prog.durationWeeks} weeks
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.programTitle, { color: colors.foreground }]}>
                    {prog.title}
                  </Text>

                  <Text
                    style={[
                      styles.programDescription,
                      { color: colors.mutedForeground },
                    ]}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    {prog.description}
                  </Text>

                  {prog.goals && prog.goals.length > 0 && (
                    <View style={styles.goalChips}>
                      {prog.goals.map((g) => (
                        <View
                          key={g}
                          style={[
                            styles.goalChip,
                            { backgroundColor: colors.muted, borderColor: colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.goalChipText,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {g}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {prog.schedule && prog.schedule.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.selectionAsync();
                        setExpandedProgramId(isExpanded ? null : prog.id);
                      }}
                      style={[
                        styles.scheduleToggle,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scheduleToggleText,
                          { color: colors.primary },
                        ]}
                      >
                        {isExpanded ? "Hide Schedule" : "View Schedule"}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                  )}

                  {isExpanded && prog.schedule && (
                    <View
                      style={[
                        styles.scheduleList,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      {(prog.schedule as ProgramWeek[]).map((s, i) => (
                        <View
                          key={i}
                          style={[
                            styles.scheduleItem,
                            i < prog.schedule!.length - 1 && {
                              borderBottomWidth: 1,
                              borderBottomColor: colors.border,
                            },
                          ]}
                        >
                          <View style={styles.scheduleWeek}>
                            <Text
                              style={[
                                styles.scheduleWeekText,
                                { color: levelColor },
                              ]}
                            >
                              Week {s.week}
                            </Text>
                            <Text
                              style={[
                                styles.schedulePhaseBadge,
                                { color: colors.foreground },
                              ]}
                            >
                              {s.phase}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.scheduleFocus,
                              { color: colors.mutedForeground },
                            ]}
                          >
                            {s.focus}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    onPress={() => handleEnrollProgram(prog)}
                    disabled={isActive || enrollLoading === prog.id}
                    style={[
                      styles.enrollBtn,
                      { backgroundColor: isActive ? colors.primary + "60" : levelColor },
                    ]}
                  >
                    {enrollLoading === prog.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name={isActive ? "checkmark-circle-outline" : "rocket-outline"} size={16} color="#fff" />
                    )}
                    <Text style={styles.enrollBtnText}>
                      {isActive ? "Active" : "Start Program"}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {activeTab === "history" && (
        workoutLogs.length === 0 ? (
          <View style={[styles.emptyState, { flex: 1 }]}>
            <Ionicons name="barbell-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No workouts yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>Start a workout from the library</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Week / Month toggle */}
            <View style={[styles.historyToggleRow, { backgroundColor: colors.muted }]}>
              {(["week", "month"] as HistoryViewMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setHistoryViewMode(mode);
                  }}
                  style={[
                    styles.historyToggleBtn,
                    historyViewMode === mode && { backgroundColor: colors.card },
                  ]}
                >
                  <Text
                    style={[
                      styles.historyToggleLabel,
                      {
                        color: historyViewMode === mode ? colors.foreground : colors.mutedForeground,
                        fontFamily: historyViewMode === mode ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {mode === "week" ? "By Week" : "By Month"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {historyViewMode === "week"
              ? weekGroups.map((group) => (
                  <WorkoutWeekSection
                    key={group.weekKey}
                    group={group}
                    expanded={expandedKeys.has(group.weekKey)}
                    onToggle={() => toggleKey(group.weekKey)}
                    colors={colors}
                  />
                ))
              : monthGroups.map((group) => (
                  <WorkoutMonthSection
                    key={group.monthKey}
                    group={group}
                    expanded={expandedKeys.has(group.monthKey)}
                    onToggle={() => toggleKey(group.monthKey)}
                    colors={colors}
                  />
                ))}
          </ScrollView>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  tabRow: { flexDirection: "row", borderRadius: 10, padding: 3 },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  tabLabel: { fontSize: 13 },
  listContent: { padding: 16, gap: 12 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 4,
  },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 2,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  templateInfo: { flex: 1, gap: 4 },
  templateName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  templateMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  templateStats: { flexDirection: "row", gap: 12, marginTop: 2 },
  templateStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  templateStatText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  startBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  programCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 2,
  },
  programHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    paddingBottom: 8,
  },
  levelBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  programDuration: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
  },
  programDurationText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  programTitle: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  programDescription: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  goalChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  goalChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  goalChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  scheduleToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  scheduleToggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  scheduleList: { borderTopWidth: 1 },
  scheduleItem: { padding: 14, gap: 5 },
  scheduleWeek: { flexDirection: "row", alignItems: "center", gap: 10 },
  scheduleWeekText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  schedulePhaseBadge: { fontSize: 13, fontFamily: "SpaceGrotesk_600SemiBold" },
  scheduleFocus: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  enrollBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    margin: 14,
    marginTop: 12,
    paddingVertical: 13,
    borderRadius: 12,
  },
  enrollBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtext: { fontSize: 14, fontFamily: "Inter_400Regular" },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  buildBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    gap: 12,
    marginBottom: 2,
  },
  buildBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buildBtnText: { flex: 1, gap: 3 },
  activeProgramCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    gap: 6,
    marginBottom: 4,
  },
  activeProgramHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeProgramBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  activeProgramBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
  unenrollText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  activeProgramName: {
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  activeProgramProgress: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  historyToggleRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  historyToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  historyToggleLabel: { fontSize: 13 },
});
