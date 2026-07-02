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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";

const STORAGE_KEY = "@raimzeal_fasting_v1";

interface Protocol {
  id: string;
  label: string;
  fastHours: number;
  eatHours: number;
  blurb: string;
}

// Common evidence-informed intermittent-fasting windows. Educational only.
const PROTOCOLS: Protocol[] = [
  { id: "16-8", label: "16:8", fastHours: 16, eatHours: 8, blurb: "Beginner-friendly · fast 16h, eat within 8h" },
  { id: "18-6", label: "18:6", fastHours: 18, eatHours: 6, blurb: "Fast 18h, eat within 6h" },
  { id: "20-4", label: "20:4", fastHours: 20, eatHours: 4, blurb: "Warrior · fast 20h, eat within 4h" },
  { id: "omad", label: "OMAD", fastHours: 23, eatHours: 1, blurb: "One meal a day · fast 23h" },
];

interface ActiveFast {
  startedAt: number; // epoch ms
  targetHours: number;
  protocolId: string;
}

interface FastRecord {
  startedAt: number;
  endedAt: number;
  targetHours: number;
  protocolId: string;
  completed: boolean;
}

interface FastingState {
  protocolId: string;
  active: ActiveFast | null;
  history: FastRecord[];
}

const DEFAULT_STATE: FastingState = { protocolId: "16-8", active: null, history: [] };
const MS_PER_HOUR = 3_600_000;

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Consecutive days (ending today or yesterday) that have at least one completed fast.
function calcStreak(history: FastRecord[]): number {
  const completedDays = new Set(history.filter((r) => r.completed).map((r) => dayKey(r.endedAt)));
  if (completedDays.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (completedDays.has(key)) {
      streak++;
    } else if (i === 0) {
      // Today not yet done — keep counting from yesterday.
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// A short physiological milestone label for how deep into the fast the user is.
function fastingPhase(hours: number): { label: string; color: string } {
  if (hours < 4) return { label: "Fed state — digesting", color: "#8a8a96" };
  if (hours < 12) return { label: "Blood sugar settling", color: "#3b82f6" };
  if (hours < 16) return { label: "Fat-burning begins", color: "#FFB800" };
  if (hours < 18) return { label: "Ketosis ramping up", color: "#00FF7F" };
  if (hours < 24) return { label: "Autophagy zone", color: "#BF00FF" };
  return { label: "Deep fast — listen to your body", color: "#FF2020" };
}

export default function FastingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [state, setState] = useState<FastingState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted state.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<FastingState>;
            setState({
              protocolId: parsed.protocolId ?? DEFAULT_STATE.protocolId,
              active: parsed.active ?? null,
              history: Array.isArray(parsed.history) ? parsed.history : [],
            });
          } catch {
            /* keep default */
          }
        }
      })
      .finally(() => setHydrated(true));
  }, []);

  // Persist whenever state changes (after initial hydration).
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  // Tick the clock every second only while a fast is running.
  useFocusEffect(
    useCallback(() => {
      setNow(Date.now());
      if (state.active) {
        tickRef.current = setInterval(() => setNow(Date.now()), 1000);
      }
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = null;
      };
    }, [state.active])
  );

  const selectedProtocol = PROTOCOLS.find((p) => p.id === state.protocolId) ?? PROTOCOLS[0];
  const active = state.active;

  const elapsedMs = active ? now - active.startedAt : 0;
  const targetMs = (active?.targetHours ?? selectedProtocol.fastHours) * MS_PER_HOUR;
  const progress = active ? Math.min(1, elapsedMs / targetMs) : 0;
  const remainingMs = targetMs - elapsedMs;
  const elapsedHours = elapsedMs / MS_PER_HOUR;
  const phase = fastingPhase(active ? elapsedHours : 0);
  const streak = calcStreak(state.history);

  const startFast = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setState((prev) => {
      const proto = PROTOCOLS.find((p) => p.id === prev.protocolId) ?? PROTOCOLS[0];
      return {
        ...prev,
        active: { startedAt: Date.now(), targetHours: proto.fastHours, protocolId: proto.id },
      };
    });
  }, []);

  const endFast = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState((prev) => {
      if (!prev.active) return prev;
      const endedAt = Date.now();
      const durationH = (endedAt - prev.active.startedAt) / MS_PER_HOUR;
      const record: FastRecord = {
        startedAt: prev.active.startedAt,
        endedAt,
        targetHours: prev.active.targetHours,
        protocolId: prev.active.protocolId,
        completed: durationH >= prev.active.targetHours,
      };
      return { ...prev, active: null, history: [record, ...prev.history].slice(0, 60) };
    });
  }, []);

  const pickProtocol = useCallback((id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setState((prev) => ({ ...prev, protocolId: id }));
  }, []);

  const completedCount = state.history.filter((r) => r.completed).length;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 124 : 110 },
        ]}
        showsVerticalScrollIndicator={false}
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
            <Text style={[styles.title, { color: colors.foreground }]}>Intermittent Fasting</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {active ? "Fast in progress" : "Choose a window and begin"}
            </Text>
          </View>
          {streak > 0 && (
            <View style={[styles.streakBadge, { backgroundColor: colors.secondary + "20", borderColor: colors.secondary + "40" }]}>
              <Ionicons name="flame" size={14} color={colors.secondary} />
              <Text style={[styles.streakText, { color: colors.secondary }]}>{streak}d</Text>
            </View>
          )}
        </View>

        {/* Main timer card */}
        <GlassCard style={[styles.mainCard, { borderColor: (active ? phase.color : colors.primary) + "50" }]}>
          {active ? (
            <>
              <Text style={[styles.timerBig, { color: phase.color }]}>{formatDuration(elapsedMs)}</Text>
              <Text style={[styles.timerLabel, { color: colors.mutedForeground }]}>
                elapsed · target {active.targetHours}h
              </Text>

              <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
                <View
                  style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: phase.color }]}
                />
              </View>

              <View style={styles.phaseRow}>
                <View style={[styles.phaseDot, { backgroundColor: phase.color }]} />
                <Text style={[styles.phaseText, { color: colors.foreground }]}>{phase.label}</Text>
              </View>

              <Text style={[styles.remainingText, { color: colors.mutedForeground }]}>
                {remainingMs > 0
                  ? `${formatDuration(remainingMs)} to goal`
                  : `Goal reached — +${formatDuration(-remainingMs)} over 🎉`}
              </Text>

              <AnimatedPressable
                onPress={endFast}
                style={[styles.primaryBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="stop-circle-outline" size={20} color="#fff" />
                <Text style={styles.primaryBtnText}>End Fast</Text>
              </AnimatedPressable>
            </>
          ) : (
            <>
              <View style={styles.idleIconWrap}>
                <Ionicons name="timer-outline" size={44} color={colors.primary} />
              </View>
              <Text style={[styles.idleTitle, { color: colors.foreground }]}>Ready when you are</Text>
              <Text style={[styles.idleSub, { color: colors.mutedForeground }]}>
                {selectedProtocol.label} · {selectedProtocol.blurb}
              </Text>
              <AnimatedPressable
                onPress={startFast}
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="play" size={18} color={colors.primaryForeground} />
                <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
                  Start {selectedProtocol.label} Fast
                </Text>
              </AnimatedPressable>
            </>
          )}
        </GlassCard>

        {/* Protocol picker */}
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Fasting window</Text>
        <View style={styles.protocolGrid}>
          {PROTOCOLS.map((p) => {
            const selected = p.id === state.protocolId;
            return (
              <TouchableOpacity
                key={p.id}
                disabled={!!active}
                onPress={() => pickProtocol(p.id)}
                style={[
                  styles.protocolChip,
                  {
                    backgroundColor: selected ? colors.primary + "1a" : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: active && !selected ? 0.4 : 1,
                  },
                ]}
              >
                <Text style={[styles.protocolLabel, { color: selected ? colors.primary : colors.foreground }]}>
                  {p.label}
                </Text>
                <Text style={[styles.protocolHours, { color: colors.mutedForeground }]}>
                  {p.fastHours}h fast
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {active && (
          <Text style={[styles.lockNote, { color: colors.mutedForeground }]}>
            End your current fast to switch windows.
          </Text>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{streak}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>day streak</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.secondary }]}>{completedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>fasts completed</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.accent }]}>{state.history.length}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>total logged</Text>
          </GlassCard>
        </View>

        {/* History */}
        <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Recent fasts</Text>
        {state.history.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="hourglass-outline" size={28} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Your completed fasts will appear here.
            </Text>
          </GlassCard>
        ) : (
          state.history.slice(0, 14).map((r, i) => {
            const durMs = r.endedAt - r.startedAt;
            const proto = PROTOCOLS.find((p) => p.id === r.protocolId);
            return (
              <GlassCard key={`${r.startedAt}-${i}`} style={styles.historyRow}>
                <View
                  style={[
                    styles.historyIcon,
                    { backgroundColor: (r.completed ? colors.primary : colors.mutedForeground) + "1a" },
                  ]}
                >
                  <Ionicons
                    name={r.completed ? "checkmark-circle" : "time-outline"}
                    size={20}
                    color={r.completed ? colors.primary : colors.mutedForeground}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.historyTitle, { color: colors.foreground }]}>
                    {proto?.label ?? `${r.targetHours}h`} · {formatDuration(durMs)}
                  </Text>
                  <Text style={[styles.historyDate, { color: colors.mutedForeground }]}>
                    {new Date(r.endedAt).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                    {"  ·  "}
                    {r.completed ? "Goal met" : "Ended early"}
                  </Text>
                </View>
              </GlassCard>
            );
          })
        )}

        {/* Disclaimer */}
        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          Educational only. Intermittent fasting isn't for everyone — if you're pregnant, breastfeeding,
          diabetic, underweight, under 18, or have a history of disordered eating, talk to a healthcare
          professional first. Stay hydrated and break your fast gently.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  streakBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1,
  },
  streakText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  mainCard: { padding: 22, alignItems: "center", marginBottom: 24, borderWidth: 1 },
  timerBig: { fontSize: 46, fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 1 },
  timerLabel: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2, marginBottom: 16 },
  progressTrack: { width: "100%", height: 10, borderRadius: 6, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 6 },
  phaseRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  phaseDot: { width: 8, height: 8, borderRadius: 4 },
  phaseText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  remainingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 6, marginBottom: 18 },

  idleIconWrap: { marginBottom: 12 },
  idleTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_600SemiBold" },
  idleSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4, marginBottom: 18 },

  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 16, width: "100%",
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },

  sectionLabel: { fontSize: 15, fontFamily: "SpaceGrotesk_600SemiBold", marginBottom: 12, marginTop: 4 },
  protocolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  protocolChip: {
    flexGrow: 1, flexBasis: "22%", minWidth: 74, paddingVertical: 12, paddingHorizontal: 8,
    borderRadius: 14, borderWidth: 1, alignItems: "center",
  },
  protocolLabel: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  protocolHours: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  lockNote: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 12 },

  statsRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 24 },
  statCard: { flex: 1, padding: 14, alignItems: "center" },
  statValue: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, textAlign: "center" },

  emptyCard: { padding: 24, alignItems: "center", gap: 10, marginBottom: 16 },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },

  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginBottom: 10 },
  historyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  historyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  historyDate: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16, marginTop: 18, marginBottom: 8 },
});
