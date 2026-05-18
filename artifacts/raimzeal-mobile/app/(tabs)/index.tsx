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
import { GlassCard } from "@/components/GlassCard";
import { StatCard } from "@/components/StatCard";
import { ProgressRing } from "@/components/ProgressRing";
import { WorkoutCard } from "@/components/WorkoutCard";

const CALORIE_GOAL = 2200;
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
    getTodayMacros,
    getTodayWaterGlasses,
    updateWaterIntake,
  } = useFitness();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const recentWorkouts = workoutLogs.slice(0, 3);
  const { calories: totalCaloriesToday } = getTodayMacros();
  const waterGlasses = getTodayWaterGlasses();

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

      {/* Calorie Ring */}
      <GlassCard style={styles.ringCard}>
        <View style={styles.ringRow}>
          <ProgressRing
            progress={totalCaloriesToday / CALORIE_GOAL}
            size={110}
            strokeWidth={9}
            color={colors.primary}
            label={totalCaloriesToday.toString()}
            sublabel="kcal"
          />
          <View style={styles.ringStats}>
            <RingStat
              color={colors.primary}
              label="Consumed"
              value={totalCaloriesToday}
            />
            <RingStat
              color={colors.secondary}
              label="Remaining"
              value={Math.max(0, CALORIE_GOAL - totalCaloriesToday)}
            />
            <RingStat
              color={colors.muted}
              label="Goal"
              value={CALORIE_GOAL}
            />
          </View>
        </View>
      </GlassCard>

      {/* Stats Grid */}
      <View style={styles.grid}>
        <StatCard
          icon="footsteps-outline"
          label="Steps"
          value="8,420"
          color={colors.secondary}
          progress={8420 / STEPS_GOAL}
          style={styles.gridItem}
        />
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
          Add glass of water
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
        <QuickAction
          icon="chatbubble-ellipses-outline"
          label="Ask Ovia"
          color={colors.accent}
          bg={colors.accent + "20"}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate("/(tabs)/profile");
          }}
        />
        <QuickAction
          icon="trending-up-outline"
          label="Log Weight"
          color={colors.warning}
          bg={colors.warning + "20"}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.navigate("/(tabs)/progress");
          }}
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

function RingStat({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  const colors = useColors();
  return (
    <View style={ringStatStyles.row}>
      <View style={[ringStatStyles.dot, { backgroundColor: color }]} />
      <Text style={[ringStatStyles.label, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[ringStatStyles.val, { color: colors.foreground }]}>
        {value}
      </Text>
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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.actionBtn, { backgroundColor: bg, borderColor: color + "30" }]}
    >
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  sectionTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    marginTop: 4,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionBtn: {
    width: "47%",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  workoutList: { gap: 10 },
});
