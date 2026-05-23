import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
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

  const speculTop = variant === "accent"
    ? "rgba(255,255,255,0.10)"
    : "rgba(255,255,255,0.13)";

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: bgColor, borderColor, borderRadius: 18 },
        style,
      ]}
    >
      {/* iOS 26 Liquid Glass specular highlight along the top edge */}
      {Platform.OS !== "web" && (
        <LinearGradient
          colors={[speculTop as string, "rgba(255,255,255,0.00)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.specular]}
          pointerEvents="none"
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: "hidden",
  },
  specular: {
    zIndex: 0,
    height: "50%",
    top: 0,
  },
});
