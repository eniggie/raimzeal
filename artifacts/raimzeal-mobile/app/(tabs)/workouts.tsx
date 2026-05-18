import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, WorkoutLog } from "@/contexts/FitnessContext";
import { WorkoutCard } from "@/components/WorkoutCard";
import { GlassCard } from "@/components/GlassCard";

interface WorkoutTemplate {
  workoutId: string;
  name: string;
  duration: number;
  calories: number;
  exercises: { name: string; sets: number; reps: number; weight?: number }[];
  icon: keyof typeof Ionicons.glyphMap;
}

const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    workoutId: "w1",
    name: "Upper Body Strength",
    duration: 50,
    calories: 380,
    exercises: [
      { name: "Bench Press", sets: 4, reps: 10, weight: 70 },
      { name: "Pull-ups", sets: 4, reps: 8 },
      { name: "Shoulder Press", sets: 3, reps: 12, weight: 45 },
      { name: "Bicep Curls", sets: 3, reps: 12, weight: 16 },
      { name: "Tricep Dips", sets: 3, reps: 12 },
    ],
    icon: "barbell-outline",
  },
  {
    workoutId: "w2",
    name: "Leg Day",
    duration: 65,
    calories: 460,
    exercises: [
      { name: "Squats", sets: 4, reps: 12, weight: 60 },
      { name: "Deadlifts", sets: 3, reps: 8, weight: 85 },
      { name: "Lunges", sets: 3, reps: 12 },
      { name: "Leg Press", sets: 3, reps: 15 },
      { name: "Calf Raises", sets: 4, reps: 20 },
    ],
    icon: "body-outline",
  },
  {
    workoutId: "w3",
    name: "HIIT Cardio",
    duration: 30,
    calories: 320,
    exercises: [
      { name: "Burpees", sets: 4, reps: 15 },
      { name: "Jump Rope", sets: 4, reps: 100 },
      { name: "Box Jumps", sets: 4, reps: 10 },
      { name: "Sprint Intervals", sets: 6, reps: 1 },
      { name: "Mountain Climbers", sets: 4, reps: 20 },
    ],
    icon: "flash-outline",
  },
  {
    workoutId: "w4",
    name: "Core & Abs",
    duration: 25,
    calories: 180,
    exercises: [
      { name: "Plank", sets: 3, reps: 1 },
      { name: "Crunches", sets: 4, reps: 20 },
      { name: "Leg Raises", sets: 3, reps: 15 },
      { name: "Russian Twists", sets: 3, reps: 20 },
      { name: "Bicycle Crunches", sets: 3, reps: 20 },
    ],
    icon: "fitness-outline",
  },
  {
    workoutId: "w5",
    name: "Full Body",
    duration: 60,
    calories: 420,
    exercises: [
      { name: "Deadlifts", sets: 3, reps: 8, weight: 85 },
      { name: "Push-ups", sets: 4, reps: 15 },
      { name: "Rows", sets: 4, reps: 10 },
      { name: "Squat Jumps", sets: 3, reps: 12 },
      { name: "Shoulder Press", sets: 3, reps: 10, weight: 45 },
    ],
    icon: "body-outline",
  },
  {
    workoutId: "w6",
    name: "Active Recovery",
    duration: 35,
    calories: 150,
    exercises: [
      { name: "Yoga Flow", sets: 1, reps: 1 },
      { name: "Foam Rolling", sets: 1, reps: 1 },
      { name: "Light Stretching", sets: 1, reps: 1 },
      { name: "Walking", sets: 1, reps: 1 },
      { name: "Mobility Work", sets: 1, reps: 1 },
    ],
    icon: "leaf-outline",
  },
];

export default function WorkoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { workoutLogs, addWorkoutLog } = useFitness();

  const [activeTab, setActiveTab] = useState<"library" | "history">("library");
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [customName, setCustomName] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleStartWorkout(template: WorkoutTemplate) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedTemplate(template);
    setCustomName(template.name);
    setShowModal(true);
  }

  function handleLogWorkout() {
    if (!selectedTemplate) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const log: WorkoutLog = {
      id: Date.now().toString(),
      workoutId: selectedTemplate.workoutId,
      workoutName: customName || selectedTemplate.name,
      date: new Date().toISOString().split("T")[0],
      duration: selectedTemplate.duration,
      caloriesBurned: selectedTemplate.calories,
      exercises: selectedTemplate.exercises,
    };
    addWorkoutLog(log);
    setShowModal(false);
    Alert.alert("Workout Logged!", `Great job completing ${log.workoutName}!`);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Workouts
        </Text>
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["library", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabBtn,
                activeTab === tab && { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === tab ? colors.foreground : colors.mutedForeground,
                    fontFamily: activeTab === tab ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === "library" ? (
        <FlatList
          data={WORKOUT_TEMPLATES}
          keyExtractor={(item) => item.workoutId}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleStartWorkout(item)}
              style={[
                styles.templateCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.templateIcon, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name={item.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.templateInfo}>
                <Text style={[styles.templateName, { color: colors.foreground }]}>
                  {item.name}
                </Text>
                <Text style={[styles.templateMeta, { color: colors.mutedForeground }]}>
                  {item.exercises.slice(0, 3).map((e) => e.name).join(" · ")}
                  {item.exercises.length > 3 ? ` +${item.exercises.length - 3}` : ""}
                </Text>
                <View style={styles.templateStats}>
                  <View style={styles.templateStat}>
                    <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>
                      {item.duration}m
                    </Text>
                  </View>
                  <View style={styles.templateStat}>
                    <Ionicons name="flame-outline" size={12} color={colors.warning} />
                    <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>
                      ~{item.calories} kcal
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="play" size={16} color={colors.primaryForeground} />
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={workoutLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No workouts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
                Start a workout from the library
              </Text>
            </View>
          }
          renderItem={({ item }) => <WorkoutCard workout={item} />}
        />
      )}

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Log Workout
            </Text>
            <TextInput
              value={customName}
              onChangeText={setCustomName}
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholderTextColor={colors.mutedForeground}
              placeholder="Workout name"
            />
            {selectedTemplate && (
              <Text style={[styles.modalMetaText, { color: colors.mutedForeground }]}>
                {selectedTemplate.duration} min · ~{selectedTemplate.calories} kcal
              </Text>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowModal(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleLogWorkout}
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                  Log Workout
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  tabRow: { flexDirection: "row", borderRadius: 10, padding: 3 },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  tabLabel: { fontSize: 14 },
  listContent: { padding: 16, gap: 10 },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  templateInfo: { flex: 1, gap: 4 },
  templateName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  templateMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  templateStats: { flexDirection: "row", gap: 12, marginTop: 2 },
  templateStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  templateStatText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  startBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtext: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "flex-end",
  },
  modalCard: { margin: 16, padding: 24, borderRadius: 20, gap: 16 },
  modalTitle: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  modalInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modalMetaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  modalConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
