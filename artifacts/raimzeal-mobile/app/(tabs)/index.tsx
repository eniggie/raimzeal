import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  GestureResponderEvent,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { usePedometer } from "@/hooks/usePedometer";
import { useFitness } from "@/contexts/FitnessContext";
import { useMacroGoals } from "@/contexts/MacroGoalsContext";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { ProgressRing } from "@/components/ProgressRing";
import { MacroRing } from "@/components/MacroRing";
import { WorkoutCard } from "@/components/WorkoutCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { QuickGoalSheet, QuickGoalMacro } from "@/components/QuickGoalSheet";

const WATER_GOAL_GLASSES = 10;
const STEPS_GOAL = 10000;

const STRIPE_DONATION_URL = "https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00";

const SLEEP_STORAGE_PREFIX = "@raimzeal_sleep_v1_";
const WELLNESS_STORAGE_PREFIX = "@raimzeal_wellness_v1_";

interface WellnessEntry {
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  stress: 1 | 2 | 3 | 4 | 5;
  recovery: 1 | 2 | 3 | 4 | 5;
}

function calcWellnessReadiness(e: WellnessEntry): number {
  return Math.round(((e.mood + e.energy + (6 - e.stress) + e.recovery) / 4) * 20);
}

function useTodayWellness(): { score: number | null; label: string | null; color: string | null } {
  const [score, setScore] = useState<number | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const todayKey = new Date().toISOString().split("T")[0];
        const raw = await AsyncStorage.getItem(WELLNESS_STORAGE_PREFIX + todayKey);
        if (!raw || cancelled) return;
        const entry = JSON.parse(raw) as WellnessEntry;
        const s = calcWellnessReadiness(entry);
        if (!cancelled) {
          setScore(s);
          if (s >= 80) { setLabel("Push"); setColor("#10b981"); }
          else if (s >= 60) { setLabel("Maintain"); setColor("#3b82f6"); }
          else if (s >= 40) { setLabel("Recover"); setColor("#f59e0b"); }
          else { setLabel("Rest"); setColor("#ef4444"); }
        }
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { score, label, color };
}

