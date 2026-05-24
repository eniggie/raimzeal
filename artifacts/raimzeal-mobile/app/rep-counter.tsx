import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Accelerometer } from "expo-sensors";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

// ─── Exercise definitions ────────────────────────────────────────────────────

interface Exercise {
  id: string;
  label: string;
  icon: string;
  hint: string;
  threshold: number;
  minInterval: number;
}

const EXERCISES: Exercise[] = [
  {
    id: "pushup",
    label: "Push-ups",
    icon: "fitness-outline",
    hint: "Phone flat on floor beside you, face-down",
    threshold: 1.8,
    minInterval: 600,
  },
  {
    id: "squat",
    label: "Squats",
    icon: "body-outline",
    hint: "Phone in hand or pocket while squatting",
    threshold: 2.0,
    minInterval: 700,
  },
  {
    id: "situp",
    label: "Sit-ups",
    icon: "arrow-up-circle-outline",
    hint: "Phone on chest, lie down and crunch up",
    threshold: 1.9,
    minInterval: 700,
  },
  {
    id: "curl",
    label: "Bicep Curls",
    icon: "barbell-outline",
    hint: "Phone in hand you're curling, elbow at side",
    threshold: 2.2,
    minInterval: 500,
  },
  {
    id: "jumpingjack",
    label: "Jumping Jacks",
    icon: "flash-outline",
    hint: "Phone in hand or pocket while jumping",
    threshold: 2.5,
    minInterval: 400,
  },
  {
    id: "lunge",
    label: "Lunges",
    icon: "walk-outline",
    hint: "Phone in pocket while stepping forward",
    threshold: 2.1,
    minInterval: 700,
  },
];

// ─── Rep detection hook ──────────────────────────────────────────────────────

function useRepCounter(exercise: Exercise | null, enabled: boolean) {
  const [reps, setReps] = useState(0);
  const lastRepTime = useRef(0);
  const lastMag = useRef(1.0);
  const wasAbove = useRef(false);

  useEffect(() => {
    if (!enabled || !exercise) return;

    Accelerometer.setUpdateInterval(50);

    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      const threshold = exercise.threshold;
      const minInterval = exercise.minInterval;

      const isAbove = mag > threshold;
      if (isAbove && !wasAbove.current && now - lastRepTime.current > minInterval) {
        lastRepTime.current = now;
        setReps((r) => r + 1);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
      wasAbove.current = isAbove;
      lastMag.current = mag;
    });

    return () => sub.remove();
  }, [exercise, enabled]);

  const reset = useCallback(() => {
    setReps(0);
    lastRepTime.current = 0;
    wasAbove.current = false;
  }, []);

  return { reps, reset };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

type Phase = "picker" | "counting" | "done";

