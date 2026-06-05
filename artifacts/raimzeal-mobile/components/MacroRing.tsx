import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ANIMATION_DURATION = 400;
const UPDATE_ANIMATION_DURATION = 200;
const ANIMATION_EASING = Easing.out(Easing.quad);

export const MACRO_RING_COLORS = {
  protein: "#3b82f6",
  carbs: "#f97316",
  fat: "#ec4899",
} as const;

interface MacroRingProps {
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
  strokeWidth?: number;
  /**
   * Set to true when this ring is visible on screen so the arc-fill animation
   * fires. Once it fires it will not repeat, even if the prop toggles.
   *
   * When false the ring remains in its initial invisible state (strokeDashoffset
   * = circumference). This is intentional for off-screen cards that will later
   * become visible. Callers that always want a static ring should omit this prop
   * (it defaults to true) — the animation will run once immediately on mount.
   */
  shouldAnimate?: boolean;
}

export function MacroRing({
  protein,
  carbs,
  fat,
  size = 44,
  strokeWidth = 7,
  shouldAnimate = true,
}: MacroRingProps) {
  const [showPercentages, setShowPercentages] = useState(false);

  const total = protein + carbs + fat;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const proteinFrac = total > 0 ? protein / total : 0;
  const carbsFrac = total > 0 ? carbs / total : 0;
  const fatFrac = total > 0 ? fat / total : 0;

  const proteinLen = proteinFrac * circumference;
  const carbsLen = carbsFrac * circumference;
  const fatLen = fatFrac * circumference;

  const hasData = total > 0;

  const targetProteinOffset = circumference - proteinLen;
  const targetCarbsOffset = circumference - carbsLen;
  const targetFatOffset = circumference - fatLen;

  // All segments start fully transparent (offset = circumference = nothing drawn).
  // The animation effect will drive them to their target values.
  const proteinOffset = useSharedValue(circumference);
  const carbsOffset = useSharedValue(circumference);
  const fatOffset = useSharedValue(circumference);

  // Guard so the entry animation fires at most once per mount.
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!shouldAnimate || !hasData) return;
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    // Query the accessibility preference once at the moment of animation, not
    // via a persistent subscription — avoids creating one listener per ring
    // instance when a long history list is rendered.
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) {
        // Jump to final values with no animation.
        proteinOffset.value = targetProteinOffset;
        carbsOffset.value = targetCarbsOffset;
        fatOffset.value = targetFatOffset;
      } else {
        const config = { duration: ANIMATION_DURATION, easing: ANIMATION_EASING };
        proteinOffset.value = withTiming(targetProteinOffset, config);
        carbsOffset.value = withTiming(targetCarbsOffset, config);
        fatOffset.value = withTiming(targetFatOffset, config);
      }
    });
  }, [shouldAnimate, hasData]);

  // After the entry animation has fired, keep arc lengths in sync when macro
  // props change (e.g., the user edits or deletes a logged meal). Skip the
  // very first run (mount) so we don't cancel the entry animation mid-flight.
  const isFirstSyncRun = useRef(true);
  useEffect(() => {
    if (isFirstSyncRun.current) {
      isFirstSyncRun.current = false;
      return;
    }
    if (!hasAnimatedRef.current || !hasData) return;
    const config = { duration: UPDATE_ANIMATION_DURATION, easing: ANIMATION_EASING };
    proteinOffset.value = withTiming(targetProteinOffset, config);
    carbsOffset.value = withTiming(targetCarbsOffset, config);
    fatOffset.value = withTiming(targetFatOffset, config);
  }, [targetProteinOffset, targetCarbsOffset, targetFatOffset, hasData]);

  const proteinAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: proteinOffset.value,
  }));
  const carbsAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: carbsOffset.value,
  }));
  const fatAnimProps = useAnimatedProps(() => ({
    strokeDashoffset: fatOffset.value,
  }));

  const segments = [
    {
      color: MACRO_RING_COLORS.protein,
      len: proteinLen,
      startAngle: -90,
      animProps: proteinAnimProps,
    },
    {
      color: MACRO_RING_COLORS.carbs,
      len: carbsLen,
      startAngle: -90 + proteinFrac * 360,
      animProps: carbsAnimProps,
    },
    {
      color: MACRO_RING_COLORS.fat,
      len: fatLen,
      startAngle: -90 + (proteinFrac + carbsFrac) * 360,
      animProps: fatAnimProps,
    },
  ];

  const legend = [
    { color: MACRO_RING_COLORS.protein, label: "P", grams: Math.round(protein) },
    { color: MACRO_RING_COLORS.carbs, label: "C", grams: Math.round(carbs) },
    { color: MACRO_RING_COLORS.fat, label: "F", grams: Math.round(fat) },
  ];

  const proteinCal = protein * 4;
  const carbsCal = carbs * 4;
  const fatCal = fat * 9;
  const totalCal = proteinCal + carbsCal + fatCal;
  const proteinCalFrac = totalCal > 0 ? proteinCal / totalCal : 0;
  const carbsCalFrac = totalCal > 0 ? carbsCal / totalCal : 0;
  const fatCalFrac = totalCal > 0 ? fatCal / totalCal : 0;

  const percentages = [
    { color: MACRO_RING_COLORS.protein, label: "P", pct: Math.round(proteinCalFrac * 100) },
    { color: MACRO_RING_COLORS.carbs, label: "C", pct: Math.round(carbsCalFrac * 100) },
    { color: MACRO_RING_COLORS.fat, label: "F", pct: Math.round(fatCalFrac * 100) },
  ];

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => hasData && setShowPercentages((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={
          showPercentages ? "Hide macro percentages" : "Show macro percentages"
        }
        style={styles.ringContainer}
      >
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(128,128,128,0.18)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {hasData &&
            segments.map((seg) =>
              seg.len > 0 ? (
                <AnimatedCircle
                  key={seg.color}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  animatedProps={seg.animProps}
                  rotation={seg.startAngle}
                  origin={`${center}, ${center}`}
                />
              ) : null
            )}
        </Svg>
      </Pressable>

      <View style={styles.legend}>
        {legend.map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendLabel, { color: item.color }]}>
              {item.label} {item.grams}g
            </Text>
          </View>
        ))}
      </View>

      {showPercentages && hasData && (
        <View style={styles.percentageRow}>
          {percentages.map((item, i) => (
            <Text key={item.label} style={[styles.percentageText, { color: item.color }]}>
              {item.label} {item.pct}%{i < percentages.length - 1 ? " ·" : ""}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "flex-end",
    gap: 6,
  },
  ringContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  legendDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  percentageRow: {
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  percentageText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
