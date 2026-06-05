import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { usePermissionToast } from "@/hooks/usePermissionToast";
import { computeSuggestedGoalsWithBreakdown, type SuggestedGoalsResult } from "@/lib/tdee";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

/**
 * Route-level error boundary — Expo Router picks this up automatically.
 * Shows the real error message and stack so any crash can be diagnosed
 * instead of the generic Expo Router "Something went wrong" screen.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
        gap: 16,
      }}
    >
      <Text style={{ fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", color: "#ef4444" }}>
        Edit Profile couldn't load
      </Text>
      <Text style={{ fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
        {error?.message ?? "Unknown error"}
      </Text>
      {!!error?.stack && (
        <ScrollView style={{ maxHeight: 220 }}>
          <Text
            selectable
            style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 16 }}
          >
            {error.stack}
          </Text>
        </ScrollView>
      )}
      <Pressable
        onPress={retry}
        style={({ pressed }) => ({
          backgroundColor: colors.primary,
          borderRadius: 10,
          paddingVertical: 14,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_600SemiBold", fontSize: 15 }}>
          Try Again
        </Text>
      </Pressable>
    </View>
  );
}

const BLOOD_TYPES = ["A", "B", "AB", "O"] as const;
const RH_FACTORS = ["+", "-"] as const;
const GENOTYPES = ["AA", "AS", "AC", "SS", "SC"] as const;
const BIOLOGICAL_SEX_OPTIONS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

const GOALS = [
  { id: "build_muscle", label: "Build Muscle" },
  { id: "lose_weight", label: "Lose Weight" },
  { id: "improve_fitness", label: "Improve Fitness" },
  { id: "endurance", label: "Build Endurance" },
  { id: "flexibility", label: "Flexibility" },
  { id: "stress_relief", label: "Stress Relief" },
];

const FITNESS_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, updateProfile } = useFitness();
  const { showPermissionToast, permissionToastElement } = usePermissionToast();

  const [name, setName] = useState(user?.name ?? "");
  const [age, setAge] = useState(user?.age?.toString() ?? "");
  const [height, setHeight] = useState(user?.height?.toString() ?? "");
  const [weight, setWeight] = useState(user?.weight?.toString() ?? "");
  const [fitnessLevel, setFitnessLevel] = useState<"beginner" | "intermediate" | "advanced">(
    (user?.fitnessLevel as "beginner" | "intermediate" | "advanced" | undefined) ?? "intermediate"
  );
  // Defensive: ensure goals is always an array regardless of what came from storage
  const [goals, setGoals] = useState<string[]>(
    Array.isArray(user?.goals) ? user.goals : []
  );
  const [units, setUnits] = useState<"metric" | "imperial">(
    (user?.units as "metric" | "imperial" | undefined) ?? "metric"
  );
  const [location, setLocation] = useState("");
  const [locLoading, setLocLoading] = useState(false);
  const [bloodType, setBloodType] = useState<"A" | "B" | "AB" | "O" | undefined>(user?.bloodType);
  const [rhFactor, setRhFactor] = useState<"+" | "-" | undefined>(user?.rhFactor);
  const [genotype, setGenotype] = useState<"AA" | "AS" | "AC" | "SS" | "SC" | undefined>(user?.genotype);
  const [biologicalSex, setBiologicalSex] = useState<"male" | "female" | "prefer_not_to_say" | undefined>(user?.biologicalSex);
  const [previewExpanded, setPreviewExpanded] = useState(true);

  // Live macro preview — recomputed on every relevant field change without saving
  const livePreview = useMemo(() => {
    if (!user) return null;
    const ageNum = parseInt(age, 10);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    if (!ageNum || !heightNum || !weightNum || ageNum <= 0 || heightNum <= 0 || weightNum <= 0) {
      return null;
    }
    return computeSuggestedGoalsWithBreakdown({
      ...user,
      age: ageNum,
      height: heightNum,
      weight: weightNum,
      fitnessLevel,
      goals,
      units,
      biologicalSex,
    });
  }, [age, height, weight, fitnessLevel, goals, units, biologicalSex, user]);

  // Null guard: profile not yet loaded (context still hydrating)
  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 15 }}>
          Loading profile…
        </Text>
      </View>
    );
  }

  function toggleGoal(id: string) {
    Haptics.selectionAsync();
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  }

  async function handleGetLocation() {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showPermissionToast("Location access blocked — tap to open Settings");
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      setLocation(`${place.city ?? ""}, ${place.country ?? ""}`.replace(/^, /, ""));
    } catch {
      Alert.alert("Error", "Could not get your location. Please type it manually.");
    }
    setLocLoading(false);
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert("Required", "Please enter your name.");
      return;
    }
    updateProfile({
      name: name.trim(),
      age: parseInt(age, 10) || user?.age,
      height: parseFloat(height) || user?.height,
      weight: parseFloat(weight) || user?.weight,
      fitnessLevel,
      goals,
      units,
      bloodType,
      rhFactor,
      genotype,
      biologicalSex,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" },
            ]}
          >
            <Text style={[styles.avatarInitial, { color: colors.primary }]}>
              {name.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>
            Your initials are used as your avatar
          </Text>
        </View>

        {/* Personal Info */}
        <SectionTitle title="Personal Information" colors={colors} />

        <InputRow label="Full name" colors={colors}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
          />
        </InputRow>

        <InputRow label="Age" colors={colors}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            value={age}
            onChangeText={setAge}
            placeholder="28"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
        </InputRow>

        {/* Units toggle */}
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Units</Text>
          <View style={[styles.toggle, { backgroundColor: colors.muted }]}>
            {(["metric", "imperial"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                onPress={() => setUnits(u)}
                style={[
                  styles.toggleOption,
                  units === u && { backgroundColor: colors.card },
                ]}
              >
                <Text
                  style={[
                    styles.toggleText,
                    {
                      color: units === u ? colors.foreground : colors.mutedForeground,
                      fontFamily: units === u ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {u === "metric" ? "kg / cm" : "lbs / in"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <InputRow label={`Height (${units === "metric" ? "cm" : "in"})`} colors={colors}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            value={height}
            onChangeText={setHeight}
            placeholder={units === "metric" ? "178" : "70"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
        </InputRow>

        <InputRow label={`Weight (${units === "metric" ? "kg" : "lbs"})`} colors={colors}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            value={weight}
            onChangeText={setWeight}
            placeholder={units === "metric" ? "80" : "176"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
        </InputRow>

        {/* Location */}
        <SectionTitle title="Location" colors={colors} />
        <View style={[styles.locationRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.foreground, flex: 1 }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Your city"
            placeholderTextColor={colors.mutedForeground}
          />
          <TouchableOpacity
            onPress={handleGetLocation}
            style={[styles.locBtn, { backgroundColor: colors.primary + "20" }]}
            disabled={locLoading}
          >
            <Ionicons
              name={locLoading ? "hourglass-outline" : "location-outline"}
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* Fitness Level */}
        <SectionTitle title="Fitness Level" colors={colors} />
        <View style={styles.levelRow}>
          {FITNESS_LEVELS.map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => {
                Haptics.selectionAsync();
                setFitnessLevel(level);
              }}
              style={[
                styles.levelBtn,
                {
                  backgroundColor:
                    fitnessLevel === level ? colors.primary : colors.muted,
                  borderColor:
                    fitnessLevel === level ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.levelText,
                  {
                    color:
                      fitnessLevel === level ? colors.primaryForeground : colors.mutedForeground,
                    fontFamily:
                      fitnessLevel === level ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Health Profile */}
        <SectionTitle title="Health Profile" colors={colors} />
        <Text style={[styles.healthNote, { color: colors.mutedForeground }]}>
          Used to generate evidence-based food guidance. Optional but recommended.
        </Text>

        <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Biological Sex</Text>
        <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
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
                styles.healthChip,
                {
                  backgroundColor: biologicalSex === opt.id ? colors.primary : colors.muted,
                  borderColor: biologicalSex === opt.id ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.healthChipText,
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

        <Text style={[styles.rowLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Blood Type (ABO)</Text>
        <View style={styles.chipRow}>
          {BLOOD_TYPES.map((bt) => (
            <TouchableOpacity
              key={bt}
              onPress={() => { Haptics.selectionAsync(); setBloodType(bt === bloodType ? undefined : bt); }}
              style={[
                styles.healthChip,
                { backgroundColor: bloodType === bt ? colors.primary : colors.muted, borderColor: bloodType === bt ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.healthChipText, { color: bloodType === bt ? colors.primaryForeground : colors.mutedForeground, fontFamily: bloodType === bt ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {bt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.rowLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Rh Factor</Text>
        <View style={styles.chipRow}>
          {RH_FACTORS.map((rh) => (
            <TouchableOpacity
              key={rh}
              onPress={() => { Haptics.selectionAsync(); setRhFactor(rh === rhFactor ? undefined : rh); }}
              style={[
                styles.healthChip,
                { backgroundColor: rhFactor === rh ? colors.primary : colors.muted, borderColor: rhFactor === rh ? colors.primary : colors.border },
              ]}
            >
              <Text style={[styles.healthChipText, { color: rhFactor === rh ? colors.primaryForeground : colors.mutedForeground, fontFamily: rhFactor === rh ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {rh === "+" ? "Positive (+)" : "Negative (−)"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.rowLabel, { color: colors.mutedForeground, marginTop: 8 }]}>Genotype (Haemoglobin)</Text>
        <View style={styles.chipRow}>
          {GENOTYPES.map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => { Haptics.selectionAsync(); setGenotype(g === genotype ? undefined : g); }}
              style={[
                styles.healthChip,
                {
                  backgroundColor: genotype === g ? (g === "SS" || g === "SC" ? "#ef4444" : colors.primary) : colors.muted,
                  borderColor: genotype === g ? (g === "SS" || g === "SC" ? "#ef4444" : colors.primary) : colors.border,
                },
              ]}
            >
              <Text style={[styles.healthChipText, { color: genotype === g ? "#fff" : colors.mutedForeground, fontFamily: genotype === g ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Goals */}
        <SectionTitle title="Fitness Goals" colors={colors} />
        <View style={styles.goalsGrid}>
          {GOALS.map((g) => {
            const active = goals.includes(g.id);
            return (
              <TouchableOpacity
                key={g.id}
                onPress={() => toggleGoal(g.id)}
                style={[
                  styles.goalChip,
                  {
                    backgroundColor: active ? colors.primary + "20" : colors.muted,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                {active && (
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                )}
                <Text
                  style={[
                    styles.goalText,
                    {
                      color: active ? colors.primary : colors.mutedForeground,
                      fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Live macro suggestion preview */}
        {livePreview && (
          <MacroPreviewBanner
            preview={livePreview}
            expanded={previewExpanded}
            onToggle={() => setPreviewExpanded((v) => !v)}
            colors={colors}
          />
        )}

        {/* Save */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.saveFullBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            Save Changes
          </Text>
        </TouchableOpacity>
      </ScrollView>
      {permissionToastElement}
    </KeyboardAvoidingView>
  );
}

function MacroPreviewBanner({
  preview,
  expanded,
  onToggle,
  colors,
}: {
  preview: SuggestedGoalsResult;
  expanded: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { goals, breakdown } = preview;
  return (
    <View
      style={[
        styles.previewBanner,
        { backgroundColor: colors.primary + "12", borderColor: colors.primary + "40" },
      ]}
    >
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={styles.previewHeader}
      >
        <View style={styles.previewHeaderLeft}>
          <Ionicons name="flash" size={14} color={colors.primary} />
          <Text style={[styles.previewTitle, { color: colors.primary }]}>
            Suggested targets preview
          </Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.primary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.previewBody}>
          <Text style={[styles.previewCalories, { color: colors.foreground }]}>
            {goals.calories} kcal / day
          </Text>
          <View style={styles.previewMacroRow}>
            <MacroPill label="Protein" value={goals.protein} color="#3b82f6" />
            <MacroPill label="Carbs" value={goals.carbs} color="#f59e0b" />
            <MacroPill label="Fat" value={goals.fat} color="#f97316" />
          </View>
          <Text style={[styles.previewNote, { color: colors.mutedForeground }]}>
            Based on BMR {breakdown.bmr} kcal · {breakdown.activityLabel}
            {breakdown.goalAdjustment !== 0
              ? ` · goal adjustment ${breakdown.goalAdjustment > 0 ? "+" : ""}${breakdown.goalAdjustment} kcal`
              : ""}
          </Text>
        </View>
      )}
    </View>
  );
}

function MacroPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.macroPill, { backgroundColor: color + "18", borderColor: color + "40" }]}>
      <Text style={[styles.macroPillValue, { color }]}>{value}g</Text>
      <Text style={[styles.macroPillLabel, { color }]}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title, colors }: { title: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
  );
}

function InputRow({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.inputRowWrap}>
      <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.inputBox,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  saveBtn: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 12 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarInitial: { fontSize: 36, fontFamily: "SpaceGrotesk_700Bold" },
  avatarHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  sectionTitle: { fontSize: 15, fontFamily: "SpaceGrotesk_700Bold", marginTop: 8 },
  inputRowWrap: { gap: 4 },
  rowLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputBox: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  textInput: { fontSize: 15, fontFamily: "Inter_400Regular" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toggle: { flexDirection: "row", borderRadius: 8, padding: 3 },
  toggleOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  toggleText: { fontSize: 13 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  locBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  levelRow: { flexDirection: "row", gap: 8 },
  levelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  levelText: { fontSize: 13 },
  goalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  goalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  goalText: { fontSize: 13 },
  healthNote: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: -4, marginBottom: 4 },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15, marginTop: -6, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  healthChip: {
    paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1,
  },
  healthChipText: { fontSize: 13 },
  saveFullBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  previewBanner: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginTop: 4,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  previewHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  previewBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  previewCalories: {
    fontSize: 22,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 26,
  },
  previewMacroRow: {
    flexDirection: "row",
    gap: 8,
  },
  previewNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  macroPill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
    gap: 2,
  },
  macroPillValue: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  macroPillLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
