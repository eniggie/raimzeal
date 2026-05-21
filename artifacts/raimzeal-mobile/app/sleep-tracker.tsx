import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  Pressable,
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

const STORAGE_PREFIX = "@raimzeal_sleep_v1_";
const GOAL_HOURS = 8;

interface SleepEntry {
  bedHour: number;
  bedMin: number;
  wakeHour: number;
  wakeMin: number;
  quality: 1 | 2 | 3 | 4 | 5;
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      key: d.toISOString().split("T")[0],
      label: i === 0 ? "Today" : d.toLocaleDateString("en", { weekday: "short" }),
    });
  }
  return days;
}

function durationHours(entry: SleepEntry): number {
  const bedTotalMins = entry.bedHour * 60 + entry.bedMin;
  const wakeTotalMins = entry.wakeHour * 60 + entry.wakeMin;
  let diff = wakeTotalMins - bedTotalMins;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function qualityLabel(q: 1 | 2 | 3 | 4 | 5) {
  return ["😫 Poor", "😞 Bad", "😐 Fair", "🙂 Good", "😄 Great"][q - 1];
}

function qualityColor(q: 1 | 2 | 3 | 4 | 5, primary: string) {
  return ["#ef4444", "#f97316", "#eab308", "#84cc16", "#10b981"][q - 1] || primary;
}

function TimeSelector({
  label,
  hour,
  min,
  onHourChange,
  onMinChange,
  colors,
}: {
  label: string;
  hour: number;
  min: number;
  onHourChange: (h: number) => void;
  onMinChange: (m: number) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={tsStyles.wrap}>
      <Text style={[tsStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={tsStyles.controls}>
        <View style={tsStyles.spinnerGroup}>
          <Pressable
            onPress={() => onHourChange((hour + 23) % 24)}
            hitSlop={8}
            style={[tsStyles.spinBtn, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="chevron-up" size={14} color={colors.foreground} />
          </Pressable>
          <Text style={[tsStyles.spinValue, { color: colors.foreground }]}>
            {pad2(hour)}
          </Text>
          <Pressable
            onPress={() => onHourChange((hour + 1) % 24)}
            hitSlop={8}
            style={[tsStyles.spinBtn, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="chevron-down" size={14} color={colors.foreground} />
          </Pressable>
        </View>
        <Text style={[tsStyles.colon, { color: colors.mutedForeground }]}>:</Text>
        <View style={tsStyles.spinnerGroup}>
          <Pressable
            onPress={() => onMinChange((min + 45) % 60)}
            hitSlop={8}
            style={[tsStyles.spinBtn, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="chevron-up" size={14} color={colors.foreground} />
          </Pressable>
          <Text style={[tsStyles.spinValue, { color: colors.foreground }]}>
            {pad2(min)}
          </Text>
          <Pressable
            onPress={() => onMinChange((min + 15) % 60)}
            hitSlop={8}
            style={[tsStyles.spinBtn, { backgroundColor: colors.muted }]}
          >
            <Ionicons name="chevron-down" size={14} color={colors.foreground} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const tsStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", gap: 8 },
  label: { fontSize: 11, fontFamily: "Inter_500Medium" },
  controls: { flexDirection: "row", alignItems: "center", gap: 4 },
  spinnerGroup: { alignItems: "center", gap: 4 },
  spinBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  spinValue: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold", minWidth: 44, textAlign: "center" },
  colon: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold", marginTop: -4 },
});

export default function SleepTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [bedHour, setBedHour] = useState(22);
  const [bedMin, setBedMin] = useState(30);
  const [wakeHour, setWakeHour] = useState(6);
  const [wakeMin, setWakeMin] = useState(30);
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [weekData, setWeekData] = useState<Record<string, SleepEntry | null>>({});
  const [saved, setSaved] = useState(false);

  const days = last7Days();
  const todayEntry = weekData[todayKey()];

  const currentEntry: SleepEntry = { bedHour, bedMin, wakeHour, wakeMin, quality };
  const previewHours = durationHours(currentEntry);

  useEffect(() => {
    loadWeek();
  }, []);

  async function loadWeek() {
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const results = await Promise.all(days.map((d) => AsyncStorage.getItem(STORAGE_PREFIX + d.key)));
      const data: Record<string, SleepEntry | null> = {};
      days.forEach((d, i) => {
        data[d.key] = results[i] ? (JSON.parse(results[i]!) as SleepEntry) : null;
      });
      setWeekData(data);
      const today = data[todayKey()];
      if (today) {
        setBedHour(today.bedHour);
        setBedMin(today.bedMin);
        setWakeHour(today.wakeHour);
        setWakeMin(today.wakeMin);
        setQuality(today.quality);
        setSaved(true);
      }
    } catch {}
  }

  const saveSleep = useCallback(async () => {
    try {
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      const entry: SleepEntry = { bedHour, bedMin, wakeHour, wakeMin, quality };
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(entry));
      setWeekData((prev) => ({ ...prev, [todayKey()]: entry }));
      setSaved(true);
    } catch {}
  }, [bedHour, bedMin, wakeHour, wakeMin, quality]);

  const avgSleep =
    Object.values(weekData).filter(Boolean).length > 0
      ? Object.values(weekData)
          .filter((e): e is SleepEntry => e !== null)
          .reduce((s, e) => s + durationHours(e), 0) /
        Object.values(weekData).filter(Boolean).length
      : 0;

  const sleepColor = previewHours >= GOAL_HOURS ? "#10b981" : previewHours >= 6 ? "#f59e0b" : "#ef4444";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Sleep Tracker</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 7-day chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>7-Day Sleep</Text>
            {avgSleep > 0 && (
              <Text style={[styles.chartAvg, { color: colors.mutedForeground }]}>
                Avg: {avgSleep.toFixed(1)}h
              </Text>
            )}
          </View>
          <View style={styles.chartBars}>
            {days.map((d) => {
              const entry = weekData[d.key];
              const hrs = entry ? durationHours(entry) : 0;
              const pct = Math.min(hrs / 10, 1);
              const barColor =
                hrs >= GOAL_HOURS ? "#10b981" : hrs >= 6 ? "#f59e0b" : hrs > 0 ? "#ef4444" : colors.muted;
              const isToday = d.key === todayKey();
              return (
                <View key={d.key} style={styles.barCol}>
                  <Text style={[styles.barHrs, { color: hrs > 0 ? colors.mutedForeground : "transparent" }]}>
                    {hrs > 0 ? `${hrs.toFixed(1)}` : ""}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.muted }]}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${pct * 100}%`, backgroundColor: barColor },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      { color: isToday ? colors.primary : colors.mutedForeground,
                        fontFamily: isToday ? "Inter_600SemiBold" : "Inter_400Regular" },
                    ]}
                  >
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.goalLine}>
            <View style={[styles.goalDash, { backgroundColor: colors.primary + "50" }]} />
            <Text style={[styles.goalText, { color: colors.mutedForeground }]}>8h goal</Text>
          </View>
        </View>

        {/* Log today */}
        <View style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.logTitle, { color: colors.foreground }]}>
            {saved ? "Today's Sleep ✓" : "Log Tonight's Sleep"}
          </Text>

          {/* Preview */}
          <View style={[styles.previewRow, { backgroundColor: sleepColor + "18", borderColor: sleepColor + "40" }]}>
            <Ionicons name="moon" size={18} color={sleepColor} />
            <Text style={[styles.previewText, { color: sleepColor }]}>
              {previewHours.toFixed(1)} hours
            </Text>
            <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
              {pad2(bedHour)}:{pad2(bedMin)} → {pad2(wakeHour)}:{pad2(wakeMin)}
            </Text>
          </View>

          {/* Bed/Wake time pickers */}
          <View style={styles.timeRow}>
            <TimeSelector
              label="Bedtime"
              hour={bedHour}
              min={bedMin}
              onHourChange={setBedHour}
              onMinChange={setBedMin}
              colors={colors}
            />
            <View style={[styles.timeDivider, { backgroundColor: colors.border }]} />
            <TimeSelector
              label="Wake up"
              hour={wakeHour}
              min={wakeMin}
              onHourChange={setWakeHour}
              onMinChange={setWakeMin}
              colors={colors}
            />
          </View>

          {/* Quality */}
          <Text style={[styles.qualityLabel, { color: colors.mutedForeground }]}>Sleep quality</Text>
          <View style={styles.qualityRow}>
            {([1, 2, 3, 4, 5] as const).map((q) => (
              <TouchableOpacity
                key={q}
                activeOpacity={0.7}
                onPress={() => {
                  setQuality(q);
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                }}
                style={[
                  styles.qualityBtn,
                  {
                    backgroundColor:
                      quality === q ? qualityColor(q, colors.primary) + "25" : colors.muted,
                    borderColor:
                      quality === q ? qualityColor(q, colors.primary) : "transparent",
                    borderWidth: quality === q ? 2 : 0,
                  },
                ]}
              >
                <Text style={styles.qualityEmoji}>
                  {["😫", "😞", "😐", "🙂", "😄"][q - 1]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.qualitySelected, { color: qualityColor(quality, colors.primary) }]}>
            {qualityLabel(quality)}
          </Text>

          <Pressable
            onPress={saveSleep}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="checkmark-circle" size={18} color={colors.primaryForeground} />
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
              {saved ? "Update Sleep Log" : "Save Sleep"}
            </Text>
          </Pressable>
        </View>

        {/* Past entries */}
        {Object.values(weekData).some(Boolean) && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Recent Nights
            </Text>
            <View style={[styles.pastList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {days
                .filter((d) => weekData[d.key])
                .reverse()
                .map((d, i, arr) => {
                  const entry = weekData[d.key]!;
                  const hrs = durationHours(entry);
                  const qColor = qualityColor(entry.quality, colors.primary);
                  return (
                    <View
                      key={d.key}
                      style={[
                        styles.pastRow,
                        i < arr.length - 1 && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.pastDate, { color: colors.mutedForeground }]}>
                        {d.label}
                      </Text>
                      <Text style={[styles.pastTime, { color: colors.foreground }]}>
                        {pad2(entry.bedHour)}:{pad2(entry.bedMin)} → {pad2(entry.wakeHour)}:{pad2(entry.wakeMin)}
                      </Text>
                      <Text style={[styles.pastHrs, { color: hrs >= 7 ? "#10b981" : "#f59e0b" }]}>
                        {hrs.toFixed(1)}h
                      </Text>
                      <Text>{["😫", "😞", "😐", "🙂", "😄"][entry.quality - 1]}</Text>
                    </View>
                  );
                })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chartTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  chartAvg: { fontSize: 13, fontFamily: "Inter_400Regular" },
  chartBars: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 80 },
  barCol: { alignItems: "center", gap: 4, flex: 1 },
  barHrs: { fontSize: 9, fontFamily: "Inter_400Regular" },
  barTrack: { width: 24, height: 60, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 6, minHeight: 4 },
  barLabel: { fontSize: 10 },
  goalLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  goalDash: { flex: 1, height: 1 },
  goalText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  logCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 16 },
  logTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  previewText: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  previewSub: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, textAlign: "right" },
  timeRow: { flexDirection: "row", alignItems: "flex-start", gap: 0 },
  timeDivider: { width: 1, height: 80, marginTop: 28, marginHorizontal: 8 },
  qualityLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: -4 },
  qualityRow: { flexDirection: "row", gap: 8 },
  qualityBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  qualityEmoji: { fontSize: 22 },
  qualitySelected: { fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold", marginBottom: 10 },
  pastList: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  pastRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  pastDate: { width: 44, fontSize: 12, fontFamily: "Inter_500Medium" },
  pastTime: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  pastHrs: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
