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
import { useFitness } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";

const WELLNESS_PREFIX = "@raimzeal_wellness_v1_";

const DISCLAIMER: FeatureDisclaimerConfig = {
  storageKey: "@raimzeal_adaptive_workout_disclaimer_seen",
  icon: "barbell-outline",
  iconColor: "#3b82f6",
  title: "Adaptive Workout Suggestions",
  body:
    "Workout suggestions are generated from your wellness check-in data for general fitness guidance only.\n\n" +
    "They are not medical or physiotherapy advice. Consult a healthcare provider before starting a new exercise programme, especially if you have an injury or medical condition.\n\n" +
    "Stop immediately if you feel pain, dizziness, or chest discomfort.",
  acceptLabel: "I understand — show my plan",
};

interface WellnessEntry { mood: 1|2|3|4|5; energy: 1|2|3|4|5; stress: 1|2|3|4|5; recovery: 1|2|3|4|5; }

function todayKey() { return new Date().toISOString().split("T")[0]; }
function readiness(e: WellnessEntry) { return Math.round((e.mood + e.energy + (6 - e.stress) + e.recovery) / 4 * 20); }

interface SuggestedWorkout {
  type: string;
  emoji: string;
  duration: string;
  intensity: string;
  color: string;
  description: string;
  exercises: { name: string; sets?: string; note?: string }[];
  tip: string;
}

function getSuggestion(score: number, recentWorkoutDays: number): SuggestedWorkout {
  if (score >= 80) {
    return {
      type: "High Performance Day",
      emoji: "🚀",
      duration: "45–60 min",
      intensity: "High",
      color: "#10b981",
      description: "Your readiness is excellent. Push hard today — strength training or intense cardio will deliver great results.",
      exercises: [
        { name: "Compound lift (deadlift, squat, or bench)", sets: "4×5", note: "Work up to 85–90% of 1RM" },
        { name: "Accessory supersets", sets: "3×10–12" },
        { name: "HIIT finisher", sets: "10 min", note: "30s on / 20s off" },
      ],
      tip: "Eat a good pre-workout meal 60–90 min before. Hydrate well during.",
    };
  }
  if (score >= 60) {
    return {
      type: "Steady State Day",
      emoji: "💪",
      duration: "35–45 min",
      intensity: "Moderate",
      color: "#3b82f6",
      description: "Good readiness for a quality training session. Focus on technique and consistency.",
      exercises: [
        { name: "Main compound movement", sets: "3×6–8", note: "70–80% effort" },
        { name: "Accessory work", sets: "3×10–15" },
        { name: "Light cardio cool-down", sets: "10 min" },
      ],
      tip: "Quality over quantity today. Focus on mind-muscle connection.",
    };
  }
  if (score >= 40) {
    return {
      type: "Recovery Training",
      emoji: "🌿",
      duration: "20–30 min",
      intensity: "Low",
      color: "#f59e0b",
      description: "Your readiness is below average. Light, therapeutic movement will help more than skipping entirely.",
      exercises: [
        { name: "Walking", sets: "15–20 min", note: "Easy pace — outdoors if possible" },
        { name: "Full-body stretch", sets: "10 min" },
        { name: "Foam rolling", sets: "5 min", note: "Focus on tight areas" },
      ],
      tip: "Movement at this level reduces soreness and improves blood flow without adding stress.",
    };
  }
  return {
    type: "Full Rest Day",
    emoji: "😴",
    duration: "Rest",
    intensity: "None",
    color: "#ef4444",
    description: "Your readiness score is very low. Your body is telling you it needs recovery — honour that.",
    exercises: [
      { name: "Sleep 8+ hours tonight", note: "Priority #1" },
      { name: "Gentle walking only", note: "5–10 min max" },
      { name: "Breathing or meditation", sets: "10 min" },
    ],
    tip: "Skipping a session when you need rest is not failure — it's smart training.",
  };
}

