import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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

const STORAGE_KEY = "@raimzeal_womens_health_reminders_v1";
const ACCENT = "#ec4899";

interface ReminderRecord {
  id: string;
  lastDone?: string;
  notes?: string;
}

interface RemindersData {
  records: Record<string, ReminderRecord>;
}

interface ReminderDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  intervalMonths: number;
  guideSteps?: string[];
  plan: string;
}

const REMINDERS: ReminderDef[] = [
  {
    id: "breast_exam",
    title: "Breast Self-Exam",
    description: "Monthly self-check to detect any changes early.",
    icon: "heart-outline",
    color: ACCENT,
    intervalMonths: 1,
    plan: "Foundation",
    guideSteps: [
      "Stand in front of a mirror with arms at your sides.",
      "Raise arms above your head — look for changes in shape, size, or skin.",
      "Place hands on hips and press down — check for dimpling or puckering.",
      "Lie down, use the pads of your fingers to feel each breast in a circular motion.",
      "Check your armpits and collarbone area for lumps.",
      "Check for any discharge from the nipples.",
    ],
  },
  {
    id: "pap_smear",
    title: "Pap Smear (Cervical Screening)",
    description: "Every 3 years (ages 21–65). Detects cervical cancer early.",
    icon: "medical-outline",
    color: "#8b5cf6",
    intervalMonths: 36,
    plan: "Foundation",
    guideSteps: [
      "Recommended every 3 years for ages 21–29.",
      "Every 3–5 years for ages 30–65 (with or without HPV co-test).",
      "Schedule with your gynecologist — takes about 5 minutes.",
      "Avoid sex, douching, or vaginal products 48 hours before the test.",
    ],
  },
  {
    id: "mammogram",
    title: "Mammogram",
    description: "Annual X-ray screening for breast cancer (age 40+).",
    icon: "scan-outline",
    color: "#f59e0b",
    intervalMonths: 12,
    plan: "Foundation",
    guideSteps: [
      "Recommended annually starting at age 40.",
      "Schedule at a licensed imaging centre or hospital.",
      "Do not wear deodorant, perfume, or powder on the day.",
      "Tell the technician about any breast changes you've noticed.",
    ],
  },
  {
    id: "gynaecologist",
    title: "Annual Gynaecologist Visit",
    description: "Yearly wellness check with your OB-GYN.",
    icon: "person-outline",
    color: "#10b981",
    intervalMonths: 12,
    plan: "Foundation",
    guideSteps: [
      "Book once a year even if you feel well.",
      "Discuss menstrual irregularities, pain, or discharge.",
      "Talk about contraception, fertility, or menopause concerns.",
      "Bring a list of any medications or supplements you take.",
    ],
  },
  {
    id: "hpv_vaccine",
    title: "HPV Vaccine Check",
    description: "Discuss HPV vaccination status with your doctor.",
    icon: "shield-checkmark-outline",
    color: "#3b82f6",
    intervalMonths: 12,
    plan: "Foundation",
    guideSteps: [
      "Recommended for ages 11–26; may be given up to age 45 with doctor advice.",
      "3-dose series if starting at age 15 or older.",
      "Ask your doctor if you are up to date.",
    ],
  },
  {
    id: "bone_density",
    title: "Bone Density Scan (DEXA)",
    description: "Recommended for women 65+ or earlier with risk factors.",
    icon: "body-outline",
    color: "#06b6d4",
    intervalMonths: 24,
    plan: "Foundation",
    guideSteps: [
      "DEXA scan is a low-radiation X-ray of hip and spine.",
      "Recommended at age 65, or earlier for postmenopausal women with risk factors.",
      "Risk factors: smoking, family history, low body weight, steroid use.",
    ],
  },
];

