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

const STORAGE_KEY_CONFIG = "@raimzeal_supps_config_v1";
const STORAGE_KEY_LOG_PREFIX = "@raimzeal_supps_log_";

interface Supplement {
  id: string;
  name: string;
  dose: string;
  timing: string;
  color: string;
  enabled: boolean;
}

const DEFAULT_SUPPLEMENTS: Supplement[] = [
  { id: "s1", name: "Creatine", dose: "5g", timing: "Post-workout", color: "#3b82f6", enabled: false },
  { id: "s2", name: "Whey Protein", dose: "1 scoop", timing: "Post-workout", color: "#f97316", enabled: false },
  { id: "s3", name: "Multivitamin", dose: "1 tablet", timing: "Morning", color: "#10b981", enabled: false },
  { id: "s4", name: "Omega-3", dose: "1000mg", timing: "With meal", color: "#f59e0b", enabled: false },
  { id: "s5", name: "Vitamin D3", dose: "2000 IU", timing: "Morning", color: "#eab308", enabled: false },
  { id: "s6", name: "Pre-workout", dose: "1 scoop", timing: "Pre-workout", color: "#ef4444", enabled: false },
  { id: "s7", name: "Magnesium", dose: "400mg", timing: "Before bed", color: "#8b5cf6", enabled: false },
  { id: "s8", name: "BCAAs", dose: "5g", timing: "During workout", color: "#ec4899", enabled: false },
];

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function last7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function complianceColor(pct: number, primary: string) {
  if (pct >= 0.8) return "#10b981";
  if (pct >= 0.5) return primary;
  return "#f59e0b";
}

