import React, { useState } from "react";
import {
  Alert,
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
import { useFitness } from "@/contexts/FitnessContext";

const BLOOD_TYPES = ["A", "B", "AB", "O"] as const;
const RH_FACTORS = ["+", "-"] as const;
const GENOTYPES = ["AA", "AS", "AC", "SS", "SC"] as const;
const BIOLOGICAL_SEX_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;
const FITNESS_LEVELS = [
  { key: "beginner", label: "Beginner", desc: "Just starting out" },
  { key: "intermediate", label: "Intermediate", desc: "Consistent for 6+ months" },
  { key: "advanced", label: "Advanced", desc: "Training for years" },
] as const;
const GOALS = [
  { id: "build_muscle", label: "Build Muscle", icon: "barbell-outline" },
  { id: "lose_weight", label: "Lose Weight", icon: "trending-down-outline" },
  { id: "improve_fitness", label: "Improve Fitness", icon: "pulse-outline" },
  { id: "endurance", label: "Build Endurance", icon: "bicycle-outline" },
  { id: "flexibility", label: "Flexibility", icon: "body-outline" },
  { id: "stress_relief", label: "Stress Relief", icon: "leaf-outline" },
] as const;

export default function HealthOnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile, markOnboarded } = useFitness();

  const [step, setStep] = useState(0);

  const [height, setHeight] = useState(user?.height ? user.height.toString() : "");
  const [weight, setWeight] = useState(user?.weight ? user.weight.toString() : "");
  const [fitnessLevel, setFitnessLevel] = useState<"beginner" | "intermediate" | "advanced">(
    user?.fitnessLevel ?? "intermediate"
  );
  const [goals, setGoals] = useState<string[]>(user?.goals ?? []);
  const [bloodType, setBloodType] = useState<"A" | "B" | "AB" | "O" | undefined>(user?.bloodType);
  const [rhFactor, setRhFactor] = useState<"+" | "-" | undefined>(user?.rhFactor);
  const [genotype, setGenotype] = useState<"AA" | "AS" | "AC" | "SS" | "SC" | undefined>(user?.genotype);
  const [biologicalSex, setBiologicalSex] = useState<"male" | "female" | "prefer_not_to_say" | undefined>(
    user?.biologicalSex
  );

  const STEPS = ["body", "fitness", "health"];
  const STEP_LABELS = ["Body Stats", "Fitness Profile", "Health Profile"];

  function toggleGoal(id: string) {
    Haptics.selectionAsync();
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  function handleNext() {
    if (step === 0) {
      if (!height.trim() || !weight.trim()) {
        Alert.alert("Required", "Please enter your height and weight to continue.");
        return;
      }
      const h = parseFloat(height);
      const w = parseFloat(weight);
      if (isNaN(h) || h < 50 || h > 300) {
        Alert.alert("Invalid Height", "Please enter a valid height in cm (e.g. 175).");
        return;
      }
      if (isNaN(w) || w < 20 || w > 500) {
        Alert.alert("Invalid Weight", "Please enter a valid weight in kg (e.g. 70).");
        return;
      }
    }
    if (step === 1 && goals.length === 0) {
      Alert.alert("Select a Goal", "Please select at least one fitness goal.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleComplete();
    }
  }

  function handleComplete() {
    updateProfile({
      height: parseFloat(height) || user?.height || 170,
      weight: parseFloat(weight) || user?.weight || 70,
      fitnessLevel,
      goals,
      bloodType,
      rhFactor,
      genotype,
      biologicalSex,
    });
    markOnboarded();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 48 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {step === 0 ? "Your Body Stats" : step === 1 ? "Your Fitness Profile" : "Your Health Profile"}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {step === 0
                ? "Help Ovia AI personalise your plan"
                : step === 1
                ? "Set your level and goals"
                : "Optional — used for health guidance"}
            </Text>
          </View>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.stepDot,
                {
                  backgroundColor: i <= step ? colors.primary : colors.border,
                  flex: i < STEPS.length - 1 ? 1 : 0,
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.mutedForeground }]}>
          Step {step + 1} of {STEPS.length} — {STEP_LABELS[step]}
        </Text>

        {/* STEP 0: Body stats */}
        {step === 0 && (
          <View style={styles.section}>
            <View style={styles.fieldRow}>
              <View style={styles.fieldHalf}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Height (cm)</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={height}
                    onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, ""))}
                    placeholder="e.g. 175"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <View style={styles.fieldHalf}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Weight (kg)</Text>
                <View style={[styles.inputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={weight}
                    onChangeText={(v) => setWeight(v.replace(/[^0-9.]/g, ""))}
                    placeholder="e.g. 70"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
            <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 4 }]}>Biological Sex</Text>
            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: -4 }]}>
              Improves calorie suggestion accuracy by ~80–160 kcal/day.
            </Text>
            <View style={styles.chipRow}>
              {BIOLOGICAL_SEX_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBiologicalSex(biologicalSex === opt.id ? undefined : opt.id);
                  }}
                  style={[
                    styles.sexChip,
                    {
                      backgroundColor: biologicalSex === opt.id ? colors.primary : colors.muted,
                      borderColor: biologicalSex === opt.id ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.sexChipText,
                      {
                        color: biologicalSex === opt.id ? colors.primaryForeground : colors.mutedForeground,
                        fontFamily: biologicalSex === opt.id ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[styles.infoBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                Used to calculate BMI, calorie targets, and personalise Ovia AI responses. You can change these anytime in your profile.
              </Text>
            </View>
          </View>
        )}

        {/* STEP 1: Fitness profile */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Fitness Level</Text>
            <View style={styles.levelRow}>
              {FITNESS_LEVELS.map((lvl) => (
                <TouchableOpacity
                  key={lvl.key}
                  onPress={() => { Haptics.selectionAsync(); setFitnessLevel(lvl.key); }}
                  style={[
                    styles.levelCard,
                    {
                      backgroundColor: fitnessLevel === lvl.key ? colors.primary + "20" : colors.muted,
                      borderColor: fitnessLevel === lvl.key ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.levelTitle, { color: fitnessLevel === lvl.key ? colors.primary : colors.foreground }]}>
                    {lvl.label}
                  </Text>
                  <Text style={[styles.levelDesc, { color: colors.mutedForeground }]}>{lvl.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 20 }]}>
              Fitness Goals <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>(pick all that apply)</Text>
            </Text>
            <View style={styles.goalsGrid}>
              {GOALS.map((g) => {
                const selected = goals.includes(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    onPress={() => toggleGoal(g.id)}
                    style={[
                      styles.goalChip,
                      {
                        backgroundColor: selected ? colors.primary + "20" : colors.muted,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={g.icon as keyof typeof Ionicons.glyphMap}
                      size={16}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[styles.goalLabel, { color: selected ? colors.primary : colors.foreground }]}>
                      {g.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* STEP 2: Health profile */}
        {step === 2 && (
          <View style={styles.section}>
            <View style={[styles.optionalBanner, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
              <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>
                These fields are <Text style={{ color: colors.foreground }}>completely optional</Text>. They unlock personalised healthcare guidance from Ovia AI. You can set or change them anytime in your profile.
              </Text>
            </View>

            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Blood Group</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => { Haptics.selectionAsync(); setBloodType(bloodType === t ? undefined : t); }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: bloodType === t ? "#ef444420" : colors.muted,
                      borderColor: bloodType === t ? "#ef4444" : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: bloodType === t ? "#ef4444" : colors.foreground }]}>{t}</Text>
                </TouchableOpacity>
              ))}
              <Text style={[styles.rhLabel, { color: colors.mutedForeground }]}>Rh:</Text>
              {RH_FACTORS.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => { Haptics.selectionAsync(); setRhFactor(rhFactor === r ? undefined : r); }}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: rhFactor === r ? "#ef444420" : colors.muted,
                      borderColor: rhFactor === r ? "#ef4444" : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: rhFactor === r ? "#ef4444" : colors.foreground }]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.foreground, marginTop: 20 }]}>Haemoglobin Genotype</Text>
            <View style={styles.chipRow}>
              {GENOTYPES.map((g) => {
                const isHighRisk = g === "SS" || g === "SC";
                const selectedColor = isHighRisk ? "#ef4444" : colors.primary;
                return (
                  <TouchableOpacity
                    key={g}
                    onPress={() => { Haptics.selectionAsync(); setGenotype(genotype === g ? undefined : g); }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: genotype === g ? selectedColor + "20" : colors.muted,
                        borderColor: genotype === g ? selectedColor : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: genotype === g ? selectedColor : colors.foreground }]}>{g}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {(genotype === "SS" || genotype === "SC") && (
              <View style={[styles.warningBox, { backgroundColor: "#ef444415", borderColor: "#ef444440" }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={[styles.warningText, { color: "#ef4444" }]}>
                  Genotype {genotype} may carry health risks. Ovia AI will provide relevant guidance and always recommend consulting a medical professional.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Navigation buttons */}
        <View style={styles.btnRow}>
          {step > 0 && (
            <TouchableOpacity
              onPress={() => { Haptics.selectionAsync(); setStep((s) => s - 1); }}
              style={[styles.backBtn, { borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.foreground} />
              <Text style={[styles.backBtnText, { color: colors.foreground }]}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            style={[styles.nextBtn, { backgroundColor: colors.primary, flex: step === 0 ? 1 : undefined }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
              {step < STEPS.length - 1 ? "Continue" : "Complete Setup"}
            </Text>
            <Ionicons name={step < STEPS.length - 1 ? "chevron-forward" : "checkmark"} size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        {step === 2 && (
          <TouchableOpacity onPress={handleComplete} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip health profile for now</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconCircle: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 4, height: 4 },
  stepDot: { height: 4, borderRadius: 2, minWidth: 4 },
  stepLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -8 },
  section: { gap: 12 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fieldRow: { flexDirection: "row", gap: 12 },
  fieldHalf: { flex: 1, gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputWrap: { borderRadius: 12, borderWidth: 1, height: 52, paddingHorizontal: 14, justifyContent: "center" },
  input: { fontSize: 16, fontFamily: "Inter_400Regular" },
  infoBox: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  levelRow: { gap: 8 },
  levelCard: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 2 },
  levelTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  levelDesc: { fontSize: 12, fontFamily: "Inter_400Regular" },
  goalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goalLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  optionalBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  optionalText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  chip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 9 },
  chipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  sexChip: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  sexChipText: { fontSize: 14 },
  rhLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  warningBox: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  warningText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  nextBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
