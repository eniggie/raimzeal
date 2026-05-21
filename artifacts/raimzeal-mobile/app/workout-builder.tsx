import React, { useCallback, useEffect, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import type { WorkoutTemplate } from "@/constants/workoutTemplates";
import { loadCustomWorkouts, saveCustomWorkouts } from "@/lib/customWorkouts";

export interface CustomExercise {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const EXERCISE_LIBRARY: { name: string; category: string }[] = [
  // Chest
  { name: "Bench Press", category: "Chest" },
  { name: "Incline Bench Press", category: "Chest" },
  { name: "Push-ups", category: "Chest" },
  { name: "Chest Flyes", category: "Chest" },
  { name: "Dips", category: "Chest" },
  // Back
  { name: "Pull-ups", category: "Back" },
  { name: "Deadlifts", category: "Back" },
  { name: "Bent Over Rows", category: "Back" },
  { name: "Lat Pulldowns", category: "Back" },
  { name: "Seated Cable Rows", category: "Back" },
  // Shoulders
  { name: "Shoulder Press", category: "Shoulders" },
  { name: "Lateral Raises", category: "Shoulders" },
  { name: "Front Raises", category: "Shoulders" },
  { name: "Face Pulls", category: "Shoulders" },
  // Arms
  { name: "Bicep Curls", category: "Arms" },
  { name: "Hammer Curls", category: "Arms" },
  { name: "Tricep Dips", category: "Arms" },
  { name: "Tricep Pushdowns", category: "Arms" },
  { name: "Skull Crushers", category: "Arms" },
  // Legs
  { name: "Squats", category: "Legs" },
  { name: "Lunges", category: "Legs" },
  { name: "Leg Press", category: "Legs" },
  { name: "Romanian Deadlifts", category: "Legs" },
  { name: "Leg Curls", category: "Legs" },
  { name: "Leg Extensions", category: "Legs" },
  { name: "Calf Raises", category: "Legs" },
  // Core
  { name: "Plank", category: "Core" },
  { name: "Crunches", category: "Core" },
  { name: "Russian Twists", category: "Core" },
  { name: "Hanging Leg Raises", category: "Core" },
  { name: "Ab Wheel Rollouts", category: "Core" },
  // Cardio
  { name: "Burpees", category: "Cardio" },
  { name: "Jump Rope", category: "Cardio" },
  { name: "Box Jumps", category: "Cardio" },
  { name: "Mountain Climbers", category: "Cardio" },
  { name: "Sprint Intervals", category: "Cardio" },
];

const CATEGORIES = [...new Set(EXERCISE_LIBRARY.map((e) => e.category))];

const ICON_OPTIONS: { icon: IoniconsName; label: string }[] = [
  { icon: "barbell-outline", label: "Weights" },
  { icon: "body-outline", label: "Body" },
  { icon: "flash-outline", label: "HIIT" },
  { icon: "fitness-outline", label: "Fitness" },
  { icon: "flame-outline", label: "Cardio" },
];

export default function WorkoutBuilderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [workoutName, setWorkoutName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState<IoniconsName>("barbell-outline");
  const [exercises, setExercises] = useState<CustomExercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<string | null>(null);
  const [customExName, setCustomExName] = useState("");
  const [saving, setSaving] = useState(false);

  const estimatedDuration = Math.max(15, exercises.reduce((s, e) => s + e.sets * 3, 0));
  const estimatedCalories = Math.round(exercises.reduce((s, e) => s + e.sets * e.reps * 0.5, 0) + estimatedDuration * 5);

  function addExercise(name: string) {
    if (exercises.find((e) => e.name === name)) {
      Alert.alert("Already added", `${name} is already in this workout.`);
      return;
    }
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setExercises((prev) => [...prev, { name, sets: 3, reps: 12 }]);
    setShowExercisePicker(false);
    setCustomExName("");
  }

  function addCustomExercise() {
    const name = customExName.trim();
    if (!name) return;
    addExercise(name);
  }

  function removeExercise(index: number) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }

  function updateExercise(index: number, key: keyof CustomExercise, value: string) {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== index) return ex;
        if (key === "name") return { ...ex, name: value };
        const n = parseInt(value, 10);
        if (key === "weight") return { ...ex, weight: isNaN(n) ? undefined : Math.max(0, n) };
        return { ...ex, [key]: isNaN(n) ? ex[key] : Math.max(1, n) };
      })
    );
  }

  function moveExercise(index: number, dir: -1 | 1) {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= exercises.length) return;
    const arr = [...exercises];
    [arr[index], arr[newIdx]] = [arr[newIdx], arr[index]];
    setExercises(arr);
  }

  async function handleSave() {
    if (!workoutName.trim()) {
      Alert.alert("Name required", "Please give your workout a name.");
      return;
    }
    if (exercises.length === 0) {
      Alert.alert("No exercises", "Add at least one exercise to your workout.");
      return;
    }
    setSaving(true);
    const existing = await loadCustomWorkouts();
    const newWorkout: WorkoutTemplate = {
      workoutId: `custom_${Date.now()}`,
      name: workoutName.trim(),
      duration: estimatedDuration,
      calories: estimatedCalories,
      exercises,
      icon: selectedIcon,
    };
    await saveCustomWorkouts([...existing, newWorkout]);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSaving(false);
    Alert.alert("Saved!", `"${newWorkout.name}" has been added to My Workouts.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  const filteredLibrary = pickerCategory
    ? EXERCISE_LIBRARY.filter((e) => e.category === pickerCategory)
    : EXERCISE_LIBRARY;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Build Workout</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveHeaderBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.saveHeaderBtnText, { color: colors.primaryForeground }]}>
            {saving ? "Saving…" : "Save"}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Workout name */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>Workout Name</Text>
          <TextInput
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="e.g. Push Day A, Leg Blast..."
            placeholderTextColor={colors.mutedForeground}
            maxLength={50}
            style={[styles.nameInput, { color: colors.foreground }]}
          />
          <Text style={[styles.cardLabel, { color: colors.mutedForeground }, { marginTop: 12 }]}>Icon</Text>
          <View style={styles.iconRow}>
            {ICON_OPTIONS.map(({ icon, label }) => (
              <TouchableOpacity
                key={icon}
                onPress={() => setSelectedIcon(icon)}
                style={[
                  styles.iconBtn,
                  {
                    backgroundColor: selectedIcon === icon ? colors.primary + "20" : colors.muted,
                    borderColor: selectedIcon === icon ? colors.primary : "transparent",
                    borderWidth: selectedIcon === icon ? 2 : 0,
                  },
                ]}
              >
                <Ionicons name={icon} size={22} color={selectedIcon === icon ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.iconBtnLabel, { color: selectedIcon === icon ? colors.primary : colors.mutedForeground }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Stats preview */}
        {exercises.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statPill, { backgroundColor: colors.primary + "18" }]}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={[styles.statPillText, { color: colors.primary }]}>~{estimatedDuration} min</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: colors.warning + "18" }]}>
              <Ionicons name="flame-outline" size={14} color={colors.warning} />
              <Text style={[styles.statPillText, { color: colors.warning }]}>~{estimatedCalories} kcal</Text>
            </View>
            <View style={[styles.statPill, { backgroundColor: "#10b981" + "18" }]}>
              <Ionicons name="barbell-outline" size={14} color="#10b981" />
              <Text style={[styles.statPillText, { color: "#10b981" }]}>{exercises.length} exercises</Text>
            </View>
          </View>
        )}

        {/* Exercise list */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Exercises</Text>
        {exercises.length === 0 && (
          <View style={[styles.emptyEx, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="add-circle-outline" size={36} color={colors.mutedForeground} />
            <Text style={[styles.emptyExText, { color: colors.mutedForeground }]}>
              No exercises yet — tap Add Exercise below
            </Text>
          </View>
        )}
        {exercises.map((ex, i) => (
          <View key={i} style={[styles.exCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.exHeader}>
              <View style={styles.exReorder}>
                <Pressable onPress={() => moveExercise(i, -1)} disabled={i === 0} hitSlop={8}>
                  <Ionicons name="chevron-up" size={18} color={i === 0 ? colors.muted : colors.mutedForeground} />
                </Pressable>
                <Pressable onPress={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} hitSlop={8}>
                  <Ionicons name="chevron-down" size={18} color={i === exercises.length - 1 ? colors.muted : colors.mutedForeground} />
                </Pressable>
              </View>
              <Text style={[styles.exName, { color: colors.foreground }]} numberOfLines={1}>
                {ex.name}
              </Text>
              <Pressable onPress={() => removeExercise(i)} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.destructive} />
              </Pressable>
            </View>
            <View style={styles.exFields}>
              <View style={styles.exField}>
                <Text style={[styles.exFieldLabel, { color: colors.mutedForeground }]}>Sets</Text>
                <TextInput
                  value={ex.sets.toString()}
                  onChangeText={(v) => updateExercise(i, "sets", v)}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[styles.exFieldInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                />
              </View>
              <View style={styles.exField}>
                <Text style={[styles.exFieldLabel, { color: colors.mutedForeground }]}>Reps</Text>
                <TextInput
                  value={ex.reps.toString()}
                  onChangeText={(v) => updateExercise(i, "reps", v)}
                  keyboardType="number-pad"
                  maxLength={3}
                  style={[styles.exFieldInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                />
              </View>
              <View style={styles.exField}>
                <Text style={[styles.exFieldLabel, { color: colors.mutedForeground }]}>Weight (kg)</Text>
                <TextInput
                  value={ex.weight != null ? ex.weight.toString() : ""}
                  onChangeText={(v) => updateExercise(i, "weight", v)}
                  keyboardType="number-pad"
                  maxLength={4}
                  placeholder="—"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.exFieldInput, { backgroundColor: colors.muted, color: colors.foreground }]}
                />
              </View>
            </View>
          </View>
        ))}

        {/* Add exercise button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            setShowExercisePicker(!showExercisePicker);
            setPickerCategory(null);
            setCustomExName("");
          }}
          style={[styles.addExBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name={showExercisePicker ? "chevron-up" : "add-circle-outline"} size={20} color={colors.primary} />
          <Text style={[styles.addExBtnText, { color: colors.primary }]}>
            {showExercisePicker ? "Close picker" : "Add Exercise"}
          </Text>
        </TouchableOpacity>

        {/* Exercise picker */}
        {showExercisePicker && (
          <View style={[styles.picker, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Custom exercise */}
            <View style={[styles.customExRow, { borderBottomColor: colors.border }]}>
              <TextInput
                value={customExName}
                onChangeText={setCustomExName}
                placeholder="Custom exercise name…"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.customExInput, { color: colors.foreground, backgroundColor: colors.muted }]}
                returnKeyType="done"
                onSubmitEditing={addCustomExercise}
              />
              <Pressable
                onPress={addCustomExercise}
                disabled={!customExName.trim()}
                style={[styles.customExAdd, { backgroundColor: colors.primary, opacity: customExName.trim() ? 1 : 0.4 }]}
              >
                <Text style={[styles.customExAddText, { color: colors.primaryForeground }]}>Add</Text>
              </Pressable>
            </View>
            {/* Category tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catTabs}>
              <Pressable
                onPress={() => setPickerCategory(null)}
                style={[styles.catTab, { backgroundColor: pickerCategory === null ? colors.primary : colors.muted }]}
              >
                <Text style={[styles.catTabText, { color: pickerCategory === null ? colors.primaryForeground : colors.mutedForeground }]}>All</Text>
              </Pressable>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setPickerCategory(cat === pickerCategory ? null : cat)}
                  style={[styles.catTab, { backgroundColor: pickerCategory === cat ? colors.primary : colors.muted }]}
                >
                  <Text style={[styles.catTabText, { color: pickerCategory === cat ? colors.primaryForeground : colors.mutedForeground }]}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {/* Exercise list */}
            {filteredLibrary.map((ex) => {
              const already = exercises.some((e) => e.name === ex.name);
              return (
                <TouchableOpacity
                  key={ex.name}
                  onPress={() => !already && addExercise(ex.name)}
                  activeOpacity={already ? 1 : 0.7}
                  style={[
                    styles.pickerRow,
                    { borderBottomColor: colors.border, opacity: already ? 0.4 : 1 },
                  ]}
                >
                  <Text style={[styles.pickerRowName, { color: colors.foreground }]}>{ex.name}</Text>
                  <Text style={[styles.pickerRowCat, { color: colors.mutedForeground }]}>{ex.category}</Text>
                  {already ? (
                    <Ionicons name="checkmark-circle" size={18} color="#10b981" />
                  ) : (
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Save button */}
        <Pressable
          onPress={handleSave}
          disabled={saving || !workoutName.trim() || exercises.length === 0}
          style={[
            styles.saveBtn,
            {
              backgroundColor: colors.primary,
              opacity: saving || !workoutName.trim() || exercises.length === 0 ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name="save-outline" size={20} color={colors.primaryForeground} />
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            {saving ? "Saving…" : "Save Workout"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  saveHeaderBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20 },
  saveHeaderBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  cardLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  nameInput: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold", paddingVertical: 4 },
  iconRow: { flexDirection: "row", gap: 8 },
  iconBtn: { flex: 1, alignItems: "center", padding: 10, borderRadius: 12, gap: 4 },
  iconBtnLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4, padding: 10, borderRadius: 12, justifyContent: "center" },
  statPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  emptyEx: { borderRadius: 16, borderWidth: 1, borderStyle: "dashed", padding: 28, alignItems: "center", gap: 10 },
  emptyExText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  exCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  exHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  exReorder: { gap: 2 },
  exName: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  exFields: { flexDirection: "row", gap: 10 },
  exField: { flex: 1, gap: 6 },
  exFieldLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  exFieldInput: { borderRadius: 10, padding: 10, fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  addExBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 16, borderWidth: 1 },
  addExBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  picker: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  customExRow: { flexDirection: "row", gap: 8, padding: 12, borderBottomWidth: 1 },
  customExInput: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, fontFamily: "Inter_400Regular" },
  customExAdd: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, justifyContent: "center" },
  customExAddText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  catTabs: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, flexDirection: "row" },
  catTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  catTabText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  pickerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 10 },
  pickerRowName: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  pickerRowCat: { fontSize: 12, fontFamily: "Inter_400Regular" },
  saveBtn: { height: 56, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
