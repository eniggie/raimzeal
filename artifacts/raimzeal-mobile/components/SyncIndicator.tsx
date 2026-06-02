import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SyncStatus } from "@/hooks/useSyncIndicator";

interface SyncIndicatorProps {
  status: SyncStatus;
}

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const CONFIG: Record<
  Exclude<SyncStatus, "idle">,
  { icon: IoniconName; label: string; bg: string; text: string; border: string; iconColor: string }
> = {
  syncing: {
    icon: "cloud-upload-outline",
    label: "Saving\u2026",
    bg: "rgba(30,30,40,0.92)",
    text: "#aaa",
    border: "rgba(80,80,100,0.5)",
    iconColor: "#aaa",
  },
  saved: {
    icon: "checkmark-circle",
    label: "Saved",
    bg: "rgba(5,46,22,0.92)",
    text: "#86efac",
    border: "rgba(22,101,52,0.6)",
    iconColor: "#4ade80",
  },
  offline: {
    icon: "cloud-offline-outline",
    label: "Saved locally \u2014 will sync when online",
    bg: "rgba(45,26,3,0.92)",
    text: "#fcd34d",
    border: "rgba(120,53,15,0.6)",
    iconColor: "#fbbf24",
  },
};

export function SyncIndicator({ status }: SyncIndicatorProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    if (status === "idle") {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 12, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [status, opacity, translateY]);

  const cfg = status !== "idle" ? CONFIG[status] : null;

  return (
    <Animated.View
      style={[
        styles.pill,
        { opacity, transform: [{ translateY }] },
        cfg
          ? { backgroundColor: cfg.bg, borderColor: cfg.border }
          : { backgroundColor: "transparent", borderColor: "transparent" },
      ]}
      pointerEvents="none"
    >
      {cfg && (
        <View style={styles.inner}>
          <Ionicons name={cfg.icon} size={14} color={cfg.iconColor} />
          <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    bottom: 88,
    right: 16,
    zIndex: 100,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
