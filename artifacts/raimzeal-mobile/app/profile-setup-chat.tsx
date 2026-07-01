/**
 * Ovia-guided profile completion — a deterministic, chat-styled flow that asks
 * only for the fields actually missing from the user's profile, one at a time,
 * and saves each answer immediately via updateProfile(). This is what makes
 * Ovia's AI Tools (meal/workout/body-analysis) genuinely personalized instead
 * of falling back to generic defaults.
 *
 * Deliberately NOT a free-form LLM conversation: the questions, parsing, and
 * writes are all deterministic client-side logic, so there's zero hallucination
 * risk and it ships without any backend changes.
 */

import React, { useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { useColors } from "@/hooks/useColors";
import { useFitness, UserProfile } from "@/contexts/FitnessContext";

const GOALS = [
  { id: "build_muscle", label: "Build Muscle", icon: "barbell-outline" },
  { id: "lose_weight", label: "Lose Weight", icon: "trending-down-outline" },
  { id: "improve_fitness", label: "Improve Fitness", icon: "pulse-outline" },
  { id: "endurance", label: "Build Endurance", icon: "bicycle-outline" },
  { id: "flexibility", label: "Flexibility", icon: "body-outline" },
  { id: "stress_relief", label: "Stress Relief", icon: "leaf-outline" },
] as const;

type StepId = "body" | "sex" | "level" | "goals" | "genetics" | "done";

interface Turn {
  from: "ovia" | "user";
  text: string;
}

function buildSteps(user: UserProfile | null): StepId[] {
  const steps: StepId[] = [];
  const needsBody = !user?.age || !user?.height || !user?.weight;
  if (needsBody) steps.push("body");
  if (!user?.biologicalSex) steps.push("sex");
  if (needsBody) steps.push("level"); // only nudge fitness level alongside body stats — a set default elsewhere isn't "missing"
  if (!user?.goals || user.goals.length === 0) steps.push("goals");
  if (!user?.bloodType && !user?.genotype) steps.push("genetics");
  steps.push("done");
  return steps;
}

export default function ProfileSetupChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useFitness();
  const scrollRef = useRef<ScrollView>(null);

  const steps = useMemo(() => buildSteps(user), [user]);
  const [stepIndex, setStepIndex] = useState(0);
  const [history, setHistory] = useState<Turn[]>([]);

  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [selectedSex, setSelectedSex] = useState<UserProfile["biologicalSex"]>();
  const [selectedLevel, setSelectedLevel] = useState<UserProfile["fitnessLevel"]>();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedBlood, setSelectedBlood] = useState<UserProfile["bloodType"]>();
  const [selectedRh, setSelectedRh] = useState<UserProfile["rhFactor"]>();

  const currentStep = steps[stepIndex];
  const units = user?.units ?? "metric";

  function pushTurn(from: Turn["from"], text: string) {
    setHistory((h) => [...h, { from, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }

  function advance(userAnswerText: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pushTurn("user", userAnswerText);
    setStepIndex((i) => i + 1);
  }

  function skip() {
    Haptics.selectionAsync();
    setStepIndex((i) => i + 1);
  }

  function submitBody() {
    const a = parseInt(age, 10);
    const h = parseFloat(height);
    const w = parseFloat(weight);
    const updates: Partial<UserProfile> = {};
    if (a > 0) updates.age = a;
    if (h > 0) updates.height = h;
    if (w > 0) updates.weight = w;
    if (Object.keys(updates).length === 0) return;
    updateProfile(updates);
    const parts: string[] = [];
    if (a > 0) parts.push(`${a} years old`);
    if (h > 0) parts.push(`${h}${units === "metric" ? "cm" : "in"}`);
    if (w > 0) parts.push(`${w}${units === "metric" ? "kg" : "lb"}`);
    advance(parts.join(" · "));
  }

  function submitSex(value: NonNullable<UserProfile["biologicalSex"]>, label: string) {
    updateProfile({ biologicalSex: value });
    setSelectedSex(value);
    advance(label);
  }

  function submitLevel(value: NonNullable<UserProfile["fitnessLevel"]>, label: string) {
    updateProfile({ fitnessLevel: value });
    setSelectedLevel(value);
    advance(label);
  }

  function toggleGoal(id: string) {
    Haptics.selectionAsync();
    setSelectedGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id]));
  }

  function submitGoals() {
    if (selectedGoals.length === 0) return;
    updateProfile({ goals: selectedGoals });
    const labels = GOALS.filter((g) => selectedGoals.includes(g.id)).map((g) => g.label);
    advance(labels.join(", "));
  }

  function submitGenetics() {
    const updates: Partial<UserProfile> = {};
    if (selectedBlood) updates.bloodType = selectedBlood;
    if (selectedRh) updates.rhFactor = selectedRh;
    if (Object.keys(updates).length > 0) {
      updateProfile(updates);
      advance([selectedBlood, selectedRh].filter(Boolean).join(""));
    } else {
      skip();
    }
  }

  const OVIA_PROMPTS: Record<Exclude<StepId, "done">, string> = {
    body: "Let's get your plans dialed in. What's your age, height, and weight?",
    sex: "What's your biological sex? This lets me use the right formula for your calorie and BMR targets.",
    level: "How would you describe your current fitness level?",
    goals: "What are you working toward? Pick as many as apply.",
    genetics: "Bonus round — your blood type and genotype let me tailor nutrition advice no other app offers. Totally optional.",
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.foreground }]}>Complete Your Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {history.map((turn, i) => (
          <View
            key={i}
            style={[
              styles.bubble,
              turn.from === "ovia"
                ? [styles.oviaBubble, { backgroundColor: colors.card, borderColor: colors.border }]
                : [styles.userBubble, { backgroundColor: colors.primary }],
            ]}
          >
            <Text style={{ color: turn.from === "ovia" ? colors.foreground : colors.primaryForeground, fontSize: 14, lineHeight: 20 }}>
              {turn.text}
            </Text>
          </View>
        ))}

        {currentStep !== "done" && (
          <View style={[styles.bubble, styles.oviaBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
              {OVIA_PROMPTS[currentStep]}
            </Text>
          </View>
        )}

        {currentStep === "body" && (
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.numInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="Age"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={age}
              onChangeText={setAge}
            />
            <TextInput
              style={[styles.numInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder={units === "metric" ? "Height (cm)" : "Height (in)"}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={height}
              onChangeText={setHeight}
            />
            <TextInput
              style={[styles.numInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder={units === "metric" ? "Weight (kg)" : "Weight (lb)"}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }]}
              onPress={submitBody}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentStep === "sex" && (
          <View style={styles.chipRow}>
            {([
              ["male", "Male"],
              ["female", "Female"],
              ["prefer_not_to_say", "Prefer not to say"],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => submitSex(value, label)}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentStep === "level" && (
          <View style={styles.chipRow}>
            {([
              ["beginner", "Beginner"],
              ["intermediate", "Intermediate"],
              ["advanced", "Advanced"],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => submitLevel(value, label)}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentStep === "goals" && (
          <>
            <View style={styles.chipRow}>
              {GOALS.map((g) => {
                const active = selectedGoals.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        backgroundColor: active ? colors.primary + "20" : colors.card,
                      },
                    ]}
                    onPress={() => toggleGoal(g.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={g.icon as never} size={14} color={active ? colors.primary : colors.mutedForeground} />
                    <Text style={{ color: active ? colors.primary : colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary, opacity: selectedGoals.length ? 1 : 0.5 }]}
              onPress={submitGoals}
              disabled={selectedGoals.length === 0}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {currentStep === "genetics" && (
          <>
            <View style={styles.chipRow}>
              {(["A", "B", "AB", "O"] as const).map((bt) => (
                <TouchableOpacity
                  key={bt}
                  style={[
                    styles.chip,
                    { borderColor: selectedBlood === bt ? colors.primary : colors.border, backgroundColor: selectedBlood === bt ? colors.primary + "20" : colors.card },
                  ]}
                  onPress={() => setSelectedBlood(bt)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{bt}</Text>
                </TouchableOpacity>
              ))}
              {(["+", "-"] as const).map((rh) => (
                <TouchableOpacity
                  key={rh}
                  style={[
                    styles.chip,
                    { borderColor: selectedRh === rh ? colors.primary : colors.border, backgroundColor: selectedRh === rh ? colors.primary + "20" : colors.card },
                  ]}
                  onPress={() => setSelectedRh(rh)}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: colors.foreground, fontSize: 13, fontFamily: "Inter_500Medium" }}>{rh}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.primary, flex: 1 }]}
                onPress={submitGenetics}
                activeOpacity={0.85}
              >
                <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: colors.muted, flex: 1 }]}
                onPress={skip}
                activeOpacity={0.85}
              >
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" }}>Skip</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {currentStep === "done" && (
          <View style={[styles.bubble, styles.oviaBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20, fontFamily: "Inter_600SemiBold" }}>
              {steps.length <= 1
                ? "Your profile is already complete — nice!"
                : "All set! I can now give you fully personalised meal plans, workouts, and body analysis."}
            </Text>
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
              onPress={() => router.replace("/(tabs)/ovia")}
              activeOpacity={0.85}
            >
              <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }}>Get my personalised plan</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  bubble: { padding: 12, borderRadius: 16, maxWidth: "88%" },
  oviaBubble: { alignSelf: "flex-start", borderWidth: 1, borderBottomLeftRadius: 4 },
  userBubble: { alignSelf: "flex-end", borderBottomRightRadius: 4 },
  inputRow: { gap: 8 },
  numInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  sendBtn: { borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
});
