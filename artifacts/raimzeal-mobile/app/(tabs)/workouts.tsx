import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  topMuscleGroup: string | null;
};

type WorkoutMonthGroup = {
  monthKey: string;
  monthLabel: string;
  logs: WorkoutLog[];
  totalDuration: number;
  totalCalories: number;
  weekGroups: WorkoutWeekGroup[];
};

// Flat item discriminated union — drives the virtualized FlatList
type FlatItem =
  | { type: "weekHeader"; group: WorkoutWeekGroup }
  | { type: "monthHeader"; group: WorkoutMonthGroup }
  | { type: "weekSubHeader"; group: WorkoutWeekGroup }
  | { type: "log"; log: WorkoutLog; indented: boolean };

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

// Keyword → muscle-group mapping (ordered most-specific first).
// Matches exercise names by substring so custom names like "Barbell Squat" still resolve.
const MUSCLE_KEYWORDS: [string, string][] = [
  // Chest
  ["bench press", "Chest"], ["push-up", "Chest"], ["push up", "Chest"],
  ["pushup", "Chest"], ["chest fly", "Chest"], ["chest press", "Chest"],
  ["incline press", "Chest"], ["decline press", "Chest"], ["pec", "Chest"],
  // Back
  ["deadlift", "Back"], ["pull-up", "Back"], ["pull up", "Back"],
  ["pullup", "Back"], ["chin-up", "Back"], ["chin up", "Back"],
  ["lat pull", "Back"], ["back ext", "Back"],
  // Back (must come after "overhead press" / "bench press" checks)
  ["row", "Back"],
  // Shoulders
  ["shoulder press", "Shoulders"], ["overhead press", "Shoulders"],
  ["lateral raise", "Shoulders"], ["front raise", "Shoulders"],
  ["arnold", "Shoulders"], ["military press", "Shoulders"],
  // Arms
  ["bicep", "Arms"], ["tricep", "Arms"], ["dip", "Arms"],
  ["curl", "Arms"], ["skull crush", "Arms"],
  // Legs
  ["squat", "Legs"], ["lunge", "Legs"], ["leg press", "Legs"],
  ["leg ext", "Legs"], ["leg curl", "Legs"], ["calf", "Legs"],
  ["hip thrust", "Legs"], ["glute", "Legs"], ["box jump", "Legs"],
  ["step up", "Legs"],
  // Core
  ["plank", "Core"], ["crunch", "Core"], ["sit-up", "Core"],
  ["sit up", "Core"], ["leg raise", "Core"], ["russian twist", "Core"],
  ["mountain climb", "Core"], ["flutter", "Core"], [" ab ", "Core"],
  // Cardio
  ["burpee", "Cardio"], ["jump rope", "Cardio"], ["sprint", "Cardio"],
  ["cycling", "Cardio"], ["elliptical", "Cardio"], ["cardio", "Cardio"],
  ["walk", "Cardio"],
  // Recovery
  ["yoga", "Recovery"], ["foam roll", "Recovery"],
  ["stretch", "Recovery"], ["mobility", "Recovery"],
];

function exerciseToMuscleGroup(name: string): string {
  const lower = name.toLowerCase();
  for (const [kw, mg] of MUSCLE_KEYWORDS) {
    if (lower.includes(kw)) return mg;
  }
  return "Other";
}

function computeTopMuscleGroup(logs: WorkoutLog[]): string | null {
  const counts = new Map<string, number>();
  for (const log of logs) {
    for (const ex of log.exercises) {
      const mg = exerciseToMuscleGroup(ex.name);
      counts.set(mg, (counts.get(mg) ?? 0) + ex.sets);
    }
  }
  if (counts.size === 0) return null;
  let top = "";
  let max = 0;
  counts.forEach((n, mg) => { if (n > max) { max = n; top = mg; } });
  return top || null;
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
      const sorted = [...weekLogs].sort((a, b) => (a.date > b.date ? -1 : 1));
      return {
        weekKey,
        weekLabel: `Week of ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`,
        startDate: weekKey,
        endDate: endD.toISOString().split("T")[0],
        logs: sorted,
        totalDuration: weekLogs.reduce((s, l) => s + l.duration, 0),
        totalCalories: weekLogs.reduce((s, l) => s + l.caloriesBurned, 0),
        topMuscleGroup: computeTopMuscleGroup(weekLogs),
      };
    });
}

