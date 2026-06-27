import React, { useEffect, useId, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  labelColor?: string;
  sublabel?: string;
  animateOnMount?: boolean;
  delay?: number;
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 10,
  color,
  label,
  labelColor,
  sublabel,
  animateOnMount = false,
  delay = 0,
}: ProgressRingProps) {
  const colors = useColors();
  const ringColor = color ?? colors.primary;
  // When no explicit color is given (e.g. the hero calorie ring), sweep the
  // stroke from royal green into royal gold — straight from the RZ logo.
  const useGradient = !color;
  const gradientId = "ring-" + useId().replace(/:/g, "");
  const resolvedLabelColor = labelColor ?? colors.foreground;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const targetOffset = circumference * (1 - clampedProgress);

  // ── Ring stroke animation ────────────────────────────────────────────────────
  const animatedOffset = useRef(new Animated.Value(circumference)).current;

  useEffect(() => {
    if (!animateOnMount) {
      animatedOffset.setValue(targetOffset);
      return;
    }
    animatedOffset.setValue(circumference);
    const timer = setTimeout(() => {
      Animated.timing(animatedOffset, {
        toValue: targetOffset,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [animateOnMount, delay, targetOffset, circumference]);

  useEffect(() => {
    if (!animateOnMount) {
      animatedOffset.setValue(targetOffset);
    }
  }, [targetOffset, animateOnMount]);

  // ── Percentage label counter animation ───────────────────────────────────────
  // If the label looks like a percentage ("72%"), count it up in sync with the
  // ring fill so both finish at the same time. Other label formats are untouched.
  const finalPercent =
    typeof label === "string" && label.endsWith("%")
      ? parseInt(label, 10)
      : null;
  const isPercentLabel = finalPercent !== null && !Number.isNaN(finalPercent);

  const animatedPercent = useRef(new Animated.Value(0)).current;
  const [displayLabel, setDisplayLabel] = useState<string | undefined>(
    animateOnMount && isPercentLabel ? "0%" : label,
  );

  useEffect(() => {
    if (!animateOnMount || !isPercentLabel) {
      setDisplayLabel(label);
      return;
    }

    // Reset to 0% immediately so there's no stale value on re-mount
    animatedPercent.setValue(0);
    setDisplayLabel("0%");

    const listenerId = animatedPercent.addListener(({ value }) => {
      setDisplayLabel(`${Math.round(value)}%`);
    });

    const timer = setTimeout(() => {
      Animated.timing(animatedPercent, {
        toValue: finalPercent,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(() => {
        // Pin to the exact label string after animation so rounding never leaves
        // a 1-off value (e.g. 99% instead of 100%).
        setDisplayLabel(label);
        animatedPercent.removeListener(listenerId);
      });
    }, delay);

    return () => {
      clearTimeout(timer);
      animatedPercent.removeListener(listenerId);
    };
  }, [animateOnMount, delay, isPercentLabel, finalPercent, label]);

  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {useGradient && (
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.primary} />
              <Stop offset="1" stopColor={colors.secondary} />
            </LinearGradient>
          </Defs>
        )}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={colors.muted}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke={useGradient ? `url(#${gradientId})` : ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        {label && (
          <Text
            style={[
              styles.label,
              { color: resolvedLabelColor, fontSize: size * 0.18 },
            ]}
          >
            {displayLabel}
          </Text>
        )}
        {sublabel && (
          <Text
            style={[
              styles.sublabel,
              { color: colors.mutedForeground, fontSize: size * 0.1 },
            ]}
          >
            {sublabel}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  labelContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: undefined,
  },
  sublabel: {
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