export default function AdaptiveWorkoutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { workoutLogs } = useFitness();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [score, setScore] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<SuggestedWorkout | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(WELLNESS_PREFIX + todayKey()).then((raw) => {
      const today = new Date().toISOString().split("T")[0];
      const recentDays = workoutLogs.filter((w) => {
        const d = new Date(w.date);
        const now = new Date();
        return (now.getTime() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
      }).length;
      if (raw) {
        const entry: WellnessEntry = JSON.parse(raw);
        const s = readiness(entry);
        setScore(s);
        setSuggestion(getSuggestion(s, recentDays));
      } else {
        setSuggestion(getSuggestion(60, recentDays));
      }
    });
  }, [workoutLogs]);


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
            <Text style={[styles.title, { color: colors.foreground }]}>Adaptive Workouts</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Reign · Based on today's readiness</Text>
          </View>
        </View>

        {/* Readiness context */}
        {score !== null ? (
          <GlassCard style={[styles.scoreCard, { borderColor: (suggestion?.color ?? "#10b981") + "50" }]}>
            <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>Today's Readiness Score</Text>
            <Text style={[styles.scoreValue, { color: suggestion?.color ?? "#10b981" }]}>{score}/100</Text>
            <Text style={[styles.scoreHint, { color: colors.mutedForeground }]}>
              Based on your wellness check-in today
            </Text>
          </GlassCard>
        ) : (
          <TouchableOpacity
            onPress={() => router.push("/wellness-checkin")}
            style={[styles.noCheckin, { backgroundColor: colors.card, borderColor: colors.border }]}
            activeOpacity={0.8}
          >
            <Ionicons name="happy-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.noCheckinText, { color: colors.foreground }]}>No check-in today</Text>
              <Text style={[styles.noCheckinSub, { color: colors.mutedForeground }]}>
                Tap to complete your wellness check-in for a personalised suggestion
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}

        {/* Suggestion */}
        {suggestion && (
          <>
            <GlassCard style={[styles.suggestionCard, { borderColor: suggestion.color + "50" }]}>
              <View style={styles.suggestionTop}>
                <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.suggestionType, { color: suggestion.color }]}>{suggestion.type}</Text>
                  <View style={styles.suggestionMeta}>
                    <View style={[styles.metaBadge, { backgroundColor: suggestion.color + "20" }]}>
                      <Ionicons name="time-outline" size={12} color={suggestion.color} />
                      <Text style={[styles.metaText, { color: suggestion.color }]}>{suggestion.duration}</Text>
                    </View>
                    <View style={[styles.metaBadge, { backgroundColor: suggestion.color + "20" }]}>
                      <Ionicons name="flash-outline" size={12} color={suggestion.color} />
                      <Text style={[styles.metaText, { color: suggestion.color }]}>{suggestion.intensity}</Text>
                    </View>
                  </View>
                </View>
              </View>
              <Text style={[styles.suggestionDesc, { color: colors.mutedForeground }]}>{suggestion.description}</Text>
            </GlassCard>

            <GlassCard style={styles.exerciseCard}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Suggested Session</Text>
              {suggestion.exercises.map((ex, i) => (
                <View key={i} style={[styles.exerciseRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.exNum, { backgroundColor: suggestion.color + "20" }]}>
                    <Text style={[styles.exNumText, { color: suggestion.color }]}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.exName, { color: colors.foreground }]}>{ex.name}</Text>
                    <View style={styles.exMeta}>
                      {ex.sets && <Text style={[styles.exSets, { color: suggestion.color }]}>{ex.sets}</Text>}
                      {ex.note && <Text style={[styles.exNote, { color: colors.mutedForeground }]}>{ex.note}</Text>}
                    </View>
                  </View>
                </View>
              ))}
            </GlassCard>

            <GlassCard style={[styles.tipCard, { borderColor: suggestion.color + "30" }]}>
              <View style={styles.tipHeader}>
                <Ionicons name="bulb-outline" size={16} color={suggestion.color} />
                <Text style={[styles.tipTitle, { color: colors.foreground }]}>Today's Tip</Text>
              </View>
              <Text style={[styles.tipText, { color: colors.mutedForeground }]}>{suggestion.tip}</Text>
            </GlassCard>

            <AnimatedPressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/(tabs)/workouts"); }}
              style={[styles.startBtn, { backgroundColor: suggestion.intensity === "None" ? colors.muted : suggestion.color }]}
              scale={0.97}
            >
              <Ionicons name={suggestion.intensity === "None" ? "bed-outline" : "barbell-outline"} size={20} color={suggestion.intensity === "None" ? colors.mutedForeground : "#fff"} />
              <Text style={[styles.startBtnText, { color: suggestion.intensity === "None" ? colors.mutedForeground : "#fff" }]}>
                {suggestion.intensity === "None" ? "Rest Today" : "Go to Workouts"}
              </Text>
            </AnimatedPressable>
          </>
        )}

        <View style={[styles.disclaimer, { borderColor: colors.border }]}>
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            Suggestions are for general fitness guidance only · Not medical advice · Stop if you feel pain
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  scoreCard: { gap: 4, borderWidth: 1.5, alignItems: "center", paddingVertical: 20 },
  scoreLabel: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  scoreValue: { fontSize: 44, fontFamily: "SpaceGrotesk_700Bold" },
  scoreHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  noCheckin: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  noCheckinText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  noCheckinSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 2 },
  suggestionCard: { gap: 10, borderWidth: 1.5 },
  suggestionTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  suggestionEmoji: { fontSize: 32 },
  suggestionType: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  suggestionMeta: { flexDirection: "row", gap: 8, marginTop: 4 },
  metaBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  metaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  suggestionDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  exerciseCard: { gap: 0 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  exerciseRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  exNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
  exNumText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  exName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  exMeta: { flexDirection: "row", gap: 8, marginTop: 3, flexWrap: "wrap" },
  exSets: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  exNote: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tipCard: { gap: 8, borderWidth: 1 },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  tipTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tipText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: 14 },
  startBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  disclaimer: { borderTopWidth: 1, paddingTop: 12 },
  disclaimerText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  gateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
