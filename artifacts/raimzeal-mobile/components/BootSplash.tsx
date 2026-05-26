import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0a0a0b";
const CARD = "#111113";
const MUTED = "#1d1d20";

function SkeletonBlock({ style }: { style?: object }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, style, { opacity }]} />;
}

export function BootSplash() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerAvatar} />
      </View>

      <View style={styles.statsRow}>
        <SkeletonBlock style={styles.statCard} />
        <SkeletonBlock style={styles.statCard} />
        <SkeletonBlock style={styles.statCard} />
      </View>

      <SkeletonBlock style={styles.sectionLabel} />

      <SkeletonBlock style={styles.mainCard} />

      <SkeletonBlock style={styles.sectionLabel} />

      <SkeletonBlock style={styles.listCard} />
      <SkeletonBlock style={styles.listCard} />
      <SkeletonBlock style={styles.listCard} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  block: {
    backgroundColor: CARD,
    borderRadius: 10,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    marginTop: 8,
  },
  headerTitle: {
    height: 22,
    width: 140,
    borderRadius: 6,
  },
  headerAvatar: {
    height: 36,
    width: 36,
    borderRadius: 18,
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    height: 80,
    borderRadius: 12,
    backgroundColor: CARD,
  },

  sectionLabel: {
    height: 14,
    width: 100,
    borderRadius: 4,
    backgroundColor: MUTED,
    marginBottom: 10,
  },

  mainCard: {
    height: 160,
    borderRadius: 14,
    marginBottom: 24,
  },

  listCard: {
    height: 60,
    borderRadius: 12,
    marginBottom: 10,
  },
});
