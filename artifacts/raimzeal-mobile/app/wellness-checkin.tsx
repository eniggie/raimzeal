import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
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
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { getApiBase, getAccessToken } from "@/lib/db";

const STORAGE_PREFIX = "@raimzeal_wellness_v1_";
const DISCLAIMER_KEY = "@raimzeal_wellness_disclaimer_seen";

const CRISIS_KEYWORDS = [
  "suicide", "suicidal", "kill myself", "end my life", "can't go on",
  "want to die", "hurt myself", "self harm", "self-harm", "no reason to live",
  "hopeless", "give up on life",
];

interface WellnessEntry {
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  recovery: 1 | 2 | 3 | 4 | 5;
  notes: string;
  timestamp: string;
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

function last7Days() {
  const days: { key: string; label: string }[] = [];
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

function calcReadiness(entry: Pick<WellnessEntry, "mood" | "energy" | "stress" | "recovery">): number {
  const score = (entry.mood + entry.energy + (6 - entry.stress) + entry.recovery) / 4;
  return Math.round(score * 20);
}

function readinessLabel(score: number): { label: string; color: string; icon: keyof typeof Ionicons.glyphMap; tip: string } {
  if (score >= 80) return { label: "Push", color: "#10b981", icon: "flash-outline", tip: "Great day to train hard and chase goals." };
  if (score >= 60) return { label: "Maintain", color: "#3b82f6", icon: "walk-outline", tip: "Moderate activity — keep your routine steady." };
  if (score >= 40) return { label: "Recover", color: "#f59e0b", icon: "leaf-outline", tip: "Light movement only — your body needs care." };
  return { label: "Rest", color: "#ef4444", icon: "bed-outline", tip: "Full rest day recommended — prioritise sleep." };
}

const MOOD_OPTS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: "😫", label: "Awful" },
  { value: 2, emoji: "😞", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];
const ENERGY_OPTS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: "🪫", label: "Drained" },
  { value: 2, emoji: "😴", label: "Tired" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "⚡", label: "Energised" },
  { value: 5, emoji: "🚀", label: "Fired up" },
];
const STRESS_OPTS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: "😌", label: "Calm" },
  { value: 2, emoji: "🙂", label: "Low" },
  { value: 3, emoji: "😐", label: "Moderate" },
  { value: 4, emoji: "😤", label: "High" },
  { value: 5, emoji: "🤯", label: "Overwhelmed" },
];
const RECOVERY_OPTS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: "🤕", label: "Very sore" },
  { value: 2, emoji: "😬", label: "Sore" },
  { value: 3, emoji: "😐", label: "Some ache" },
  { value: 4, emoji: "💪", label: "Good" },
  { value: 5, emoji: "✨", label: "Fresh" },
];

function EmojiPicker({
  options,
  value,
  onChange,
  colors,
}: {
  options: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[];
  value: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={pickerStyles.row}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(opt.value);
            }}
            style={[
              pickerStyles.btn,
              {
                backgroundColor: selected ? colors.primary + "25" : colors.muted,
                borderColor: selected ? colors.primary : "transparent",
              },
            ]}
            activeOpacity={0.75}
          >
            <Text style={pickerStyles.emoji}>{opt.emoji}</Text>
            <Text
              style={[
                pickerStyles.label,
                { color: selected ? colors.primary : colors.mutedForeground },
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const pickerStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  btn: {
    flex: 1,
    minWidth: 56,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1.5,
    gap: 4,
  },
  emoji: { fontSize: 20 },
  label: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

function DisclaimerModal({ visible, onAccept }: { visible: boolean; onAccept: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={[dStyles.overlay]}>
        <View style={[dStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[dStyles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name="heart-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[dStyles.title, { color: colors.foreground }]}>
            Wellness Check-In
          </Text>
          <Text style={[dStyles.body, { color: colors.mutedForeground }]}>
            The daily Wellness Readiness score is a <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>personal awareness tool</Text>, not a medical assessment.
            {"\n\n"}
            It is not a substitute for advice from a licensed healthcare provider. If you are experiencing a medical emergency, call <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>911</Text> immediately.
            {"\n\n"}
            If you are struggling with your mental health, reach out to the <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>988 Suicide & Crisis Lifeline</Text> — call or text <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>988</Text>, available 24/7.
          </Text>
          <TouchableOpacity
            onPress={onAccept}
            style={[dStyles.btn, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[dStyles.btnText, { color: colors.primaryForeground }]}>
              I understand — continue
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const dStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  sheet: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
    maxWidth: 380,
    width: "100%",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, textAlign: "center" },
  btn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    width: "100%",
    alignItems: "center",
  },
  btnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});

function CrisisModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={cStyles.overlay}>
        <View style={[cStyles.sheet, { backgroundColor: "#1a0505", borderColor: "#ef444460" }]}>
          <Ionicons name="heart" size={32} color="#ef4444" />
          <Text style={[cStyles.title, { color: "#fafafa" }]}>You matter.</Text>
          <Text style={[cStyles.body, { color: "#d4d4d4" }]}>
            We noticed something in your note. If you're struggling, please reach out — help is here right now.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openURL("tel:988")}
            style={[cStyles.primary]}
            activeOpacity={0.85}
          >
            <Ionicons name="call-outline" size={18} color="#fafafa" />
            <Text style={[cStyles.primaryText]}>Call or Text 988 — Crisis Lifeline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL("sms:741741")}
            style={[cStyles.secondary, { borderColor: "#ef444460" }]}
            activeOpacity={0.85}
          >
            <Ionicons name="chatbubble-outline" size={18} color="#ef4444" />
            <Text style={[cStyles.secondaryText, { color: "#ef4444" }]}>
              Text HOME to Crisis Text Line (741741)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={cStyles.dismiss}>
            <Text style={[cStyles.dismissText, { color: "#878792" }]}>I'm safe — close this</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const cStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 16,
  },
  title: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold" },
  body: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22, textAlign: "center" },
  primary: {
    width: "100%",
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fafafa", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  secondary: {
    width: "100%",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  secondaryText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  dismiss: { paddingVertical: 8 },
  dismissText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});

