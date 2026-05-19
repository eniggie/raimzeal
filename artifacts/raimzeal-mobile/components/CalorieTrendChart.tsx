import React from "react";
import { Dimensions, Text, View } from "react-native";
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

export function CalorieTrendChart({
  days,
  goal,
  unit,
  accentColor,
  highlightedDate,
  onBarPress,
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

  return (
    <View>
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
              {/* Value label on top of bar when highlighted */}
              {isHighlighted && day.value > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize={9}
                  fill={colors.warning}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {day.value}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>

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
      </View>
    </View>
  );
}
