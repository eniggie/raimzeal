import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

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

  const [name, setName] = useState(user?.name ?? "");
  const [age, setAge] = useState(user?.age?.toString() ?? "");
  const [height, setHeight] = useState(user?.height?.toString() ?? "");
  const [weight, setWeight] = useState(user?.weight?.toString() ?? "");
  const [fitnessLevel, setFitnessLevel] = useState<"beginner" | "intermediate" | "advanced">(
    user?.fitnessLevel ?? "intermediate"
  );
  const [goals, setGoals] = useState<string[]>(user?.goals ?? []);
  const [units, setUnits] = useState<"metric" | "imperial">(user?.units ?? "metric");
  const [location, setLocation] = useState("");
  const [locLoading, setLocLoading] = useState(false);

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
        Alert.alert("Permission denied", "Location access is needed to auto-fill your city.");
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
            Profile photo coming soon
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
    </KeyboardAvoidingView>
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
  saveFullBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
});
