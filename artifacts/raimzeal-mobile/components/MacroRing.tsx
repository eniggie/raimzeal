import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

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
}

export function MacroRing({
  protein,
  carbs,
  fat,
  size = 44,
  strokeWidth = 7,
}: MacroRingProps) {
  const [expanded, setExpanded] = useState(false);

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

  const segments = [
    {
      color: MACRO_RING_COLORS.protein,
      len: proteinLen,
      startAngle: -90,
    },
    {
      color: MACRO_RING_COLORS.carbs,
      len: carbsLen,
      startAngle: -90 + proteinFrac * 360,
    },
    {
      color: MACRO_RING_COLORS.fat,
      len: fatLen,
      startAngle: -90 + (proteinFrac + carbsFrac) * 360,
    },
  ];

  const legend = [
    { color: MACRO_RING_COLORS.protein, label: "P" },
    { color: MACRO_RING_COLORS.carbs, label: "C" },
    { color: MACRO_RING_COLORS.fat, label: "F" },
  ];

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.ringPressable}
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
                <Circle
                  key={seg.color}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference - seg.len}
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
            <Text style={[styles.legendLabel, { color: item.color }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      {expanded && hasData && (
        <View style={styles.tooltip}>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: MACRO_RING_COLORS.protein }]} />
            <Text style={[styles.tooltipText, { color: MACRO_RING_COLORS.protein }]}>
              {Math.round(protein)}g
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: MACRO_RING_COLORS.carbs }]} />
            <Text style={[styles.tooltipText, { color: MACRO_RING_COLORS.carbs }]}>
              {Math.round(carbs)}g
            </Text>
          </View>
          <View style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: MACRO_RING_COLORS.fat }]} />
            <Text style={[styles.tooltipText, { color: MACRO_RING_COLORS.fat }]}>
              {Math.round(fat)}g
            </Text>
          </View>
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
  ringPressable: {
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
  tooltip: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tooltipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  tooltipText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