export default function SupplementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [supplements, setSupplements] = useState<Supplement[]>(DEFAULT_SUPPLEMENTS);
  const [takenToday, setTakenToday] = useState<Set<string>>(new Set());
  const [weekData, setWeekData] = useState<Record<string, Set<string>>>({});
  const [showManage, setShowManage] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [loading, setLoading] = useState(true);

  const activeSupps = supplements.filter((s) => s.enabled);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      const keys = [
        STORAGE_KEY_CONFIG,
        ...last7Days().map((d) => STORAGE_KEY_LOG_PREFIX + d),
      ];
      const results = await Promise.all(keys.map((k) => AsyncStorage.getItem(k)));
      const [configRaw, ...logRaws] = results;

      if (configRaw) setSupplements(JSON.parse(configRaw) as Supplement[]);

      const week: Record<string, Set<string>> = {};
      last7Days().forEach((d, i) => {
        week[d] = logRaws[i] ? new Set(JSON.parse(logRaws[i]!) as string[]) : new Set();
      });
      setWeekData(week);
      setTakenToday(week[todayKey()] ?? new Set());
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const saveConfig = useCallback(async (updated: Supplement[]) => {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
    } catch {}
  }, []);

  const saveTodayLog = useCallback(async (taken: Set<string>) => {
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem(
        STORAGE_KEY_LOG_PREFIX + todayKey(),
        JSON.stringify([...taken])
      );
    } catch {}
  }, []);

  function toggleTaken(id: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setTakenToday((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveTodayLog(next);
      setWeekData((wd) => ({ ...wd, [todayKey()]: next }));
      return next;
    });
  }

  function toggleEnabled(id: string) {
    setSupplements((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s));
      saveConfig(next);
      return next;
    });
  }

  function addCustom() {
    const name = newName.trim();
    if (!name) return;
    const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
    const newSupp: Supplement = {
      id: `custom_${Date.now()}`,
      name,
      dose: newDose.trim() || "—",
      timing: "Daily",
      color: COLORS[supplements.length % COLORS.length],
      enabled: true,
    };
    setSupplements((prev) => {
      const next = [...prev, newSupp];
      saveConfig(next);
      return next;
    });
    setNewName("");
    setNewDose("");
  }

  function deleteSupp(id: string) {
    Alert.alert("Remove Supplement", "Remove this supplement?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setSupplements((prev) => {
            const next = prev.filter((s) => s.id !== id);
            saveConfig(next);
            return next;
          });
        },
      },
    ]);
  }

  function weeklyCompliance(id: string) {
    const days = last7Days();
    const taken = days.filter((d) => weekData[d]?.has(id)).length;
    const active = days.filter((d) => supplements.find((s) => s.id === id)?.enabled).length;
    return active > 0 ? taken / Math.min(active, 7) : 0;
  }

  const todayDoneCount = activeSupps.filter((s) => takenToday.has(s.id)).length;

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
          Supplement Tracker
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
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {!showManage && (
          <>
            {/* Summary card */}
            {activeSupps.length > 0 && (
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor:
                      todayDoneCount === activeSupps.length
                        ? "#10b981" + "18"
                        : colors.card,
                    borderColor:
                      todayDoneCount === activeSupps.length
                        ? "#10b981" + "50"
                        : colors.border,
                  },
                ]}
              >
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
                      {todayDoneCount === activeSupps.length
                        ? "All taken today! ✓"
                        : "Today's Stack"}
                    </Text>
                    <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>
                      {new Date().toLocaleDateString("en", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.summaryFraction,
                      {
                        color:
                          todayDoneCount === activeSupps.length
                            ? "#10b981"
                            : colors.primary,
                      },
                    ]}
                  >
                    {todayDoneCount}/{activeSupps.length}
                  </Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${activeSupps.length > 0 ? (todayDoneCount / activeSupps.length) * 100 : 0}%`,
                        backgroundColor:
                          todayDoneCount === activeSupps.length
                            ? "#10b981"
                            : colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            {activeSupps.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="medkit-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No supplements added yet.{"\n"}Tap Manage to set up your stack.
                </Text>
              </View>
            ) : (
              <View style={styles.suppList}>
                {activeSupps.map((supp) => {
                  const taken = takenToday.has(supp.id);
                  const compliance = weeklyCompliance(supp.id);
                  return (
                    <TouchableOpacity
                      key={supp.id}
                      activeOpacity={0.75}
                      onPress={() => toggleTaken(supp.id)}
                      style={[
                        styles.suppRow,
                        {
                          backgroundColor: taken ? supp.color + "18" : colors.card,
                          borderColor: taken ? supp.color + "50" : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[styles.suppDot, { backgroundColor: supp.color }]}
                      />
                      <View style={styles.suppInfo}>
                        <Text
                          style={[
                            styles.suppName,
                            {
                              color: colors.foreground,
                              textDecorationLine: taken ? "line-through" : "none",
                              opacity: taken ? 0.6 : 1,
                            },
                          ]}
                        >
                          {supp.name}
                        </Text>
                        <Text
                          style={[styles.suppMeta, { color: colors.mutedForeground }]}
                        >
                          {supp.dose} · {supp.timing}
                        </Text>
                      </View>
                      <View style={styles.suppRight}>
                        <Text
                          style={[
                            styles.complianceText,
                            {
                              color: complianceColor(compliance, colors.primary),
                            },
                          ]}
                        >
                          {Math.round(compliance * 100)}%
                        </Text>
                        <Text
                          style={[styles.complianceLabel, { color: colors.mutedForeground }]}
                        >
                          7d
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkCircle,
                          {
                            backgroundColor: taken ? supp.color : "transparent",
                            borderColor: taken ? supp.color : colors.border,
                          },
                        ]}
                      >
                        {taken && (
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

        {showManage && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Add Supplement
            </Text>
            <View style={styles.addSection}>
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
                  placeholder="Name (e.g. Zinc)"
                  placeholderTextColor={colors.mutedForeground}
                  value={newName}
                  onChangeText={setNewName}
                />
                <TextInput
                  style={[
                    styles.addInputSmall,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  placeholder="Dose"
                  placeholderTextColor={colors.mutedForeground}
                  value={newDose}
                  onChangeText={setNewDose}
                />
              </View>
              <Pressable
                onPress={addCustom}
                style={[styles.addBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add" size={18} color={colors.primaryForeground} />
                <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
                  Add
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              All Supplements
            </Text>
            <View
              style={[
                styles.manageList,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {supplements.map((supp, i) => (
                <View
                  key={supp.id}
                  style={[
                    styles.manageRow,
                    i < supplements.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[styles.suppDot, { backgroundColor: supp.color }]}
                  />
                  <View style={styles.suppInfo}>
                    <Text
                      style={[styles.suppName, { color: colors.foreground, opacity: supp.enabled ? 1 : 0.5 }]}
                      numberOfLines={1}
                    >
                      {supp.name}
                    </Text>
                    <Text style={[styles.suppMeta, { color: colors.mutedForeground }]}>
                      {supp.dose}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => toggleEnabled(supp.id)}
                    hitSlop={8}
                    style={[
                      styles.togglePill,
                      {
                        backgroundColor: supp.enabled
                          ? supp.color + "25"
                          : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.togglePillText,
                        { color: supp.enabled ? supp.color : colors.mutedForeground },
                      ]}
                    >
                      {supp.enabled ? "On" : "Off"}
                    </Text>
                  </Pressable>
                  {supp.id.startsWith("custom_") && (
                    <Pressable
                      onPress={() => deleteSupp(supp.id)}
                      hitSlop={8}
                      style={{ marginLeft: 6 }}
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
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  summarySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryFraction: { fontSize: 32, fontFamily: "SpaceGrotesk_700Bold" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  suppList: { gap: 10 },
  suppRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  suppDot: { width: 10, height: 10, borderRadius: 5 },
  suppInfo: { flex: 1, gap: 2 },
  suppName: { fontSize: 15, fontFamily: "Inter_500Medium" },
  suppMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  suppRight: { alignItems: "center" },
  complianceText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  complianceLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: { alignItems: "center", gap: 12, paddingVertical: 48 },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  sectionTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  addSection: { gap: 10 },
  addRow: { flexDirection: "row", gap: 10 },
  addInput: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  addInputSmall: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  addBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  manageList: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  togglePill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  togglePillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