function groupWorkoutsByMonth(wkGroups: WorkoutWeekGroup[]): WorkoutMonthGroup[] {
  // Key each week by the month of its Monday (startDate), not its end date,
  // so cross-month weeks land in the month where most of their days fall.
  const map = new Map<string, WorkoutWeekGroup[]>();
  for (const wg of wkGroups) {
    const mk = wg.startDate.slice(0, 7);
    if (!map.has(mk)) map.set(mk, []);
    map.get(mk)!.push(wg);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : 1))
    .map(([monthKey, mWeeks]) => {
      const allLogs = mWeeks.flatMap((w) => w.logs);
      const [yr, mo] = monthKey.split("-");
      return {
        monthKey,
        monthLabel: `${MONTH_LONG[parseInt(mo) - 1]} ${yr}`,
        logs: allLogs,
        totalDuration: allLogs.reduce((s, l) => s + l.duration, 0),
        totalCalories: allLogs.reduce((s, l) => s + l.caloriesBurned, 0),
        weekGroups: mWeeks,
      };
    });
}

const LEVEL_COLORS: Record<ProgramItem["level"], string> = {
  beginner: "#2E8B57",
  intermediate: "#C9A84C",
  advanced: "#8B31C7",
};

const secStyles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 4,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 4,
  },
  weekSubHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 4,
    marginLeft: 12,
  },
  headerLeft: { flex: 1, gap: 5 },
  headerLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  monthLabel: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold" },
  subHeaderLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  indentedLog: { marginLeft: 12 },
});

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

// ── Library search/filter constants ──────────────────────────────────────────
const LIBRARY_MUSCLE_GROUPS = [
  "Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Full Body",
] as const;

function getTemplateMuscles(exercises: { name: string }[]): Set<string> {
  const s = new Set<string>();
  for (const ex of exercises) {
    const mg = exerciseToMuscleGroup(ex.name);
    if (mg !== "Other") s.add(mg);
  }
  return s;
}

