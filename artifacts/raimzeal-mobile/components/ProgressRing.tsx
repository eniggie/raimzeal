import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
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
  const resolvedLabelColor = labelColor ?? colors.foreground;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const clampedProgress = Math.min(1, Math.max(0, progress));
  const targetOffset = circumference * (1 - clampedProgress);

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

  const center = size / 2;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
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
          stroke={ringColor}
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
            {label}
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
    fontFamily: "Inter_700Bold",
    lineHeight: undefined,
  },
  sublabel: {
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
