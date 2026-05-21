import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: IoniconsName;
  color: string;
  unlocked: (ctx: ReturnType<typeof useFitness>) => boolean;
  category: "Workouts" | "Nutrition" | "Progress" | "Community";
}

const BADGES: BadgeDef[] = [
  // Workouts
  {
    id: "first_step",
    name: "First Step",
    desc: "Complete your first workout",
    icon: "footsteps-outline",
    color: "#10b981",
    category: "Workouts",
    unlocked: ({ workoutLogs }) => workoutLogs.length >= 1,
  },
  {
    id: "week_warrior",
    name: "Week Warrior",
    desc: "Reach a 7-day workout streak",
    icon: "flame",
    color: "#f59e0b",
    category: "Workouts",
    unlocked: ({ streak }) => streak >= 7,
  },
  {
    id: "iron_will",
    name: "Iron Will",
    desc: "Reach a 30-day workout streak",
    icon: "shield",
    color: "#ef4444",
    category: "Workouts",
    unlocked: ({ streak }) => streak >= 30,
  },
  {
    id: "dedicated",
    name: "Dedicated",
    desc: "Complete 10 workouts",
    icon: "barbell-outline",
    color: "#3b82f6",
    category: "Workouts",
    unlocked: ({ workoutLogs }) => workoutLogs.length >= 10,
  },
  {
    id: "committed",
    name: "Committed",
    desc: "Complete 25 workouts",
    icon: "barbell",
    color: "#6366f1",
    category: "Workouts",
    unlocked: ({ workoutLogs }) => workoutLogs.length >= 25,
  },
  {
    id: "century",
    name: "Century Club",
    desc: "Complete 100 workouts",
    icon: "trophy",
    color: "#eab308",
    category: "Workouts",
    unlocked: ({ workoutLogs }) => workoutLogs.length >= 100,
  },
  {
    id: "calorie_crusher",
    name: "Calorie Crusher",
    desc: "Burn 5,000 calories total across workouts",
    icon: "flame-outline",
    color: "#f97316",
    category: "Workouts",
    unlocked: ({ workoutLogs }) =>
      workoutLogs.reduce((s, w) => s + (w.caloriesBurned ?? 0), 0) >= 5000,
  },
  {
    id: "time_lord",
    name: "Time Lord",
    desc: "Train for 1,000 minutes total",
    icon: "time",
    color: "#8b5cf6",
    category: "Workouts",
    unlocked: ({ workoutLogs }) =>
      workoutLogs.reduce((s, w) => s + (w.duration ?? 0), 0) >= 1000,
  },
  {
    id: "weekly_three",
    name: "Triple Threat",
    desc: "Complete 3 workouts in a single week",
    icon: "calendar",
    color: "#06b6d4",
    category: "Workouts",
    unlocked: ({ workoutLogs }) => {
      const weeks: Record<string, number> = {};
      for (const w of workoutLogs) {
        const d = new Date(w.date);
        const year = d.getFullYear();
        const weekNum = Math.floor(
          (d.getTime() - new Date(year, 0, 1).getTime()) / (7 * 86400000)
        );
        const key = `${year}-${weekNum}`;
        weeks[key] = (weeks[key] ?? 0) + 1;
      }
      return Object.values(weeks).some((c) => c >= 3);
    },
  },
  // Nutrition
  {
    id: "first_meal",
    name: "Logged In",
    desc: "Log your first meal",
    icon: "restaurant-outline",
    color: "#10b981",
    category: "Nutrition",
    unlocked: ({ mealLogs }) => mealLogs.length >= 1,
  },
  {
    id: "nutrition_nerd",
    name: "Nutrition Nerd",
    desc: "Log 50 meals",
    icon: "nutrition-outline",
    color: "#84cc16",
    category: "Nutrition",
    unlocked: ({ mealLogs }) => mealLogs.length >= 50,
  },
  {
    id: "macro_master",
    name: "Macro Master",
    desc: "Log 100 meals",
    icon: "nutrition",
    color: "#22c55e",
    category: "Nutrition",
    unlocked: ({ mealLogs }) => mealLogs.length >= 100,
  },
  {
    id: "hydrated",
    name: "Stay Hydrated",
    desc: "Log 8 glasses of water in a day",
    icon: "water",
    color: "#3b82f6",
    category: "Nutrition",
    unlocked: ({ waterIntake }) =>
      waterIntake.some((w) => w.glasses >= 8),
  },
  // Progress
  {
    id: "measure_up",
    name: "Measure Up",
    desc: "Log your first body measurement",
    icon: "body-outline",
    color: "#f59e0b",
    category: "Progress",
    unlocked: ({ bodyMeasurements }) => bodyMeasurements.length >= 1,
  },
  {
    id: "transformation",
    name: "Transformation",
    desc: "Log 10 body measurements",
    icon: "trending-down",
    color: "#ec4899",
    category: "Progress",
    unlocked: ({ bodyMeasurements }) => bodyMeasurements.length >= 10,
  },
  {
    id: "record_breaker",
    name: "Record Breaker",
    desc: "Set your first personal record",
    icon: "medal-outline",
    color: "#eab308",
    category: "Progress",
    unlocked: ({ personalRecords }) => personalRecords.length >= 1,
  },
  {
    id: "pr_legend",
    name: "PR Legend",
    desc: "Set 5 personal records",
    icon: "medal",
    color: "#f59e0b",
    category: "Progress",
    unlocked: ({ personalRecords }) => personalRecords.length >= 5,
  },
  // Community
  {
    id: "ai_powered",
    name: "AI Powered",
    desc: "Have your first Ovia AI coaching session",
    icon: "chatbubble-outline",
    color: "#8b5cf6",
    category: "Community",
    unlocked: ({ oviaMessages }) => oviaMessages.length >= 1,
  },
  {
    id: "big_talker",
    name: "Big Talker",
    desc: "Send 50 messages to Ovia AI",
    icon: "chatbubbles",
    color: "#6366f1",
    category: "Community",
    unlocked: ({ oviaMessages }) =>
      oviaMessages.filter((m) => m.role === "user").length >= 50,
  },
];

