import React, { useState } from "react";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

const BBT_ACCENT = "#ec4899";

const CHART_H = 260;
const LEFT_PAD = 38;
const RIGHT_PAD = 10;
const TOP_PAD = 18;
const BOTTOM_PAD = 26;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export interface BBTPoint {
  date: string;
  cycleDay: number;
  bbt: number;
}

function formatDate(s: string): string {
  const parts = s.split("-");
  return `${MONTHS[parseInt(parts[1]) - 1]} ${parseInt(parts[2])}`;
}

interface BBTChartProps {
  points: BBTPoint[];
}

export function BBTChart({ points }: BBTChartProps) {
  const colors = useColors();
  const [tooltip, setTooltip] = useState<BBTPoint | null>(null);

  const screenWidth = Dimensions.get("window").width;
  const cardWidth = screenWidth - 32;
  const drawW = cardWidth - LEFT_PAD - RIGHT_PAD;
  const drawH = CHART_H - TOP_PAD - BOTTOM_PAD;

  const bbts = points.map((p) => p.bbt);
  const minBBT = Math.min(...bbts) - 0.3;
  const maxBBT = Math.max(...bbts) + 0.3;
  const bbtRange = maxBBT - minBBT;

  const minDay = points[0].cycleDay;
  const maxDay = points[points.length - 1].cycleDay;
  const dayRange = Math.max(maxDay - minDay, 1);

  function toX(cycleDay: number): number {
    return LEFT_PAD + ((cycleDay - minDay) / dayRange) * drawW;
  }

  function toY(bbt: number): number {
    return TOP_PAD + drawH * (1 - (bbt - minBBT) / bbtRange);
  }

  const polylinePoints = points
    .map((p) => `${toX(p.cycleDay).toFixed(1)},${toY(p.bbt).toFixed(1)}`)
    .join(" ");

  const yTickCount = 4;
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) {
    yTicks.push(minBBT + (bbtRange * i) / yTickCount);
  }

  const xAxisDays: number[] = (() => {
    const totalDays = dayRange + 1;
    const maxLabels = 8;
    const step = totalDays <= maxLabels ? 1 : Math.ceil(totalDays / maxLabels);
    const ticks: number[] = [];
    for (let d = minDay; d <= maxDay; d += step) ticks.push(d);
    if (ticks[ticks.length - 1] !== maxDay) ticks.push(maxDay);
    return ticks;
  })();

  return (
    <View>
      <Svg width={cardWidth} height={CHART_H}>
        {/* Y-axis gridlines + labels */}
        {yTicks.map((val, i) => {
          const y = toY(val);
          return (
            <React.Fragment key={i}>
              <Line
                x1={LEFT_PAD}
                y1={y}
                x2={cardWidth - RIGHT_PAD}
                y2={y}
                stroke={colors.border}
                strokeWidth={0.7}
                opacity={0.55}
              />
              <SvgText
                x={LEFT_PAD - 4}
                y={y + 3.5}
                fontSize={8.5}
                fill={colors.mutedForeground}
                textAnchor="end"
              >
                {val.toFixed(1)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X-axis day labels */}
        {xAxisDays.map((day) => (
          <SvgText
            key={day}
            x={toX(day)}
            y={CHART_H - 5}
            fontSize={8.5}
            fill={colors.mutedForeground}
            textAnchor="middle"
          >
            {`D${day}`}
          </SvgText>
        ))}

        {/* Connecting polyline */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={BBT_ACCENT}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Data points + hit targets */}
        {points.map((p) => {
          const cx = toX(p.cycleDay);
          const cy = toY(p.bbt);
          const isSelected = tooltip?.date === p.date;
          return (
            <React.Fragment key={p.date}>
              <Circle
                cx={cx}
                cy={cy}
                r={isSelected ? 6 : 3.5}
                fill={isSelected ? BBT_ACCENT : colors.card}
                stroke={BBT_ACCENT}
                strokeWidth={isSelected ? 0 : 1.5}
              />
              <Circle
                cx={cx}
                cy={cy}
                r={14}
                fill="transparent"
                onPress={() => setTooltip(isSelected ? null : p)}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {/* Tooltip pill */}
      {tooltip ? (
        <View style={{ alignItems: "center", marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => setTooltip(null)}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: BBT_ACCENT + "1A",
              borderWidth: 1,
              borderColor: BBT_ACCENT + "55",
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: BBT_ACCENT }} />
            <Text style={{ fontSize: 12, fontWeight: "600", color: BBT_ACCENT }}>
              {formatDate(tooltip.date)} (Day {tooltip.cycleDay}) · {tooltip.bbt.toFixed(2)} °C
            </Text>
            <Text style={{ fontSize: 11, color: BBT_ACCENT + "BB" }}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ height: 30 }} />
      )}

      {/* Legend */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 20, height: 2, backgroundColor: BBT_ACCENT, borderRadius: 1, opacity: 0.8 }} />
        <Text style={{ fontSize: 11, color: colors.mutedForeground }}>Basal Body Temperature (°C)</Text>
      </View>
    </View>
  );
}
