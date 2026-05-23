import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type Phase = "inhale" | "hold_in" | "exhale" | "hold_out";

interface Pattern {
  id: string;
  name: string;
  subtitle: string;
  phases: { phase: Phase; duration: number }[];
  color: string;
  benefit: string;
}

const PATTERNS: Pattern[] = [
  {
    id: "box",
    name: "Box Breathing",
    subtitle: "4 · 4 · 4 · 4",
    color: "#3b82f6",
    benefit: "Calm & focus",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "hold_in", duration: 4 },
      { phase: "exhale", duration: 4 },
      { phase: "hold_out", duration: 4 },
    ],
  },
  {
    id: "478",
    name: "4-7-8 Breathing",
    subtitle: "4 · 7 · 8",
    color: "#8b5cf6",
    benefit: "Deep relaxation",
    phases: [
      { phase: "inhale", duration: 4 },
      { phase: "hold_in", duration: 7 },
      { phase: "exhale", duration: 8 },
    ],
  },
  {
    id: "55",
    name: "Equal Breathing",
    subtitle: "5 · 5",
    color: "#10b981",
    benefit: "Balance & clarity",
    phases: [
      { phase: "inhale", duration: 5 },
      { phase: "exhale", duration: 5 },
    ],
  },
  {
    id: "calm",
    name: "Quick Calm",
    subtitle: "2 · 1 · 4",
    color: "#f59e0b",
    benefit: "Instant stress relief",
    phases: [
      { phase: "inhale", duration: 2 },
      { phase: "hold_in", duration: 1 },
      { phase: "exhale", duration: 4 },
    ],
  },
];

const PHASE_LABELS: Record<Phase, string> = {
  inhale: "Inhale",
  hold_in: "Hold",
  exhale: "Exhale",
  hold_out: "Hold",
};

function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
}

