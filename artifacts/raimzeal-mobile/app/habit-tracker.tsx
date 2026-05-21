import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const STORAGE_KEY_CONFIG = "@raimzeal_habits_config_v1";
const STORAGE_KEY_LOG_PREFIX = "@raimzeal_habits_log_";

interface Habit {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

const DEFAULT_HABITS: Habit[] = [
  { id: "h1", name: "Morning stretch", icon: "body-outline", color: "#f59e0b", enabled: true },
  { id: "h2", name: "Drink 8 glasses of water", icon: "water-outline", color: "#3b82f6", enabled: true },
  { id: "h3", name: "Meditate 10 minutes", icon: "leaf-outline", color: "#10b981", enabled: true },
  { id: "h4", name: "No junk food", icon: "fast-food-outline", color: "#ef4444", enabled: true },
  { id: "h5", name: "8 hours sleep", icon: "moon-outline", color: "#8b5cf6", enabled: false },
  { id: "h6", name: "Cold shower", icon: "water", color: "#06b6d4", enabled: false },
  { id: "h7", name: "Read 30 minutes", icon: "book-outline", color: "#f97316", enabled: false },
  { id: "h8", name: "No alcohol", icon: "wine-outline", color: "#ec4899", enabled: false },
  { id: "h9", name: "Take vitamins", icon: "medkit-outline", color: "#84cc16", enabled: false },
];

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function weekDayLabels() {
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

export default function HabitTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [completedToday, setCompletedToday] = useState<Set<string>>(new Set());
  const [weekData, setWeekData] = useState<Record<string, Set<string>>>({});
  const [showManage, setShowManage] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [loading, setLoading] = useState(true);

  const activeHabits = habits.filter((h) => h.enabled);
  const completedCount = completedToday.size;
  const totalCount = activeHabits.length;
  const allDone = totalCount > 0 && completedCount >= totalCount;

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;

      const [configRaw, ...logRaws] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_CONFIG),
        ...weekDayLabels().map((d) =>
          AsyncStorage.getItem(STORAGE_KEY_LOG_PREFIX + d.key)
        ),
      ]);

      if (configRaw) {
        const parsed = JSON.parse(configRaw) as Habit[];
        setHabits(parsed);
      }

      const week: Record<string, Set<string>> = {};
      weekDayLabels().forEach((d, i) => {
        const raw = logRaws[i];
        week[d.key] = raw ? new Set(JSON.parse(raw) as string[]) : new Set();
      });
      setWeekData(week);
      setCompletedToday(week[todayKey()] ?? new Set());
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const saveConfig = useCallback(async (updated: Habit[]) => {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    } catch {}
  }, []);

  const saveTodayLog = useCallback(async (completed: Set<string>) => {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem(
        STORAGE_KEY_LOG_PREFIX + todayKey(),
        JSON.stringify([...completed])
      );
    } catch {}
  }, []);

  function toggleHabit(id: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setCompletedToday((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveTodayLog(next);
      setWeekData((wd) => ({ ...wd, [todayKey()]: next }));
      return next;
    });
  }

  function toggleHabitEnabled(id: string) {
    setHabits((prev) => {
      const next = prev.map((h) =>
        h.id === id ? { ...h, enabled: !h.enabled } : h
      );
      saveConfig(next);
      return next;
    });
  }

  function addCustomHabit() {
    const name = newHabitName.trim();
    if (!name) return;
    const COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#ec4899", "#8b5cf6", "#f97316"];
    const color = COLORS[habits.length % COLORS.length];
    const newHabit: Habit = {
      id: `custom_${Date.now()}`,
      name,
      icon: "star-outline",
      color,
      enabled: true,
    };
    setHabits((prev) => {
      const next = [...prev, newHabit];
      saveConfig(next);
      return next;
    });
    setNewHabitName("");
  }

  function deleteHabit(id: string) {
    Alert.alert("Delete Habit", "Remove this habit permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setHabits((prev) => {
            const next = prev.filter((h) => h.id !== id);
            saveConfig(next);
            return next;
          });
        },
      },
    ]);
  }

  const weekDays = weekDayLabels();

  function streakForHabit(id: string) {
    let streak = 0;
    const days = weekDayLabels().reverse();
    for (const d of days) {
      const set = weekData[d.key];
      if (set?.has(id)) streak++;
      else if (d.key !== todayKey()) break;
    }
    return streak;
  }

  if (loading) return null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Habit Tracker
        </Text>
        <Pressable
          onPress={() => setShowManage((v) => !v)}
          hitSlop={10}
          style={styles.manageBtn}
        >
          <Text style={[styles.manageBtnText, { color: colors.primary }]}>
            {showManage ? "Done" : "Manage"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!showManage && (
          <>
            {/* Progress */}
            <View
              style={[
                styles.progressCard,
                {
                  backgroundColor: allDone
                    ? "#10b981" + "18"
                    : colors.card,
                  borderColor: allDone ? "#10b981" + "60" : colors.border,
                },
              ]}
            >
              <View style={styles.progressTop}>
                <View>
                  <Text style={[styles.progressTitle, { color: colors.foreground }]}>
                    {allDone ? "All habits done! 🎉" : "Today's Habits"}
                  </Text>
                  <Text style={[styles.progressSub, { color: colors.mutedForeground }]}>
                    {new Date().toLocaleDateString("en", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.progressFraction,
                    { color: allDone ? "#10b981" : colors.primary },
                  ]}
                >
                  {completedCount}/{totalCount}
                </Text>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: colors.primary,
                      width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
                    },
                  ]}
                />
              </View>
            </View>

            {/* Week grid */}
            <View style={[styles.weekCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.weekTitle, { color: colors.foreground }]}>
                7-Day View
              </Text>
              <View style={styles.weekRow}>
                {weekDays.map((d) => {
                  const set = weekData[d.key] ?? new Set();
                  const count = activeHabits.filter((h) => set.has(h.id)).length;
                  const pct = totalCount > 0 ? count / totalCount : 0;
                  const isToday = d.key === todayKey();
                  return (
                    <View key={d.key} style={styles.weekDayCol}>
                      <Text style={[styles.weekDayLabel, { color: isToday ? colors.primary : colors.mutedForeground }]}>
                        {d.label}
                      </Text>
                      <View style={[styles.weekDayBar, { backgroundColor: colors.muted }]}>
                        <View
                          style={[
                            styles.weekDayFill,
                            {
                              height: `${pct * 100}%`,
                              backgroundColor:
                                pct >= 1
                                  ? "#10b981"
                                  : isToday
                                  ? colors.primary
                                  : colors.secondary,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.weekDayCount, { color: colors.mutedForeground }]}>
                        {count}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Habits list */}
            {activeHabits.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No habits enabled.{"\n"}Tap Manage to add some.
                </Text>
              </View>
            ) : (
              <View style={styles.habitsList}>
                {activeHabits.map((habit) => {
                  const done = completedToday.has(habit.id);
                  const streak = streakForHabit(habit.id);
                  return (
                    <TouchableOpacity
                      key={habit.id}
                      activeOpacity={0.75}
                      onPress={() => toggleHabit(habit.id)}
                      style={[
                        styles.habitRow,
                        {
                          backgroundColor: done
                            ? habit.color + "18"
                            : colors.card,
                          borderColor: done ? habit.color + "50" : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.habitIconWrap,
                          { backgroundColor: habit.color + "25" },
                        ]}
                      >
                        <Ionicons
                          name={habit.icon as any}
                          size={20}
                          color={habit.color}
                        />
                      </View>
                      <View style={styles.habitInfo}>
                        <Text
                          style={[
                            styles.habitName,
                            {
                              color: done ? colors.foreground : colors.foreground,
                              textDecorationLine: done ? "line-through" : "none",
                              opacity: done ? 0.6 : 1,
                            },
                          ]}
                        >
                          {habit.name}
                        </Text>
                        {streak > 1 && (
                          <Text style={[styles.habitStreak, { color: colors.warning }]}>
                            🔥 {streak}-day streak
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.habitCheck,
                          {
                            backgroundColor: done ? habit.color : "transparent",
                            borderColor: done ? habit.color : colors.border,
                          },
                        ]}
                      >
                        {done && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Manage panel */}
        {showManage && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Add Custom Habit
            </Text>
            <View style={styles.addRow}>
              <TextInput
                style={[
                  styles.addInput,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="e.g. No screen after 10pm"
                placeholderTextColor={colors.mutedForeground}
                value={newHabitName}
                onChangeText={setNewHabitName}
                returnKeyType="done"
                onSubmitEditing={addCustomHabit}
              />
              <Pressable
                onPress={addCustomHabit}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add" size={20} color={colors.primaryForeground} />
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              All Habits
            </Text>
            <View style={[styles.manageList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {habits.map((habit, i) => (
                <View
                  key={habit.id}
                  style={[
                    styles.manageRow,
                    i < habits.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.habitIconWrap,
                      { backgroundColor: habit.color + "25" },
                    ]}
                  >
                    <Ionicons
                      name={habit.icon as any}
                      size={18}
                      color={habit.color}
                    />
                  </View>
                  <Text
                    style={[
                      styles.manageHabitName,
                      { color: colors.foreground, opacity: habit.enabled ? 1 : 0.5 },
                    ]}
                    numberOfLines={1}
                  >
                    {habit.name}
                  </Text>
                  <Pressable
                    onPress={() => toggleHabitEnabled(habit.id)}
                    hitSlop={8}
                    style={[
                      styles.togglePill,
                      {
                        backgroundColor: habit.enabled
                          ? habit.color + "25"
                          : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        { color: habit.enabled ? habit.color : colors.mutedForeground },
                      ]}
                    >
                      {habit.enabled ? "On" : "Off"}
                    </Text>
                  </Pressable>
                  {habit.id.startsWith("custom_") && (
                    <Pressable
                      onPress={() => deleteHabit(habit.id)}
                      hitSlop={8}
                      style={{ marginLeft: 4 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.destructive}
                      />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </>
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
  manageBtn: { width: 60, alignItems: "flex-end" },
  manageBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  progressCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  progressSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  progressFraction: { fontSize: 32, fontFamily: "SpaceGrotesk_700Bold" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  weekCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  weekTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  weekRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  weekDayCol: { alignItems: "center", gap: 4 },
  weekDayLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  weekDayBar: { width: 28, height: 60, borderRadius: 8, justifyContent: "flex-end", overflow: "hidden" },
  weekDayFill: { width: "100%", borderRadius: 8, minHeight: 4 },
  weekDayCount: { fontSize: 10, fontFamily: "Inter_400Regular" },
  habitsList: { gap: 10 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  habitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  habitInfo: { flex: 1, gap: 2 },
  habitName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  habitStreak: { fontSize: 11, fontFamily: "Inter_400Regular" },
  habitCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 40 },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  sectionTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  addRow: { flexDirection: "row", gap: 10 },
  addInput: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  manageList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  manageHabitName: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  togglePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  togglePillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
