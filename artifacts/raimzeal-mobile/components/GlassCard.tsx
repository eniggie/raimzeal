import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "elevated" | "accent";
}

export function GlassCard({ children, style, variant = "default" }: GlassCardProps) {
  const colors = useColors();

  const bgColor =
    variant === "elevated"
      ? colors.card + "ee"
      : variant === "accent"
      ? colors.primary + "15"
      : colors.card + "cc";

  const borderColor =
    variant === "accent" ? colors.primary + "40" : colors.border + "80";

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bgColor,
          borderColor,
          borderRadius: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
});