export default function BreathingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedId, setSelectedId] = useState("box");
  const [isRunning, setIsRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [secsLeft, setSecsLeft] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);

  const pattern = PATTERNS.find((p) => p.id === selectedId)!;
  const currentPhase = pattern.phases[phaseIdx];

  const circleAnim = useRef(new Animated.Value(0.5)).current;
  const circleAnimValue = useRef(0.5);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIdxRef = useRef(0);
  const secsLeftRef = useRef(0);
  const cycleCountRef = useRef(0);

  const animatePhase = useCallback(
    (phase: Phase, duration: number) => {
      const toValue = phase === "inhale" ? 1 : phase === "exhale" ? 0.35 : circleAnimValue.current;
      circleAnimValue.current = toValue;
      Animated.timing(circleAnim, {
        toValue,
        duration: duration * 1000,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    },
    [circleAnim]
  );

  const startPhase = useCallback(
    (idx: number) => {
      const phase = pattern.phases[idx];
      phaseIdxRef.current = idx;
      secsLeftRef.current = phase.duration;
      setPhaseIdx(idx);
      setSecsLeft(phase.duration);
      animatePhase(phase.phase, phase.duration);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    },
    [pattern, animatePhase]
  );

  const stop = useCallback(() => {
    setIsRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    circleAnim.stopAnimation();
    Animated.timing(circleAnim, {
      toValue: 0.5,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    setPhaseIdx(0);
    setSecsLeft(0);
    setCycleCount(0);
    setTotalSecs(0);
    phaseIdxRef.current = 0;
    secsLeftRef.current = 0;
    cycleCountRef.current = 0;
  }, [circleAnim]);

  const start = useCallback(() => {
    setIsRunning(true);
    setTotalSecs(0);
    setCycleCount(0);
    cycleCountRef.current = 0;
    startPhase(0);

    timerRef.current = setInterval(() => {
      secsLeftRef.current -= 1;
      setSecsLeft(secsLeftRef.current);
      if (secsLeftRef.current <= 0) {
        const nextIdx = phaseIdxRef.current + 1;
        if (nextIdx >= pattern.phases.length) {
          cycleCountRef.current += 1;
          setCycleCount(cycleCountRef.current);
          startPhase(0);
        } else {
          startPhase(nextIdx);
        }
      }
    }, 1000);

    totalTimerRef.current = setInterval(() => {
      setTotalSecs((s) => s + 1);
    }, 1000);
  }, [pattern, startPhase]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isRunning) stop();
  }, [selectedId]);

  const circleScale = circleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 1],
  });

  const accentColor = pattern.color;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Breathing</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Pattern picker */}
        {!isRunning && (
          <View style={styles.patternGrid}>
            {PATTERNS.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setSelectedId(p.id)}
                style={[
                  styles.patternCard,
                  {
                    backgroundColor:
                      selectedId === p.id ? p.color + "22" : colors.card,
                    borderColor:
                      selectedId === p.id ? p.color : colors.border,
                    borderWidth: selectedId === p.id ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.patternName, { color: colors.foreground }]}>
                  {p.name}
                </Text>
                <Text style={[styles.patternSubtitle, { color: p.color }]}>
                  {p.subtitle}
                </Text>
                <Text style={[styles.patternBenefit, { color: colors.mutedForeground }]}>
                  {p.benefit}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Circle */}
        <View style={styles.circleContainer}>
          <View
            style={[
              styles.circleTrack,
              { borderColor: accentColor + "25" },
            ]}
          >
            <Animated.View
              style={[
                styles.circleInner,
                {
                  backgroundColor: accentColor + "22",
                  transform: [{ scale: circleScale }],
                },
              ]}
            />
            {isRunning ? (
              <>
                <Text style={[styles.phaseLabel, { color: accentColor }]}>
                  {PHASE_LABELS[currentPhase.phase]}
                </Text>
                <Text style={[styles.phaseSeconds, { color: colors.foreground }]}>
                  {secsLeft}
                </Text>
              </>
            ) : (
              <View style={styles.centerPlaceholder}>
                <Ionicons name="leaf-outline" size={36} color={accentColor} />
                <Text style={[styles.readyPatternName, { color: accentColor }]}>
                  {pattern.name}
                </Text>
                <Text style={[styles.readyBenefit, { color: colors.mutedForeground }]}>
                  {pattern.benefit}
                </Text>
                <Text style={[styles.readyHint, { color: colors.mutedForeground }]}>
                  Choose a pattern below, then press Begin
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats row */}
        {isRunning && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {cycleCount}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Cycles
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {formatSeconds(totalSecs)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Duration
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: accentColor }]}>
                {pattern.name.split(" ")[0]}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Pattern
              </Text>
            </View>
          </View>
        )}

        {/* Phase guide */}
        {isRunning && (
          <View
            style={[
              styles.phaseGuide,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {pattern.phases.map((p, i) => (
              <View
                key={i}
                style={[
                  styles.phaseGuideItem,
                  i < pattern.phases.length - 1 && {
                    borderRightWidth: 1,
                    borderRightColor: colors.border,
                  },
                  phaseIdx === i && { backgroundColor: accentColor + "18" },
                ]}
              >
                <Text
                  style={[
                    styles.phaseGuideName,
                    { color: phaseIdx === i ? accentColor : colors.mutedForeground },
                  ]}
                >
                  {PHASE_LABELS[p.phase]}
                </Text>
                <Text
                  style={[
                    styles.phaseGuideDuration,
                    { color: phaseIdx === i ? colors.foreground : colors.mutedForeground },
                  ]}
                >
                  {p.duration}s
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* CTA */}
        <Pressable
          onPress={isRunning ? stop : start}
          style={[
            styles.ctaBtn,
            { backgroundColor: isRunning ? colors.muted : accentColor },
          ]}
        >
          <Ionicons
            name={isRunning ? "stop" : "play"}
            size={20}
            color={isRunning ? colors.foreground : "#fff"}
          />
          <Text
            style={[
              styles.ctaBtnText,
              { color: isRunning ? colors.foreground : "#fff" },
            ]}
          >
            {isRunning ? "Stop" : "Begin Session"}
          </Text>
        </Pressable>

        {!isRunning && (
          <Text style={[styles.tip, { color: colors.mutedForeground }]}>
            Find a comfortable position · Breathe through your nose · Close your eyes
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  content: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },
  patternGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  patternCard: {
    width: "47%",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  patternName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  patternSubtitle: { fontSize: 13, fontFamily: "SpaceGrotesk_700Bold" },
  patternBenefit: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  circleContainer: { alignItems: "center" },
  circleTrack: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  circleInner: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  phaseLabel: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 1,
  },
  phaseSeconds: {
    fontSize: 52,
    fontFamily: "SpaceGrotesk_700Bold",
    marginTop: -4,
  },
  centerPlaceholder: { alignItems: "center", gap: 6 },
  readyPatternName: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  readyBenefit: { fontSize: 13, fontFamily: "Inter_400Regular" },
  readyHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 4, textAlign: "center" as const, opacity: 0.7 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  statItem: { alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statDivider: { width: 1, height: 36 },
  phaseGuide: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  phaseGuideItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    gap: 4,
  },
  phaseGuideName: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  phaseGuideDuration: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  ctaBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  ctaBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  tip: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
