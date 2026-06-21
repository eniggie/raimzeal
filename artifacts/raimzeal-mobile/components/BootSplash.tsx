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

function HomeSkeleton() {
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

function WorkoutsSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerAvatar} />
      </View>

      <View style={styles.pillsRow}>
        <SkeletonBlock style={styles.filterPill} />
        <SkeletonBlock style={styles.filterPill} />
        <SkeletonBlock style={styles.filterPill} />
      </View>

      <SkeletonBlock style={styles.workoutHero} />
      <SkeletonBlock style={styles.sectionLabel} />

      <View style={styles.exerciseRow}>
        <SkeletonBlock style={styles.exerciseIcon} />
        <View style={styles.exerciseText}>
          <SkeletonBlock style={styles.exerciseTitle} />
          <SkeletonBlock style={styles.exerciseSub} />
        </View>
      </View>
      <View style={styles.exerciseRow}>
        <SkeletonBlock style={styles.exerciseIcon} />
        <View style={styles.exerciseText}>
          <SkeletonBlock style={styles.exerciseTitle} />
          <SkeletonBlock style={styles.exerciseSub} />
        </View>
      </View>
      <View style={styles.exerciseRow}>
        <SkeletonBlock style={styles.exerciseIcon} />
        <View style={styles.exerciseText}>
          <SkeletonBlock style={styles.exerciseTitle} />
          <SkeletonBlock style={styles.exerciseSub} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function OviaSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerAvatar} />
      </View>

      <View style={styles.chatFill}>
        <SkeletonBlock style={styles.bubbleReceived} />
        <SkeletonBlock style={[styles.bubbleReceived, { width: 200, marginTop: 10 }]} />
        <SkeletonBlock style={styles.bubbleSent} />
        <SkeletonBlock style={[styles.bubbleReceived, { width: 220, height: 56, marginTop: 10 }]} />
      </View>

      <SkeletonBlock style={styles.chatInput} />
    </SafeAreaView>
  );
}

function NutritionSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerAvatar} />
      </View>

      <View style={styles.macroRow}>
        <SkeletonBlock style={styles.macroRing} />
        <SkeletonBlock style={styles.macroRing} />
        <SkeletonBlock style={styles.macroRing} />
      </View>

      <SkeletonBlock style={styles.dateNav} />
      <SkeletonBlock style={styles.sectionLabel} />

      <View style={styles.foodRow}>
        <SkeletonBlock style={styles.foodThumb} />
        <View style={styles.foodText}>
          <SkeletonBlock style={styles.foodName} />
          <SkeletonBlock style={styles.foodCal} />
        </View>
      </View>
      <View style={styles.foodRow}>
        <SkeletonBlock style={styles.foodThumb} />
        <View style={styles.foodText}>
          <SkeletonBlock style={styles.foodName} />
          <SkeletonBlock style={styles.foodCal} />
        </View>
      </View>

      <SkeletonBlock style={[styles.sectionLabel, { marginTop: 12 }]} />

      <View style={styles.foodRow}>
        <SkeletonBlock style={styles.foodThumb} />
        <View style={styles.foodText}>
          <SkeletonBlock style={styles.foodName} />
          <SkeletonBlock style={styles.foodCal} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function ProgressSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerAvatar} />
      </View>

      <SkeletonBlock style={styles.chartArea} />

      <View style={styles.statsRow}>
        <SkeletonBlock style={styles.statCard} />
        <SkeletonBlock style={styles.statCard} />
        <SkeletonBlock style={styles.statCard} />
      </View>

      <SkeletonBlock style={styles.sectionLabel} />

      <View style={styles.photoRow}>
        <SkeletonBlock style={styles.photoThumb} />
        <SkeletonBlock style={styles.photoThumb} />
        <SkeletonBlock style={styles.photoThumb} />
      </View>
    </SafeAreaView>
  );
}

function CommunitySkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <SkeletonBlock style={styles.headerTitle} />
        <SkeletonBlock style={styles.headerAvatar} />
      </View>

      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.postCard}>
          <View style={styles.postHeader}>
            <SkeletonBlock style={styles.postAvatar} />
            <View style={styles.postMeta}>
              <SkeletonBlock style={styles.postName} />
              <SkeletonBlock style={styles.postTime} />
            </View>
          </View>
          <SkeletonBlock style={styles.postContent} />
          <View style={styles.postReactions}>
            <SkeletonBlock style={styles.reactionDot} />
            <SkeletonBlock style={styles.reactionDot} />
            <SkeletonBlock style={styles.reactionDot} />
          </View>
        </View>
      ))}
    </SafeAreaView>
  );
}

