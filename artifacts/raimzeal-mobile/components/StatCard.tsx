import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "./GlassCard";

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit?: string;
  color?: string;
  /** 0–1 fill ratio */
  progress?: number;
  style?: ViewStyle;
}

export function StatCard({
  icon,
  label,
  value,
  unit,
  color,
  progress,
  style,
}: StatCardProps) {
  const colors = useColors();
  const accentColor = color ?? colors.primary;
  const fillRatio = progress !== undefined ? Math.min(1, Math.max(0, progress)) : 0;

  return (
    <GlassCard style={[styles.card, style]}>
      <View style={[styles.iconWrap, { backgroundColor: accentColor + "20" }]}>
        <Ionicons name={icon} size={18} color={accentColor} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: colors.foreground }]}>{value}</Text>
          {unit && (
            <Text style={[styles.unit, { color: colors.mutedForeground }]}>
              {" "}{unit}
            </Text>
          )}
        </View>
        {progress !== undefined && (
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            {/* Flex-based progress bar — avoids percentage string type issues */}
            <View style={styles.progressFlex}>
              <View style={[styles.progressFill, { flex: fillRatio, backgroundColor: accentColor }]} />
              <View style={{ flex: 1 - fillRatio }} />
            </View>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  unit: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 6,
    overflow: "hidden",
  },
  progressFlex: {
    flex: 1,
    flexDirection: "row",
    height: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
});