function useTodaySleep(): { hours: number | null; quality: number | null } {
  const [hours, setHours] = useState<number | null>(null);
  const [quality, setQuality] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const todayKey = new Date().toISOString().split("T")[0];
        const raw = await AsyncStorage.getItem(SLEEP_STORAGE_PREFIX + todayKey);
        if (!raw || cancelled) return;
        const entry = JSON.parse(raw) as {
          bedHour: number; bedMin: number;
          wakeHour: number; wakeMin: number;
          quality: number;
        };
        const bedMins = entry.bedHour * 60 + entry.bedMin;
        const wakeMins = entry.wakeHour * 60 + entry.wakeMin;
        let diff = wakeMins - bedMins;
        if (diff < 0) diff += 24 * 60;
        if (!cancelled) {
          setHours(parseFloat((diff / 60).toFixed(1)));
          setQuality(entry.quality);
        }
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { hours, quality };
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { steps: pedometerSteps, available: pedometerAvailable } = usePedometer();
  const { hours: sleepHours, quality: sleepQuality } = useTodaySleep();
  const { score: readinessScore, label: readinessLabel, color: readinessColor } = useTodayWellness();
  const {
    user,
    streak,
    workoutLogs,
    waterIntake,
    bodyMeasurements,
    getTodayMacros,
    getTodayWaterGlasses,
    updateWaterIntake,
    settings,
    getWeekCalories,
  } = useFitness();

  const waterStreak = React.useMemo(() => {
    const map = new Map(waterIntake.map((w) => [w.date, w.glasses]));
    let s = 0;
    const now = new Date();
    for (let i = 0; i <= 365; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const g = map.get(key) ?? 0;
      if (g < WATER_GOAL_GLASSES) break;
      s++;
    }
    return s;
  }, [waterIntake]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const recentWorkouts = workoutLogs.slice(0, 3);
  const { calories: totalCaloriesToday, protein: proteinToday, carbs: carbsToday, fat: fatToday } = getTodayMacros();
  const waterGlasses = getTodayWaterGlasses();
  const unit = settings.weightUnit;

  const { goals: macroGoals, setGoals } = useMacroGoals();
  const [quickGoalMacro, setQuickGoalMacro] = useState<QuickGoalMacro | null>(null);
  // Prevents the onPress navigation from firing after a long-press opens the
  // QuickGoalSheet — TouchableOpacity fires onPress on release even after
  // onLongPress, so we suppress it with this ref.
  const didLongPressRef = useRef(false);
  const calorieGoal = macroGoals.calories;

  const todayStr = new Date().toISOString().split("T")[0];
  const caloriesTodayBurned = workoutLogs
    .filter((w) => w.date === todayStr)
    .reduce((sum, w) => sum + (w.caloriesBurned ?? 0), 0);
  const netCalories = totalCaloriesToday - caloriesTodayBurned;
  const netRemaining = calorieGoal - netCalories;
  const isDeficit = netCalories <= calorieGoal;

  const latestWeight = bodyMeasurements.length > 0
    ? bodyMeasurements[bodyMeasurements.length - 1].weight
    : user?.weight;

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 17
      ? "Good afternoon"
      : "Good evening";

  function handleAddWater() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateWaterIntake(Math.min(WATER_GOAL_GLASSES, waterGlasses + 1));
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
            {greeting},
          </Text>
          <Text style={[styles.name, { color: colors.foreground }]}>
            {user?.name ?? "Champion"}
          </Text>
        </View>
        <View
          style={[
            styles.streakBadge,
            {
              backgroundColor: colors.warning + "20",
              borderColor: colors.warning + "40",
            },
          ]}
        >
          <Ionicons name="flame" size={16} color={colors.warning} />
          <Text style={[styles.streakText, { color: colors.warning }]}>
            {streak}
          </Text>
        </View>
      </View>

      {/* Today's Nutrition */}
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.navigate("/(tabs)/nutrition");
        }}
        scale={0.98}
      >
        <GlassCard style={styles.ringCard}>
          <View style={styles.nutritionHeader}>
            <Text style={[styles.nutritionTitle, { color: colors.foreground }]}>
              Today's Nutrition
            </Text>
            <View style={styles.nutritionHeaderRight}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/macro-goals");
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={[styles.editGoalsBtn, { backgroundColor: colors.muted }]}
              >
                <Ionicons name="pencil-outline" size={13} color={colors.mutedForeground} />
                <Text style={[styles.editGoalsText, { color: colors.mutedForeground }]}>Edit goals</Text>
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </View>
          </View>
          <View style={styles.ringRow}>
            <ProgressRing
              progress={netCalories / calorieGoal}
              size={110}
              strokeWidth={9}
              color={
                netCalories / calorieGoal > 1
                  ? colors.destructive
                  : netCalories / calorieGoal >= 0.9
                  ? colors.warning
                  : colors.primary
              }
              label={netCalories.toString()}
              sublabel="net kcal"
            />
            <View style={styles.ringStats}>
              <RingStat color={colors.primary} label="Consumed" value={totalCaloriesToday} />
              {caloriesTodayBurned > 0 && (
                <RingStat color={colors.secondary} label="Burned" value={caloriesTodayBurned} />
              )}
              <RingStat
                color={isDeficit ? colors.success : colors.warning}
                label={isDeficit ? "Deficit" : "Surplus"}
                value={Math.abs(netRemaining)}
              />
              <RingStat color={colors.muted} label="Goal" value={calorieGoal} />
              <MacroRing
                protein={proteinToday}
                carbs={carbsToday}
                fat={fatToday}
                shouldAnimate={true}
                onLegendPress={(macro) => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/macro-goals?focus=${macro}`);
                }}
              />
            </View>
          </View>
          {/* Macro goal progress rings */}
          <View style={[styles.macroRingRow, { borderTopColor: colors.border }]}>
            {[
              { label: "Calories", macroKey: "calories", value: totalCaloriesToday, goal: calorieGoal, unit: "kcal", baseColor: colors.primary },
              { label: "Protein", macroKey: "protein", value: proteinToday, goal: macroGoals.protein, unit: "g", baseColor: colors.secondary },
              { label: "Carbs", macroKey: "carbs", value: carbsToday, goal: macroGoals.carbs, unit: "g", baseColor: "#f97316" },
              { label: "Fat", macroKey: "fat", value: fatToday, goal: macroGoals.fat, unit: "g", baseColor: colors.accent },
            ].map(({ label, macroKey, value, goal, unit, baseColor }, index) => {
              const rawRatio = goal > 0 ? value / goal : 0;
              const pct = Math.min(rawRatio, 1);
              const ringColor =
                rawRatio > 1
                  ? colors.destructive
                  : rawRatio >= 0.9
                  ? colors.warning
                  : baseColor;
              const isOver = rawRatio > 1;
              const pctLabel = isOver
                ? "100%+"
                : `${Math.round(rawRatio * 100)}%`;
              return (
                <View
                  key={label}
                  style={[
                    styles.macroRingItem,
                    isOver && {
                      shadowColor: colors.destructive,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.65,
                      shadowRadius: 10,
                      elevation: 6,
                    },
                  ]}
                >
                  <AnimatedPressable
                    onPress={(e) => {
                      if (didLongPressRef.current) {
                        didLongPressRef.current = false;
                        return;
                      }
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(`/macro-goals?focus=${macroKey}`);
                    }}
                    onLongPress={() => {
                      didLongPressRef.current = true;
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setQuickGoalMacro(macroKey as QuickGoalMacro);
                    }}
                    scale={0.92}
                    style={{ alignItems: "center" }}
                  >
                    <ProgressRing
                      progress={pct}
                      size={64}
                      strokeWidth={6}
                      color={ringColor}
                      label={pctLabel}
                      labelColor={isOver ? colors.warning : ringColor}
                      animateOnMount
                      delay={index * 100}
                    />
                    <Text style={[styles.macroRingName, { color: colors.mutedForeground }]}>{label}</Text>
                    <Text style={[styles.macroRingValue, { color: ringColor }]}>
                      {value}
                      <Text style={[styles.macroRingGoal, { color: colors.mutedForeground }]}>/{goal}{unit}</Text>
                    </Text>
                  </AnimatedPressable>
                </View>
              );
            })}
          </View>

          {caloriesTodayBurned > 0 && (
            <View style={[styles.netBanner, {
              backgroundColor: isDeficit ? colors.success + "15" : colors.warning + "15",
              borderColor: isDeficit ? colors.success + "40" : colors.warning + "40",
            }]}>
              <Ionicons
                name={isDeficit ? "trending-down" : "trending-up"}
                size={14}
                color={isDeficit ? colors.success : colors.warning}
              />
              <Text style={[styles.netBannerText, { color: isDeficit ? colors.success : colors.warning }]}>
                {isDeficit
                  ? `${Math.abs(netRemaining)} kcal deficit today — great work!`
                  : `${Math.abs(netRemaining)} kcal over goal — adjust your next meal`}
              </Text>
            </View>
          )}

          {/* Weekly calorie sparkline */}
          <WeeklyCalorieTrend
            data={getWeekCalories()}
            goal={calorieGoal}
            onBarPress={async (date, e) => {
              e.stopPropagation();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const isToday = date === new Date().toISOString().split("T")[0];
              if (!isToday) {
                try {
                  await AsyncStorage.setItem("@nutrition_highlighted_date", date);
                  await AsyncStorage.setItem("@nutrition_jump_to_history", "1");
                } catch {}
              }
              router.navigate("/(tabs)/nutrition");
            }}
          />
        </GlassCard>
      </AnimatedPressable>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/activity-tracker");
          }}
          style={styles.gridItem}
        >
          <StatCard
            icon="footsteps-outline"
            label="Steps"
            value={
              pedometerAvailable
                ? pedometerSteps >= 1000
                  ? `${(pedometerSteps / 1000).toFixed(1)}k`
                  : pedometerSteps.toString()
                : "—"
            }
            unit={`/ ${STEPS_GOAL.toLocaleString()}`}
            color={colors.secondary}
            progress={pedometerAvailable ? Math.min(pedometerSteps / STEPS_GOAL, 1) : 0}
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/hydration");
          }}
          style={styles.gridItem}
        >
          <StatCard
            icon="water-outline"
            label={waterStreak > 0 ? `Water 🔥${waterStreak}d` : "Water"}
            value={waterGlasses.toString()}
            unit={`/ ${WATER_GOAL_GLASSES} glasses`}
            color={colors.accent}
            progress={waterGlasses / WATER_GOAL_GLASSES}
          />
        </TouchableOpacity>
      </View>

      {/* Water Quick Add */}
      <AnimatedPressable
        onPress={handleAddWater}
        style={[
          styles.waterBtn,
          {
            backgroundColor: colors.accent + "20",
            borderColor: colors.accent + "40",
          },
        ]}
        scale={0.96}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
        <Text style={[styles.waterBtnText, { color: colors.accent }]}>
          Add glass of water
        </Text>
      </AnimatedPressable>

      {/* Activity Banner */}
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/activity-tracker");
        }}
        style={[
          styles.activityBanner,
          { backgroundColor: colors.secondary + "15", borderColor: colors.secondary + "35" },
        ]}
        scale={0.97}
      >
        <View style={[styles.activityIcon, { backgroundColor: colors.secondary + "25" }]}>
          <Ionicons name="pulse-outline" size={22} color={colors.secondary} />
        </View>
        <View style={styles.activityInfo}>
          <Text style={[styles.activityTitle, { color: colors.foreground }]}>
            Activity Tracker
          </Text>
          <Text style={[styles.activitySub, { color: colors.mutedForeground }]}>
            Steps, active minutes & weekly progress
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </AnimatedPressable>

      {/* Sleep Summary Banner */}
      {sleepHours !== null ? (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/sleep-tracker");
          }}
          style={[
            styles.activityBanner,
            {
              backgroundColor:
                sleepHours >= 7
                  ? "#10b981" + "15"
                  : sleepHours >= 6
                  ? "#f59e0b" + "15"
                  : "#ef4444" + "15",
              borderColor:
                sleepHours >= 7
                  ? "#10b981" + "35"
                  : sleepHours >= 6
                  ? "#f59e0b" + "35"
                  : "#ef4444" + "35",
            },
          ]}
          scale={0.97}
        >
          <View
            style={[
              styles.activityIcon,
              {
                backgroundColor:
                  sleepHours >= 7
                    ? "#10b981" + "25"
                    : sleepHours >= 6
                    ? "#f59e0b" + "25"
                    : "#ef4444" + "25",
              },
            ]}
          >
            <Ionicons
              name="moon-outline"
              size={22}
              color={
                sleepHours >= 7 ? "#10b981" : sleepHours >= 6 ? "#f59e0b" : "#ef4444"
              }
            />
          </View>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: colors.foreground }]}>
              {sleepHours}h sleep last night{" "}
              {sleepQuality !== null
                ? ["😫", "😞", "😐", "🙂", "😄"][sleepQuality - 1]
                : ""}
            </Text>
            <Text style={[styles.activitySub, { color: colors.mutedForeground }]}>
              {sleepHours >= 7
                ? "Great recovery — you're well rested!"
                : sleepHours >= 6
                ? "A little short — aim for 7–9 hours"
                : "Poor sleep — consider an earlier bedtime"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </AnimatedPressable>
      ) : (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/sleep-tracker");
          }}
          style={[
            styles.activityBanner,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          scale={0.97}
        >
          <View style={[styles.activityIcon, { backgroundColor: colors.muted }]}>
            <Ionicons name="moon-outline" size={22} color={colors.mutedForeground} />
          </View>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: colors.foreground }]}>
              Log tonight's sleep
            </Text>
            <Text style={[styles.activitySub, { color: colors.mutedForeground }]}>
              Track sleep quality for better recovery
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </AnimatedPressable>
      )}

      {/* Wellness Readiness Banner */}
      {readinessScore !== null ? (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/wellness-checkin");
          }}
          style={[
            styles.activityBanner,
            { backgroundColor: (readinessColor ?? "#10b981") + "15", borderColor: (readinessColor ?? "#10b981") + "35" },
          ]}
          scale={0.97}
        >
          <View style={[styles.activityIcon, { backgroundColor: (readinessColor ?? "#10b981") + "25" }]}>
            <Ionicons name="happy-outline" size={22} color={readinessColor ?? "#10b981"} />
          </View>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: colors.foreground }]}>
              Wellness Readiness: {readinessScore}/100 — {readinessLabel}
            </Text>
            <Text style={[styles.activitySub, { color: colors.mutedForeground }]}>
              {readinessScore >= 80
                ? "Great day to push hard 💪"
                : readinessScore >= 60
                ? "Keep a steady pace today"
                : readinessScore >= 40
                ? "Light activity — listen to your body"
                : "Full rest day recommended"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </AnimatedPressable>
      ) : (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/wellness-checkin");
          }}
          style={[
            styles.activityBanner,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          scale={0.97}
        >
          <View style={[styles.activityIcon, { backgroundColor: "#10b98120" }]}>
            <Ionicons name="happy-outline" size={22} color="#10b981" />
          </View>
          <View style={styles.activityInfo}>
            <Text style={[styles.activityTitle, { color: colors.foreground }]}>
              Daily Wellness Check-In
            </Text>
            <Text style={[styles.activitySub, { color: colors.mutedForeground }]}>
              Log mood, energy & stress for your readiness score
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        </AnimatedPressable>
      )}

      {/* Membership Plans Banner */}
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/membership");
        }}
        style={[styles.membershipBanner, { backgroundColor: colors.card, borderColor: "#F59E0B40" }]}
      >
        <View style={styles.membershipBannerLeft}>
          <Ionicons name="star" size={20} color="#F59E0B" />
        </View>
        <View style={styles.membershipBannerContent}>
          <Text style={[styles.membershipBannerTitle, { color: colors.foreground }]}>
            Rise · Reign · Legacy 👑
          </Text>
          <Text style={[styles.membershipBannerSub, { color: colors.mutedForeground }]}>
            Optional support plans from $4.99/mo — tap to explore
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Quick Actions
      </Text>
      <View style={styles.actions}>
        <View style={styles.actionsRow}>
          <QuickAction
            icon="body-outline"
            label="Log Body"
            color={colors.warning}
            bg={colors.warning + "20"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/body-measurements");
            }}
          />
          <QuickAction
            icon="people-outline"
            label="Community"
            color="#22c55e"
            bg="#22c55e20"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/community");
            }}
          />
          <QuickAction
            icon="bar-chart-outline"
            label="Progress"
            color="#a855f7"
            bg="#a855f720"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/progress");
            }}
          />
        </View>
        <View style={styles.actionsRow}>
          <QuickAction
            icon="person-outline"
            label="Profile"
            color="#f472b6"
            bg="#f472b620"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/profile");
            }}
          />
          <QuickAction
            icon="share-social-outline"
            label="Share Progress"
            color="#34d399"
            bg="#34d39920"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/progress");
            }}
          />
          <QuickAction
            icon="card-outline"
            label="My Card"
            color="#38bdf8"
            bg="#38bdf820"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate({ pathname: "/(tabs)/profile", params: { openCard: "1" } });
            }}
          />
        </View>

      </View>

      {/* Donation CTA */}
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          Linking.openURL(STRIPE_DONATION_URL);
        }}
        style={[styles.donationCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}
      >
        <View style={styles.donationLeft}>
          <View style={[styles.donationIconWrap, { backgroundColor: colors.primary + "20" }]}>
            <Ionicons name="heart" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.donationTitle, { color: colors.foreground }]}>
              Someone funded this session.{"\n"}
              <Text style={{ color: colors.primary }}>It wasn't you.</Text>
            </Text>
            <Text style={[styles.donationSub, { color: colors.mutedForeground }]}>
              Support the mission — any amount
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {/* Body Stats Banner */}
      {latestWeight && (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/body-measurements");
          }}
          style={[
            styles.bodyBanner,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          scale={0.97}
        >
          <View style={styles.bodyBannerRow}>
            <View>
              <Text style={[styles.bodyBannerTitle, { color: colors.foreground }]}>
                Latest Weight
              </Text>
              <Text style={[styles.bodyBannerValue, { color: colors.primary }]}>
                {latestWeight.toFixed(1)} {unit}
              </Text>
            </View>
            <View style={styles.bodyBannerRight}>
              <Text style={[styles.bodyBannerSub, { color: colors.mutedForeground }]}>
                {bodyMeasurements.length} entries
              </Text>
              <View style={[styles.bodyBannerBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.bodyBannerBtnText, { color: colors.primaryForeground }]}>
                  + Add
                </Text>
              </View>
            </View>
          </View>
        </AnimatedPressable>
      )}

      {/* Recent Workouts */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Recent Workouts
      </Text>
      {recentWorkouts.length > 0 ? (
        <View style={styles.workoutList}>
          {recentWorkouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} />
          ))}
        </View>
      ) : (
        <AnimatedPressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate("/(tabs)/workouts");
          }}
          style={[styles.noWorkouts, { backgroundColor: colors.card, borderColor: colors.border }]}
          scale={0.97}
        >
          <Ionicons name="barbell-outline" size={28} color={colors.mutedForeground} />
          <Text style={[styles.noWorkoutsText, { color: colors.mutedForeground }]}>
            No workouts yet. Tap to start your first one.
          </Text>
        </AnimatedPressable>
      )}
      {/* Membership Upgrade Banner */}
      <AnimatedPressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push("/membership");
        }}
        style={[{
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 16,
          borderWidth: 1,
          padding: 14,
          flexDirection: "row" as const,
          alignItems: "center" as const,
          gap: 12,
          backgroundColor: colors.card,
          borderColor: "#F59E0B40",
        }]}
        scale={0.97}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F59E0B20", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="star" size={18} color="#F59E0B" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Rise · Reign · Legacy 👑</Text>
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}>Optional support plans from $4.99/mo — tap to explore</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      </AnimatedPressable>

      <Text style={{ fontSize: 10, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 24, paddingVertical: 14, lineHeight: 15 }}>
        RAIMZEAL is not here to replace any doctor, dietitian, or healthcare professional — we exist to complement their work and spread health awareness.
      </Text>

      <QuickGoalSheet
        visible={quickGoalMacro !== null}
        macro={quickGoalMacro}
        currentGoal={quickGoalMacro !== null ? macroGoals[quickGoalMacro] : 0}
        onClose={() => setQuickGoalMacro(null)}
        onSave={(value) => {
          if (quickGoalMacro !== null) {
            setGoals({ ...macroGoals, [quickGoalMacro]: value });
          }
          setQuickGoalMacro(null);
        }}
      />
    </ScrollView>
  );
}

function WeeklyCalorieTrend({
  data,
  goal,
  onBarPress,
}: {
  data: { day: string; date: string; calories: number }[];
  goal: number;
  onBarPress?: (date: string, e: GestureResponderEvent) => void;
}) {
  const colors = useColors();
  const CHART_HEIGHT = 48;
  const maxCal = Math.max(goal, ...data.map((d) => d.calories), 1);
  const todayIdx = data.length - 1;

  // Keep a stable ref array, extending it if data ever grows.
  const animValuesRef = useRef<Animated.Value[]>([]);
  for (let i = animValuesRef.current.length; i < data.length; i++) {
    animValuesRef.current.push(new Animated.Value(0));
  }

  useEffect(() => {
    // Reset each bar to 0 before re-animating (handles data updates too).
    data.forEach((_, i) => animValuesRef.current[i].setValue(0));

    const animations = data.map((item, i) => {
      const targetHeight =
        item.calories > 0
          ? Math.max(3, (item.calories / maxCal) * CHART_HEIGHT)
          : 3;
      return Animated.timing(animValuesRef.current[i], {
        toValue: targetHeight,
        // duration 280 ms + stagger 20 ms × 6 = 400 ms total for 7 bars.
        duration: 280,
        delay: i * 20,
        useNativeDriver: false,
      });
    });
    const composite = Animated.parallel(animations);
    composite.start();
    return () => composite.stop();
  }, [data, maxCal]);

  return (
    <View style={sparkStyles.wrapper}>
      <View style={[sparkStyles.divider, { backgroundColor: colors.border }]} />
      <View style={sparkStyles.header}>
        <Text style={[sparkStyles.title, { color: colors.mutedForeground }]}>
          This week
        </Text>
        <Text style={[sparkStyles.goalLabel, { color: colors.mutedForeground }]}>
          Goal: {goal} kcal
        </Text>
      </View>
      <View style={[sparkStyles.chart, { height: CHART_HEIGHT }]}>
        {/* Goal line */}
        <View
          style={[
            sparkStyles.goalLine,
            {
              bottom: (goal / maxCal) * CHART_HEIGHT,
              borderColor: colors.mutedForeground + "40",
            },
          ]}
        />
        {data.map((item, i) => {
          const isToday = i === todayIdx;
          const overGoal = goal > 0 && item.calories > goal;
          const barColor = overGoal
            ? colors.warning
            : isToday
            ? colors.primary
            : colors.primary + "55";

          return (
            <TouchableOpacity
              key={i}
              style={sparkStyles.barCol}
              activeOpacity={0.7}
              onPress={(e) => {
                e.stopPropagation();
                onBarPress?.(item.date, e);
              }}
            >
              <View style={[sparkStyles.barTrack, { height: CHART_HEIGHT }]}>
                <Animated.View
                  style={[
                    sparkStyles.bar,
                    {
                      height: animValuesRef.current[i],
                      backgroundColor: barColor,
                      borderRadius: isToday ? 4 : 3,
                      opacity: isToday ? 1 : item.calories === 0 ? 0.25 : 0.75,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  sparkStyles.dayLabel,
                  {
                    color: isToday ? colors.primary : colors.mutedForeground,
                    fontFamily: isToday
                      ? "Inter_700Bold"
                      : "Inter_400Regular",
                  },
                ]}
              >
                {item.day}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  wrapper: { marginTop: 12 },
  divider: { height: 1, marginBottom: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  goalLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    position: "relative",
  },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barTrack: { width: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: { width: "70%" },
  dayLabel: { fontSize: 9, textAlign: "center" },
});

function RingStat({ color, label, value }: { color: string; label: string; value: number }) {
  const colors = useColors();
  return (
    <View style={ringStatStyles.row}>
      <View style={[ringStatStyles.dot, { backgroundColor: color }]} />
      <Text style={[ringStatStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[ringStatStyles.val, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}
const ringStatStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  val: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});

function QuickAction({
  icon,
  label,
  color,
  bg,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
  onPress?: () => void;
}) {
  const colors = useColors();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.actionBtn, { backgroundColor: bg, borderColor: color + "30" }]}
      scale={0.93}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular" },
  name: { fontSize: 26, fontFamily: "SpaceGrotesk_700Bold", marginTop: 2 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  streakText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  ringCard: { padding: 20 },
  nutritionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  nutritionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  nutritionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  editGoalsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
  },
  editGoalsText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  ringRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  ringStats: { flex: 1, gap: 10 },
  grid: { flexDirection: "row", gap: 10 },
  gridItem: { flex: 1 },
  waterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  waterBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  activityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activitySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", marginTop: 4 },
  actions: { gap: 10 },
  actionsRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  bodyBanner: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  bodyBannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bodyBannerTitle: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bodyBannerValue: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 2 },
  bodyBannerRight: { alignItems: "flex-end", gap: 6 },
  bodyBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bodyBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  bodyBannerBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  membershipBanner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  membershipBannerLeft: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F59E0B20",
    alignItems: "center",
    justifyContent: "center",
  },
  membershipBannerContent: { flex: 1 },
  membershipBannerTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  membershipBannerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  donationCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  donationLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  donationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  donationTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2, lineHeight: 18 },
  donationSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  workoutList: { gap: 10 },
  noWorkouts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  noWorkoutsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  netBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  netBannerText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  macroRingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  macroRingItem: { alignItems: "center", gap: 4 },
  macroRingName: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  macroRingValue: { fontSize: 11, fontFamily: "Inter_700Bold" },
  macroRingGoal: { fontSize: 9, fontFamily: "Inter_400Regular" },
});