export default function WellnessCheckinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [disclaimerLoading, setDisclaimerLoading] = useState(true);

  const [mood, setMood] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stress, setStress] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [recovery, setRecovery] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState("");

  const [todayEntry, setTodayEntry] = useState<WellnessEntry | null>(null);
  const [history, setHistory] = useState<Record<string, WellnessEntry>>({});
  const [saved, setSaved] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const scoreAnim = useRef(new Animated.Value(0)).current;

  const days = last7Days();

  useEffect(() => {
    async function init() {
      try {
        const seen = await AsyncStorage.getItem(DISCLAIMER_KEY);
        if (!seen) setShowDisclaimer(true);
        const today = await AsyncStorage.getItem(STORAGE_PREFIX + todayKey());
        if (today) {
          const parsed: WellnessEntry = JSON.parse(today);
          setTodayEntry(parsed);
          setMood(parsed.mood);
          setEnergy(parsed.energy);
          setStress(parsed.stress);
          setRecovery(parsed.recovery);
          setNotes(parsed.notes);
        }
        const hist: Record<string, WellnessEntry> = {};
        for (const day of days) {
          const raw = await AsyncStorage.getItem(STORAGE_PREFIX + day.key);
          if (raw) hist[day.key] = JSON.parse(raw);
        }
        setHistory(hist);
      } finally {
        setDisclaimerLoading(false);
      }
    }
    init();
  }, []);

  const readiness = calcReadiness({ mood, energy, stress, recovery });
  const readInfo = readinessLabel(readiness);

  useEffect(() => {
    Animated.spring(scoreAnim, {
      toValue: readiness,
      useNativeDriver: false,
      friction: 8,
      tension: 40,
    }).start();
  }, [readiness]);

  const handleDisclaimerAccept = useCallback(async () => {
    await AsyncStorage.setItem(DISCLAIMER_KEY, "1");
    setShowDisclaimer(false);
  }, []);

  const handleNotesChange = useCallback((text: string) => {
    setNotes(text);
    const lower = text.toLowerCase();
    const hasCrisis = CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
    if (hasCrisis) {
      setShowCrisis(true);
    }
  }, []);

  const handleSave = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const entry: WellnessEntry = {
      mood,
      energy,
      stress,
      recovery,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(entry));
    setTodayEntry(entry);
    setHistory((prev) => ({ ...prev, [todayKey()]: entry }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }, [mood, energy, stress, recovery, notes]);

  const fetchBalanceInsight = useCallback(async () => {
    if (aiLoading) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAiLoading(true);
    setAiInsight(null);
    try {
      const token = await getAccessToken();
      if (!token) { setAiInsight("Sign in to unlock AI life balance coaching. 🔐"); return; }
      const histEntries = Object.values(history);
      const histCount = histEntries.length;
      const avgMood7d = histCount > 0 ? histEntries.reduce((s, e) => s + e.mood, 0) / histCount : null;
      const avgEnergy7d = histCount > 0 ? histEntries.reduce((s, e) => s + e.energy, 0) / histCount : null;
      const avgStress7d = histCount > 0 ? histEntries.reduce((s, e) => s + e.stress, 0) / histCount : null;
      const res = await fetch(`${getApiBase()}/api/ai/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          type: "balance",
          data: {
            todayMood: mood,
            todayEnergy: energy,
            todayStress: stress,
            todayRecovery: recovery,
            readinessScore: readiness,
            readinessLabel: readInfo.label,
            historyCount: histCount,
            avgMood7d,
            avgEnergy7d,
            avgStress7d,
            notes: notes.trim(),
          },
        }),
      });
      if (res.status === 429) { setAiInsight("Daily AI limit reached — come back tomorrow! ⏰"); return; }
      if (!res.ok) throw new Error("API error");
      const json = await res.json() as { insight: string };
      setAiInsight(json.insight);
    } catch {
      setAiInsight("Couldn't load insight right now — try again shortly. 🔄");
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, mood, energy, stress, recovery, readiness, readInfo.label, history, notes]);

  const scoreWidth = scoreAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  if (disclaimerLoading) return null;

  return (
    <>
      <DisclaimerModal visible={showDisclaimer} onAccept={handleDisclaimerAccept} />
      <CrisisModal visible={showCrisis} onClose={() => setShowCrisis(false)} />

      <ScrollView
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 40 + 84 : 110 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-back" size={26} color={colors.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Wellness Check-In
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
            </Text>
          </View>
        </View>

        {/* Readiness Score Card */}
        <GlassCard style={[styles.scoreCard, { borderColor: readInfo.color + "50" }]}>
          <View style={styles.scoreHeader}>
            <View style={[styles.scoreIconWrap, { backgroundColor: readInfo.color + "20" }]}>
              <Ionicons name={readInfo.icon} size={22} color={readInfo.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>
                Wellness Readiness
              </Text>
              <Text style={[styles.scoreValue, { color: readInfo.color }]}>
                {readiness} — {readInfo.label}
              </Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: readInfo.color + "20" }]}>
              <Text style={[styles.scoreBadgeText, { color: readInfo.color }]}>
                {readiness}/100
              </Text>
            </View>
          </View>
          <View style={[styles.scoreTrack, { backgroundColor: colors.muted }]}>
            <Animated.View
              style={[styles.scoreFill, { width: scoreWidth, backgroundColor: readInfo.color }]}
            />
          </View>
          <Text style={[styles.scoreTip, { color: colors.mutedForeground }]}>
            {readInfo.tip}
          </Text>
          <Text style={[styles.scoreDisclaimer, { color: colors.mutedForeground }]}>
            For wellness awareness only · not a medical assessment
          </Text>
        </GlassCard>

        {/* Mood */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            How are you feeling?
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Overall mood right now
          </Text>
          <EmojiPicker options={MOOD_OPTS} value={mood} onChange={setMood} colors={colors} />
        </GlassCard>

        {/* Energy */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Energy level
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            How much fuel do you have today?
          </Text>
          <EmojiPicker options={ENERGY_OPTS} value={energy} onChange={setEnergy} colors={colors} />
        </GlassCard>

        {/* Stress */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Stress level
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Mental load and tension
          </Text>
          <EmojiPicker options={STRESS_OPTS} value={stress} onChange={setStress} colors={colors} />
        </GlassCard>

        {/* Recovery */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Body recovery
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Muscle soreness and physical freshness
          </Text>
          <EmojiPicker options={RECOVERY_OPTS} value={recovery} onChange={setRecovery} colors={colors} />
        </GlassCard>

        {/* Notes */}
        <GlassCard style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Optional note
          </Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
            Anything on your mind today?
          </Text>
          <TextInput
            value={notes}
            onChangeText={handleNotesChange}
            placeholder="e.g. Poor sleep, big presentation today…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            style={[
              styles.notesInput,
              {
                backgroundColor: colors.muted,
                color: colors.foreground,
                borderColor: colors.border,
              },
            ]}
          />
        </GlassCard>

        {/* Save Button */}
        <AnimatedPressable
          onPress={handleSave}
          style={[
            styles.saveBtn,
            { backgroundColor: saved ? "#10b981" : colors.primary },
          ]}
          scale={0.97}
        >
          <Ionicons
            name={saved ? "checkmark-circle-outline" : "save-outline"}
            size={20}
            color={colors.primaryForeground}
          />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {saved ? "Saved!" : todayEntry ? "Update Today's Check-In" : "Save Check-In"}
          </Text>
        </AnimatedPressable>

        {/* AI Life Balance Coach */}
        <GlassCard style={[styles.aiCard, { borderColor: "#10b98140" }]}>
          <View style={styles.aiCardHeader}>
            <View style={[styles.aiIconWrap, { backgroundColor: "#10b98120" }]}>
              <Ionicons name="sparkles" size={18} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.aiCardTitle, { color: colors.foreground }]}>AI Life Balance Coach</Text>
              <Text style={[styles.aiCardSub, { color: colors.mutedForeground }]}>Powered by Ovia AI</Text>
            </View>
          </View>
          {aiInsight ? (
            <Text style={[styles.aiInsightText, { color: colors.foreground }]}>{aiInsight}</Text>
          ) : (
            <Text style={[styles.aiInsightPlaceholder, { color: colors.mutedForeground }]}>
              Get a personalised life balance insight based on your mood, energy, stress, and recovery scores today.
            </Text>
          )}
          <AnimatedPressable
            onPress={fetchBalanceInsight}
            scale={0.97}
            style={[styles.aiBtn, { backgroundColor: aiLoading ? colors.muted : "#10b981" }]}
          >
            {aiLoading ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Ionicons name="sparkles" size={15} color="#fff" />
            )}
            <Text style={[styles.aiBtnText, { color: aiLoading ? colors.mutedForeground : "#fff" }]}>
              {aiLoading ? "Reading your balance…" : aiInsight ? "Refresh Insight" : "Get Life Balance Insight"}
            </Text>
          </AnimatedPressable>
        </GlassCard>

        {/* 7-Day History */}
        <GlassCard style={styles.historyCard}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Last 7 Days
          </Text>
          <View style={styles.historyRow}>
            {days.map((day) => {
              const entry = history[day.key];
              const score = entry ? calcReadiness(entry) : null;
              const info = score !== null ? readinessLabel(score) : null;
              return (
                <View key={day.key} style={styles.historyCol}>
                  <View
                    style={[
                      styles.historyBar,
                      {
                        backgroundColor: info ? info.color + "25" : colors.muted,
                        borderColor: info ? info.color + "60" : colors.border,
                      },
                    ]}
                  >
                    {score !== null ? (
                      <>
                        <View
                          style={[
                            styles.historyFill,
                            {
                              height: `${score}%` as any,
                              backgroundColor: info!.color,
                            },
                          ]}
                        />
                        <Text style={[styles.historyScore, { color: info!.color }]}>
                          {score}
                        </Text>
                      </>
                    ) : (
                      <Text style={[styles.historyEmpty, { color: colors.mutedForeground }]}>—</Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.historyLabel,
                      {
                        color: day.key === todayKey() ? colors.primary : colors.mutedForeground,
                        fontFamily: day.key === todayKey() ? "Inter_700Bold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {day.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.legendRow]}>
            {(["Push", "Maintain", "Recover", "Rest"] as const).map((lbl) => {
              const color =
                lbl === "Push" ? "#10b981" :
                lbl === "Maintain" ? "#3b82f6" :
                lbl === "Recover" ? "#f59e0b" :
                "#ef4444";
              return (
                <View key={lbl} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={[styles.legendText, { color: colors.mutedForeground }]}>{lbl}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Crisis Resource */}
        <TouchableOpacity
          onPress={() => Linking.openURL("tel:988")}
          style={[styles.crisisRow, { borderColor: colors.border }]}
          activeOpacity={0.75}
        >
          <Ionicons name="heart-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.crisisText, { color: colors.mutedForeground }]}>
            Mental health support · 988 Lifeline · 24/7
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  scoreCard: { gap: 10, borderWidth: 1.5 },
  scoreHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  scoreIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  scoreValue: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", marginTop: 2 },
  scoreBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  scoreBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  scoreTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreFill: {
    height: "100%",
    borderRadius: 3,
  },
  scoreTip: { fontSize: 13, fontFamily: "Inter_400Regular" },
  scoreDisclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  section: { gap: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -4 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  historyCard: { gap: 14 },
  historyRow: { flexDirection: "row", gap: 6 },
  historyCol: { flex: 1, alignItems: "center", gap: 6 },
  historyBar: {
    width: "100%",
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 4,
  },
  historyFill: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  historyScore: { fontSize: 10, fontFamily: "Inter_700Bold", zIndex: 1 },
  historyEmpty: { fontSize: 12, fontFamily: "Inter_400Regular" },
  historyLabel: { fontSize: 9, textAlign: "center" },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  crisisRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  crisisText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  aiCard: { gap: 12, borderWidth: 1.5 },
  aiCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  aiIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiCardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  aiCardSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  aiInsightText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  aiInsightPlaceholder: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, fontStyle: "italic" },
  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 12 },
  aiBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