function ProfileSkeleton() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.profileHero}>
        <SkeletonBlock style={styles.profileAvatar} />
        <SkeletonBlock style={styles.profileName} />
        <SkeletonBlock style={styles.profileSub} />
      </View>

      <View style={styles.divider} />

      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.settingRow}>
          <SkeletonBlock style={styles.settingIcon} />
          <SkeletonBlock style={styles.settingLabel} />
          <SkeletonBlock style={styles.settingArrow} />
        </View>
      ))}
    </SafeAreaView>
  );
}

interface BootSplashProps {
  tab?: string;
}

export function BootSplash({ tab = "index" }: BootSplashProps) {
  switch (tab) {
    case "workouts":
      return <WorkoutsSkeleton />;
    case "ovia":
      return <OviaSkeleton />;
    case "nutrition":
      return <NutritionSkeleton />;
    case "progress":
      return <ProgressSkeleton />;
    case "community":
      return <CommunitySkeleton />;
    case "profile":
      return <ProfileSkeleton />;
    default:
      return <HomeSkeleton />;
  }
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

  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  filterPill: {
    height: 32,
    width: 80,
    borderRadius: 16,
    backgroundColor: MUTED,
  },

  workoutHero: {
    height: 140,
    borderRadius: 14,
    marginBottom: 20,
  },

  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  exerciseIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  exerciseText: {
    flex: 1,
    gap: 6,
  },
  exerciseTitle: {
    height: 14,
    borderRadius: 4,
    width: "70%",
    backgroundColor: CARD,
  },
  exerciseSub: {
    height: 11,
    borderRadius: 4,
    width: "45%",
    backgroundColor: MUTED,
  },

  chatFill: {
    flex: 1,
    paddingTop: 8,
  },
  bubbleReceived: {
    height: 44,
    width: 240,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    alignSelf: "flex-start",
  },
  bubbleSent: {
    height: 36,
    width: 180,
    borderRadius: 20,
    borderBottomRightRadius: 4,
    alignSelf: "flex-end",
    marginTop: 10,
    backgroundColor: MUTED,
  },
  chatInput: {
    height: 52,
    borderRadius: 26,
    marginBottom: 8,
    backgroundColor: MUTED,
  },

  macroRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  macroRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },

  dateNav: {
    height: 36,
    borderRadius: 10,
    backgroundColor: MUTED,
    marginBottom: 20,
  },

  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  foodThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  foodText: {
    flex: 1,
    gap: 6,
  },
  foodName: {
    height: 14,
    borderRadius: 4,
    width: "65%",
  },
  foodCal: {
    height: 11,
    borderRadius: 4,
    width: "35%",
    backgroundColor: MUTED,
  },

  chartArea: {
    height: 180,
    borderRadius: 16,
    marginBottom: 20,
  },

  photoRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  photoThumb: {
    flex: 1,
    height: 100,
    borderRadius: 12,
  },

  postCard: {
    marginBottom: 16,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MUTED,
  },
  postMeta: {
    flex: 1,
    gap: 5,
  },
  postName: {
    height: 13,
    width: 110,
    borderRadius: 4,
    backgroundColor: MUTED,
  },
  postTime: {
    height: 10,
    width: 70,
    borderRadius: 4,
    backgroundColor: MUTED,
  },
  postContent: {
    height: 52,
    borderRadius: 8,
    backgroundColor: MUTED,
    marginBottom: 12,
  },
  postReactions: {
    flexDirection: "row",
    gap: 8,
  },
  reactionDot: {
    width: 28,
    height: 20,
    borderRadius: 10,
    backgroundColor: MUTED,
  },

  profileHero: {
    alignItems: "center",
    paddingVertical: 24,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  profileName: {
    height: 18,
    width: 120,
    borderRadius: 6,
    marginBottom: 6,
    backgroundColor: MUTED,
  },
  profileSub: {
    height: 12,
    width: 80,
    borderRadius: 4,
    backgroundColor: MUTED,
  },

  divider: {
    height: 1,
    backgroundColor: MUTED,
    marginVertical: 20,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
    marginBottom: 4,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: MUTED,
  },
  settingLabel: {
    flex: 1,
    height: 14,
    borderRadius: 4,
  },
  settingArrow: {
    width: 20,
    height: 14,
    borderRadius: 4,
    backgroundColor: MUTED,
  },
});
