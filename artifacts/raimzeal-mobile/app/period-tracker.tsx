import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { BBTChart, BBTPoint } from "@/components/BBTChart";
import { FeatureDisclaimerModal, type FeatureDisclaimerConfig } from "@/components/FeatureDisclaimerModal";

const PERIOD_DISCLAIMER: FeatureDisclaimerConfig = {
  storageKey: "@raimzeal_period_disclaimer_seen",
  icon: "rose-outline",
  iconColor: "#ec4899",
  title: "Period & Cycle Tracker",
  body:
    "This tracker is for personal wellness awareness only.\n\n" +
    "Cycle predictions are estimates based on your logged data and are NOT accurate enough to be used as a contraceptive method. RAIMZEAL does not provide fertility or reproductive medical advice.\n\n" +
    "For medical concerns about your cycle, please consult a licensed OB/GYN or gynaecologist.",
  acceptLabel: "I understand — continue",
};

const STORAGE_KEY = "@raimzeal_period_tracker_v1";
const ACCENT = "#ec4899";

type FlowIntensity = "spotting" | "light" | "medium" | "heavy";
type Symptom =
  | "cramps"
  | "bloating"
  | "headache"
  | "fatigue"
  | "mood_swings"
  | "back_pain"
  | "tender_breasts"
  | "acne"
  | "nausea"
  | "insomnia";

interface DayLog {
  date: string;
  flow?: FlowIntensity;
  symptoms: Symptom[];
  bbt?: number;
}

interface CycleEntry {
  id: string;
  startDate: string;
  endDate?: string;
  dayLogs: DayLog[];
}

interface TrackerData {
  cycles: CycleEntry[];
  avgCycleLength: number;
  avgPeriodLength: number;
}

const DEFAULT_DATA: TrackerData = {
  cycles: [],
  avgCycleLength: 28,
  avgPeriodLength: 5,
};

const FLOW_LABELS: Record<FlowIntensity, string> = {
  spotting: "Spotting",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};

const FLOW_COLORS: Record<FlowIntensity, string> = {
  spotting: "#fda4af",
  light: "#fb7185",
  medium: "#f43f5e",
  heavy: "#be123c",
};

const SYMPTOM_LIST: { id: Symptom; label: string; icon: string }[] = [
  { id: "cramps", label: "Cramps", icon: "flash-outline" },
  { id: "bloating", label: "Bloating", icon: "ellipse-outline" },
  { id: "headache", label: "Headache", icon: "medical-outline" },
  { id: "fatigue", label: "Fatigue", icon: "battery-dead-outline" },
  { id: "mood_swings", label: "Mood swings", icon: "happy-outline" },
  { id: "back_pain", label: "Back pain", icon: "body-outline" },
  { id: "tender_breasts", label: "Tender breasts", icon: "heart-outline" },
  { id: "acne", label: "Acne", icon: "sparkles-outline" },
  { id: "nausea", label: "Nausea", icon: "cloudy-outline" },
  { id: "insomnia", label: "Insomnia", icon: "moon-outline" },
];

function toKey(d: Date) {
  return d.toISOString().split("T")[0];
}

