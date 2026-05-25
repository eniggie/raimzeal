import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

// ─── Types ──────────────────────────────────────────────────────────────────

type ActivityType = "run" | "walk" | "cycle";
type WorkoutPhase = "picker" | "active" | "paused" | "summary";

interface Coord {
  latitude: number;
  longitude: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ACTIVITIES: { type: ActivityType; label: string; icon: string; color: string; met: number; desc: string }[] = [
  { type: "run",   label: "Run",   icon: "fitness-outline",   color: "#ef4444", met: 9.8, desc: "Outdoor jog or sprint" },
  { type: "walk",  label: "Walk",  icon: "walk-outline",      color: "#3b82f6", met: 3.5, desc: "Brisk or leisure walk" },
  { type: "cycle", label: "Cycle", icon: "bicycle-outline",   color: "#10b981", met: 7.5, desc: "Road or trail cycling" },
];

const DEFAULT_WEIGHT_KG = 70;

// ─── Helpers ────────────────────────────────────────────────────────────────

function haversineKm(a: Coord, b: Coord): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPace(durationSecs: number, km: number): string {
  if (km < 0.01) return "--:--";
  const minsPerKm = durationSecs / 60 / km;
  const mins = Math.floor(minsPerKm);
  const secs = Math.round((minsPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatSpeed(durationSecs: number, km: number): string {
  if (durationSecs < 1) return "0.0";
  return ((km / durationSecs) * 3600).toFixed(1);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function OutdoorWorkoutScreen() {
  useKeepAwake();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addWorkoutLog, user, settings } = useFitness();

  const weightKg = (() => {
    const w = user?.weight ?? DEFAULT_WEIGHT_KG;
    const unit = settings?.weightUnit ?? "kg";
    return unit === "lbs" ? w * 0.453592 : w;
  })();

  const [activity, setActivity] = useState<ActivityType>("run");
  const [phase, setPhase]       = useState<WorkoutPhase>("picker");
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [distanceKm, setDistanceKm]   = useState(0);
  const [locationErr, setLocationErr] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState<boolean | null>(null);

  const prevCoord   = useRef<Coord | null>(null);
  const watchRef    = useRef<{ remove: () => void } | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedSecsRef = useRef<number>(0);

  const selectedActivity = ACTIVITIES.find((a) => a.type === activity)!;

  const caloriesBurned = Math.round(
    selectedActivity.met * weightKg * (elapsedSecs / 3600)
  );

  // ── GPS permission check on mount ───────────────────────────────────────
  useEffect(() => {
    if (Platform.OS === "web") {
      setLocationGranted(false);
      return;
    }
    (async () => {
      try {
        const Location = await import("expo-location");
        const { status } = await Location.getForegroundPermissionsAsync();
        setLocationGranted(status === "granted");
      } catch {
        setLocationGranted(false);
      }
    })();
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      watchRef.current?.remove();
    };
  }, []);

  // ── Start workout ────────────────────────────────────────────────────────
  const handleStart = useCallback(async () => {
    setLocationErr(null);

    if (Platform.OS !== "web") {
      try {
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationErr(
            "Location access is needed to track distance and pace. Please enable it in Settings."
          );
          setLocationGranted(false);
          return;
        }
        setLocationGranted(true);

        prevCoord.current = null;

        watchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5, // update every 5 metres
            timeInterval: 3000,
          },
          (loc) => {
            const coord: Coord = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            if (prevCoord.current) {
              const delta = haversineKm(prevCoord.current, coord);
              if (delta > 0.003) { // ignore < 3m jitter
                setDistanceKm((d) => d + delta);
              }
            }
            prevCoord.current = coord;
          }
        );
      } catch (e) {
        setLocationErr("Could not start GPS. Distance tracking will be unavailable.");
      }
    }

    startTimeRef.current = Date.now() - pausedSecsRef.current * 1000;
    timerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setPhase("active");
  }, []);

