import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "@raimzeal_menopause_tracker_v1";
const ACCENT = "#f59e0b";

type Severity = 1 | 2 | 3;

interface DayEntry {
  date: string;
  symptoms: Record<string, Severity>;
}

interface MenopauseData {
  entries: DayEntry[];
  stage?: "perimenopause" | "menopause" | "postmenopause";
}

const SYMPTOMS = [
  { id: "hot_flashes", label: "Hot flashes", icon: "flame-outline", color: "#ef4444" },
  { id: "night_sweats", label: "Night sweats", icon: "water-outline", color: "#3b82f6" },
  { id: "sleep_issues", label: "Sleep problems", icon: "moon-outline", color: "#6366f1" },
  { id: "mood_swings", label: "Mood swings", icon: "happy-outline", color: "#f59e0b" },
  { id: "anxiety", label: "Anxiety", icon: "pulse-outline", color: "#ec4899" },
  { id: "brain_fog", label: "Brain fog", icon: "cloud-outline", color: "#64748b" },
  { id: "fatigue", label: "Fatigue", icon: "battery-dead-outline", color: "#94a3b8" },
  { id: "joint_pain", label: "Joint pain", icon: "fitness-outline", color: "#f97316" },
  { id: "headaches", label: "Headaches", icon: "medical-outline", color: "#a855f7" },
  { id: "dry_skin", label: "Dry skin/hair", icon: "sparkles-outline", color: "#84cc16" },
  { id: "low_libido", label: "Low libido", icon: "heart-dislike-outline", color: "#f43f5e" },
  { id: "vaginal_dryness", label: "Vaginal dryness", icon: "alert-circle-outline", color: "#ec4899" },
  { id: "weight_changes", label: "Weight changes", icon: "scale-outline", color: "#10b981" },
  { id: "heart_palpitations", label: "Heart palpitations", icon: "heart-outline", color: "#ef4444" },
];

const STAGES = [
  { id: "perimenopause", label: "Perimenopause", desc: "Transition period (irregular periods)", color: "#f59e0b" },
  { id: "menopause", label: "Menopause", desc: "12+ months without a period", color: "#ef4444" },
  { id: "postmenopause", label: "Postmenopause", desc: "After menopause", color: "#10b981" },
] as const;

const SEVERITY_LABELS: Record<Severity, string> = { 1: "Mild", 2: "Moderate", 3: "Severe" };
const SEVERITY_COLORS: Record<Severity, string> = { 1: "#10b981", 2: "#f59e0b", 3: "#ef4444" };

function toKey(d: Date) { return d.toISOString().split("T")[0]; }
function formatDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}
function monthLabel(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString("en", { month: "long", year: "numeric" });
}

