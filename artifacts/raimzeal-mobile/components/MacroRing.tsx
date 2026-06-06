import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ANIMATION_DURATION = 400;
const UPDATE_ANIMATION_DURATION = 200;
const ANIMATION_EASING = Easing.out(Easing.quad);

const LEGEND_TIP_KEY = "raimzeal_legend_tip_seen";
const TOOLTIP_DELAY = 600;
const TOOLTIP_HOLD = 2500;
const TOOLTIP_FADE = 220;

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
  /** Called when the user taps a legend item (P, C, or F). */
  onLegendPress?: (macro: "protein" | "carbs" | "fat") => void;
}

export function MacroRing({
  protein,
  carbs,
  fat,
  size = 44,
  strokeWidth = 7,
  shouldAnimate = true,
  onLegendPress,
}: MacroRingProps) {
  const [showPercentages, setShowPercentages] = useState(false);
  // Keep segments mounted during the animate-to-zero transition so withTiming
  // can play out before the circles are removed from the tree.
  const [showSegments, setShowSegments] = useState(() => protein + carbs + fat > 0);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Percentage-row animation — the row stays mounted during the exit animation
  // so the fade+slide-out plays before the element leaves the tree.
  const [showPctRow, setShowPctRow] = useState(false);
  const pctUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PCT_ANIM_DURATION = 150;
  const pctOpacity = useSharedValue(0);
  const pctTranslateY = useSharedValue(-6);
  const pctAnimStyle = useAnimatedStyle(() => ({
    opacity: pctOpacity.value,
    transform: [{ translateY: pctTranslateY.value }],
  }));

  // One-shot tooltip — shown once per install the first time the legend is
  // interactive (onLegendPress provided). Persisted in AsyncStorage.
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipOpacity = useSharedValue(0);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipAnimStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
  }));

  const dismissTooltip = () => {
    tooltipOpacity.value = withTiming(0, { duration: TOOLTIP_FADE, easing: ANIMATION_EASING });
    tooltipTimerRef.current = setTimeout(() => setShowTooltip(false), TOOLTIP_FADE);
    AsyncStorage.setItem(LEGEND_TIP_KEY, "1").catch(() => {});
  };

  useEffect(() => {
    if (!onLegendPress) return;
    let cancelled = false;

    AsyncStorage.getItem(LEGEND_TIP_KEY)
      .then((val) => {
        if (cancelled || val === "1") return;
        tooltipTimerRef.current = setTimeout(() => {
          if (cancelled) return;
          setShowTooltip(true);
          tooltipOpacity.value = withTiming(1, { duration: TOOLTIP_FADE, easing: ANIMATION_EASING });
          tooltipTimerRef.current = setTimeout(() => {
            if (!cancelled) dismissTooltip();
          }, TOOLTIP_HOLD);
        }, TOOLTIP_DELAY);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (tooltipTimerRef.current) {
        clearTimeout(tooltipTimerRef.current);
        tooltipTimerRef.current = null;
      }
    };
  }, [onLegendPress]);

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

  // Ref that always reflects the current shouldAnimate prop without adding it
  // to the sync effect's dependency array (avoids retriggering sync logic when
  // shouldAnimate changes — the entry effect owns that transition).
  const shouldAnimateRef = useRef(shouldAnimate);
  useEffect(() => {
    shouldAnimateRef.current = shouldAnimate;
  });

  // Entry animation — fires when animation is first enabled (shouldAnimate
  // flipping false→true for scroll-triggered history cards, or on mount for
  // the home ring). hasData is intentionally NOT a dependency here: when the
  // home ring starts at zero and data later arrives, the sync effect below
  // fires its own entry-style sweep so these two effects don't race.
  useEffect(() => {
    if (!shouldAnimate || !hasData) return;
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    // Show segments so the SVG elements exist before withTiming starts.
    setShowSegments(true);

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
  }, [shouldAnimate]); // ← hasData intentionally omitted; see comment above

  // After the entry animation has fired, keep arc lengths in sync when macro
  // props change (e.g., the user edits or deletes a logged meal). Also handles
  // the 0 → non-zero transition when the ring was mounted empty (shouldAnimate
  // was already true but hasData was false at mount time).
  const isFirstSyncRun = useRef(true);
  useEffect(() => {
    if (isFirstSyncRun.current) {
      isFirstSyncRun.current = false;
      return;
    }

    // Ring was mounted at zero and the first meal just arrived — play a full
    // entry-style sweep (ANIMATION_DURATION) so the arcs draw in gracefully
    // rather than snapping or staying invisible.
    if (!hasAnimatedRef.current) {
      if (!hasData || !shouldAnimateRef.current) return;
      hasAnimatedRef.current = true;
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
      setShowSegments(true);
      AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
        if (reduceMotion) {
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
      return;
    }

    // Normal sync path: entry animation already fired, update to new values.

    // If macros are coming back from zero, show segments immediately before
    // the animation so the arcs are in the tree when withTiming starts.
    if (hasData) {
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
      setShowSegments(true);
    }

    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;

      if (reduceMotion) {
        proteinOffset.value = targetProteinOffset;
        carbsOffset.value = targetCarbsOffset;
        fatOffset.value = targetFatOffset;

        // No animation — hide segments immediately when transitioning to zero.
        if (!hasData) {
          setShowSegments(false);
        }
      } else {
        const config = { duration: UPDATE_ANIMATION_DURATION, easing: ANIMATION_EASING };
        proteinOffset.value = withTiming(targetProteinOffset, config);
        carbsOffset.value = withTiming(targetCarbsOffset, config);
        fatOffset.value = withTiming(targetFatOffset, config);

        // When transitioning to zero, keep segments mounted for the full animation
        // duration so the arcs visibly sweep to empty before being removed.
        if (!hasData) {
          unmountTimerRef.current = setTimeout(
            () => setShowSegments(false),
            UPDATE_ANIMATION_DURATION,
          );
        }
      }
    });

    return () => {
      cancelled = true;
      if (unmountTimerRef.current) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
    };
  }, [targetProteinOffset, targetCarbsOffset, targetFatOffset, hasData]);

  // Drive the percentage-row fade+slide animation whenever visibility changes.
  useEffect(() => {
    if (pctUnmountTimerRef.current) {
      clearTimeout(pctUnmountTimerRef.current);
      pctUnmountTimerRef.current = null;
    }

    const visible = showPercentages && hasData;
    const config = { duration: PCT_ANIM_DURATION, easing: ANIMATION_EASING };

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (visible) {
        // Mount first, then animate in.
        setShowPctRow(true);
        if (reduceMotion) {
          pctOpacity.value = 1;
          pctTranslateY.value = 0;
        } else {
          pctOpacity.value = 0;
          pctTranslateY.value = -6;
          pctOpacity.value = withTiming(1, config);
          pctTranslateY.value = withTiming(0, config);
        }
      } else {
        // Animate out, then unmount after the animation completes.
        if (reduceMotion) {
          pctOpacity.value = 0;
          pctTranslateY.value = -6;
          setShowPctRow(false);
        } else {
          pctOpacity.value = withTiming(0, config);
          pctTranslateY.value = withTiming(-6, config);
          pctUnmountTimerRef.current = setTimeout(
            () => setShowPctRow(false),
            PCT_ANIM_DURATION,
          );
        }
      }
    });

    return () => {
      if (pctUnmountTimerRef.current) {
        clearTimeout(pctUnmountTimerRef.current);
        pctUnmountTimerRef.current = null;
      }
    };
  }, [showPercentages, hasData]);

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
      macro: "protein" as const,
    },
    {
      color: MACRO_RING_COLORS.carbs,
      len: carbsLen,
      startAngle: -90 + proteinFrac * 360,
      animProps: carbsAnimProps,
      macro: "carbs" as const,
    },
    {
      color: MACRO_RING_COLORS.fat,
      len: fatLen,
      startAngle: -90 + (proteinFrac + carbsFrac) * 360,
      animProps: fatAnimProps,
      macro: "fat" as const,
    },
  ];

  const legend = [
    { color: MACRO_RING_COLORS.protein, label: "P", grams: Math.round(protein), macro: "protein" as const },
    { color: MACRO_RING_COLORS.carbs, label: "C", grams: Math.round(carbs), macro: "carbs" as const },
    { color: MACRO_RING_COLORS.fat, label: "F", grams: Math.round(fat), macro: "fat" as const },
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
          {showSegments &&
            segments.map((seg) => (
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
                onPress={
                  onLegendPress
                    ? (e) => {
                        e.stopPropagation();
                        onLegendPress(seg.macro);
                      }
                    : undefined
                }
                accessible={!!onLegendPress}
                accessibilityLabel={
                  onLegendPress ? `Edit ${seg.macro} goal` : undefined
                }
              />
            ))}
        </Svg>
      </Pressable>

      <View style={styles.legend}>
        {legend.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [
              styles.legendItem,
              onLegendPress && pressed && styles.legendItemPressed,
            ]}
            onPress={
              onLegendPress
                ? (e) => {
                    e.stopPropagation();
                    onLegendPress(item.macro);
                  }
                : undefined
            }
            accessibilityRole={onLegendPress ? "button" : "text"}
            accessibilityLabel={
              onLegendPress
                ? `Edit ${item.macro} goal`
                : `${item.macro}: ${hasData ? `${item.grams}g` : "no data"}`
            }
            hitSlop={onLegendPress ? { top: 8, bottom: 8, left: 4, right: 4 } : undefined}
          >
            <View
              style={[
                styles.legendDot,
                { backgroundColor: hasData ? item.color : "rgba(128,128,128,0.35)" },
              ]}
            />
            <Text
              style={[
                styles.legendLabel,
                { color: hasData ? item.color : "rgba(128,128,128,0.45)" },
                onLegendPress && hasData && styles.legendLabelTappable,
              ]}
            >
              {item.label} {hasData ? `${item.grams}g` : "—"}
            </Text>
          </Pressable>
        ))}
      </View>

      {showPctRow && (
        <Animated.View style={[styles.percentageRow, pctAnimStyle]}>
          {percentages.map((item, i) => (
            <Text key={item.label} style={[styles.percentageText, { color: item.color }]}>
              {item.label} {item.pct}%{i < percentages.length - 1 ? " ·" : ""}
            </Text>
          ))}
        </Animated.View>
      )}

      {!hasData && (
        <Text style={styles.emptyLabel}>No meals logged</Text>
      )}

      {showTooltip && onLegendPress && (
        <Pressable
          onPress={dismissTooltip}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tip"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Animated.View style={[styles.tooltip, tooltipAnimStyle]}>
            <Text style={styles.tooltipText}>Tap P · C · F to set goals</Text>
          </Animated.View>
        </Pressable>
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
  legendItemPressed: {
    opacity: 0.6,
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
  legendLabelTappable: {
    textDecorationLine: "underline",
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
  emptyLabel: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: "rgba(128,128,128,0.5)",
    textAlign: "center",
  },
  tooltip: {
    backgroundColor: "rgba(30,30,40,0.82)",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: "flex-end",
  },
  tooltipText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#fff",
    letterSpacing: 0.2,
  },
});
