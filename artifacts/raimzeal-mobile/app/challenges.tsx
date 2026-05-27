import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";

const STORAGE_KEY = "@raimzeal_challenges_v2";

interface ChallengeDefinition {
  id: string;
  title: string;
  emoji: string;
  description: string;
  durationDays: number;
  category: "hydration" | "movement" | "nutrition" | "sleep" | "wellness" | "strength";
  color: string;
  dailyTask: string;
}

const CHALLENGES: ChallengeDefinition[] = [
  {
    id: "hydration_7",
    title: "7-Day Hydration Challenge",
    emoji: "💧",
    description: "Hit your daily water goal every day for 7 days straight.",
    durationDays: 7,
    category: "hydration",
    color: "#3b82f6",
    dailyTask: "Log 10+ glasses of water",
  },
  {
    id: "walking_21",
    title: "21-Day Walking Challenge",
    emoji: "🚶",
    description: "Walk at least 7,000 steps every day for 3 weeks.",
    durationDays: 21,
    category: "movement",
    color: "#10b981",
    dailyTask: "Log 7,000+ steps",
  },
  {
    id: "fatloss_30",
    title: "30-Day Fat Loss Challenge",
    emoji: "🔥",
    description: "Stay within your calorie goal and train at least 4 days a week for 30 days.",
    durationDays: 30,
    category: "nutrition",
    color: "#ef4444",
    dailyTask: "Log meals & stay in deficit",
  },
  {
    id: "strength_21",
    title: "21-Day Strength Challenge",
    emoji: "💪",
    description: "Complete a strength workout at least 4 times per week for 3 weeks.",
    durationDays: 21,
    category: "strength",
    color: "#8b5cf6",
    dailyTask: "Log a strength session",
  },
  {
    id: "sleep_14",
    title: "Sleep Reset Challenge",
    emoji: "😴",
    description: "Hit 7+ hours of sleep and log your quality for 14 consecutive nights.",
    durationDays: 14,
    category: "sleep",
    color: "#a78bfa",
    dailyTask: "Log 7+ hours of sleep",
  },
  {
    id: "cycle_sync_28",
    title: "Cycle Sync Challenge",
    emoji: "🌙",
    description: "Log your cycle daily and complete phase-appropriate activities for 28 days.",
    durationDays: 28,
    category: "wellness",
    color: "#ec4899",
    dailyTask: "Log cycle + complete daily activity",
  },
  {
    id: "workplace_wellness_5",
    title: "Workplace Wellness Challenge",
    emoji: "🏢",
    description: "5 days of desk stretches, hydration, and a 10-minute walk each day.",
    durationDays: 5,
    category: "wellness",
    color: "#f59e0b",
    dailyTask: "Stretch + walk + 8 glasses",
  },
];

const CATEGORY_LABELS: Record<ChallengeDefinition["category"], string> = {
  hydration: "Hydration",
  movement: "Movement",
  nutrition: "Nutrition",
  sleep: "Sleep",
  wellness: "Wellness",
  strength: "Strength",
};

interface UserChallenge {
  challengeId: string;
  startDate: string;
  checkIns: string[];
  completed: boolean;
}