function parseDate(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function addDays(s: string, n: number): string {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (parseDate(b).getTime() - parseDate(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatDisplay(s: string): string {
  return parseDate(s).toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(s: string): string {
  return parseDate(s).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function buildCalendarDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells: (string | null)[] = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(toKey(new Date(year, month, d)));
  }
  return cells;
}

function computeAvgCycle(cycles: CycleEntry[]): number {
  const lengths: number[] = [];
  for (let i = 1; i < cycles.length; i++) {
    lengths.push(daysBetween(cycles[i - 1].startDate, cycles[i].startDate));
  }
  if (!lengths.length) return 28;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

function computeAvgPeriod(cycles: CycleEntry[]): number {
  const lengths = cycles
    .filter((c) => c.endDate)
    .map((c) => daysBetween(c.startDate, c.endDate!) + 1);
  if (!lengths.length) return 5;
  return Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
}

export default function PeriodTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<TrackerData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);

  const today = toKey(new Date());
  const calNow = new Date();
  const [calYear, setCalYear] = useState(calNow.getFullYear());
  const [calMonth, setCalMonth] = useState(calNow.getMonth());

  const [logModalDate, setLogModalDate] = useState<string | null>(null);
  const [logFlow, setLogFlow] = useState<FlowIntensity | undefined>(undefined);
  const [logSymptoms, setLogSymptoms] = useState<Symptom[]>([]);
  const [logBBT, setLogBBT] = useState("");

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [inputCycleLen, setInputCycleLen] = useState("28");
  const [inputPeriodLen, setInputPeriodLen] = useState("5");

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setData(JSON.parse(raw));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = useCallback(async (next: TrackerData) => {
    setData(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const activeCycle = data.cycles[data.cycles.length - 1];
  const isOnPeriod =
    activeCycle &&
    !activeCycle.endDate &&
    daysBetween(activeCycle.startDate, today) < 15;

  const nextPeriodDate = (() => {
    if (!activeCycle) return null;
    const base = activeCycle.startDate;
    return addDays(base, data.avgCycleLength);
  })();

  const ovulationDate = (() => {
    if (!nextPeriodDate) return null;
    return addDays(nextPeriodDate, -14);
  })();

  const fertileStart = ovulationDate ? addDays(ovulationDate, -5) : null;
  const fertileEnd = ovulationDate ? addDays(ovulationDate, 1) : null;

  const daysUntilNext = nextPeriodDate ? daysBetween(today, nextPeriodDate) : null;

  const periodSet = new Set<string>();
  const fertileSet = new Set<string>();
  const ovulationSet = new Set<string>();

  for (const c of data.cycles) {
    const end =
      c.endDate ?? addDays(c.startDate, data.avgPeriodLength - 1);
    let d = c.startDate;
    while (d <= end) {
      periodSet.add(d);
      d = addDays(d, 1);
    }
  }
  if (nextPeriodDate) {
    let d = nextPeriodDate;
    for (let i = 0; i < data.avgPeriodLength; i++) {
      periodSet.add(d);
      d = addDays(d, 1);
    }
  }
  if (fertileStart && fertileEnd) {
    let d = fertileStart;
    while (d <= fertileEnd) {
      fertileSet.add(d);
      d = addDays(d, 1);
    }
  }
  if (ovulationDate) ovulationSet.add(ovulationDate);

  function getDayLog(date: string): DayLog | undefined {
    for (const c of data.cycles) {
      const found = c.dayLogs.find((l) => l.date === date);
      if (found) return found;
    }
    return undefined;
  }

  function openLogModal(date: string) {
    const existing = getDayLog(date);
    setLogFlow(existing?.flow);
    setLogSymptoms(existing?.symptoms ?? []);
    setLogBBT(existing?.bbt != null ? String(existing.bbt) : "");
    setLogModalDate(date);
  }

  function startPeriod() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newCycle: CycleEntry = {
      id: Date.now().toString(),
      startDate: today,
      dayLogs: [{ date: today, symptoms: [] }],
    };
    const next: TrackerData = {
      ...data,
      cycles: [...data.cycles, newCycle],
    };
    next.avgCycleLength = computeAvgCycle(next.cycles);
    next.avgPeriodLength = computeAvgPeriod(next.cycles);
    save(next);
  }

  function endPeriod() {
    if (!activeCycle || activeCycle.endDate) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = { ...activeCycle, endDate: today };
    const cycles = [...data.cycles.slice(0, -1), updated];
    const next: TrackerData = { ...data, cycles };
    next.avgCycleLength = computeAvgCycle(cycles);
    next.avgPeriodLength = computeAvgPeriod(cycles);
    save(next);
  }

  function confirmStartPeriod() {
    if (activeCycle && !activeCycle.endDate) {
      Alert.alert(
        "Period already active",
        "You have an ongoing period. End it first.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert("Start period?", `Log today (${formatDisplay(today)}) as day 1?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Start", onPress: startPeriod },
    ]);
  }

  function confirmEndPeriod() {
    Alert.alert("End period?", `Log today (${formatDisplay(today)}) as the last day?`, [
      { text: "Cancel", style: "cancel" },
      { text: "End", onPress: endPeriod },
    ]);
  }

  function saveLog() {
    if (!logModalDate) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let cycles = [...data.cycles];
    let targetIdx = cycles.findIndex(
      (c) =>
        logModalDate >= c.startDate &&
        (!c.endDate || logModalDate <= c.endDate)
    );

    if (targetIdx === -1) {
      const newCycle: CycleEntry = {
        id: Date.now().toString(),
        startDate: logModalDate,
        dayLogs: [],
      };
      cycles = [...cycles, newCycle].sort((a, b) =>
        a.startDate.localeCompare(b.startDate)
      );
      targetIdx = cycles.findIndex((c) => c.startDate === logModalDate);
    }

    const cycle = { ...cycles[targetIdx] };
    const existingIdx = cycle.dayLogs.findIndex((l) => l.date === logModalDate);
    const bbtNum = parseFloat(logBBT);
    const newLog: DayLog = {
      date: logModalDate,
      flow: logFlow,
      symptoms: logSymptoms,
      bbt: !isNaN(bbtNum) && bbtNum > 30 && bbtNum < 45 ? bbtNum : undefined,
    };
    if (existingIdx >= 0) {
      cycle.dayLogs = [...cycle.dayLogs];
      cycle.dayLogs[existingIdx] = newLog;
    } else {
      cycle.dayLogs = [...cycle.dayLogs, newLog];
    }
    cycles[targetIdx] = cycle;

    const next: TrackerData = { ...data, cycles };
    next.avgCycleLength = computeAvgCycle(cycles);
    next.avgPeriodLength = computeAvgPeriod(cycles);
    save(next);
    setLogModalDate(null);
  }

  function toggleSymptom(s: Symptom) {
    setLogSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  const calDays = buildCalendarDays(calYear, calMonth);

  const currentCycleDay = activeCycle && !activeCycle.endDate
    ? daysBetween(activeCycle.startDate, today) + 1
    : null;

  const bbtPoints = useMemo<BBTPoint[]>(() => {
    if (!activeCycle) return [];
    return activeCycle.dayLogs
      .filter((l): l is typeof l & { bbt: number } => l.bbt != null && l.bbt > 30)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((l) => ({
        date: l.date,
        cycleDay: daysBetween(activeCycle.startDate, l.date) + 1,
        bbt: l.bbt,
      }));
  }, [activeCycle]);

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="flower-outline" size={40} color={ACCENT} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FeatureDisclaimerModal config={PERIOD_DISCLAIMER} />
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Period Tracker</Text>
        </View>
        <TouchableOpacity onPress={() => {
          setInputCycleLen(String(data.avgCycleLength));
          setInputPeriodLen(String(data.avgPeriodLength));
          setSettingsVisible(true);
        }} style={styles.settingsBtn}>
          <Ionicons name="settings-outline" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status card */}
        <View style={[styles.statusCard, { backgroundColor: ACCENT + "18", borderColor: ACCENT + "40" }]}>
          <View style={[styles.statusIcon, { backgroundColor: ACCENT + "25" }]}>
            <Ionicons name="flower" size={28} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            {isOnPeriod ? (
              <>
                <Text style={[styles.statusTitle, { color: ACCENT }]}>Period in progress</Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  Day {currentCycleDay} · started {formatDisplay(activeCycle.startDate)}
                </Text>
              </>
            ) : daysUntilNext !== null && daysUntilNext >= 0 ? (
              <>
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>
                  {daysUntilNext === 0 ? "Period expected today" : `Period in ${daysUntilNext} day${daysUntilNext !== 1 ? "s" : ""}`}
                </Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  Expected {formatDisplay(nextPeriodDate!)}
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.statusTitle, { color: colors.foreground }]}>No cycle data yet</Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  Tap "Start Period" to begin tracking
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Cycle summary row */}
        {data.cycles.length > 0 && (
          <View style={styles.statsRow}>
            {[
              { label: "Cycle length", value: `${data.avgCycleLength}d`, icon: "repeat-outline" },
              { label: "Period length", value: `${data.avgPeriodLength}d`, icon: "calendar-outline" },
              { label: "Cycles logged", value: String(data.cycles.length), icon: "list-outline" },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name={s.icon as any} size={18} color={ACCENT} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Fertile window card */}
        {fertileStart && fertileEnd && (
          <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Ionicons name="leaf-outline" size={18} color="#10b981" />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Fertile window</Text>
              <Text style={[styles.infoValue, { color: "#10b981" }]}>
                {formatDisplay(fertileStart)} – {formatDisplay(fertileEnd)}
              </Text>
            </View>
            {ovulationDate && (
              <View style={[styles.infoRow, { marginTop: 8 }]}>
                <Ionicons name="sunny-outline" size={18} color="#f59e0b" />
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Ovulation</Text>
                <Text style={[styles.infoValue, { color: "#f59e0b" }]}>{formatDisplay(ovulationDate)}</Text>
              </View>
            )}
            <Text style={[styles.infoNote, { color: colors.mutedForeground }]}>
              Estimates only — based on a {data.avgCycleLength}-day cycle
            </Text>
          </View>
        )}

        {/* Calendar */}
        <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.calHeader}>
            <TouchableOpacity onPress={() => {
              const d = new Date(calYear, calMonth - 1);
              setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
            }} hitSlop={12}>
              <Ionicons name="chevron-back" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[styles.calMonthLabel, { color: colors.foreground }]}>
              {new Date(calYear, calMonth).toLocaleDateString("en", { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity onPress={() => {
              const d = new Date(calYear, calMonth + 1);
              setCalYear(d.getFullYear()); setCalMonth(d.getMonth());
            }} hitSlop={12}>
              <Ionicons name="chevron-forward" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={styles.calWeekRow}>
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <Text key={d} style={[styles.calWeekLabel, { color: colors.mutedForeground }]}>{d}</Text>
            ))}
          </View>

          <View style={styles.calGrid}>
            {calDays.map((date, idx) => {
              if (!date) return <View key={`empty-${idx}`} style={styles.calCell} />;
              const isPeriod = periodSet.has(date);
              const isFertile = !isPeriod && fertileSet.has(date);
              const isOvulation = ovulationSet.has(date);
              const isToday = date === today;
              const log = getDayLog(date);
              const hasLog = !!log?.flow || (log?.symptoms?.length ?? 0) > 0;
              const isFuture = date > today;
              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.calCell,
                    isPeriod && { backgroundColor: ACCENT + (isFuture ? "35" : "55") },
                    isFertile && { backgroundColor: "#10b981" + "30" },
                    isOvulation && { backgroundColor: "#f59e0b30" },
                    isToday && styles.calToday,
                  ]}
                  onPress={() => !isFuture && openLogModal(date)}
                  activeOpacity={isFuture ? 1 : 0.7}
                >
                  <Text style={[
                    styles.calDayNum,
                    { color: isPeriod ? ACCENT : isFertile ? "#10b981" : isOvulation ? "#f59e0b" : colors.foreground },
                    isToday && { fontFamily: "Inter_700Bold" },
                    isFuture && { opacity: 0.45 },
                  ]}>
                    {parseInt(date.split("-")[2])}
                  </Text>
                  {hasLog && !isFuture && (
                    <View style={[styles.calDot, { backgroundColor: ACCENT }]} />
                  )}
                  {isOvulation && (
                    <View style={[styles.calDot, { backgroundColor: "#f59e0b" }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {[
              { color: ACCENT + "55", label: "Period" },
              { color: "#10b98130", label: "Fertile" },
              { color: "#f59e0b30", label: "Ovulation" },
            ].map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color, borderColor: l.color }]} />
                <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{l.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          {!isOnPeriod ? (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: ACCENT }]}
              onPress={confirmStartPeriod}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Start Period</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: ACCENT }]}
              onPress={confirmEndPeriod}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color={ACCENT} />
              <Text style={[styles.actionBtnText, { color: ACCENT }]}>End Period</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            onPress={() => openLogModal(today)}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Log Today</Text>
          </TouchableOpacity>
        </View>

        {/* BBT Temperature chart */}
        {bbtPoints.length >= 2 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ACCENT + "20", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="thermometer-outline" size={16} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>Temperature</Text>
                <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
                  Current cycle · {bbtPoints.length} reading{bbtPoints.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>
            <BBTChart points={bbtPoints} />
          </View>
        )}

        {/* Recent cycles */}
        {data.cycles.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Cycle History</Text>
            {[...data.cycles].reverse().slice(0, 5).map((c, i) => {
              const len = c.endDate ? daysBetween(c.startDate, c.endDate) + 1 : null;
              const symptomsAll = c.dayLogs.flatMap((l) => l.symptoms);
              const topSymptoms = [...new Set(symptomsAll)].slice(0, 3);
              return (
                <View
                  key={c.id}
                  style={[styles.cycleRow, i < Math.min(data.cycles.length, 5) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <View style={[styles.cycleNumBadge, { backgroundColor: ACCENT + "20" }]}>
                    <Text style={[styles.cycleNumText, { color: ACCENT }]}>
                      {data.cycles.length - i}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cycleDate, { color: colors.foreground }]}>
                      {formatDisplay(c.startDate)}{c.endDate ? ` – ${formatDisplay(c.endDate)}` : " (ongoing)"}
                    </Text>
                    <Text style={[styles.cycleMeta, { color: colors.mutedForeground }]}>
                      {len ? `${len} days` : "In progress"}
                      {topSymptoms.length > 0
                        ? " · " + topSymptoms.map((s) => SYMPTOM_LIST.find((x) => x.id === s)?.label).filter(Boolean).join(", ")
                        : ""}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Disclaimer */}
        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          This tracker is for personal awareness only and does not replace medical advice. Predictions are estimates based on your logged data.
        </Text>
      </ScrollView>

      {/* Log Modal */}
      <Modal visible={!!logModalDate} transparent animationType="slide" onRequestClose={() => setLogModalDate(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Log — {logModalDate ? formatDisplay(logModalDate) : ""}
            </Text>

            <Text style={[styles.modalSection, { color: colors.mutedForeground }]}>Flow intensity</Text>
            <View style={styles.flowRow}>
              {(["spotting", "light", "medium", "heavy"] as FlowIntensity[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.flowChip,
                    { borderColor: FLOW_COLORS[f] },
                    logFlow === f && { backgroundColor: FLOW_COLORS[f] },
                  ]}
                  onPress={() => setLogFlow(logFlow === f ? undefined : f)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.flowChipText, { color: logFlow === f ? "#fff" : FLOW_COLORS[f] }]}>
                    {FLOW_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSection, { color: colors.mutedForeground }]}>Symptoms</Text>
            <View style={styles.symptomsGrid}>
              {SYMPTOM_LIST.map((s) => {
                const active = logSymptoms.includes(s.id);
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.symptomChip,
                      { borderColor: active ? ACCENT : colors.border, backgroundColor: active ? ACCENT + "20" : "transparent" },
                    ]}
                    onPress={() => toggleSymptom(s.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={s.icon as any} size={14} color={active ? ACCENT : colors.mutedForeground} />
                    <Text style={[styles.symptomChipText, { color: active ? ACCENT : colors.mutedForeground }]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.modalSection, { color: colors.mutedForeground }]}>BBT (Basal Body Temperature)</Text>
            <View style={[styles.bbtRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="thermometer-outline" size={18} color={colors.mutedForeground} />
              <TextInput
                style={[styles.bbtInput, { color: colors.foreground }]}
                placeholder="e.g. 36.5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
                value={logBBT}
                onChangeText={setLogBBT}
                maxLength={5}
              />
              <Text style={[styles.bbtUnit, { color: colors.mutedForeground }]}>°C</Text>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancel, { borderColor: colors.border }]}
                onPress={() => setLogModalDate(null)}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSave, { backgroundColor: ACCENT }]} onPress={saveLog}>
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={settingsVisible} transparent animationType="slide" onRequestClose={() => setSettingsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Cycle Settings</Text>

            {[
              { label: "Average cycle length (days)", value: inputCycleLen, set: setInputCycleLen, hint: "Typically 21–35 days" },
              { label: "Average period length (days)", value: inputPeriodLen, set: setInputPeriodLen, hint: "Typically 2–7 days" },
            ].map((row) => (
              <View key={row.label} style={{ marginBottom: 16 }}>
                <Text style={[styles.settingsLabel, { color: colors.foreground }]}>{row.label}</Text>
                <Text style={[styles.settingsHint, { color: colors.mutedForeground }]}>{row.hint}</Text>
                <View style={[styles.settingsInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Text style={[styles.settingsInputText, { color: colors.foreground }]}>{row.value}</Text>
                  <View style={styles.settingsStepper}>
                    <TouchableOpacity hitSlop={8} onPress={() => row.set((v) => String(Math.max(1, parseInt(v) - 1)))}>
                      <Ionicons name="remove" size={20} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} onPress={() => row.set((v) => String(parseInt(v) + 1))}>
                      <Ionicons name="add" size={20} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalCancel, { borderColor: colors.border }]} onPress={() => setSettingsVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSave, { backgroundColor: ACCENT }]}
                onPress={() => {
                  const cl = Math.max(15, Math.min(50, parseInt(inputCycleLen) || 28));
                  const pl = Math.max(1, Math.min(10, parseInt(inputPeriodLen) || 5));
                  save({ ...data, avgCycleLength: cl, avgPeriodLength: pl });
                  setSettingsVisible(false);
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  backBtn: { padding: 4 },
  settingsBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 16 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  statusTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  statusSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },

  infoCard: { padding: 14, borderRadius: 14, borderWidth: 1 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  infoNote: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 10 },

  calCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calMonthLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  calWeekRow: { flexDirection: "row" },
  calWeekLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    paddingBottom: 6,
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    position: "relative",
  },
  calToday: { borderWidth: 1.5, borderColor: "#ec4899" },
  calDayNum: { fontSize: 13, fontFamily: "Inter_400Regular" },
  calDot: { width: 4, height: 4, borderRadius: 2, position: "absolute", bottom: 3 },
  legend: { flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
  legendLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },

  actionsRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },

  section: { borderRadius: 16, borderWidth: 1, padding: 14 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  cycleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  cycleNumBadge: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cycleNumText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  cycleDate: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cycleMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 4 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginBottom: 8 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 8 },
  modalSection: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },

  flowRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  flowChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  flowChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  symptomsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  symptomChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  symptomChipText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  modalBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  modalCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalSave: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  modalSaveText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  bbtRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 4,
  },
  bbtInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular" },
  bbtUnit: { fontSize: 14, fontFamily: "Inter_400Regular" },

  settingsLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  settingsHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 8 },
  settingsInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingsInputText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  settingsStepper: { flexDirection: "row", gap: 16 },
});
