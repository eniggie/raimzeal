import React, { useCallback, useEffect, useState } from "react";
import {
  Linking,
  Platform,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { FeatureDisclaimerModal, type FeatureDisclaimerConfig } from "@/components/FeatureDisclaimerModal";
import { useTier } from "@/hooks/useTier";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "@raimzeal_pregnancy_v1";

const DISCLAIMER: FeatureDisclaimerConfig = {
  storageKey: "@raimzeal_pregnancy_disclaimer_seen",
  icon: "heart-outline",
  iconColor: "#ec4899",
  title: "Pregnancy Wellness",
  body:
    "RAIMZEAL's pregnancy wellness feature is for general wellbeing support only.\n\n" +
    "This is NOT medical advice and does not replace guidance from your OB/GYN, midwife, or healthcare provider.\n\n" +
    "If you experience pain, bleeding, reduced fetal movement, or any emergency symptom, call 911 or your maternity unit immediately.\n\n" +
    "Always consult your healthcare provider before starting or changing exercise or nutrition during pregnancy.",
  acceptLabel: "I understand — continue",
};

type Trimester = 1 | 2 | 3;

interface PregnancyData {
  weekNumber: number;
  setAt: string;
}

interface TrimesterInfo {
  label: string;
  emoji: string;
  color: string;
  weekRange: string;
  description: string;
  exercises: string[];
  nutritionTips: string[];
  wellnessTips: string[];
  avoidList: string[];
}

const TRIMESTER_DATA: Record<Trimester, TrimesterInfo> = {
  1: {
    label: "First Trimester",
    emoji: "🌱",
    color: "#10b981",
    weekRange: "Weeks 1–12",
    description: "Your baby is growing rapidly. Fatigue and nausea are common. Listen to your body — rest is productive.",
    exercises: [
      "Walking (30 min most days)",
      "Prenatal yoga",
      "Gentle swimming",
      "Light stretching",
      "Pelvic floor exercises (Kegels)",
    ],
    nutritionTips: [
      "400–800 mcg folate/folic acid daily",
      "Small, frequent meals to manage nausea",
      "Iron-rich foods: lean red meat, spinach, lentils",
      "Stay hydrated — aim for 8–10 glasses of water",
      "Ginger tea may help with morning sickness",
    ],
    wellnessTips: [
      "Sleep on your side when possible from week 8",
      "Reduce caffeine to under 200 mg/day",
      "Avoid alcohol entirely",
      "Attend your first prenatal appointment",
    ],
    avoidList: ["Heavy lifting", "Contact sports", "Hot tubs/saunas", "Raw fish/unpasteurised dairy"],
  },
  2: {
    label: "Second Trimester",
    emoji: "🌻",
    color: "#f59e0b",
    weekRange: "Weeks 13–26",
    description: "Often called the 'golden trimester'. Energy often returns. Baby movements begin. A good time to establish gentle fitness habits.",
    exercises: [
      "Prenatal swimming",
      "Prenatal yoga or Pilates",
      "Low-impact aerobics",
      "Walking with light hills",
      "Stationary cycling",
    ],
    nutritionTips: [
      "+340 extra calories/day in second trimester",
      "Calcium: dairy, fortified plant milk, leafy greens",
      "Omega-3: oily fish (2 portions/week), walnuts, flaxseed",
      "Vitamin D: safe sun exposure + fortified foods",
      "Protein: aim for 70–100g/day",
    ],
    wellnessTips: [
      "Sleep on your left side for better circulation",
      "Wear a support belt as bump grows",
      "Track baby movements from week 20",
      "Attend anatomy scan around week 20",
    ],
    avoidList: ["Lying flat on your back for long periods", "High-intensity jumps", "Core exercises with heavy spinal load"],
  },
  3: {
    label: "Third Trimester",
    emoji: "🌕",
    color: "#8b5cf6",
    weekRange: "Weeks 27–40+",
    description: "Your body is preparing for birth. Discomfort increases but movement remains important. Focus on rest, bonding, and birth preparation.",
    exercises: [
      "Gentle walking",
      "Prenatal yoga (birth preparation focus)",
      "Pelvic floor and breathing exercises",
      "Gentle swimming",
      "Seated stretching",
    ],
    nutritionTips: [
      "+450 extra calories/day in third trimester",
      "Iron-rich foods remain important as blood volume peaks",
      "Dates from week 36 may support cervical preparation",
      "Smaller, more frequent meals as space reduces",
      "Red raspberry leaf tea from 36 weeks (check with midwife)",
    ],
    wellnessTips: [
      "Birth plan preparation",
      "Perineal massage from week 34",
      "Hospital bag ready by week 36",
      "Rest as much as possible — sleep now",
    ],
    avoidList: ["Any exercise causing shortness of breath", "New vigorous activities", "Prolonged standing"],
  },
};

function weekToTrimester(week: number): Trimester {
  if (week <= 12) return 1;
  if (week <= 26) return 2;
  return 3;
}

export default function PregnancyWellnessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { tier } = useTier(authUser?.id ?? null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [weekNumber, setWeekNumber] = useState<number>(8);
  const [activeSection, setActiveSection] = useState<"exercise" | "nutrition" | "wellness">("exercise");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const data: PregnancyData = JSON.parse(raw);
        const storedAt = new Date(data.setAt);
        const weeksElapsed = Math.floor((Date.now() - storedAt.getTime()) / (1000 * 60 * 60 * 24 * 7));
        setWeekNumber(Math.min(42, data.weekNumber + weeksElapsed));
      }
    });
  }, []);

  const trimester = weekToTrimester(weekNumber);
  const info = TRIMESTER_DATA[trimester];

  const adjustWeek = useCallback(async (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = Math.max(1, Math.min(42, weekNumber + delta));
    setWeekNumber(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ weekNumber: next, setAt: new Date().toISOString() }));
  }, [weekNumber]);


  return (
    <>
      <FeatureDisclaimerModal config={DISCLAIMER} />
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
            <Text style={[styles.title, { color: colors.foreground }]}>Pregnancy Wellness</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Rise · General wellness only</Text>
          </View>
        </View>

        {/* Week Card */}
        <GlassCard style={[styles.weekCard, { borderColor: info.color + "50" }]}>
          <Text style={[styles.weekLabel, { color: colors.mutedForeground }]}>Current Week</Text>
          <View style={styles.weekRow}>
            <TouchableOpacity onPress={() => adjustWeek(-1)} style={styles.weekBtn} activeOpacity={0.7}>
              <Ionicons name="remove" size={20} color={colors.foreground} />
            </TouchableOpacity>
            <View style={{ alignItems: "center" }}>
              <Text style={[styles.weekNum, { color: info.color }]}>{weekNumber}</Text>
              <Text style={[styles.weekSub, { color: colors.mutedForeground }]}>weeks pregnant</Text>
            </View>
            <TouchableOpacity onPress={() => adjustWeek(1)} style={styles.weekBtn} activeOpacity={0.7}>
              <Ionicons name="add" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <View style={[styles.trimBadge, { backgroundColor: info.color + "20" }]}>
            <Text style={styles.trimEmoji}>{info.emoji}</Text>
            <Text style={[styles.trimLabel, { color: info.color }]}>{info.label} · {info.weekRange}</Text>
          </View>
          <Text style={[styles.trimDesc, { color: colors.mutedForeground }]}>{info.description}</Text>
        </GlassCard>

        {/* Section Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["exercise", "nutrition", "wellness"] as const).map((s) => {
            const icons = { exercise: "barbell-outline", nutrition: "restaurant-outline", wellness: "heart-outline" } as const;
            const active = activeSection === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => { Haptics.selectionAsync(); setActiveSection(s); }}
                style={[styles.tabBtn, active && { backgroundColor: colors.card }]}
              >
                <Ionicons name={icons[s]} size={14} color={active ? info.color : colors.mutedForeground} />
                <Text style={[styles.tabLabel, {
                  color: active ? colors.foreground : colors.mutedForeground,
                  fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeSection === "exercise" && (
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Safe Exercises This Trimester</Text>
            {info.exercises.map((ex, i) => (
              <View key={i} style={styles.listItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={info.color} />
                <Text style={[styles.listText, { color: colors.foreground }]}>{ex}</Text>
              </View>
            ))}
            <View style={[styles.avoidBox, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}>
              <Text style={[styles.avoidTitle, { color: "#ef4444" }]}>⚠️ Avoid this trimester</Text>
              {info.avoidList.map((a, i) => (
                <Text key={i} style={[styles.avoidItem, { color: colors.mutedForeground }]}>• {a}</Text>
              ))}
            </View>
          </GlassCard>
        )}

        {activeSection === "nutrition" && (
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Nutrition Focus</Text>
            {info.nutritionTips.map((tip, i) => (
              <View key={i} style={styles.listItem}>
                <Ionicons name="leaf-outline" size={16} color={info.color} />
                <Text style={[styles.listText, { color: colors.foreground }]}>{tip}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        {activeSection === "wellness" && (
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Wellness & Preparation</Text>
            {info.wellnessTips.map((tip, i) => (
              <View key={i} style={styles.listItem}>
                <Ionicons name="heart-outline" size={16} color={info.color} />
                <Text style={[styles.listText, { color: colors.foreground }]}>{tip}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Emergency CTA */}
        <TouchableOpacity
          onPress={() => Linking.openURL("tel:911")}
          style={[styles.emergencyRow, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}
          activeOpacity={0.8}
        >
          <Ionicons name="call-outline" size={18} color="#ef4444" />
          <Text style={[styles.emergencyText, { color: "#ef4444" }]}>
            Pain, bleeding, or emergency — call 911 immediately
          </Text>
        </TouchableOpacity>

        <View style={[styles.disclaimerRow, { borderColor: colors.border }]}>
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            For wellness awareness only · Not medical advice · Always consult your OB/GYN or midwife
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  weekCard: { gap: 12, borderWidth: 1.5 },
  weekLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  weekRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  weekNum: { fontSize: 52, fontFamily: "SpaceGrotesk_700Bold", lineHeight: 56 },
  weekSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  trimBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  trimEmoji: { fontSize: 18 },
  trimLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  trimDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  tabRow: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 2 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10 },
  tabLabel: { fontSize: 13 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  listItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  listText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  avoidBox: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6 },
  avoidTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  avoidItem: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  emergencyRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 14,
  },
  emergencyText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  disclaimerRow: { borderTopWidth: 1, paddingTop: 12 },
  disclaimerText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  gateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