const CATEGORIES = ["Workouts", "Nutrition", "Progress", "Community"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Workouts: "#3b82f6",
  Nutrition: "#10b981",
  Progress: "#f59e0b",
  Community: "#8b5cf6",
};

export default function AchievementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ctx = useFitness();

  const badgesWithStatus = useMemo(
    () =>
      BADGES.map((b) => ({
        ...b,
        isUnlocked: b.unlocked(ctx),
      })),
    [ctx.workoutLogs, ctx.mealLogs, ctx.waterIntake, ctx.bodyMeasurements,
     ctx.personalRecords, ctx.oviaMessages, ctx.streak]
  );

  const unlockedCount = badgesWithStatus.filter((b) => b.isUnlocked).length;
  const totalCount = BADGES.length;
  const pct = totalCount > 0 ? unlockedCount / totalCount : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Achievements
        </Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress summary */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.summaryTop}>
            <View>
              <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
                {unlockedCount} / {totalCount} Badges
              </Text>
              <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>
                {totalCount - unlockedCount} more to unlock
              </Text>
            </View>
            <Text style={[styles.summaryPct, { color: colors.primary }]}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${pct * 100}%`, backgroundColor: colors.primary },
              ]}
            />
          </View>
        </View>

        {/* Badges by category */}
        {CATEGORIES.map((cat) => {
          const catBadges = badgesWithStatus.filter((b) => b.category === cat);
          const catUnlocked = catBadges.filter((b) => b.isUnlocked).length;
          const catColor = CATEGORY_COLORS[cat];
          return (
            <View key={cat}>
              <View style={styles.catHeader}>
                <View style={[styles.catDot, { backgroundColor: catColor }]} />
                <Text style={[styles.catTitle, { color: colors.foreground }]}>
                  {cat}
                </Text>
                <Text style={[styles.catCount, { color: colors.mutedForeground }]}>
                  {catUnlocked}/{catBadges.length}
                </Text>
              </View>
              <View style={styles.badgeGrid}>
                {catBadges.map((badge) => (
                  <View
                    key={badge.id}
                    style={[
                      styles.badgeCard,
                      {
                        backgroundColor: badge.isUnlocked
                          ? badge.color + "18"
                          : colors.card,
                        borderColor: badge.isUnlocked
                          ? badge.color + "50"
                          : colors.border,
                        opacity: badge.isUnlocked ? 1 : 0.45,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.badgeIconWrap,
                        {
                          backgroundColor: badge.isUnlocked
                            ? badge.color + "25"
                            : colors.muted,
                        },
                      ]}
                    >
                      <Ionicons
                        name={badge.icon}
                        size={26}
                        color={badge.isUnlocked ? badge.color : colors.mutedForeground}
                      />
                    </View>
                    {badge.isUnlocked && (
                      <View
                        style={[
                          styles.unlockedPip,
                          { backgroundColor: badge.color },
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.badgeName,
                        { color: badge.isUnlocked ? colors.foreground : colors.mutedForeground },
                      ]}
                      numberOfLines={2}
                    >
                      {badge.name}
                    </Text>
                    <Text
                      style={[styles.badgeDesc, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {badge.desc}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 20 },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  summarySub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  summaryPct: { fontSize: 36, fontFamily: "SpaceGrotesk_700Bold" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  catHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catTitle: { flex: 1, fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  catCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  badgeCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    alignItems: "center",
    position: "relative",
  },
  badgeIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  unlockedPip: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeName: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  badgeDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 15,
  },
});
