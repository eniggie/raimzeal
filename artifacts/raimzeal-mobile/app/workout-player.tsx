import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, WorkoutLog } from "@/contexts/FitnessContext";
import { WORKOUT_TEMPLATES } from "@/constants/workoutTemplates";
import type { WorkoutTemplate } from "@/constants/workoutTemplates";
import { loadCustomWorkouts } from "@/lib/customWorkouts";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useSyncIndicator } from "@/hooks/useSyncIndicator";

const REST_SECONDS_DEFAULT = 60;
const REST_SECONDS_MIN = 15;
const REST_SECONDS_MAX = 300;

type Phase = "exercise" | "rest" | "complete";

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function WorkoutPlayerScreen() {
  useKeepAwake();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addWorkoutLog, personalRecords } = useFitness();
  const { syncStatus, startSync, finishSync } = useSyncIndicator();
  const { workoutId } = useLocalSearchParams<{ workoutId: string }>();

  const builtInTemplate = WORKOUT_TEMPLATES.find((t) => t.workoutId === workoutId);
  const [customTemplate, setCustomTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(!builtInTemplate);
  const template = builtInTemplate ?? customTemplate;

  useEffect(() => {
    if (!builtInTemplate && workoutId) {
      setTemplateLoading(true);
      loadCustomWorkouts()
        .then((workouts) => {
          const found = workouts.find((w) => w.workoutId === workoutId) ?? null;
          setCustomTemplate(found);
        })
        .finally(() => setTemplateLoading(false));
    }
  }, [workoutId]);

  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [setIdx, setSetIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("exercise");
  const [restDuration, setRestDuration] = useState(REST_SECONDS_DEFAULT);
  const [restSecsLeft, setRestSecsLeft] = useState(REST_SECONDS_DEFAULT);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [logged, setLogged] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [rpeValue, setRpeValue] = useState(6);
  const [noteText, setNoteText] = useState("");
  const [newPRExercises, setNewPRExercises] = useState<string[]>([]);
  const [workoutLogId, setWorkoutLogId] = useState("");

  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const exercises = template?.exercises ?? [];
  const currentExercise = exercises[exerciseIdx];
  const totalSets = currentExercise?.sets ?? 1;

  const totalSteps = exercises.reduce((acc, ex) => acc + ex.sets, 0);
  const completedSteps =
    exercises.slice(0, exerciseIdx).reduce((acc, ex) => acc + ex.sets, 0) +
    setIdx;
  const progress = totalSteps > 0 ? completedSteps / totalSteps : 0;

  const triggerHaptic = useCallback((type: "set" | "finish") => {
    if (Platform.OS === "web") return;
    if (type === "finish") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, []);

  useEffect(() => {
    elapsedIntervalRef.current = setInterval(() => {
      setElapsedSecs((s) => s + 1);
    }, 1000);
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "rest") {
      setRestSecsLeft(restDuration);
      restIntervalRef.current = setInterval(() => {
        setRestSecsLeft((s) => {
          if (s <= 1) {
            clearInterval(restIntervalRef.current!);
            advanceFromRest();
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, [phase, exerciseIdx, setIdx]);

  const logWorkout = useCallback(() => {
    if (!template || logged) return;
    setLogged(true);
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    triggerHaptic("finish");
    const logId = Date.now().toString();
    setWorkoutLogId(logId);
    const log: WorkoutLog = {
      id: logId,
      workoutId: template.workoutId,
      workoutName: template.name,
      date: new Date().toISOString().split("T")[0],
      duration: Math.round(elapsedSecs / 60) || 1,
      caloriesBurned: template.calories,
      exercises: template.exercises,
    };
    startSync();
    addWorkoutLog(log, finishSync);
    // Detect potential new PRs from template exercises that have weights
    const prMap = new Map(personalRecords.map((pr) => [pr.exercise.toLowerCase(), pr.weight]));
    const newPRs = template.exercises
      .filter((ex) => ex.weight != null && ex.weight > 0)
      .filter((ex) => {
        const existing = prMap.get(ex.name.toLowerCase());
        return existing == null || ex.weight! > existing;
      })
      .map((ex) => ex.name);
    setNewPRExercises(newPRs);
  }, [template, logged, elapsedSecs, triggerHaptic, addWorkoutLog, personalRecords, startSync, finishSync]);

  function advanceFromRest() {
    const nextSet = setIdx + 1;
    if (nextSet >= totalSets) {
      const nextExercise = exerciseIdx + 1;
      if (nextExercise >= exercises.length) {
        setPhase("complete");
        logWorkout();
      } else {
        setExerciseIdx(nextExercise);
        setSetIdx(0);
        setPhase("exercise");
      }
    } else {
      setSetIdx(nextSet);
      setPhase("exercise");
    }
  }

  function handleCompleteSet() {
    triggerHaptic("set");
    const isLastSet = setIdx + 1 >= totalSets;
    const isLastExercise = exerciseIdx + 1 >= exercises.length;

    if (isLastSet && isLastExercise) {
      setPhase("complete");
      logWorkout();
    } else {
      setPhase("rest");
    }
  }

  function handleSkipRest() {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    advanceFromRest();
  }

  function handleQuit() {
    Alert.alert(
      "Quit Workout?",
      "Your progress won't be saved.",
      [
        { text: "Keep Going", style: "cancel" },
        {
          text: "Quit",
          style: "destructive",
          onPress: () => {
            if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
            router.back();
          },
        },
      ]
    );
  }

  function handleFinish() {
    setShowNotes(true);
  }

  async function handleSaveNote(skip: boolean) {
    if (!skip && workoutLogId && (rpeValue > 0 || noteText.trim())) {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        await AsyncStorage.setItem(
          `@raimzeal_workout_note_${workoutLogId}`,
          JSON.stringify({ rpe: rpeValue, note: noteText.trim(), date: new Date().toISOString() })
        );
      } catch {}
    }
    setShowNotes(false);
    router.back();
  }

  if (templateLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!template) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.foreground }]}>
          Workout not found.
        </Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "complete") {
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.completeContainer}>
          <View style={[styles.completeBadge, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name="trophy" size={64} color={colors.primary} />
          </View>
          <Text style={[styles.completeTitle, { color: colors.foreground }]}>
            Workout Complete!
          </Text>
          <Text style={[styles.completeName, { color: colors.mutedForeground }]}>
            {template.name}
          </Text>

          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={22} color={colors.secondary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {formatTime(elapsedSecs)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Duration
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="flame-outline" size={22} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                ~{template.calories}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                kcal
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Ionicons name="barbell-outline" size={22} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {totalSteps}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Sets
              </Text>
            </View>
          </View>

          {newPRExercises.length > 0 && (
            <View style={[styles.prBanner, { backgroundColor: "#eab308" + "20", borderColor: "#eab308" + "50" }]}>
              <Text style={styles.prBannerEmoji}>🏆</Text>
              <View style={styles.prBannerText}>
                <Text style={[styles.prBannerTitle, { color: "#eab308" }]}>New Personal Records!</Text>
                <Text style={[styles.prBannerSub, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {newPRExercises.join(" · ")}
                </Text>
              </View>
            </View>
          )}

          <Pressable
            onPress={handleFinish}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Done
            </Text>
          </Pressable>
        </View>

        {/* Notes / RPE modal */}
        <Modal visible={showNotes} animationType="slide" transparent>
          <View style={styles.notesOverlay}>
            <View style={[styles.notesSheet, { backgroundColor: colors.background }]}>
              <View style={[styles.notesHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.notesTitle, { color: colors.foreground }]}>
                How was that? 💪
              </Text>
              <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>
                Effort level (RPE)
              </Text>
              <View style={styles.rpeRow}>
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => {
                      setRpeValue(n);
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                    }}
                    style={[
                      styles.rpeBtn,
                      {
                        backgroundColor: rpeValue === n ? colors.primary : colors.muted,
                        borderColor: rpeValue === n ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.rpeBtnText, { color: rpeValue === n ? colors.primaryForeground : colors.mutedForeground }]}>
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.rpeHint, { color: colors.mutedForeground }]}>
                {rpeValue <= 3 ? "Very easy" : rpeValue <= 5 ? "Moderate" : rpeValue <= 7 ? "Hard" : rpeValue <= 9 ? "Very hard" : "Maximum effort"}
              </Text>
              <Text style={[styles.notesLabel, { color: colors.mutedForeground }]}>
                Notes (optional)
              </Text>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder="How did you feel? Any PRs? Notes for next time..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={300}
                style={[styles.noteInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: colors.border }]}
              />
              <View style={styles.notesActions}>
                <Pressable
                  onPress={() => handleSaveNote(true)}
                  style={[styles.notesSkip, { borderColor: colors.border }]}
                >
                  <Text style={[styles.notesSkipText, { color: colors.mutedForeground }]}>Skip</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleSaveNote(false)}
                  style={[styles.notesSave, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.notesSaveText, { color: colors.primaryForeground }]}>Save Note</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  function adjustRest(deltaSecs: number) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    setRestDuration((prev) => {
      const next = Math.max(REST_SECONDS_MIN, Math.min(REST_SECONDS_MAX, prev + deltaSecs));
      setRestSecsLeft((cur) => Math.max(REST_SECONDS_MIN, Math.min(next, cur + deltaSecs)));
      return next;
    });
  }

  const restPercent = phase === "rest" ? restSecsLeft / restDuration : 1;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <Pressable onPress={handleQuit} style={styles.quitBtn} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.mutedForeground} />
        </Pressable>
        <Text style={[styles.workoutTitle, { color: colors.foreground }]} numberOfLines={1}>
          {template.name}
        </Text>
        <Text style={[styles.elapsedText, { color: colors.mutedForeground }]}>
          {formatTime(elapsedSecs)}
        </Text>
      </View>

      <View style={[styles.progressBarTrack, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.progressBarFill,
            { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
      <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
        {Math.round(progress * 100)}% complete
      </Text>

      <View style={styles.exerciseListHints}>
        {exercises.map((ex, i) => (
          <View
            key={i}
            style={[
              styles.exercisePip,
              {
                backgroundColor:
                  i < exerciseIdx
                    ? colors.primary
                    : i === exerciseIdx
                    ? colors.secondary
                    : colors.muted,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.mainContent}>
        {phase === "exercise" ? (
          <>
            <View
              style={[styles.exerciseIconCircle, { backgroundColor: colors.primary + "18" }]}
            >
              <Ionicons name={template.icon} size={48} color={colors.primary} />
            </View>

            <Text style={[styles.exerciseName, { color: colors.foreground }]}>
              {currentExercise?.name}
            </Text>

            <View style={[styles.setChip, { backgroundColor: colors.muted }]}>
              <Text style={[styles.setChipText, { color: colors.secondary }]}>
                Set {setIdx + 1} of {totalSets}
              </Text>
            </View>

            <Text style={[styles.repsText, { color: colors.mutedForeground }]}>
              {currentExercise?.reps === 1
                ? "Hold / 1 rep"
                : `${currentExercise?.reps} reps`}
              {currentExercise?.weight
                ? `  ·  ${currentExercise.weight} kg`
                : ""}
            </Text>

            {exerciseIdx + 1 < exercises.length && (
              <Text style={[styles.upNextText, { color: colors.mutedForeground }]}>
                Up next: {exercises[exerciseIdx + 1].name}
              </Text>
            )}
          </>
        ) : (
          <>
            <View
              style={[styles.restCircle, { borderColor: colors.secondary + "40" }]}
            >
              <View
                style={[
                  styles.restCircleInner,
                  {
                    backgroundColor: colors.secondary + "18",
                    transform: [{ scale: 0.5 + restPercent * 0.5 }],
                  },
                ]}
              />
              <Text style={[styles.restTimerText, { color: colors.secondary }]}>
                {restSecsLeft}
              </Text>
              <Text style={[styles.restLabel, { color: colors.mutedForeground }]}>
                REST
              </Text>
            </View>

            {/* Rest duration adjuster */}
            <View style={styles.restAdjuster}>
              <Pressable
                onPress={() => adjustRest(-15)}
                hitSlop={10}
                style={[styles.restAdjBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.restAdjBtnText, { color: colors.foreground }]}>−15s</Text>
              </Pressable>
              <Text style={[styles.restAdjLabel, { color: colors.mutedForeground }]}>
                {restDuration}s rest
              </Text>
              <Pressable
                onPress={() => adjustRest(15)}
                hitSlop={10}
                style={[styles.restAdjBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.restAdjBtnText, { color: colors.foreground }]}>+15s</Text>
              </Pressable>
            </View>

            <Text style={[styles.exerciseName, { color: colors.foreground }]}>
              {currentExercise?.name}
            </Text>

            <View style={[styles.setChip, { backgroundColor: colors.muted }]}>
              <Text style={[styles.setChipText, { color: colors.secondary }]}>
                Set {setIdx + 1} of {totalSets} done
              </Text>
            </View>

            {setIdx + 1 < totalSets ? (
              <Text style={[styles.upNextText, { color: colors.mutedForeground }]}>
                Next: Set {setIdx + 2} of {totalSets}
              </Text>
            ) : exerciseIdx + 1 < exercises.length ? (
              <Text style={[styles.upNextText, { color: colors.mutedForeground }]}>
                Next exercise: {exercises[exerciseIdx + 1].name}
              </Text>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.bottomActions}>
        {phase === "exercise" ? (
          <Pressable
            onPress={handleCompleteSet}
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="checkmark" size={22} color={colors.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Complete Set
            </Text>
          </Pressable>
        ) : (
          <>
            <View
              style={[styles.restProgressTrack, { backgroundColor: colors.muted }]}
            >
              <View
                style={[
                  styles.restProgressFill,
                  { backgroundColor: colors.secondary, width: `${Math.round(restPercent * 100)}%` },
                ]}
              />
            </View>
            <Pressable
              onPress={handleSkipRest}
              style={[styles.skipBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
            >
              <Ionicons name="play-skip-forward" size={18} color={colors.foreground} />
              <Text style={[styles.skipBtnText, { color: colors.foreground }]}>
                Skip Rest
              </Text>
            </Pressable>
          </>
        )}
      </View>
      <SyncIndicator status={syncStatus} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  backBtn: { padding: 12 },
  backBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  quitBtn: { padding: 4 },
  workoutTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  elapsedText: { fontSize: 14, fontFamily: "Inter_400Regular", minWidth: 44, textAlign: "right" },

  progressBarTrack: {
    height: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: { height: "100%", borderRadius: 2 },
  progressLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginHorizontal: 16,
    marginTop: 4,
  },

  exerciseListHints: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
    paddingHorizontal: 16,
  },
  exercisePip: {
    height: 6,
    flex: 1,
    borderRadius: 3,
    maxWidth: 48,
  },

  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  exerciseIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 28,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  setChip: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    marginTop: 4,
  },
  setChipText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  repsText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
  },
  upNextText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },

  restCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  restCircleInner: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  restTimerText: {
    fontSize: 48,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  restLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 2,
  },

  bottomActions: {
    paddingHorizontal: 20,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: "row",
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },

  prBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    width: "100%",
  },
  prBannerEmoji: { fontSize: 28 },
  prBannerText: { flex: 1 },
  prBannerTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  prBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  notesOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  notesSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingTop: 12,
    gap: 14,
  },
  notesHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  notesTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  notesLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  rpeRow: { flexDirection: "row", gap: 6 },
  rpeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  rpeBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  rpeHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -8 },
  noteInput: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 80,
    textAlignVertical: "top",
  },
  notesActions: { flexDirection: "row", gap: 12 },
  notesSkip: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  notesSkipText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  notesSave: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  notesSaveText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  restProgressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  restProgressFill: {
    height: "100%",
    borderRadius: 2,
  },
  restAdjuster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  restAdjBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  restAdjBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  restAdjLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    minWidth: 60,
    textAlign: "center",
  },
  skipBtn: {
    flexDirection: "row",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  skipBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },

  completeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 16,
  },
  completeBadge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  completeTitle: {
    fontSize: 32,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  completeName: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 0,
    width: "100%",
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  statValue: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
