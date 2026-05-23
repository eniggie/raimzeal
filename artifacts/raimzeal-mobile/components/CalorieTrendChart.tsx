import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Text, TouchableOpacity, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

interface ChartDay {
  date: string;
  value: number;
  label: string;
}

interface CalorieTrendChartProps {
  days: ChartDay[];
  goal: number;
  unit: string;
  accentColor: string;
  highlightedDate: string | null;
  onBarPress: (date: string) => void;
  onPillPress?: (date: string) => void;
  onClearHighlight?: () => void;
  onEditGoals?: () => void;
  colors: {
    primary: string;
    secondary: string;
    muted: string;
    mutedForeground: string;
    foreground: string;
    card: string;
    border: string;
    warning: string;
    success: string;
    destructive: string;
  };
}

const CHART_HEIGHT = 140;
const LABEL_HEIGHT = 20;
const TOP_PADDING = 24;
const SIDE_PADDING = 4;
const MIN_BAR_H = 3;

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatPillDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export function CalorieTrendChart({
  days,
  goal,
  unit,
  accentColor,
  highlightedDate,
  onBarPress,
  onPillPress,
  onClearHighlight,
  onEditGoals,
  colors,
}: CalorieTrendChartProps) {
  const screenWidth = Dimensions.get("window").width;
  const containerWidth = screenWidth - 32;
  const drawWidth = containerWidth - SIDE_PADDING * 2;

  const maxVal = Math.max(...days.map((d) => d.value), goal * 1.15);

  const barCount = days.length;
  const barGap = barCount > 10 ? 3 : 5;
  const barW = Math.floor((drawWidth - barGap * (barCount - 1)) / Math.max(barCount, 1));
  const barAreaH = CHART_HEIGHT - TOP_PADDING - LABEL_HEIGHT;

  const goalY = TOP_PADDING + barAreaH * (1 - goal / maxVal);

  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillFlash = useRef(new Animated.Value(1)).current;
  const pillVisible = useRef(false);

  useEffect(() => {
    if (highlightedDate) {
      pillVisible.current = true;
      Animated.timing(pillOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(pillOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        pillVisible.current = false;
      });
    }
  }, [highlightedDate]);

  const [pillLabel, setPillLabel] = useState("");

  // --- Tooltip label animation ---
  const labelOpacity = useRef(new Animated.Value(0)).current;
  const labelTranslateY = useRef(new Animated.Value(4)).current;
  const [labelInfo, setLabelInfo] = useState<{
    x: number;
    dateText: string;
    valueText: string;
    yTop: number;
  } | null>(null);
  const prevHighlightedDate = useRef<string | null>(null);

  const computeLabelInfo = useCallback(
    (date: string) => {
      const idx = days.findIndex((d) => d.date === date);
      if (idx === -1) return null;
      const day = days[idx];
      if (day.value <= 0) return null;
      const barH = Math.max(MIN_BAR_H, barAreaH * (day.value / maxVal));
      const x = SIDE_PADDING + idx * (barW + barGap);
      const y = TOP_PADDING + barAreaH - barH;
      return {
        x: x + barW / 2,
        yTop: Math.max(TOP_PADDING - 2, y - 14),
        dateText: formatPillDate(date),
        valueText: day.value.toLocaleString(),
      };
    },
    [days, barAreaH, maxVal, barW, barGap]
  );

  useEffect(() => {
    const wasHighlighted = prevHighlightedDate.current;
    prevHighlightedDate.current = highlightedDate;

    if (!highlightedDate) {
      // Deselect — fade out
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      return;
    }

    const info = computeLabelInfo(highlightedDate);

    if (!info) {
      // Zero-value bar — fade out any existing label so stale data isn't shown
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      return;
    }

    if (wasHighlighted && wasHighlighted !== highlightedDate) {
      // Switching between bars — fade out, swap, fade in
      Animated.timing(labelOpacity, {
        toValue: 0,
        duration: 75,
        useNativeDriver: true,
      }).start(() => {
        setLabelInfo(info);
        labelTranslateY.setValue(4);
        Animated.parallel([
          Animated.timing(labelOpacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(labelTranslateY, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      // First selection — fade in with slide
      setLabelInfo(info);
      labelTranslateY.setValue(4);
      Animated.parallel([
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(labelTranslateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [highlightedDate, computeLabelInfo]);

  useEffect(() => {
    if (highlightedDate) {
      const highlightedDay = days.find((d) => d.date === highlightedDate);
      if (!highlightedDay) return;
      const nextLabel = `${formatPillDate(highlightedDate)} · ${highlightedDay.value.toLocaleString()} ${unit}`;
      if (pillLabel === "") {
        setPillLabel(nextLabel);
        return;
      }
      Animated.sequence([
        Animated.timing(pillFlash, {
          toValue: 0.15,
          duration: 75,
          useNativeDriver: true,
        }),
        Animated.timing(pillFlash, {
          toValue: 1,
          duration: 75,
          useNativeDriver: true,
        }),
      ]).start();
      const timeout = setTimeout(() => setPillLabel(nextLabel), 75);
      return () => clearTimeout(timeout);
    } else {
      setPillLabel("");
    }
  }, [highlightedDate, days, unit]);

  return (
    <View>
      <View style={{ position: "relative", width: containerWidth, height: CHART_HEIGHT + LABEL_HEIGHT }}>
      <Svg width={containerWidth} height={CHART_HEIGHT + LABEL_HEIGHT}>
        {/* Goal line */}
        <Line
          x1={SIDE_PADDING}
          y1={goalY}
          x2={containerWidth - SIDE_PADDING}
          y2={goalY}
          stroke={colors.warning}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />

        {/* Goal label */}
        <SvgText
          x={containerWidth - SIDE_PADDING - 2}
          y={goalY - 4}
          fontSize={9}
          fill={colors.warning}
          textAnchor="end"
          opacity={0.85}
        >
          Goal
        </SvgText>

        {days.map((day, idx) => {
          const barH = Math.max(MIN_BAR_H, barAreaH * (day.value / maxVal));
          const x = SIDE_PADDING + idx * (barW + barGap);
          const y = TOP_PADDING + barAreaH - barH;
          const isHighlighted = day.date === highlightedDate;
          const isAboveGoal = day.value >= goal;
          const barColor = isHighlighted
            ? colors.warning
            : isAboveGoal
            ? accentColor
            : colors.mutedForeground;
          const barOpacity = isHighlighted ? 1 : day.value === 0 ? 0.2 : 0.75;

          return (
            <React.Fragment key={day.date}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={barW > 8 ? 3 : 2}
                fill={barColor}
                opacity={barOpacity}
              />
              {/* Invisible hit-target overlay */}
              <Rect
                x={x - 2}
                y={TOP_PADDING}
                width={barW + 4}
                height={barAreaH}
                fill="transparent"
                onPress={() => onBarPress(day.date)}
              />
              {/* X-axis label */}
              <SvgText
                x={x + barW / 2}
                y={CHART_HEIGHT + LABEL_HEIGHT - 2}
                fontSize={barCount > 10 ? 8 : 9}
                fill={isHighlighted ? colors.warning : colors.mutedForeground}
                textAnchor="middle"
                fontWeight={isHighlighted ? "bold" : "normal"}
              >
                {day.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Animated tooltip label overlay */}
      {labelInfo && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: labelInfo.x - 28,
            top: labelInfo.yTop - 12,
            width: 56,
            alignItems: "center",
            opacity: labelOpacity,
            transform: [{ translateY: labelTranslateY }],
          }}
        >
          <Text
            style={{
              fontSize: 8,
              fontWeight: "bold",
              color: colors.warning,
              opacity: 0.9,
              textAlign: "center",
            }}
          >
            {labelInfo.dateText}
          </Text>
          <Text
            style={{
              fontSize: 9,
              fontWeight: "bold",
              color: colors.warning,
              textAlign: "center",
            }}
          >
            {labelInfo.valueText}
          </Text>
        </Animated.View>
      )}
      </View>

      {/* Summary pill — fades in when a date is highlighted */}
      <Animated.View
        pointerEvents={highlightedDate ? "auto" : "none"}
        style={{ opacity: Animated.multiply(pillOpacity, pillFlash), alignItems: "center", marginTop: 8, marginBottom: 2 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 20,
            backgroundColor: colors.warning + "1A",
            borderWidth: 1,
            borderColor: colors.warning + "55",
            overflow: "hidden",
          }}
        >
          {/* Nav body — tapping jumps to that day's meal log */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              if (!highlightedDate) return;
              if (onPillPress) {
                onPillPress(highlightedDate);
              } else {
                onBarPress(highlightedDate);
              }
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
            }}
          >
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: colors.warning,
              }}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: colors.warning,
                letterSpacing: 0.1,
              }}
            >
              {pillLabel}
            </Text>
            <Text style={{ fontSize: 11, color: colors.warning + "CC" }}>→</Text>
          </TouchableOpacity>
          {/* Dismiss button */}
          <TouchableOpacity
            activeOpacity={0.65}
            onPress={() => {
              if (onClearHighlight) {
                onClearHighlight();
              } else if (highlightedDate) {
                onBarPress(highlightedDate);
              }
            }}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderLeftWidth: 1,
              borderLeftColor: colors.warning + "44",
            }}
          >
            <Text style={{ fontSize: 11, color: colors.warning + "BB" }}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Legend row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          marginTop: 2,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: accentColor,
              opacity: 0.8,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>On track</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: colors.mutedForeground,
              opacity: 0.6,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Under goal</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View
            style={{
              width: 20,
              height: 2,
              backgroundColor: colors.warning,
              opacity: 0.7,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.mutedForeground }}>
            Goal ({goal} {unit})
          </Text>
        </View>
        {onEditGoals && (
          <TouchableOpacity
            onPress={onEditGoals}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 3,
              marginLeft: "auto",
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.warning + "55",
              backgroundColor: colors.warning + "12",
            }}
          >
            <Text style={{ fontSize: 11, color: colors.warning }}>✎</Text>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.warning }}>
              Edit goals
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
