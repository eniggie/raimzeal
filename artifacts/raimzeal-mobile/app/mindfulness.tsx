import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_PREFIX = "@raimzeal_mindfulness_v1_";
const TIMER_DURATION = 5 * 60;

interface DailyEntry {
  gratitude: [string, string, string];
  reflection: string;
  intention: string;
  savedAt: string;
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().split("T")[0], label: i === 0 ? "Today" : d.toLocaleDateString("en", { weekday: "short" }) });
  }
  return days;
}

export default function MindfulnessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [entry, setEntry] = useState<DailyEntry>({
    gratitude: ["", "", ""],
    reflection: "",
    intention: "",
    savedAt: "",
  });
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [historyDays, setHistoryDays] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"journal" | "timer" | "history">("journal");

  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const breathScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const days = last7Days();
    AsyncStorage.multiGet(days.map((d) => STORAGE_PREFIX + d.key)).then((results) => {
      const hist: Record<string, boolean> = {};
      let s = 0;
      const today = todayKey();
      for (let i = 0; i < days.length; i++) {
        const [key, val] = results[i];
        const dateKey = key.replace(STORAGE_PREFIX, "");
        hist[dateKey] = !!val;
        if (val) {
          if (dateKey === today) setEntry(JSON.parse(val));
        }
      }
      setHistoryDays(hist);
      let streak = 0;
      for (let i = 6; i >= 0; i--) {
        const d = days[i];
        if (hist[d.key]) streak++;
        else if (i < 6) break;
      }
      setStreak(streak);
    });
  }, []);

  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return TIMER_DURATION;
        }
        return prev - 1;
      });
    }, 1000);
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, { toValue: 1.15, duration: 4000, useNativeDriver: true }),
        Animated.timing(breathScale, { toValue: 1, duration: 4000, useNativeDriver: true }),
      ])
    ).start();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const handleSave = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const toSave: DailyEntry = { ...entry, savedAt: new Date().toISOString() };
    await AsyncStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(toSave));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setHistoryDays((prev) => ({ ...prev, [todayKey()]: true }));
  }, [entry]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs = (timeLeft % 60).toString().padStart(2, "0");
  const days = last7Days();


  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 40 + 84 : 110 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Mindfulness & Gratitude</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Rise · Daily practice</Text>
        </View>
        {streak > 0 && (
          <View style={[styles.streakBadge, { backgroundColor: "#a78bfa20", borderColor: "#a78bfa40" }]}>
            <Text style={[styles.streakText, { color: "#a78bfa" }]}>🔥 {streak}d</Text>
          </View>
        )}
      </View>

      {/* Tab Row */}
      <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
        {(["journal", "timer", "history"] as const).map((t) => {
          const icons = { journal: "book-outline", timer: "timer-outline", history: "calendar-outline" } as const;
          const active = activeTab === t;
          return (
            <TouchableOpacity key={t} onPress={() => { Haptics.selectionAsync(); setActiveTab(t); }}
              style={[styles.tabBtn, active && { backgroundColor: colors.card }]}>
              <Ionicons name={icons[t]} size={15} color={active ? "#a78bfa" : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Journal Tab */}
      {activeTab === "journal" && (
        <>
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Today I am grateful for...
            </Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>3 things, no matter how small</Text>
            {([0, 1, 2] as const).map((i) => (
              <View key={i} style={styles.gratRow}>
                <View style={[styles.gratNum, { backgroundColor: "#a78bfa20" }]}>
                  <Text style={[styles.gratNumText, { color: "#a78bfa" }]}>{i + 1}</Text>
                </View>
                <TextInput
                  value={entry.gratitude[i]}
                  onChangeText={(v) => setEntry((e) => {
                    const g = [...e.gratitude] as [string, string, string];
                    g[i] = v;
                    return { ...e, gratitude: g };
                  })}
                  placeholder={["e.g. A good night's sleep", "e.g. A kind message from a friend", "e.g. Sunlight this morning"][i]}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.gratInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
                  returnKeyType="next"
                />
              </View>
            ))}
          </GlassCard>

          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today's intention</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>One word or phrase for your day</Text>
            <TextInput
              value={entry.intention}
              onChangeText={(v) => setEntry((e) => ({ ...e, intention: v }))}
              placeholder="e.g. Patience, Focus, Rest, Joy..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.singleInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
            />
          </GlassCard>

          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Evening reflection</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>How did today go? What will you take forward?</Text>
            <TextInput
              value={entry.reflection}
              onChangeText={(v) => setEntry((e) => ({ ...e, reflection: v }))}
              placeholder="Today I felt... Tomorrow I want to..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              style={[styles.notesInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              textAlignVertical="top"
            />
          </GlassCard>

          <AnimatedPressable onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: saved ? "#10b981" : "#a78bfa" }]} scale={0.97}>
            <Ionicons name={saved ? "checkmark-circle-outline" : "save-outline"} size={20} color="#fff" />
            <Text style={styles.saveBtnText}>{saved ? "Saved!" : "Save Today's Journal"}</Text>
          </AnimatedPressable>
        </>
      )}

      {/* Timer Tab */}
      {activeTab === "timer" && (
        <GlassCard style={styles.timerCard}>
          <Text style={[styles.timerTitle, { color: colors.foreground }]}>Mindfulness Timer</Text>
          <Text style={[styles.timerSub, { color: colors.mutedForeground }]}>5-minute breathing & awareness session</Text>
          <Animated.View style={[styles.timerCircle, { transform: [{ scale: breathScale }], borderColor: "#a78bfa50", backgroundColor: "#a78bfa15" }]}>
            <Text style={[styles.timerDisplay, { color: "#a78bfa" }]}>{mins}:{secs}</Text>
            <Text style={[styles.timerHint, { color: colors.mutedForeground }]}>
              {timerRunning ? (timeLeft % 8 < 4 ? "Breathe in..." : "Breathe out...") : "Tap to begin"}
            </Text>
          </Animated.View>
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (timerRunning) { setTimerRunning(false); setTimeLeft(TIMER_DURATION); breathScale.stopAnimation(); breathScale.setValue(1); }
              else setTimerRunning(true);
            }}
            style={[styles.timerBtn, { backgroundColor: timerRunning ? "#ef444420" : "#a78bfa" }]}
            scale={0.96}
          >
            <Ionicons name={timerRunning ? "stop-circle-outline" : "play-circle-outline"} size={22} color={timerRunning ? "#ef4444" : "#fff"} />
            <Text style={[styles.timerBtnText, { color: timerRunning ? "#ef4444" : "#fff" }]}>
              {timerRunning ? "Stop Session" : "Start 5-Minute Session"}
            </Text>
          </AnimatedPressable>
        </GlassCard>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <GlassCard style={styles.historyCard}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>7-Day Streak</Text>
          <View style={styles.historyRow}>
            {days.map((d) => {
              const done = historyDays[d.key];
              const isToday = d.key === todayKey();
              return (
                <View key={d.key} style={styles.historyCol}>
                  <View style={[styles.historyDot, {
                    backgroundColor: done ? "#a78bfa" : colors.muted,
                    borderColor: isToday ? "#a78bfa" : "transparent",
                    borderWidth: isToday ? 2 : 0,
                  }]}>
                    {done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.historyLabel, {
                    color: isToday ? "#a78bfa" : colors.mutedForeground,
                    fontFamily: isToday ? "Inter_700Bold" : "Inter_400Regular",
                  }]}>{d.label.slice(0, 3)}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.streakSummary, { color: colors.mutedForeground }]}>
            {streak === 7 ? "🔥 Perfect week! Keep going!" : streak > 0 ? `${streak} day${streak === 1 ? "" : "s"} this week — great progress!` : "Start your streak today!"}
          </Text>
        </GlassCard>
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
  streakBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  streakText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 2 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10 },
  tabLabel: { fontSize: 13 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -4 },
  gratRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  gratNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  gratNumText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  gratInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular" },
  singleInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  notesInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { color: "#fff", fontSize: 17, fontFamily: "Inter_600SemiBold" },
  timerCard: { gap: 16, alignItems: "center" },
  timerTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  timerSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  timerCircle: { width: 180, height: 180, borderRadius: 90, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 4 },
  timerDisplay: { fontSize: 40, fontFamily: "SpaceGrotesk_700Bold" },
  timerHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
  timerBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  timerBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  historyCard: { gap: 14 },
  historyRow: { flexDirection: "row", gap: 6, justifyContent: "space-between" },
  historyCol: { flex: 1, alignItems: "center", gap: 6 },
  historyDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  historyLabel: { fontSize: 10, textAlign: "center" },
  streakSummary: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  gateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
