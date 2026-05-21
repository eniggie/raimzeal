import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { useMacroGoals } from "@/contexts/MacroGoalsContext";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { ProgressRing } from "@/components/ProgressRing";
import { WorkoutCard } from "@/components/WorkoutCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";

const WATER_GOAL_GLASSES = 10;
const STEPS_GOAL = 10000;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    user,
    streak,
    workoutLogs,
    bodyMeasurements,
    getTodayMacros,
    getTodayWaterGlasses,
    updateWaterIntake,
    settings,
  } = useFitness();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const recentWorkouts = workoutLogs.slice(0, 3);
  const { calories: totalCaloriesToday, protein: proteinToday, carbs: carbsToday, fat: fatToday } = getTodayMacros();
  const waterGlasses = getTodayWaterGlasses();
  const unit = settings.weightUnit;

  const { goals: macroGoals } = useMacroGoals();
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
            {user?.name ?? "Athlete"}
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
            <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
          </View>
          <View style={styles.ringRow}>
            <ProgressRing
              progress={netCalories / calorieGoal}
              size={110}
              strokeWidth={9}
              color={isDeficit ? colors.primary : colors.warning}
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
            </View>
          </View>
          {/* Macro progress bars */}
          <View style={styles.macroRow}>
            {[
              { label: "P", value: proteinToday, goal: macroGoals.protein, color: colors.secondary },
              { label: "C", value: carbsToday, goal: macroGoals.carbs, color: colors.warning },
              { label: "F", value: fatToday, goal: macroGoals.fat, color: colors.accent },
            ].map(({ label, value, goal, color }) => {
              const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
              return (
                <View key={label} style={styles.macroBar}>
                  <View style={styles.macroBarHeader}>
                    <Text style={[styles.macroBarLabel, { color: colors.mutedForeground }]}>{label}</Text>
                    <Text style={[styles.macroBarVal, { color }]}>{value}<Text style={{ color: colors.mutedForeground, fontSize: 9 }}>/{goal}g</Text></Text>
                  </View>
                  <View style={[styles.macroBarTrack, { backgroundColor: color + "25" }]}>
                    <View style={[styles.macroBarFill, { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color }]} />
                  </View>
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
            value="—"
            unit={`/ ${STEPS_GOAL.toLocaleString()}`}
            color={colors.secondary}
            progress={0}
          />
        </TouchableOpacity>
        <StatCard
          icon="water-outline"
          label="Water"
          value={waterGlasses.toString()}
          unit={`/ ${WATER_GOAL_GLASSES} glasses`}
          color={colors.accent}
          progress={waterGlasses / WATER_GOAL_GLASSES}
          style={styles.gridItem}
        />
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

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Quick Actions
      </Text>
      <View style={styles.actions}>
        <View style={styles.actionsRow}>
          <QuickAction
            icon="play-circle"
            label="Start Workout"
            color={colors.primary}
            bg={colors.primary + "20"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/workouts");
            }}
          />
          <QuickAction
            icon="restaurant-outline"
            label="Log Meal"
            color={colors.secondary}
            bg={colors.secondary + "20"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/nutrition");
            }}
          />
        </View>
        <View style={styles.actionsRow}>
          <QuickAction
            icon="chatbubble-ellipses-outline"
            label="Ask Ovia"
            color={colors.accent}
            bg={colors.accent + "20"}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/ovia");
            }}
          />
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
        </View>
        <View style={styles.actionsRow}>
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
            icon="list-outline"
            label="Programs"
            color="#3b82f6"
            bg="#3b82f620"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.navigate("/(tabs)/workouts");
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

      </View>

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
    </ScrollView>
  );
}

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
  ringRow: { flexDirection: "row", alignItems: "center", gap: 24 },
  ringStats: { flex: 1, gap: 10 },
  grid: { flexDirection: "row", gap: 10 },
  gridItem: { flex: 1 },
  waterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  waterBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  activityBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  bodyBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
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
  workoutList: { gap: 10 },
  noWorkouts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
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
  macroRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  macroBar: { flex: 1, gap: 4 },
  macroBarHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  macroBarLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase" },
  macroBarVal: { fontSize: 11, fontFamily: "Inter_700Bold" },
  macroBarTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  macroBarFill: { height: "100%", borderRadius: 3 },
});