function toKey(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

function nextDueDate(lastDone: string | undefined, intervalMonths: number): string | null {
  if (!lastDone) return null;
  const d = new Date(lastDone);
  d.setMonth(d.getMonth() + intervalMonths);
  return toKey(d);
}

function daysUntil(target: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function statusLabel(reminder: ReminderDef, record?: ReminderRecord): { text: string; color: string } {
  if (!record?.lastDone) return { text: "Not logged yet", color: "#f59e0b" };
  const next = nextDueDate(record.lastDone, reminder.intervalMonths);
  if (!next) return { text: "Up to date", color: "#10b981" };
  const days = daysUntil(next);
  if (days < 0) return { text: `Overdue by ${Math.abs(days)} days`, color: "#ef4444" };
  if (days === 0) return { text: "Due today", color: "#f59e0b" };
  if (days <= 30) return { text: `Due in ${days} days`, color: "#f59e0b" };
  return { text: `Next: ${formatDate(next)}`, color: "#10b981" };
}

export default function WomensHealthRemindersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<RemindersData>({ records: {} });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setData(JSON.parse(raw));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const save = useCallback(async (next: RemindersData) => {
    setData(next);
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }, []);

  function markDone(id: string) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const today = toKey(new Date());
    Alert.alert("Mark as done?", `Record today (${formatDate(today)}) as your last completed check?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes, done", onPress: () => {
          const next: RemindersData = {
            records: { ...data.records, [id]: { ...data.records[id], id, lastDone: today } },
          };
          save(next);
        },
      },
    ]);
  }

  const today = toKey(new Date());
  const overdue = REMINDERS.filter((r) => {
    const rec = data.records[r.id];
    if (!rec?.lastDone) return true;
    const next = nextDueDate(rec.lastDone, r.intervalMonths);
    return next && daysUntil(next) < 0;
  }).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Women's Health</Text>
        </View>
        {overdue > 0 && (
          <View style={[styles.badge, { backgroundColor: "#ef4444" }]}>
            <Text style={styles.badgeText}>{overdue}</Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroBanner, { backgroundColor: ACCENT + "15", borderColor: ACCENT + "30" }]}>
          <View style={[styles.heroIcon, { backgroundColor: ACCENT + "25" }]}>
            <Ionicons name="rose-outline" size={28} color={ACCENT} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Health Reminders</Text>
            <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
              Track your routine screenings and self-checks. Tap any item to mark it done or read the guide.
            </Text>
          </View>
        </View>

        {REMINDERS.map((r) => {
          const rec = data.records[r.id];
          const status = statusLabel(r, rec);
          const isExpanded = expanded === r.id;
          const next = rec?.lastDone ? nextDueDate(rec.lastDone, r.intervalMonths) : null;
          const daysLeft = next ? daysUntil(next) : null;

          return (
            <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Card header row */}
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setExpanded(isExpanded ? null : r.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: r.color + "20" }]}>
                  <Ionicons name={r.icon as any} size={22} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{r.title}</Text>
                  <Text style={[styles.cardStatus, { color: status.color }]}>{status.text}</Text>
                </View>
                <Ionicons
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>

              {/* Expanded */}
              {isExpanded && (
                <View style={[styles.expanded, { borderTopColor: colors.border }]}>
                  <Text style={[styles.expandedDesc, { color: colors.mutedForeground }]}>{r.description}</Text>

                  {rec?.lastDone && (
                    <Text style={[styles.expandedMeta, { color: colors.mutedForeground }]}>
                      Last done: {formatDate(rec.lastDone)}
                      {daysLeft !== null && daysLeft > 0 ? `  ·  Next due in ${daysLeft} days` : ""}
                    </Text>
                  )}

                  {r.guideSteps && (
                    <View style={styles.guideBox}>
                      <Text style={[styles.guideTitle, { color: colors.foreground }]}>Quick Guide</Text>
                      {r.guideSteps.map((step, i) => (
                        <View key={i} style={styles.guideStep}>
                          <View style={[styles.guideNum, { backgroundColor: r.color + "25" }]}>
                            <Text style={[styles.guideNumText, { color: r.color }]}>{i + 1}</Text>
                          </View>
                          <Text style={[styles.guideStepText, { color: colors.mutedForeground }]}>{step}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: r.color }]}
                    onPress={() => markDone(r.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.doneBtnText}>Mark as Done Today</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          Screening intervals are general guidelines. Always follow your doctor's recommendations based on your personal health history.
        </Text>
      </ScrollView>
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
  badge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  content: { padding: 16, gap: 14 },
  heroBanner: {
    flexDirection: "row", gap: 14, padding: 16,
    borderRadius: 16, borderWidth: 1,
  },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  heroBody: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 18 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  cardStatus: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  expanded: { padding: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  expandedDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  expandedMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  guideBox: { gap: 8 },
  guideTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  guideStep: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  guideNum: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  guideNumText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  guideStepText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  doneBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 12,
  },
  doneBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
});