  // ── Pause ────────────────────────────────────────────────────────────────
  const handlePause = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    watchRef.current?.remove();
    watchRef.current = null;
    pausedSecsRef.current = elapsedSecs;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("paused");
  }, [elapsedSecs]);

  // ── Resume ───────────────────────────────────────────────────────────────
  const handleResume = useCallback(async () => {
    if (Platform.OS !== "web" && locationGranted) {
      try {
        const Location = await import("expo-location");
        prevCoord.current = null;
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 3000 },
          (loc) => {
            const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            if (prevCoord.current) {
              const delta = haversineKm(prevCoord.current, coord);
              if (delta > 0.003) setDistanceKm((d) => d + delta);
            }
            prevCoord.current = coord;
          }
        );
      } catch {
        setLocationErr("Could not restart GPS. Distance tracking paused.");
      }
    }

    startTimeRef.current = Date.now() - pausedSecsRef.current * 1000;
    timerRef.current = setInterval(() => {
      setElapsedSecs(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhase("active");
  }, [locationGranted]);

  // ── Finish ───────────────────────────────────────────────────────────────
  const handleFinish = useCallback(() => {
    timerRef.current && clearInterval(timerRef.current);
    watchRef.current?.remove();
    watchRef.current = null;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase("summary");
  }, []);

  const confirmFinish = useCallback(() => {
    if (phase === "active") {
      Alert.alert(
        "Finish Workout?",
        "This will stop tracking and show your summary.",
        [
          { text: "Keep Going", style: "cancel" },
          { text: "Finish", style: "destructive", onPress: handleFinish },
        ]
      );
    } else {
      handleFinish();
    }
  }, [phase, handleFinish]);

  // ── Save to log ──────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    const distStr = distanceKm >= 0.01 ? `${distanceKm.toFixed(2)} km` : null;
    const paceStr = distanceKm >= 0.01 ? `${formatPace(elapsedSecs, distanceKm)} /km` : null;
    const notes = [
      distStr && `Distance: ${distStr}`,
      paceStr && `Avg pace: ${paceStr}`,
    ].filter(Boolean).join(" · ");

    addWorkoutLog({
      id: Date.now().toString(),
      workoutId: `outdoor-${activity}`,
      workoutName: `Outdoor ${selectedActivity.label}`,
      date: new Date().toISOString().split("T")[0],
      duration: Math.max(1, Math.round(elapsedSecs / 60)),
      caloriesBurned,
      exercises: [],
      ...(notes ? { notes } : {}),
    });

    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)/workouts");
  }, [activity, selectedActivity, distanceKm, elapsedSecs, caloriesBurned, addWorkoutLog, router]);

  // ─── Render: Activity Picker ─────────────────────────────────────────────
  if (phase === "picker") {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Outdoor Workout</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.pickerContent, { paddingBottom: insets.bottom + 32 }]}>
          {/* Hero */}
          <View style={[styles.heroBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "25" }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name="location-outline" size={28} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroTitle, { color: colors.foreground }]}>GPS Activity Tracker</Text>
              <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
                Tracks distance, pace, and calories burned using your phone's GPS.
              </Text>
            </View>
          </View>

          {locationGranted === false && Platform.OS !== "web" && (
            <View style={[styles.warnBanner, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b40" }]}>
              <Ionicons name="warning-outline" size={16} color="#f59e0b" />
              <Text style={[styles.warnText, { color: colors.mutedForeground }]}>
                Location permission not granted. You can still start — distance tracking will be unavailable until you allow access.
              </Text>
            </View>
          )}

          {locationErr && (
            <View style={[styles.warnBanner, { backgroundColor: "#ef444418", borderColor: "#ef444440" }]}>
              <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
              <Text style={[styles.warnText, { color: colors.mutedForeground }]}>{locationErr}</Text>
            </View>
          )}

          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>CHOOSE ACTIVITY</Text>

          {ACTIVITIES.map((act) => (
            <TouchableOpacity
              key={act.type}
              onPress={() => { Haptics.selectionAsync(); setActivity(act.type); }}
              activeOpacity={0.8}
              style={[
                styles.actCard,
                {
                  backgroundColor: activity === act.type ? act.color + "18" : colors.card,
                  borderColor: activity === act.type ? act.color : colors.border,
                },
              ]}
            >
              <View style={[styles.actIcon, { backgroundColor: act.color + "20" }]}>
                <Ionicons name={act.icon as keyof typeof Ionicons.glyphMap} size={26} color={act.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.actLabel, { color: colors.foreground }]}>{act.label}</Text>
                <Text style={[styles.actDesc, { color: colors.mutedForeground }]}>{act.desc}</Text>
              </View>
              {activity === act.type && (
                <Ionicons name="checkmark-circle" size={22} color={act.color} />
              )}
            </TouchableOpacity>
          ))}

          {/* Stats preview */}
          <View style={[styles.statsPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statsPreviewTitle, { color: colors.foreground }]}>What gets tracked</Text>
            {[
              { icon: "time-outline",      label: "Duration",      color: colors.primary },
              { icon: "navigate-outline",  label: "Distance (km)", color: "#3b82f6" },
              { icon: "speedometer-outline", label: "Avg pace",    color: "#8b5cf6" },
              { icon: "flame-outline",     label: "Calories burned", color: "#ef4444" },
            ].map((item) => (
              <View key={item.label} style={styles.statsPreviewRow}>
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color={item.color} />
                <Text style={[styles.statsPreviewLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleStart}
            style={[styles.startBtn, { backgroundColor: selectedActivity.color }]}
          >
            <Ionicons name="play" size={22} color="#fff" />
            <Text style={styles.startBtnText}>Start {selectedActivity.label}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Render: Summary ─────────────────────────────────────────────────────
  if (phase === "summary") {
    const paceStr = distanceKm >= 0.01 ? formatPace(elapsedSecs, distanceKm) : null;
    const speedStr = distanceKm >= 0.01 ? formatSpeed(elapsedSecs, distanceKm) : null;

    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={{ width: 32 }} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Workout Summary</Text>
          <View style={{ width: 32 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.summaryContent, { paddingBottom: insets.bottom + 32 }]}>
          {/* Activity badge */}
          <View style={[styles.summaryBadge, { backgroundColor: selectedActivity.color + "18" }]}>
            <Ionicons name={selectedActivity.icon as keyof typeof Ionicons.glyphMap} size={36} color={selectedActivity.color} />
            <Text style={[styles.summaryActivityName, { color: selectedActivity.color }]}>
              {selectedActivity.label} Complete!
            </Text>
          </View>

          {/* Main stats grid */}
          <View style={styles.summaryGrid}>
            {[
              { label: "Duration",  value: formatDuration(elapsedSecs),                           icon: "time-outline",          color: colors.primary },
              { label: "Distance",  value: distanceKm >= 0.01 ? `${distanceKm.toFixed(2)} km` : "—", icon: "navigate-outline",   color: "#3b82f6" },
              { label: "Avg Pace",  value: paceStr ? `${paceStr} /km` : "—",                       icon: "speedometer-outline",   color: "#8b5cf6" },
              { label: "Calories",  value: `${caloriesBurned} cal`,                                 icon: "flame-outline",         color: "#ef4444" },
              { label: "Speed",     value: speedStr ? `${speedStr} km/h` : "—",                     icon: "bicycle-outline",       color: "#10b981" },
            ].map((s) => (
              <View key={s.label} style={[styles.summaryStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={20} color={s.color} />
                <Text style={[styles.summaryStatValue, { color: colors.foreground }]}>{s.value}</Text>
                <Text style={[styles.summaryStatLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Save button */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSave}
            style={[styles.startBtn, { backgroundColor: selectedActivity.color }]}
          >
            <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
            <Text style={styles.startBtnText}>Save to Workout History</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.discardBtn}>
            <Text style={[styles.discardText, { color: colors.mutedForeground }]}>Discard & Exit</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ─── Render: Active / Paused ─────────────────────────────────────────────
  const isPaused = phase === "paused";

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Minimal header */}
      <View style={[styles.activeHeader, { paddingTop: insets.top + 12, backgroundColor: selectedActivity.color + "15" }]}>
        <View style={[styles.activityChip, { backgroundColor: selectedActivity.color + "25" }]}>
          <Ionicons name={selectedActivity.icon as keyof typeof Ionicons.glyphMap} size={16} color={selectedActivity.color} />
          <Text style={[styles.activityChipLabel, { color: selectedActivity.color }]}>
            {selectedActivity.label}
          </Text>
        </View>
        {isPaused && (
          <View style={[styles.pausedChip, { backgroundColor: "#f59e0b25" }]}>
            <Ionicons name="pause-circle-outline" size={14} color="#f59e0b" />
            <Text style={[styles.activityChipLabel, { color: "#f59e0b" }]}>Paused</Text>
          </View>
        )}
      </View>

      {/* Big timer */}
      <View style={styles.timerBlock}>
        <Text style={[styles.bigTimer, { color: colors.foreground, opacity: isPaused ? 0.45 : 1 }]}>
          {formatDuration(elapsedSecs)}
        </Text>
        <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>Duration</Text>
      </View>

      {/* Live stats */}
      <View style={styles.liveStatsRow}>
        {[
          {
            label:   "Distance",
            value:   distanceKm >= 0.01 ? `${distanceKm.toFixed(2)}` : "0.00",
            unit:    "km",
            icon:    "navigate-outline",
            color:   "#3b82f6",
          },
          {
            label:   "Pace",
            value:   formatPace(elapsedSecs, distanceKm),
            unit:    "/km",
            icon:    "speedometer-outline",
            color:   "#8b5cf6",
          },
          {
            label:   "Calories",
            value:   String(caloriesBurned),
            unit:    "cal",
            icon:    "flame-outline",
            color:   "#ef4444",
          },
        ].map((s) => (
          <View key={s.label} style={[styles.liveStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={18} color={s.color} />
            <Text style={[styles.liveStatValue, { color: colors.foreground }]}>{s.value}</Text>
            <Text style={[styles.liveStatUnit, { color: s.color }]}>{s.unit}</Text>
            <Text style={[styles.liveStatLabel, { color: colors.mutedForeground }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {locationErr && (
        <View style={[styles.warnBanner, { backgroundColor: "#f59e0b12", borderColor: "#f59e0b30", marginHorizontal: 20 }]}>
          <Ionicons name="warning-outline" size={14} color="#f59e0b" />
          <Text style={[styles.warnText, { color: colors.mutedForeground, fontSize: 12 }]}>
            GPS unavailable — time & calories still tracked
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
        {isPaused ? (
          <>
            <TouchableOpacity
              onPress={handleResume}
              activeOpacity={0.85}
              style={[styles.primaryControl, { backgroundColor: selectedActivity.color }]}
            >
              <Ionicons name="play" size={28} color="#fff" />
              <Text style={styles.primaryControlLabel}>Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmFinish}
              activeOpacity={0.85}
              style={[styles.secondaryControl, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <Ionicons name="stop-circle-outline" size={24} color="#ef4444" />
              <Text style={[styles.secondaryControlLabel, { color: "#ef4444" }]}>Finish</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={handlePause}
              activeOpacity={0.85}
              style={[styles.primaryControl, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1.5 }]}
            >
              <Ionicons name="pause" size={28} color={colors.foreground} />
              <Text style={[styles.primaryControlLabel, { color: colors.foreground }]}>Pause</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmFinish}
              activeOpacity={0.85}
              style={[styles.secondaryControl, { backgroundColor: "#ef444418", borderColor: "#ef444440" }]}
            >
              <Ionicons name="stop-circle-outline" size={24} color="#ef4444" />
              <Text style={[styles.secondaryControlLabel, { color: "#ef4444" }]}>Finish</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },

  pickerContent: { padding: 20, gap: 16 },

  heroBanner: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  heroIconWrap: {
    width: 52, height: 52, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  heroSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  warnBanner: {
    flexDirection: "row", gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, alignItems: "flex-start",
  },
  warnText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8,
  },

  actCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1.5,
  },
  actIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  actLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  actDesc: { fontSize: 13, fontFamily: "Inter_400Regular" },

  statsPreview: {
    padding: 16, borderRadius: 14, borderWidth: 1, gap: 10,
  },
  statsPreviewTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  statsPreviewRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  statsPreviewLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },

  startBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, height: 54, borderRadius: 16,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },

  // Active/paused
  activeHeader: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingBottom: 14,
  },
  activityChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  pausedChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  activityChipLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  timerBlock: {
    alignItems: "center", justifyContent: "center",
    paddingVertical: 40,
  },
  bigTimer: { fontSize: 72, fontFamily: "Inter_700Bold", letterSpacing: -2 },
  timerLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 4 },

  liveStatsRow: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20, marginBottom: 16,
  },
  liveStatCard: {
    flex: 1, alignItems: "center", padding: 14,
    borderRadius: 16, borderWidth: 1, gap: 4,
  },
  liveStatValue: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 4 },
  liveStatUnit:  { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  liveStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },

  controls: {
    flexDirection: "row", gap: 12,
    paddingHorizontal: 20, marginTop: "auto",
  },
  primaryControl: {
    flex: 2, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", gap: 4,
  },
  primaryControlLabel: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  secondaryControl: {
    flex: 1, height: 64, borderRadius: 20,
    alignItems: "center", justifyContent: "center", gap: 4, borderWidth: 1,
  },
  secondaryControlLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Summary
  summaryContent: { padding: 20, gap: 20 },
  summaryBadge: {
    alignItems: "center", padding: 24, borderRadius: 20, gap: 12,
  },
  summaryActivityName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10,
  },
  summaryStatCard: {
    width: "47%", alignItems: "center", padding: 16,
    borderRadius: 16, borderWidth: 1, gap: 6,
  },
  summaryStatValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  summaryStatLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  discardBtn: { alignItems: "center", paddingVertical: 12 },
  discardText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