type ChallengesStore = Record<string, UserChallenge>;

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function daysElapsed(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function progressPct(uc: UserChallenge, def: ChallengeDefinition): number {
  return Math.min(uc.checkIns.length / def.durationDays, 1);
}

function daysLeft(uc: UserChallenge, def: ChallengeDefinition): number {
  return Math.max(0, def.durationDays - daysElapsed(uc.startDate));
}

export default function ChallengesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [store, setStore] = useState<ChallengesStore>({});
  const [activeTab, setActiveTab] = useState<"active" | "available" | "completed">("available");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setStore(JSON.parse(raw));
    });
  }, []);

  const persist = useCallback(async (next: ChallengesStore) => {
    setStore(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const handleJoin = useCallback(async (challengeId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next: ChallengesStore = {
      ...store,
      [challengeId]: {
        challengeId,
        startDate: todayStr(),
        checkIns: [],
        completed: false,
      },
    };
    await persist(next);
    setActiveTab("active");
  }, [store, persist]);

  const handleCheckIn = useCallback(async (challengeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const uc = store[challengeId];
    if (!uc) return;
    const today = todayStr();
    if (uc.checkIns.includes(today)) return;
    const def = CHALLENGES.find((c) => c.id === challengeId)!;
    const newCheckIns = [...uc.checkIns, today];
    const completed = newCheckIns.length >= def.durationDays;
    const next: ChallengesStore = {
      ...store,
      [challengeId]: { ...uc, checkIns: newCheckIns, completed },
    };
    await persist(next);
  }, [store, persist]);

  const handleLeave = useCallback(async (challengeId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const next = { ...store };
    delete next[challengeId];
    await persist(next);
  }, [store, persist]);

  const activeChallenges = useMemo(() =>
    CHALLENGES.filter((c) => store[c.id] && !store[c.id].completed),
    [store]
  );
  const completedChallenges = useMemo(() =>
    CHALLENGES.filter((c) => store[c.id]?.completed),
    [store]
  );
  const availableChallenges = useMemo(() =>
    CHALLENGES.filter((c) => !store[c.id]),
    [store]
  );

  const tabs: { key: "active" | "available" | "completed"; label: string; count: number }[] = [
    { key: "available", label: "Join", count: availableChallenges.length },
    { key: "active", label: "Active", count: activeChallenges.length },
    { key: "completed", label: "Done", count: completedChallenges.length },
  ];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 40 + 84 : 110 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Community Challenges
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Join · Track progress · Celebrate wins
          </Text>
        </View>
      </View>

      {/* Stats Strip */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statChip}>
          <Text style={[styles.statNum, { color: colors.primary }]}>{activeChallenges.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active</Text>
        </GlassCard>
        <GlassCard style={styles.statChip}>
          <Text style={[styles.statNum, { color: "#10b981" }]}>{completedChallenges.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Completed</Text>
        </GlassCard>
        <GlassCard style={styles.statChip}>
          <Text style={[styles.statNum, { color: colors.secondary }]}>
            {Object.values(store).reduce((s, uc) => s + uc.checkIns.length, 0)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Check-ins</Text>
        </GlassCard>
      </View>

      {/* Tab Row */}
      <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => { Haptics.selectionAsync(); setActiveTab(tab.key); }}
              style={[styles.tabBtn, active && { backgroundColor: colors.card }]}
            >
              <Text style={[styles.tabLabel, {
                color: active ? colors.foreground : colors.mutedForeground,
                fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular",
              }]}>
                {tab.label}
                {tab.count > 0 ? ` (${tab.count})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Available Challenges */}
      {activeTab === "available" && (
        <View style={styles.list}>
          {availableChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color="#10b981" />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                You're in all available challenges!
              </Text>
            </View>
          ) : (
            availableChallenges.map((c) => (
              <ChallengeCard
                key={c.id}
                def={c}
                colors={colors}
                mode="join"
                onJoin={() => handleJoin(c.id)}
              />
            ))
          )}
        </View>
      )}

      {/* Active Challenges */}
      {activeTab === "active" && (
        <View style={styles.list}>
          {activeChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="flash-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No active challenges yet — join one!
              </Text>
              <TouchableOpacity
                onPress={() => setActiveTab("available")}
                style={[styles.joinBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.joinBtnText, { color: colors.primaryForeground }]}>
                  Browse Challenges
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            activeChallenges.map((c) => {
              const uc = store[c.id];
              const today = todayStr();
              const checkedInToday = uc.checkIns.includes(today);
              return (
                <ChallengeCard
                  key={c.id}
                  def={c}
                  colors={colors}
                  mode="active"
                  userChallenge={uc}
                  checkedInToday={checkedInToday}
                  onCheckIn={() => handleCheckIn(c.id)}
                  onLeave={() => handleLeave(c.id)}
                />
              );
            })
          )}
        </View>
      )}

      {/* Completed Challenges */}
      {activeTab === "completed" && (
        <View style={styles.list}>
          {completedChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="ribbon-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No completed challenges yet — keep going!
              </Text>
            </View>
          ) : (
            completedChallenges.map((c) => {
              const uc = store[c.id];
              return (
                <ChallengeCard
                  key={c.id}
                  def={c}
                  colors={colors}
                  mode="completed"
                  userChallenge={uc}
                />
              );
            })
          )}
        </View>
      )}
    </ScrollView>
  );
}

function ChallengeCard({
  def,
  colors,
  mode,
  userChallenge,
  checkedInToday,
  onJoin,
  onCheckIn,
  onLeave,
}: {
  def: ChallengeDefinition;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  mode: "join" | "active" | "completed";
  userChallenge?: UserChallenge;
  checkedInToday?: boolean;
  onJoin?: () => void;
  onCheckIn?: () => void;
  onLeave?: () => void;
}) {
  const pct = userChallenge ? progressPct(userChallenge, def) : 0;
  const left = userChallenge ? daysLeft(userChallenge, def) : def.durationDays;

  return (
    <GlassCard style={[cardStyles.card, { borderColor: def.color + (mode === "active" ? "50" : "25") }]}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.emojiWrap, { backgroundColor: def.color + "20" }]}>
          <Text style={cardStyles.emoji}>{def.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[cardStyles.cardTitle, { color: colors.foreground }]}>{def.title}</Text>
          <View style={[cardStyles.catBadge, { backgroundColor: def.color + "18" }]}>
            <Text style={[cardStyles.catText, { color: def.color }]}>
              {CATEGORY_LABELS[def.category]} · {def.durationDays} days
            </Text>
          </View>
        </View>
        {mode === "completed" && (
          <View style={[cardStyles.doneBadge, { backgroundColor: "#10b98120" }]}>
            <Ionicons name="checkmark-circle" size={22} color="#10b981" />
          </View>
        )}
      </View>

      <Text style={[cardStyles.desc, { color: colors.mutedForeground }]}>{def.description}</Text>

      <View style={[cardStyles.taskRow, { backgroundColor: def.color + "12", borderColor: def.color + "30" }]}>
        <Ionicons name="checkmark-outline" size={14} color={def.color} />
        <Text style={[cardStyles.taskText, { color: def.color }]}>{def.dailyTask}</Text>
      </View>

      {mode === "active" && userChallenge && (
        <>
          <View style={cardStyles.progressRow}>
            <Text style={[cardStyles.progressLabel, { color: colors.mutedForeground }]}>
              Day {userChallenge.checkIns.length}/{def.durationDays} · {left} days left
            </Text>
            <Text style={[cardStyles.progressPct, { color: def.color }]}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
          <View style={[cardStyles.track, { backgroundColor: colors.muted }]}>
            <View style={[cardStyles.fill, { width: `${pct * 100}%`, backgroundColor: def.color }]} />
          </View>
          <View style={cardStyles.actionRow}>
            <AnimatedPressable
              onPress={onCheckIn}
              style={[
                cardStyles.checkInBtn,
                {
                  backgroundColor: checkedInToday ? "#10b98120" : def.color,
                  borderColor: checkedInToday ? "#10b98150" : "transparent",
                  borderWidth: checkedInToday ? 1.5 : 0,
                },
              ]}
              scale={0.96}
            >
              <Ionicons
                name={checkedInToday ? "checkmark-circle-outline" : "add-circle-outline"}
                size={17}
                color={checkedInToday ? "#10b981" : "#fff"}
              />
              <Text style={[cardStyles.checkInText, { color: checkedInToday ? "#10b981" : "#fff" }]}>
                {checkedInToday ? "Done today ✓" : "Check In Today"}
              </Text>
            </AnimatedPressable>
            <TouchableOpacity
              onPress={onLeave}
              style={[cardStyles.leaveBtn, { borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Text style={[cardStyles.leaveText, { color: colors.mutedForeground }]}>Leave</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {mode === "join" && (
        <AnimatedPressable
          onPress={onJoin}
          style={[cardStyles.joinBtn, { backgroundColor: def.color }]}
          scale={0.97}
        >
          <Ionicons name="flash-outline" size={16} color="#fff" />
          <Text style={cardStyles.joinBtnText}>Join Challenge</Text>
        </AnimatedPressable>
      )}

      {mode === "completed" && userChallenge && (
        <View style={[cardStyles.completedBadge, { backgroundColor: "#10b98115", borderColor: "#10b98140" }]}>
          <Text style={[cardStyles.completedText, { color: "#10b981" }]}>
            🎉 Completed {userChallenge.checkIns.length}/{def.durationDays} check-ins — great work!
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

const cardStyles = StyleSheet.create({
  card: { gap: 10, borderWidth: 1.5 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  emojiWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  emoji: { fontSize: 22 },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 3, alignSelf: "flex-start" },
  catText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  doneBadge: { padding: 4, borderRadius: 20 },
  desc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
  },
  taskText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressPct: { fontSize: 13, fontFamily: "Inter_700Bold" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 3 },
  actionRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  checkInBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  checkInText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  leaveBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  leaveText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  joinBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 12, borderRadius: 10,
  },
  joinBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  completedBadge: { borderWidth: 1, borderRadius: 10, padding: 10 },
  completedText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 10 },
  statChip: { flex: 1, alignItems: "center", paddingVertical: 14 },
  statNum: { fontSize: 24, fontFamily: "SpaceGrotesk_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  tabLabel: { fontSize: 13 },
  list: { gap: 14 },
  empty: { alignItems: "center", paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  joinBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 4 },
  joinBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