function HighlightText({
  text,
  query,
  style,
  highlightColor,
  numberOfLines,
}: {
  text: string;
  query: string;
  style: object | object[];
  highlightColor: string;
  numberOfLines?: number;
}) {
  if (!query.trim()) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {text.slice(0, idx)}
      <Text style={[style, { color: highlightColor, fontFamily: "Inter_700Bold" }]}>
        {text.slice(idx, idx + query.length)}
      </Text>
      {text.slice(idx + query.length)}
    </Text>
  );
}

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

  // ── Library search / filter ──────────────────────────────────────────────
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const weekGroups = useMemo(() => groupWorkoutsByWeek(workoutLogs), [workoutLogs]);
  const monthGroups = useMemo(() => groupWorkoutsByMonth(weekGroups), [weekGroups]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(librarySearch), 150);
    return () => clearTimeout(t);
  }, [librarySearch]);

  const filteredTemplates = useMemo(() => {
    return WORKOUT_TEMPLATES.filter((item) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const exMatch = item.exercises.some((e) => e.name.toLowerCase().includes(q));
        if (!nameMatch && !exMatch) return false;
      }
      if (selectedMuscles.length > 0) {
        const muscles = getTemplateMuscles(item.exercises);
        const isFullBody = muscles.size >= 4;
        const matched = selectedMuscles.some((m) =>
          m === "Full Body" ? isFullBody : muscles.has(m)
        );
        if (!matched) return false;
      }
      return true;
    });
  }, [debouncedSearch, selectedMuscles]);

  const filteredCustom = useMemo(() => {
    return customWorkouts.filter((item) => {
      if (debouncedSearch) {
        const q = debouncedSearch.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(q);
        const exMatch = item.exercises.some((e) => e.name.toLowerCase().includes(q));
        if (!nameMatch && !exMatch) return false;
      }
      if (selectedMuscles.length > 0) {
        const muscles = getTemplateMuscles(item.exercises);
        const isFullBody = muscles.size >= 4;
        const matched = selectedMuscles.some((m) =>
          m === "Full Body" ? isFullBody : muscles.has(m)
        );
        if (!matched) return false;
      }
      return true;
    });
  }, [debouncedSearch, selectedMuscles, customWorkouts]);

  const flatItems = useMemo((): FlatItem[] => {
    if (historyViewMode === "week") {
      const items: FlatItem[] = [];
      for (const g of weekGroups) {
        items.push({ type: "weekHeader", group: g });
        if (expandedKeys.has(g.weekKey)) {
          for (const log of g.logs) items.push({ type: "log", log, indented: false });
        }
      }
      return items;
    } else {
      const items: FlatItem[] = [];
      for (const mg of monthGroups) {
        items.push({ type: "monthHeader", group: mg });
        if (expandedKeys.has(mg.monthKey)) {
          for (const wg of mg.weekGroups) {
            items.push({ type: "weekSubHeader", group: wg });
            if (expandedKeys.has(wg.weekKey)) {
              for (const log of wg.logs) items.push({ type: "log", log, indented: true });
            }
          }
        }
      }
      return items;
    }
  }, [historyViewMode, weekGroups, monthGroups, expandedKeys]);

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

  function toggleMuscle(mg: string) {
    Haptics.selectionAsync();
    setSelectedMuscles((prev) =>
      prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]
    );
  }

  function clearLibraryFilters() {
    setLibrarySearch("");
    setSelectedMuscles([]);
    setDebouncedSearch("");
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
        if (!ep) throw new Error("Enrollment returned null");
        setEnrolledProgram(ep);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert("Error", "Could not start program. Please ensure you are signed in and try again.");
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
          keyboardShouldPersistTaps="handled"
        >
          {/* Search bar */}
          <View style={[libStyles.searchContainer, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
            <TextInput
              value={librarySearch}
              onChangeText={setLibrarySearch}
              placeholder="Search workouts & exercises…"
              placeholderTextColor={colors.mutedForeground}
              style={[libStyles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {librarySearch.length > 0 && (
              <TouchableOpacity onPress={() => setLibrarySearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Muscle group filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={libStyles.chipRow}
          >
            {LIBRARY_MUSCLE_GROUPS.map((mg) => {
              const active = selectedMuscles.includes(mg);
              return (
                <TouchableOpacity
                  key={mg}
                  onPress={() => toggleMuscle(mg)}
                  activeOpacity={0.7}
                  style={[
                    libStyles.chip,
                    {
                      backgroundColor: active ? colors.primary : colors.muted,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[libStyles.chipText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                    {mg}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Outdoor Workout button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/outdoor-workout");
            }}
            style={[styles.buildBtn, { backgroundColor: "#10b98115", borderColor: "#10b98140" }]}
          >
            <View style={[styles.buildBtnIcon, { backgroundColor: "#10b98120" }]}>
              <Ionicons name="location-outline" size={22} color="#10b981" />
            </View>
            <View style={styles.buildBtnText}>
              <Text style={[styles.templateName, { color: "#10b981" }]}>Outdoor Workout</Text>
              <Text style={[styles.templateMeta, { color: "#10b98199" }]}>GPS run, walk or cycle tracker</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#10b981" />
          </TouchableOpacity>

          {/* Rep Counter button */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/rep-counter");
            }}
            style={[styles.buildBtn, { backgroundColor: "#8b5cf615", borderColor: "#8b5cf640" }]}
          >
            <View style={[styles.buildBtnIcon, { backgroundColor: "#8b5cf620" }]}>
              <Ionicons name="fitness-outline" size={22} color="#8b5cf6" />
            </View>
            <View style={styles.buildBtnText}>
              <Text style={[styles.templateName, { color: "#8b5cf6" }]}>Rep Counter</Text>
              <Text style={[styles.templateMeta, { color: "#8b5cf699" }]}>Motion sensor counts your reps</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8b5cf6" />
          </TouchableOpacity>

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

          {/* Empty state when no results */}
          {(debouncedSearch || selectedMuscles.length > 0) &&
           filteredCustom.length === 0 && filteredTemplates.length === 0 ? (
            <View style={libStyles.emptyState}>
              <Ionicons name="search-outline" size={44} color={colors.mutedForeground} />
              <Text style={[libStyles.emptyTitle, { color: colors.foreground }]}>No workouts match</Text>
              <Text style={[libStyles.emptySubtitle, { color: colors.mutedForeground }]}>
                Try a different search term or muscle group
              </Text>
              <TouchableOpacity
                onPress={clearLibraryFilters}
                style={[libStyles.clearBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[libStyles.clearBtnText, { color: colors.primaryForeground }]}>Clear filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* My Workouts */}
              {filteredCustom.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>My Workouts</Text>
                  {filteredCustom.map((item) => (
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
                        <HighlightText
                          text={item.name}
                          query={debouncedSearch}
                          style={[styles.templateName, { color: colors.foreground }]}
                          highlightColor={colors.primary}
                        />
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
              {filteredTemplates.length > 0 && (
                <>
                  <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>Templates</Text>
                  {filteredTemplates.map((item) => (
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
                        <HighlightText
                          text={item.name}
                          query={debouncedSearch}
                          style={[styles.templateName, { color: colors.foreground }]}
                          highlightColor={colors.primary}
                        />
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
                </>
              )}
            </>
          )}
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
        <FlatList
          data={workoutLogs.length === 0 ? [] : flatItems}
          keyExtractor={(item, idx) => {
            if (item.type === "weekHeader") return "wh-" + item.group.weekKey;
            if (item.type === "monthHeader") return "mh-" + item.group.monthKey;
            if (item.type === "weekSubHeader") return "ws-" + item.group.weekKey;
            return "log-" + item.log.id + "-" + idx;
          }}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            workoutLogs.length > 0 ? (
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
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No workouts yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>Start a workout from the library</Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === "weekHeader") {
              const g = item.group;
              const expanded = expandedKeys.has(g.weekKey);
              return (
                <TouchableOpacity
                  onPress={() => toggleKey(g.weekKey)}
                  activeOpacity={0.75}
                  style={[secStyles.sectionHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={secStyles.headerLeft}>
                    <Text style={[secStyles.headerLabel, { color: colors.foreground }]}>{g.weekLabel}</Text>
                    <View style={secStyles.metaRow}>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="barbell-outline" size={11} color={colors.mutedForeground} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                          {g.logs.length} workout{g.logs.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>{g.totalDuration}m</Text>
                      </View>
                      {g.topMuscleGroup && (
                        <View style={secStyles.metaChip}>
                          <Ionicons name="body-outline" size={11} color={colors.mutedForeground} />
                          <Text style={[secStyles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {g.topMuscleGroup}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            }
            if (item.type === "monthHeader") {
              const g = item.group;
              const expanded = expandedKeys.has(g.monthKey);
              return (
                <TouchableOpacity
                  onPress={() => toggleKey(g.monthKey)}
                  activeOpacity={0.75}
                  style={[secStyles.monthHeader, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "35" }]}
                >
                  <View style={secStyles.headerLeft}>
                    <Text style={[secStyles.monthLabel, { color: colors.foreground }]}>{g.monthLabel}</Text>
                    <View style={secStyles.metaRow}>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="barbell-outline" size={11} color={colors.mutedForeground} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                          {g.logs.length} workout{g.logs.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="time-outline" size={11} color={colors.mutedForeground} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>{g.totalDuration}m</Text>
                      </View>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="flame-outline" size={11} color={colors.warning} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>{g.totalCalories} kcal</Text>
                      </View>
                    </View>
                  </View>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={colors.primary} />
                </TouchableOpacity>
              );
            }
            if (item.type === "weekSubHeader") {
              const g = item.group;
              const expanded = expandedKeys.has(g.weekKey);
              return (
                <TouchableOpacity
                  onPress={() => toggleKey(g.weekKey)}
                  activeOpacity={0.75}
                  style={[secStyles.weekSubHeader, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={secStyles.headerLeft}>
                    <Text style={[secStyles.subHeaderLabel, { color: colors.foreground }]}>{g.weekLabel}</Text>
                    <View style={secStyles.metaRow}>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="barbell-outline" size={10} color={colors.mutedForeground} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>
                          {g.logs.length} workout{g.logs.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                      <View style={secStyles.metaChip}>
                        <Ionicons name="time-outline" size={10} color={colors.mutedForeground} />
                        <Text style={[secStyles.metaText, { color: colors.mutedForeground }]}>{g.totalDuration}m</Text>
                      </View>
                      {g.topMuscleGroup && (
                        <View style={secStyles.metaChip}>
                          <Ionicons name="body-outline" size={10} color={colors.mutedForeground} />
                          <Text style={[secStyles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {g.topMuscleGroup}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={15} color={colors.mutedForeground} />
                </TouchableOpacity>
              );
            }
            // type === "log"
            return (
              <View style={item.indented ? secStyles.indentedLog : undefined}>
                <WorkoutCard workout={item.log} />
              </View>
            );
          }}
        />
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

const libStyles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  chipRow: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  clearBtn: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