export default function RepCounterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addWorkoutLog } = useFitness();

  const [phase, setPhase] = useState<Phase>("picker");
  const [selectedId, setSelectedId] = useState<string>("pushup");
  const [sets, setSets] = useState<number[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);

  const exercise = EXERCISES.find((e) => e.id === selectedId) ?? EXERCISES[0];
  const { reps, reset } = useRepCounter(exercise, isTracking);

  const totalReps = sets.reduce((s, r) => s + r, 0) + (isTracking ? reps : 0);

  function startTracking() {
    reset();
    setIsTracking(true);
    if (phase === "picker") {
      setPhase("counting");
      setStartTime(Date.now());
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }

  function endSet() {
    if (reps > 0) {
      setSets((prev) => [...prev, reps]);
    }
    reset();
    setIsTracking(false);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function finishWorkout() {
    if (isTracking && reps > 0) {
      setSets((prev) => [...prev, reps]);
    }
    setIsTracking(false);
    setPhase("done");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function saveLog() {
    const finalSets = isTracking && reps > 0 ? [...sets, reps] : sets;
    const total = finalSets.reduce((s, r) => s + r, 0);
    const durationMins = Math.max(1, Math.round((Date.now() - startTime) / 60000));
    addWorkoutLog({
      id: Date.now().toString(),
      workoutId: `rep-${exercise.id}`,
      workoutName: `Rep Counter · ${exercise.label}`,
      date: new Date().toISOString().split("T")[0],
      duration: durationMins,
      caloriesBurned: Math.round(total * 0.35),
      exercises: [
        {
          name: exercise.label,
          sets: finalSets.length || 1,
          reps: Math.round(total / (finalSets.length || 1)),
        },
      ],
      notes: `${finalSets.length} set${finalSets.length !== 1 ? "s" : ""}: ${finalSets.join(", ")} reps`,
    });
    router.replace("/(tabs)/workouts");
  }

  const bg = colors.background;
  const card = colors.card;
  const border = colors.border;
  const fg = colors.foreground;
  const muted = colors.mutedForeground;
  const primary = colors.primary;
  const accent = "#10b981";

  return (
    <View style={[s.root, { backgroundColor: bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={fg} />
        </TouchableOpacity>
        <Text style={[s.title, { color: fg }]}>Rep Counter</Text>
        <View style={{ width: 36 }} />
      </View>

      {phase === "picker" && (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[s.sectionLabel, { color: muted }]}>SELECT EXERCISE</Text>
          {EXERCISES.map((ex) => {
            const active = ex.id === selectedId;
            return (
              <TouchableOpacity
                key={ex.id}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedId(ex.id);
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                }}
                style={[
                  s.exRow,
                  {
                    backgroundColor: active ? primary + "15" : card,
                    borderColor: active ? primary + "60" : border,
                  },
                ]}
              >
                <View style={[s.exIcon, { backgroundColor: active ? primary + "20" : border + "40" }]}>
                  <Ionicons name={ex.icon as "fitness-outline"} size={20} color={active ? primary : muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.exLabel, { color: fg }]}>{ex.label}</Text>
                  <Text style={[s.exHint, { color: muted }]}>{ex.hint}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={20} color={primary} />}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={startTracking}
            style={[s.startBtn, { backgroundColor: accent }]}
          >
            <Ionicons name="play" size={20} color="#fff" />
            <Text style={s.startBtnText}>Start Counting</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {phase === "counting" && (
        <View style={s.countingRoot}>
          {/* Exercise info */}
          <View style={[s.exInfoBar, { backgroundColor: card, borderColor: border }]}>
            <Ionicons name={exercise.icon as "fitness-outline"} size={18} color={accent} />
            <Text style={[s.exInfoLabel, { color: fg }]}>{exercise.label}</Text>
            <Text style={[s.exInfoHint, { color: muted }]}>{exercise.hint}</Text>
          </View>

          {/* Big rep display */}
          <View style={s.bigRepWrap}>
            <Text style={[s.bigRepNum, { color: isTracking ? accent : muted }]}>{reps}</Text>
            <Text style={[s.bigRepLabel, { color: muted }]}>
              {isTracking ? "reps this set" : "tap Start Set"}
            </Text>
          </View>

          {/* Sets history */}
          {sets.length > 0 && (
            <View style={[s.setsRow, { backgroundColor: card, borderColor: border }]}>
              {sets.map((r, i) => (
                <View key={i} style={[s.setChip, { backgroundColor: accent + "20" }]}>
                  <Text style={[s.setChipLabel, { color: accent }]}>Set {i + 1}</Text>
                  <Text style={[s.setChipReps, { color: fg }]}>{r}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Total */}
          <View style={[s.totalRow, { borderTopColor: border }]}>
            <Text style={[s.totalLabel, { color: muted }]}>Total reps</Text>
            <Text style={[s.totalNum, { color: fg }]}>{totalReps}</Text>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            {!isTracking ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={startTracking}
                style={[s.ctrlBtn, { backgroundColor: accent }]}
              >
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={s.ctrlBtnText}>Start Set</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={endSet}
                style={[s.ctrlBtn, { backgroundColor: primary }]}
              >
                <Ionicons name="stop" size={20} color="#fff" />
                <Text style={s.ctrlBtnText}>End Set ({reps})</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={finishWorkout}
              style={[s.finishBtn, { borderColor: border }]}
            >
              <Text style={[s.finishBtnText, { color: muted }]}>Finish Workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === "done" && (
        <View style={s.doneRoot}>
          <View style={[s.doneCard, { backgroundColor: card, borderColor: border }]}>
            <View style={[s.doneIcon, { backgroundColor: accent + "20" }]}>
              <Ionicons name="trophy-outline" size={36} color={accent} />
            </View>
            <Text style={[s.doneName, { color: fg }]}>{exercise.label}</Text>
            <Text style={[s.doneTotal, { color: accent }]}>
              {sets.reduce((s, r) => s + r, 0)} reps
            </Text>
            <Text style={[s.doneSets, { color: muted }]}>
              {sets.length} set{sets.length !== 1 ? "s" : ""}: {sets.join(", ")}
            </Text>

            {sets.map((r, i) => (
              <View key={i} style={[s.doneSetRow, { borderBottomColor: border }]}>
                <Text style={[s.doneSetLabel, { color: muted }]}>Set {i + 1}</Text>
                <Text style={[s.doneSetReps, { color: fg }]}>{r} reps</Text>
              </View>
            ))}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={saveLog}
              style={[s.saveBtn, { backgroundColor: accent }]}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={s.saveBtnText}>Save to Log</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.back()}
              style={s.skipBtn}
            >
              <Text style={[s.skipBtnText, { color: muted }]}>Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 36, height: 36, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 18, fontFamily: "Inter_600SemiBold" },

  scroll: { padding: 16, gap: 10, paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1, marginBottom: 4 },

  exRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  exIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  exLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  exHint: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  startBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },

  countingRoot: { flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  exInfoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  exInfoLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 0 },
  exInfoHint: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },

  bigRepWrap: { alignItems: "center", paddingVertical: 28 },
  bigRepNum: { fontSize: 96, fontFamily: "Inter_700Bold", lineHeight: 104 },
  bigRepLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },

  setsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  setChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignItems: "center" },
  setChipLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  setChipReps: { fontSize: 16, fontFamily: "Inter_700Bold" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  totalLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  totalNum: { fontSize: 22, fontFamily: "Inter_700Bold" },

  controls: { gap: 10, paddingBottom: 32 },
  ctrlBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
  },
  ctrlBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#fff" },
  finishBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  finishBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },

  doneRoot: { flex: 1, justifyContent: "center", padding: 20 },
  doneCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  doneName: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  doneTotal: { fontSize: 42, fontFamily: "Inter_700Bold", marginTop: 4 },
  doneSets: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 8 },

  doneSetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  doneSetLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  doneSetReps: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 16,
  },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  skipBtn: { paddingVertical: 10, marginTop: 4 },
  skipBtnText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
