import React, { useState } from "react";
import {
  FlatList,
  Platform,
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
import { WorkoutCard } from "@/components/WorkoutCard";
import { WORKOUT_TEMPLATES } from "@/constants/workoutTemplates";

export default function WorkoutsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { workoutLogs } = useFitness();

  const [activeTab, setActiveTab] = useState<"library" | "history">("library");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleStartWorkout(workoutId: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: "/workout-player", params: { workoutId } });
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Workouts
        </Text>
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["library", "history"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabBtn,
                activeTab === tab && { backgroundColor: colors.card },
              ]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === tab ? colors.foreground : colors.mutedForeground,
                    fontFamily: activeTab === tab ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === "library" ? (
        <FlatList
          data={WORKOUT_TEMPLATES}
          keyExtractor={(item) => item.workoutId}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleStartWorkout(item.workoutId)}
              style={[
                styles.templateCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={[styles.templateIcon, { backgroundColor: colors.primary + "20" }]}>
                <Ionicons name={item.icon} size={24} color={colors.primary} />
              </View>
              <View style={styles.templateInfo}>
                <Text style={[styles.templateName, { color: colors.foreground }]}>
                  {item.name}
                </Text>
                <Text style={[styles.templateMeta, { color: colors.mutedForeground }]}>
                  {item.exercises.slice(0, 3).map((e) => e.name).join(" · ")}
                  {item.exercises.length > 3 ? ` +${item.exercises.length - 3}` : ""}
                </Text>
                <View style={styles.templateStats}>
                  <View style={styles.templateStat}>
                    <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>
                      {item.duration}m
                    </Text>
                  </View>
                  <View style={styles.templateStat}>
                    <Ionicons name="flame-outline" size={12} color={colors.warning} />
                    <Text style={[styles.templateStatText, { color: colors.mutedForeground }]}>
                      ~{item.calories} kcal
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.startBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="play" size={16} color={colors.primaryForeground} />
              </View>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={workoutLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No workouts yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.mutedForeground }]}>
                Start a workout from the library
              </Text>
            </View>
          }
          renderItem={({ item }) => <WorkoutCard workout={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  tabRow: { flexDirection: "row", borderRadius: 10, padding: 3 },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  tabLabel: { fontSize: 14 },
  listContent: { padding: 16, gap: 10 },
  templateCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  templateInfo: { flex: 1, gap: 4 },
  templateName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  templateMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  templateStats: { flexDirection: "row", gap: 12, marginTop: 2 },
  templateStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  templateStatText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  startBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 60,
  },
  emptyText: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptySubtext: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
