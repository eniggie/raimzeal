import React, { useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { ProgressRing } from "@/components/ProgressRing";
import { WorkoutCard } from "@/components/WorkoutCard";

const CALORIE_GOAL = 2200;
const WATER_GOAL = 2500;
const STEPS_GOAL = 10000;

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    profile,
    streak,
    totalCaloriesToday,
    waterIntake,
    stepsToday,
    workoutLogs,
    setWaterIntake,
  } = useFitness();

  const [addingWater] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const recentWorkouts = workoutLogs.slice(0, 3);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const calorieProgress = totalCaloriesToday / CALORIE_GOAL;

  function handleAddWater() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWaterIntake(Math.min(WATER_GOAL, waterIntake + 250));
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
            {profile.name}
          </Text>
        </View>
        <View style={[styles.streakBadge, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "40" }]}>
          <Ionicons name="flame" size={16} color={colors.warning} />
          <Text style={[styles.streakText, { color: colors.warning }]}>
            {streak}
          </Text>
        </View>
      </View>

      {/* Calorie Ring */}
      <GlassCard style={styles.ringCard}>
        <View style={styles.ringRow}>
          <ProgressRing
            progress={calorieProgress}
            size={110}
            strokeWidth={9}
            color={colors.primary}
            label={totalCaloriesToday.toString()}
            sublabel="kcal"
          />
          <View style={styles.ringStats}>
            <View style={styles.ringStatItem}>
              <View style={[styles.dot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.ringStatLabel, { color: colors.mutedForeground }]}>
                Consumed
              </Text>
              <Text style={[styles.ringStatVal, { color: colors.foreground }]}>
                {totalCaloriesToday}
              </Text>
            </View>
            <View style={styles.ringStatItem}>
              <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
              <Text style={[styles.ringStatLabel, { color: colors.mutedForeground }]}>
                Remaining
              </Text>
              <Text style={[styles.ringStatVal, { color: colors.foreground }]}>
                {Math.max(0, CALORIE_GOAL - totalCaloriesToday)}
              </Text>
            </View>
            <View style={styles.ringStatItem}>
              <View style={[styles.dot, { backgroundColor: colors.muted }]} />
              <Text style={[styles.ringStatLabel, { color: colors.mutedForeground }]}>
                Goal
              </Text>
              <Text style={[styles.ringStatVal, { color: colors.foreground }]}>
                {CALORIE_GOAL}
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <StatCard
          icon="footsteps-outline"
          label="Steps"
          value={stepsToday.toLocaleString()}
          color={colors.secondary}
          progress={stepsToday / STEPS_GOAL}
          style={styles.gridItem}
        />
        <StatCard
          icon="water-outline"
          label="Water"
          value={(waterIntake / 1000).toFixed(1)}
          unit="L"
          color={colors.accent}
          progress={waterIntake / WATER_GOAL}
          style={styles.gridItem}
        />
      </View>

      {/* Water Quick Add */}
      <TouchableOpacity
        onPress={handleAddWater}
        activeOpacity={0.8}
        style={[
          styles.waterBtn,
          {
            backgroundColor: colors.accent + "20",
            borderColor: colors.accent + "40",
          },
        ]}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
        <Text style={[styles.waterBtnText, { color: colors.accent }]}>
          Add 250ml water
        </Text>
      </TouchableOpacity>

      {/* Quick Actions */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Quick Actions
      </Text>
      <View style={styles.actions}>
        <QuickAction
          icon="play-circle"
          label="Start Workout"
          color={colors.primary}
          bg={colors.primary + "20"}
        />
        <QuickAction
          icon="restaurant-outline"
          label="Log Meal"
          color={colors.secondary}
          bg={colors.secondary + "20"}
        />
        <QuickAction
          icon="chatbubble-ellipses-outline"
          label="Ask Ovia"
          color={colors.accent}
          bg={colors.accent + "20"}
        />
        <QuickAction
          icon="trending-up-outline"
          label="Log Weight"
          color={colors.warning}
          bg={colors.warning + "20"}
        />
      </View>

      {/* Recent Workouts */}
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Recent Workouts
      </Text>
      <View style={styles.workoutList}>
        {recentWorkouts.map((w) => (
          <WorkoutCard key={w.id} workout={w} />
        ))}
      </View>
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  color,
  bg,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  bg: string;
}) {
  const colors = useColors();
  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.75}
      style={[styles.actionBtn, { backgroundColor: bg, borderColor: color + "30" }]}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  name: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
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
  streakText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  ringCard: {
    padding: 20,
  },
  ringRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  ringStats: {
    flex: 1,
    gap: 10,
  },
  ringStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ringStatLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  ringStatVal: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  grid: {
    flexDirection: "row",
    gap: 10,
  },
  gridItem: {
    flex: 1,
  },
  waterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  waterBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  actionBtn: {
    width: "47%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  workoutList: {
    gap: 10,
  },
});
