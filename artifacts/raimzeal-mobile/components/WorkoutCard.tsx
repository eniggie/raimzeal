import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { WorkoutLog } from "@/contexts/FitnessContext";

interface WorkoutCardProps {
  workout: WorkoutLog;
  onPress?: () => void;
}

export function WorkoutCard({ workout, onPress }: WorkoutCardProps) {
  const colors = useColors();
  const exerciseNames = workout.exercises.map((e) => e.name);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + "20" }]}>
        <Ionicons name="barbell-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
          {workout.workoutName}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {exerciseNames.slice(0, 2).join(" · ")}
          {exerciseNames.length > 2 ? ` +${exerciseNames.length - 2}` : ""}
        </Text>
      </View>
      <View style={styles.stats}>
        <View style={styles.statRow}>
          <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
          <Text style={[styles.statText, { color: colors.mutedForeground }]}>
            {workout.duration}m
          </Text>
        </View>
        <View style={styles.statRow}>
          <Ionicons name="flame-outline" size={12} color={colors.warning} />
          <Text style={[styles.statText, { color: colors.mutedForeground }]}>
            {workout.caloriesBurned}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  stats: { gap: 4, alignItems: "flex-end" },
  statRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