export default function MenopauseTrackerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<MenopauseData>({ entries: [] });
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState(false);
  const [logSymptoms, setLogSymptoms] = useState<Record<string, Severity>>({});
  const today = toKey(new Date());

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setData(JSON.parse(raw));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = useCallback(async (next: MenopauseData) => {
    setData(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  function openLog() {
    const existing = data.entries.find((e) => e.date === today);
    setLogSymptoms(existing?.symptoms ?? {});
    setLogModal(true);
  }

  function saveLog() {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const existing = data.entries.findIndex((e) => e.date === today);
    const entry: DayEntry = { date: today, symptoms: logSymptoms };
    let entries = [...data.entries];
    if (existing >= 0) entries[existing] = entry;
    else entries = [entry, ...entries];
    save({ ...data, entries });
    setLogModal(false);
  }

  function setStage(stage: MenopauseData["stage"]) {
    save({ ...data, stage: data.stage === stage ? undefined : stage });
  }

  function toggleSeverity(id: string) {
    setLogSymptoms((prev) => {
      const cur = prev[id];
      if (!cur) return { ...prev, [id]: 1 };
      if (cur === 1) return { ...prev, [id]: 2 };
      if (cur === 2) return { ...prev, [id]: 3 };
      const next = { ...prev }; delete next[id]; return next;
    });
  }

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }]}>
        <Ionicons name="sunny-outline" size={40} color={ACCENT} />
      </View>
    );
  }


  const currentStage = STAGES.find((s) => s.id === data.stage);
  const freqMap: Record<string, number> = {};
  for (const e of data.entries) {
    for (const id of Object.keys(e.symptoms)) {
      freqMap[id] = (freqMap[id] ?? 0) + 1;
    }
  }
  const topSymptoms = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const grouped = data.entries.reduce<Record<string, DayEntry[]>>((acc, e) => {
    const month = e.date.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(e);
    return acc;
  }, {});

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Menopause Tracker</Text>
        </View>
        <View style={[styles.planBadge, { backgroundColor: ACCENT + "20" }]}>
          <Text style={[styles.planBadgeText, { color: ACCENT }]}>Rise+</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroBanner, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
          <View style={[styles.heroIcon, { backgroundColor: ACCENT + "25" }]}>
            <Ionicons name="sunny-outline" size={28} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Symptom Tracker</Text>
            <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
              Log 14 menopause symptoms daily. Tap to cycle through mild → moderate → severe.
            </Text>
          </View>
        </View>

        {/* Stage selector */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>My Stage</Text>
          <View style={styles.stagesRow}>
            {STAGES.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.stageChip,
                  { borderColor: s.color, backgroundColor: data.stage === s.id ? s.color + "20" : "transparent" },
                ]}
                onPress={() => setStage(s.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.stageLabel, { color: s.color }]}>{s.label}</Text>
                <Text style={[styles.stageDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {topSymptoms.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Most Frequent</Text>
            {topSymptoms.map(([id, count]) => {
              const def = SYMPTOMS.find((s) => s.id === id);
              if (!def) return null;
              return (
                <View key={id} style={styles.freqRow}>
                  <View style={[styles.freqDot, { backgroundColor: def.color + "30" }]}>
                    <Ionicons name={def.icon as any} size={16} color={def.color} />
                  </View>
                  <Text style={[styles.freqLabel, { color: colors.foreground }]}>{def.label}</Text>
                  <Text style={[styles.freqCount, { color: colors.mutedForeground }]}>{count}x logged</Text>
                </View>
              );
            })}
          </View>
        )}

        <TouchableOpacity
          style={[styles.logTodayBtn, { backgroundColor: ACCENT }]}
          onPress={openLog}
          activeOpacity={0.85}
        >
          <Ionicons name={data.entries[0]?.date === today ? "create" : "add-circle-outline"} size={20} color="#fff" />
          <Text style={styles.logTodayText}>
            {data.entries[0]?.date === today ? "Edit Today's Log" : "Log Today's Symptoms"}
          </Text>
        </TouchableOpacity>

        {Object.keys(grouped).sort().reverse().map((month) => (
          <View key={month} style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{monthLabel(month + "-01")}</Text>
            {grouped[month].map((entry, i) => {
              const symKeys = Object.keys(entry.symptoms);
              return (
                <View
                  key={entry.date}
                  style={[styles.entryRow, i < grouped[month].length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                >
                  <Text style={[styles.entryDate, { color: colors.foreground }]}>{formatDate(entry.date)}</Text>
                  <View style={styles.entrySymptoms}>
                    {symKeys.length === 0 ? (
                      <Text style={[styles.noSymptoms, { color: colors.mutedForeground }]}>No symptoms</Text>
                    ) : symKeys.map((id) => {
                      const def = SYMPTOMS.find((s) => s.id === id);
                      const sev = entry.symptoms[id];
                      if (!def) return null;
                      return (
                        <View key={id} style={[styles.symChip, { backgroundColor: SEVERITY_COLORS[sev] + "20", borderColor: SEVERITY_COLORS[sev] + "50" }]}>
                          <Text style={[styles.symChipText, { color: SEVERITY_COLORS[sev] }]}>
                            {def.label} · {SEVERITY_LABELS[sev]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        ))}

        {data.entries.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="sunny-outline" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No entries yet</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Log daily to track your symptom patterns over time.
            </Text>
          </View>
        )}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          For personal awareness only. Consult your doctor for diagnosis, treatment, or hormone therapy guidance.
        </Text>
      </ScrollView>

      <Modal visible={logModal} transparent animationType="slide" onRequestClose={() => setLogModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.handle} />
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Log — {formatDate(today)}</Text>
            <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>Tap once = Mild · twice = Moderate · 3× = Severe</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              <View style={styles.symptomsGrid}>
                {SYMPTOMS.map((s) => {
                  const sev = logSymptoms[s.id] as Severity | undefined;
                  const active = !!sev;
                  const sevColor = sev ? SEVERITY_COLORS[sev] : colors.mutedForeground;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.symButton,
                        { borderColor: active ? sevColor : colors.border, backgroundColor: active ? sevColor + "20" : "transparent" },
                      ]}
                      onPress={() => toggleSeverity(s.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={s.icon as any} size={15} color={active ? sevColor : colors.mutedForeground} />
                      <Text style={[styles.symButtonText, { color: active ? sevColor : colors.mutedForeground }]}>{s.label}</Text>
                      {sev && <Text style={[styles.symSev, { color: sevColor }]}>{SEVERITY_LABELS[sev]}</Text>}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.sheetBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setLogModal(false)}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={saveLog}>
                <Text style={styles.saveBtnText}>Save</Text>
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
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  planBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 14 },
  heroBanner: { flexDirection: "row", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1 },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  heroBody: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  section: { borderRadius: 16, borderWidth: 1, padding: 14 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  stagesRow: { gap: 8 },
  stageChip: { padding: 12, borderRadius: 12, borderWidth: 1 },
  stageLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stageDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  freqRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  freqDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  freqLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  freqCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  logTodayBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: 14,
  },
  logTodayText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  entryRow: { paddingVertical: 10 },
  entryDate: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  entrySymptoms: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  noSymptoms: { fontSize: 12, fontFamily: "Inter_400Regular" },
  symChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  symChipText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  paywallContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  paywallCard: { borderRadius: 20, borderWidth: 1, padding: 28, alignItems: "center", gap: 12 },
  paywallIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  paywallTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  paywallBody: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  upgradeBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, marginTop: 4,
  },
  upgradeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  symptomsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8 },
  symButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1,
  },
  symButtonText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  symSev: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  sheetBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
