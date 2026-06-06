import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, ScrollView, Text, TouchableOpacity, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedSvgText = Animated.createAnimatedComponent(SvgText);

interface ChartDay {
  date: string;
  value: number;
  label: string;
}

interface MealBreakdownEntry {
  mealType: string;
  value: number;
}

const MEAL_DOT_COLORS: Record<string, string> = {
  breakfast: "#f59f0a",
  lunch: "#C9A84C",
  dinner: "#8B31C7",
  snack: "#21c45d",
};

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
  mealBreakdown?: MealBreakdownEntry[];
  mealFilter?: string;
  onClearMealFilter?: () => void;
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
const SCROLL_THRESHOLD = 14; // bars before the chart becomes horizontally scrollable
const BAR_W_SCROLLABLE = 18; // fixed bar width (px) in scrollable mode

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
  mealBreakdown,
  mealFilter,
  onClearMealFilter,
  colors,
}: CalorieTrendChartProps) {
  const screenWidth = Dimensions.get("window").width;
  const containerWidth = screenWidth - 32;
  const drawWidth = containerWidth - SIDE_PADDING * 2;

  const maxVal = Math.max(...days.map((d) => d.value), goal * 1.15);

  const barCount = days.length;
  const barGap = barCount > 10 ? 3 : 5;
  const isScrollable = barCount > SCROLL_THRESHOLD;
  const barW = isScrollable
    ? BAR_W_SCROLLABLE
    : Math.floor((drawWidth - barGap * Math.max(barCount - 1, 0)) / Math.max(barCount, 1));
  // Expanded SVG width when scrollable; otherwise equals containerWidth
  const svgWidth = isScrollable
    ? SIDE_PADDING * 2 + barCount * BAR_W_SCROLLABLE + Math.max(barCount - 1, 0) * barGap
    : containerWidth;
  const barAreaH = CHART_HEIGHT - TOP_PADDING - LABEL_HEIGHT;

  const goalY = TOP_PADDING + barAreaH * (1 - goal / maxVal);

  const pillOpacity = useRef(new Animated.Value(0)).current;
  const pillFlash = useRef(new Animated.Value(1)).current;
  const pillVisible = useRef(false);

  const badgeOpacity = useRef(new Animated.Value(mealFilter && mealFilter !== "all" ? 1 : 0)).current;
  const badgeTranslateY = useRef(new Animated.Value(0)).current;
  const lastMealFilterRef = useRef(mealFilter && mealFilter !== "all" ? mealFilter : "");
  const [badgeVisible, setBadgeVisible] = useState(!!(mealFilter && mealFilter !== "all"));

  // --- Scroll hint animation ---
  const scrollHintOpacity = useRef(new Animated.Value(0)).current;
  const scrollHintShownRef = useRef(false);

  // --- Bar colour animation ---
  const barAnimValues = useRef<Map<string, Animated.Value>>(new Map());
  const prevBarHighlight = useRef<string | null>(null);

  // --- Ghost bar: retains the last highlighted bar's pixel geometry so it can
  //     fade out as an AnimatedRect overlay even after the date has left days. ---
  const ghostBarGeometry = useRef<{ x: number; y: number; h: number; w: number; rx: number } | null>(null);
  const ghostBarOpacity = useRef(new Animated.Value(0)).current;
  const ghostAnimStarted = useRef(false);
  const [ghostBarActive, setGhostBarActive] = useState(false);

  // Always-current snapshot of days (safe ref mutation avoids stale-closure issues).
  const currentDaysRef = useRef(days);
  currentDaysRef.current = days;

  // --- Bar grow-in animation (height scale 0→1) ---
  const barGrowValues = useRef<Map<string, Animated.Value>>(new Map());

  // Initialise animated values for any day not yet tracked
  days.forEach((day) => {
    if (!barAnimValues.current.has(day.date)) {
      const initialVal = day.date === highlightedDate ? 1 : 0;
      barAnimValues.current.set(day.date, new Animated.Value(initialVal));
    }
    if (!barGrowValues.current.has(day.date)) {
      barGrowValues.current.set(day.date, new Animated.Value(0));
    }
  });

  // Trigger grow-in whenever dates or their values change
  const daysKey = days.map((d) => `${d.date}:${d.value}`).join(",");
  useEffect(() => {
    // Prune stale keys
    const currentDates = new Set(days.map((d) => d.date));
    for (const key of barGrowValues.current.keys()) {
      if (!currentDates.has(key)) barGrowValues.current.delete(key);
    }

    // Reset each bar to 0 then stagger to 1
    days.forEach((day) => {
      const v = barGrowValues.current.get(day.date);
      if (v) {
        v.setValue(0);
      } else {
        barGrowValues.current.set(day.date, new Animated.Value(0));
      }
    });

    const runningAnimation = Animated.parallel(
      days.map((day, idx) =>
        Animated.sequence([
          Animated.delay(idx * 20),
          Animated.timing(barGrowValues.current.get(day.date)!, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }),
        ])
      )
    );
    runningAnimation.start();
    return () => runningAnimation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  useEffect(() => {
    const prev = prevBarHighlight.current;
    const next = highlightedDate;
    prevBarHighlight.current = next;

    if (next) {
      // A new bar was selected — reset ghost tracking so the next auto-clear
      // can show a fresh ghost fade-out.
      ghostAnimStarted.current = false;
    }

    const animations: Animated.CompositeAnimation[] = [];

    if (prev && prev !== next && barAnimValues.current.has(prev)) {
      animations.push(
        Animated.timing(barAnimValues.current.get(prev)!, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        })
      );
    }

    // When clearing (prev → null): if the bar is no longer in days AND the
    // ghost wasn't already started by the daysDateKey effect, kick off the ghost
    // fade now (handles edge-cases where date disappears and highlight clears in
    // the same batch without the daysDateKey effect running first).
    if (prev && !next && !ghostAnimStarted.current && ghostBarGeometry.current) {
      const prevInDays = currentDaysRef.current.some((d) => d.date === prev);
      if (!prevInDays) {
        ghostAnimStarted.current = true;
        ghostBarOpacity.setValue(1);
        setGhostBarActive(true);
        Animated.timing(ghostBarOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) setGhostBarActive(false);
        });
      }
    }

    if (next && barAnimValues.current.has(next)) {
      animations.push(
        Animated.timing(barAnimValues.current.get(next)!, {
          toValue: 1,
          duration: 150,
          useNativeDriver: false,
        })
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }
  }, [highlightedDate]);

  // Cache the highlighted bar's pixel geometry while it is visible, and
  // immediately start the ghost fade-out the moment the date falls out of days.
  // This fires during the parent's 200 ms grace-period so the animation
  // completes before highlightedDate is nulled.
  const daysDateKey = days.map((d) => d.date).join(",");
  useEffect(() => {
    if (!highlightedDate) return;

    const idx = days.findIndex((d) => d.date === highlightedDate);
    if (idx !== -1) {
      // Bar is visible — update the cached geometry and reset the ghost flag.
      const day = days[idx];
      const barH = Math.max(MIN_BAR_H, barAreaH * (day.value / maxVal));
      const x = SIDE_PADDING + idx * (barW + barGap);
      const y = TOP_PADDING + barAreaH - barH;
      ghostBarGeometry.current = { x, y, h: barH, w: barW, rx: barW > 8 ? 3 : 2 };
      ghostAnimStarted.current = false;
    } else if (!ghostAnimStarted.current && ghostBarGeometry.current) {
      // Bar just left the visible range — start ghost fade immediately.
      ghostAnimStarted.current = true;
      ghostBarOpacity.setValue(1);
      setGhostBarActive(true);
      Animated.timing(ghostBarOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setGhostBarActive(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysDateKey, highlightedDate]);

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

  useEffect(() => {
    if (mealFilter && mealFilter !== "all") {
      lastMealFilterRef.current = mealFilter;
      badgeOpacity.setValue(0);
      badgeTranslateY.setValue(4);
      setBadgeVisible(true);
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(badgeTranslateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(badgeOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(badgeTranslateY, { toValue: 4, duration: 180, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setBadgeVisible(false);
      });
    }
  }, [mealFilter]);

  useEffect(() => {
    if (!isScrollable) {
      scrollHintShownRef.current = false;
      return;
    }
    if (scrollHintShownRef.current) return;
    scrollHintShownRef.current = true;
    scrollHintOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(scrollHintOpacity, { toValue: 0.85, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(scrollHintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [isScrollable]);

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
      const barH = day.value > 0 ? Math.max(MIN_BAR_H, barAreaH * (day.value / maxVal)) : MIN_BAR_H;
      const x = SIDE_PADDING + idx * (barW + barGap);
      const y = TOP_PADDING + barAreaH - barH;
      return {
        x: x + barW / 2,
        yTop: Math.max(TOP_PADDING - 2, y - 14),
        dateText: formatPillDate(date),
        valueText: day.value > 0 ? day.value.toLocaleString() : "No data",
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
      // Date not found in chart data — fade out any stale label
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
      const nextLabel =
        highlightedDay.value === 0
          ? `${formatPillDate(highlightedDate)} · No data`
          : `${formatPillDate(highlightedDate)} · ${highlightedDay.value.toLocaleString()} ${unit}`;
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
      {/* Chart area: scrollable when barCount > SCROLL_THRESHOLD */}
      <View style={{ position: "relative" }}>
        <ScrollView
          horizontal
          scrollEnabled={isScrollable}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={() => {
            Animated.timing(scrollHintOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
          }}
        >
          <View style={{ position: "relative", width: svgWidth, height: CHART_HEIGHT + LABEL_HEIGHT }}>
      <Svg width={svgWidth} height={CHART_HEIGHT + LABEL_HEIGHT}>
        {/* Goal line */}
        <Line
          x1={SIDE_PADDING}
          y1={goalY}
          x2={svgWidth - SIDE_PADDING}
          y2={goalY}
          stroke={colors.warning}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.7}
        />

        {/* Goal label */}
        <SvgText
          x={svgWidth - SIDE_PADDING - 2}
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
          const restingColor = isAboveGoal ? accentColor : colors.mutedForeground;
          const restingOpacity = day.value === 0 ? 0.2 : 0.75;

          const animValue =
            barAnimValues.current.get(day.date) ??
            new Animated.Value(isHighlighted ? 1 : 0);
          const animatedFill = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [restingColor, colors.warning],
          });
          const animatedOpacity = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [restingOpacity, 1],
          });
          const animatedLabelColor = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [colors.mutedForeground, colors.warning],
          });

          const growValue =
            barGrowValues.current.get(day.date) ?? new Animated.Value(1);
          const animatedBarH = growValue.interpolate({
            inputRange: [0, 1],
            outputRange: [0, barH],
          });
          const animatedBarY = growValue.interpolate({
            inputRange: [0, 1],
            outputRange: [TOP_PADDING + barAreaH, y],
          });

          return (
            <React.Fragment key={day.date}>
              <AnimatedRect
                x={x}
                y={animatedBarY}
                width={barW}
                height={animatedBarH}
                rx={barW > 8 ? 3 : 2}
                fill={animatedFill}
                opacity={animatedOpacity}
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
              <AnimatedSvgText
                x={x + barW / 2}
                y={CHART_HEIGHT + LABEL_HEIGHT - 2}
                fontSize={barCount > 10 ? 8 : 9}
                fill={animatedLabelColor}
                textAnchor="middle"
                fontWeight={isHighlighted ? "bold" : "normal"}
              >
                {day.label}
              </AnimatedSvgText>
            </React.Fragment>
          );
        })}

        {/* Ghost bar — rendered at the last highlighted bar's position and faded
            out while the parent holds highlightedDate for 200 ms after the date
            leaves the visible range. Renders on top of normal bars so the fade
            is always visible regardless of z-order. */}
        {ghostBarActive && ghostBarGeometry.current && (
          <AnimatedRect
            x={ghostBarGeometry.current.x}
            y={ghostBarGeometry.current.y}
            width={ghostBarGeometry.current.w}
            height={ghostBarGeometry.current.h}
            rx={ghostBarGeometry.current.rx}
            fill={colors.warning}
            opacity={ghostBarOpacity}
          />
        )}
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
              fontWeight: labelInfo.valueText === "No data" ? "normal" : "bold",
              color:
                labelInfo.valueText === "No data"
                  ? colors.mutedForeground
                  : colors.warning,
              textAlign: "center",
              fontStyle:
                labelInfo.valueText === "No data" ? "italic" : "normal",
            }}
          >
            {labelInfo.valueText}
          </Text>
        </Animated.View>
      )}
          </View>
        </ScrollView>

        {/* "scroll →" hint: fades in on first render, auto-dismisses after ~2 s or on scroll */}
        {isScrollable && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 6,
              top: 4,
              opacity: scrollHintOpacity,
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 10, color: colors.mutedForeground }}>scroll →</Text>
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

      {/* Meal breakdown row — animates in/out with the pill */}
      <Animated.View
        pointerEvents="none"
        style={{
          opacity: pillOpacity,
          alignItems: "center",
          marginTop: 2,
          marginBottom: 2,
          minHeight: mealBreakdown && mealBreakdown.length > 0 ? undefined : 0,
        }}
      >
        {mealBreakdown && mealBreakdown.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: 0,
            }}
          >
            {mealBreakdown.map(({ mealType, value }, idx) => (
              <View
                key={mealType}
                style={{ flexDirection: "row", alignItems: "center" }}
              >
                {idx > 0 && (
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.mutedForeground,
                      marginHorizontal: 5,
                      opacity: 0.5,
                    }}
                  >
                    ·
                  </Text>
                )}
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: MEAL_DOT_COLORS[mealType] ?? colors.mutedForeground,
                    marginRight: 4,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.mutedForeground,
                  }}
                >
                  {mealType.charAt(0).toUpperCase() + mealType.slice(1)}{" "}
                  <Text
                    style={{
                      fontWeight: "600",
                      color: colors.foreground,
                    }}
                  >
                    {value.toLocaleString()}{unit}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      {/* Meal filter badge — mounts/unmounts around the 180ms fade+slide transition */}
      {badgeVisible && (() => {
        const displayFilter =
          mealFilter && mealFilter !== "all" ? mealFilter : lastMealFilterRef.current;
        const dotColor = MEAL_DOT_COLORS[displayFilter] ?? colors.primary;
        return (
          <Animated.View
            style={{
              opacity: badgeOpacity,
              transform: [{ translateY: badgeTranslateY }],
            }}
            pointerEvents={mealFilter && mealFilter !== "all" ? "auto" : "none"}
          >
            <TouchableOpacity
              onPress={onClearMealFilter}
              activeOpacity={onClearMealFilter ? 0.65 : 1}
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: 5,
                marginTop: 4,
                marginBottom: 2,
                paddingHorizontal: 9,
                paddingVertical: 3,
                borderRadius: 12,
                backgroundColor: dotColor + "1F",
                borderWidth: 1,
                borderColor: dotColor + "55",
              }}
            >
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: dotColor,
                }}
              />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: dotColor,
                  letterSpacing: 0.1,
                }}
              >
                {displayFilter.charAt(0).toUpperCase() + displayFilter.slice(1)} only
              </Text>
              {!!onClearMealFilter && (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "700",
                    color: dotColor,
                    opacity: 0.75,
                    lineHeight: 14,
                    marginLeft: 1,
                  }}
                >
                  ×
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        );
      })()}

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
