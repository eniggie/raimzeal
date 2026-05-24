import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useColors } from "@/hooks/useColors";

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "elevated" | "accent";
  /** Override the iOS blur intensity (0–100). Default: 60 default, 75 elevated, 45 accent. */
  blurIntensity?: number;
}

export function GlassCard({
  children,
  style,
  variant = "default",
  blurIntensity,
}: GlassCardProps) {
  const colors = useColors();

  // Fallback solid-ish background used on web and Android
  const fallbackBg =
    variant === "elevated"
      ? colors.card + "ee"
      : variant === "accent"
      ? colors.primary + "15"
      : colors.card + "cc";

  const borderColor =
    variant === "accent" ? colors.primary + "40" : colors.border + "80";

  // Specular refraction highlight along the top edge
  const speculTop =
    variant === "accent"
      ? "rgba(255,255,255,0.10)"
      : "rgba(255,255,255,0.13)";

  // Tint overlay for coloured-glass variants (sits on top of blur)
  const tintOverlay =
    variant === "accent"
      ? colors.primary + "18"
      : variant === "elevated"
      ? "rgba(255,255,255,0.04)"
      : undefined;

  // Blur strength by variant; caller can override
  const intensity =
    blurIntensity ??
    (variant === "elevated" ? 75 : variant === "accent" ? 45 : 60);

  return (
    <View
      style={[
        styles.card,
        { borderColor, borderRadius: 18 },
        // Web: plain semi-transparent bg (no BlurView)
        Platform.OS === "web" ? { backgroundColor: fallbackBg } : undefined,
        style,
      ]}
    >
      {Platform.OS === "ios" && (
        <>
          {/* ── Liquid Glass core: frosted-glass backdrop blur ── */}
          <BlurView
            intensity={intensity}
            tint="systemUltraThinMaterialDark"
            style={StyleSheet.absoluteFill}
          />
          {/* Coloured tint overlay for accent / elevated variants */}
          {tintOverlay && (
            <View
              style={[StyleSheet.absoluteFill, { backgroundColor: tintOverlay }]}
            />
          )}
        </>
      )}

      {Platform.OS === "android" && (
        /* Android: blur is less reliable; use a slightly more opaque tinted bg */
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: fallbackBg }]}
        />
      )}

      {/* Specular highlight along the top edge — simulates glass refraction */}
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
    height: "50%",
    top: 0,
  },
});
