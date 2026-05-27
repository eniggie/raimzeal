import React, { useEffect, useState } from "react";
import {
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

const PERIOD_KEY = "@raimzeal_period_tracker_v1";

const DISCLAIMER: FeatureDisclaimerConfig = {
  storageKey: "@raimzeal_cycle_sync_disclaimer_seen",
  icon: "rose-outline",
  iconColor: "#ec4899",
  title: "Cycle-Phase Wellness",
  body:
    "Cycle-phase recommendations are for general wellness awareness only.\n\n" +
    "This feature does NOT provide medical advice, fertility guidance, or contraceptive information. Always consult your healthcare provider for medical decisions.\n\n" +
    "Cycle predictions are estimates based on your logged data.",
  acceptLabel: "I understand — show my phases",
};

type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal" | "unknown";

interface PhaseInfo {
  phase: CyclePhase;
  day: number;
  label: string;
  emoji: string;
  color: string;
  description: string;
  workout: { title: string; examples: string[]; intensity: string };
  nutrition: { title: string; tips: string[] };
  recovery: { title: string; tips: string[] };
}

const PHASE_DATA: Record<CyclePhase, Omit<PhaseInfo, "phase" | "day">> = {
  menstrual: {
    label: "Menstrual Phase",
    emoji: "🩸",
    color: "#ef4444",
    description: "Hormone levels are at their lowest. Your body needs rest and gentle movement. Honour the need to slow down.",
    workout: {
      title: "Gentle Movement",
      intensity: "Low",
      examples: ["Gentle yoga", "Walking", "Stretching", "Pilates"],
    },
    nutrition: {
      title: "Nourishment Focus",
      tips: [
        "Iron-rich foods to replace losses: red meat, lentils, spinach",
        "Omega-3s to reduce inflammation: salmon, walnuts, chia",
        "Warm, cooked foods are easier to digest",
        "Reduce caffeine if cramping is significant",
      ],
    },
    recovery: {
      title: "Prioritise Rest",
      tips: [
        "Sleep 7–9 hours — your body is rebuilding",
        "Heat therapy (hot water bottle) eases cramps",
        "Magnesium can help with cramping and mood",
      ],
    },
  },
  follicular: {
    label: "Follicular Phase",
    emoji: "🌱",
    color: "#10b981",
    description: "Oestrogen rises, energy increases, and your brain is sharper. Best time for new goals, high performance, and social connection.",
    workout: {
      title: "Build & Explore",
      intensity: "Moderate–High",
      examples: ["Strength training", "HIIT", "Running", "Dance classes"],
    },
    nutrition: {
      title: "Fuel the Rise",
      tips: [
        "Higher protein to support muscle building",
        "Fermented foods to boost gut health: yogurt, kefir, kimchi",
        "Lighter, fresher foods — salads, raw veg, smoothies",
        "Stay hydrated — energy expenditure is rising",
      ],
    },
    recovery: {
      title: "Active Recovery OK",
      tips: [
        "Your body recovers faster in this phase",
        "Incorporate active rest days with light cardio",
        "Sleep quality improves — use this to catch up on rest",
      ],
    },
  },
  ovulation: {
    label: "Ovulation Phase",
    emoji: "✨",
    color: "#f59e0b",
    description: "Peak oestrogen and LH surge. You feel your strongest and most social. Perfect for intense efforts and important conversations.",
    workout: {
      title: "Peak Performance",
      intensity: "High",
      examples: ["Max effort lifts", "Sprint intervals", "Competition", "Group classes"],
    },
    nutrition: {
      title: "Antioxidant Boost",
      tips: [
        "Anti-inflammatory foods: berries, leafy greens, turmeric",
        "Zinc-rich foods to support egg health: pumpkin seeds, chickpeas",
        "Light, easily digestible meals before training",
        "Electrolytes if sweating heavily",
      ],
    },
    recovery: {
      title: "Listen to Joints",
      tips: [
        "Joint laxity is higher — warm up thoroughly",
        "Watch for over-training — energy may mask fatigue",
        "Foam roll and stretch post-workout",
      ],
    },
  },
  luteal: {
    label: "Luteal Phase",
    emoji: "🍂",
    color: "#8b5cf6",
    description: "Progesterone rises after ovulation. Energy starts to drop in the second half. Your body prepares for either pregnancy or the next cycle.",
    workout: {
      title: "Moderate & Mindful",
      intensity: "Moderate",
      examples: ["Steady-state cardio", "Lighter weight training", "Yoga", "Swimming"],
    },
    nutrition: {
      title: "Craving & Comfort",
      tips: [
        "Complex carbs ease PMS and mood: oats, sweet potato, brown rice",
        "Magnesium-rich foods: dark chocolate, avocado, seeds",
        "Reduce salt to limit bloating",
        "Calcium helps with PMS: dairy, fortified plant milk, leafy greens",
      ],
    },
    recovery: {
      title: "Prioritise Sleep",
      tips: [
        "Sleep may be disrupted — wind down earlier",
        "Reduce intense sessions in the last 5 days",
        "Breathing exercises help with mood swings",
      ],
    },
  },
  unknown: {
    label: "Phase Unknown",
    emoji: "❓",
    color: "#878792",
    description: "Log your period in the Period Tracker to unlock cycle-phase guidance.",
    workout: {
      title: "General Fitness",
      intensity: "As you feel",
      examples: ["Any workout you enjoy"],
    },
    nutrition: { title: "Balanced Eating", tips: ["Log meals and track macros for insights."] },
    recovery: { title: "Rest & Listen", tips: ["Rest when tired, train when energised."] },
  },
};

function detectPhase(lastPeriodStart: string | null, avgCycleLen: number, avgPeriodLen: number): { phase: CyclePhase; day: number } {
  if (!lastPeriodStart) return { phase: "unknown", day: 0 };
  const start = new Date(lastPeriodStart);
  const today = new Date();
  const day = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  if (day < 1 || day > avgCycleLen + 7) return { phase: "unknown", day };
  if (day <= avgPeriodLen) return { phase: "menstrual", day };
  const ovulationDay = Math.round(avgCycleLen / 2);
  if (day < ovulationDay - 2) return { phase: "follicular", day };
  if (day <= ovulationDay + 2) return { phase: "ovulation", day };
  return { phase: "luteal", day };
}

export default function CycleSyncScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { tier } = useTier(authUser?.id ?? null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [phaseInfo, setPhaseInfo] = useState<{ phase: CyclePhase; day: number }>({ phase: "unknown", day: 0 });
  const [activeSection, setActiveSection] = useState<"workout" | "nutrition" | "recovery">("workout");

  useEffect(() => {
    AsyncStorage.getItem(PERIOD_KEY).then((raw) => {
      if (!raw) return;
      const data = JSON.parse(raw) as { periods?: { startDate: string }[]; avgCycleLength?: number; avgPeriodLength?: number };
      const lastPeriod = data.periods?.[data.periods.length - 1]?.startDate ?? null;
      const avgCycle = data.avgCycleLength ?? 28;
      const avgPeriod = data.avgPeriodLength ?? 5;
      setPhaseInfo(detectPhase(lastPeriod, avgCycle, avgPeriod));
    });
  }, []);

  const info = PHASE_DATA[phaseInfo.phase];

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
            <Text style={[styles.title, { color: colors.foreground }]}>Cycle-Phase Sync</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Rise · Personalised by cycle phase</Text>
          </View>
        </View>

        {/* Phase Card */}
        <GlassCard style={[styles.phaseCard, { borderColor: info.color + "50" }]}>
          <View style={styles.phaseTop}>
            <Text style={styles.phaseEmoji}>{info.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.phaseLabel, { color: info.color }]}>{info.label}</Text>
              {phaseInfo.day > 0 && (
                <Text style={[styles.phaseDay, { color: colors.mutedForeground }]}>
                  Cycle day {phaseInfo.day}
                </Text>
              )}
            </View>
            {phaseInfo.phase === "unknown" && (
              <TouchableOpacity
                onPress={() => router.push("/period-tracker")}
                style={[styles.logBtn, { backgroundColor: "#ec489920" }]}
              >
                <Text style={[styles.logBtnText, { color: "#ec4899" }]}>Log Period</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.phaseDesc, { color: colors.mutedForeground }]}>{info.description}</Text>
        </GlassCard>

        {/* Section Tabs */}
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["workout", "nutrition", "recovery"] as const).map((s) => {
            const icons = { workout: "barbell-outline", nutrition: "restaurant-outline", recovery: "bed-outline" } as const;
            const active = activeSection === s;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => { Haptics.selectionAsync(); setActiveSection(s); }}
                style={[styles.tabBtn, active && { backgroundColor: colors.card }]}
              >
                <Ionicons name={icons[s]} size={15} color={active ? info.color : colors.mutedForeground} />
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

        {/* Workout Section */}
        {activeSection === "workout" && (
          <GlassCard style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{info.workout.title}</Text>
              <View style={[styles.intensityBadge, { backgroundColor: info.color + "20" }]}>
                <Text style={[styles.intensityText, { color: info.color }]}>
                  Intensity: {info.workout.intensity}
                </Text>
              </View>
            </View>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>Recommended activities this phase:</Text>
            {info.workout.examples.map((ex, i) => (
              <View key={i} style={styles.tipItem}>
                <View style={[styles.tipDot, { backgroundColor: info.color }]} />
                <Text style={[styles.tipText, { color: colors.foreground }]}>{ex}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Nutrition Section */}
        {activeSection === "nutrition" && (
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{info.nutrition.title}</Text>
            {info.nutrition.tips.map((tip, i) => (
              <View key={i} style={styles.tipItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={info.color} />
                <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        {/* Recovery Section */}
        {activeSection === "recovery" && (
          <GlassCard style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{info.recovery.title}</Text>
            {info.recovery.tips.map((tip, i) => (
              <View key={i} style={styles.tipItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color={info.color} />
                <Text style={[styles.tipText, { color: colors.foreground }]}>{tip}</Text>
              </View>
            ))}
          </GlassCard>
        )}

        <View style={[styles.disclaimer, { borderColor: colors.border }]}>
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            Cycle-phase guidance is for wellness awareness only · Not a substitute for medical advice · RAIMZEAL does not claim contraceptive accuracy
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
  phaseCard: { gap: 10, borderWidth: 1.5 },
  phaseTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  phaseEmoji: { fontSize: 36 },
  phaseLabel: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  phaseDay: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  logBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  logBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  phaseDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  tabRow: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 2 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10 },
  tabLabel: { fontSize: 13 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  intensityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  intensityText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  tipItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  tipDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  disclaimer: { borderTopWidth: 1, paddingTop: 12 },
  disclaimerText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  gateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
