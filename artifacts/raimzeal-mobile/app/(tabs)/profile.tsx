import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, OviaMessage } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";

type Tab = "ovia" | "profile";

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Lose Weight",
  build_muscle: "Build Muscle",
  maintain: "Maintain Weight",
  improve_fitness: "Improve Fitness",
};

const OVIA_RESPONSES: Record<string, string[]> = {
  workout: [
    "Your workout plan is on point! Focus on progressive overload — add 2.5kg each week.",
    "Based on your history, Upper Body days are your strongest. Keep it up!",
    "Remember to warm up for 5-10 minutes before each session to prevent injury.",
  ],
  nutrition: [
    "You're hitting your protein goals well! Make sure to spread intake across 4-5 meals.",
    "Try adding more complex carbs around your workouts for better energy.",
    "Hydration matters! Aim for 3L of water on training days.",
  ],
  progress: [
    "You're trending in the right direction! Consistency is the key.",
    "Your 7-day streak is impressive. Most people give up in week 2!",
    "Small daily improvements lead to massive results. Trust the process.",
  ],
  default: [
    "Great question! Consistency is your best friend in fitness.",
    "Based on your profile, I recommend focusing on compound movements first.",
    "Recovery is just as important as training. Are you getting 7-8 hours of sleep?",
    "Let's break this down: set a small goal for today, and build from there.",
    "Your dedication is showing! Keep up the great momentum.",
  ],
};

function getOviaResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("workout") || lower.includes("exercise") || lower.includes("train")) {
    return OVIA_RESPONSES.workout[Math.floor(Math.random() * OVIA_RESPONSES.workout.length)];
  }
  if (lower.includes("eat") || lower.includes("food") || lower.includes("nutrition") || lower.includes("calorie")) {
    return OVIA_RESPONSES.nutrition[Math.floor(Math.random() * OVIA_RESPONSES.nutrition.length)];
  }
  if (lower.includes("progress") || lower.includes("weight") || lower.includes("goal")) {
    return OVIA_RESPONSES.progress[Math.floor(Math.random() * OVIA_RESPONSES.progress.length)];
  }
  return OVIA_RESPONSES.default[Math.floor(Math.random() * OVIA_RESPONSES.default.length)];
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, oviaMessages, addOviaMessage, updateProfile, streak, workoutLogs } = useFitness();

  const [activeTab, setActiveTab] = useState<Tab>("ovia");
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const flatListRef = useRef<FlatList>(null);

  function handleSend() {
    if (!chatInput.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg = chatInput.trim();
    setChatInput("");
    addOviaMessage({ role: "user", content: userMsg });
    setIsTyping(true);
    setTimeout(() => {
      addOviaMessage({ role: "assistant", content: getOviaResponse(userMsg) });
      setIsTyping(false);
    }, 900 + Math.random() * 600);
  }

  const SUGGESTIONS = [
    "How should I train this week?",
    "Review my nutrition",
    "Help me stay motivated",
    "What are my next goals?",
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
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
          {activeTab === "ovia" ? "Ovia AI" : "Profile"}
        </Text>
        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["ovia", "profile"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabBtn,
                activeTab === tab && { backgroundColor: colors.card },
              ]}
            >
              <Ionicons
                name={tab === "ovia" ? "chatbubble-ellipses-outline" : "person-outline"}
                size={16}
                color={activeTab === tab ? colors.foreground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: activeTab === tab ? colors.foreground : colors.mutedForeground,
                    fontFamily: activeTab === tab ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {tab === "ovia" ? "Ovia AI" : "Profile"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {activeTab === "ovia" ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={flatListRef}
            data={oviaMessages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.chatContent,
              { paddingBottom: isTyping ? 60 : 16 },
            ]}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListHeaderComponent={
              <View style={styles.oviaHero}>
                <View
                  style={[
                    styles.oviaAvatar,
                    { backgroundColor: colors.accent + "20", borderColor: colors.accent + "40" },
                  ]}
                >
                  <Ionicons name="sparkles" size={28} color={colors.accent} />
                </View>
                <Text style={[styles.oviaName, { color: colors.foreground }]}>
                  Ovia AI Coach
                </Text>
                <Text style={[styles.oviaSubtitle, { color: colors.mutedForeground }]}>
                  Your personal fitness intelligence
                </Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setChatInput(s);
                      }}
                      style={[
                        styles.suggestion,
                        { backgroundColor: colors.muted, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.suggestionText, { color: colors.foreground }]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => <ChatBubble message={item} />}
            ListFooterComponent={
              isTyping ? (
                <View style={styles.typingIndicator}>
                  <View
                    style={[
                      styles.typingBubble,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }]} />
                    <View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }]} />
                    <View style={[styles.typingDot, { backgroundColor: colors.mutedForeground }]} />
                  </View>
                </View>
              ) : null
            }
          />
          <View
            style={[
              styles.inputBar,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: bottomPad + (Platform.OS === "web" ? 84 : 0),
              },
            ]}
          >
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              placeholder="Ask Ovia anything..."
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.chatInput,
                {
                  backgroundColor: colors.muted,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!chatInput.trim()}
              style={[
                styles.sendBtn,
                {
                  backgroundColor: chatInput.trim() ? colors.primary : colors.muted,
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={chatInput.trim() ? colors.primaryForeground : colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.profileContent,
            {
              paddingBottom: Platform.OS === "web" ? 34 + 84 : 100,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {profile.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {profile.name}
            </Text>
            <Text style={[styles.profileGoal, { color: colors.mutedForeground }]}>
              Goal: {GOAL_LABELS[profile.goal]}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.profileStats}>
            <ProfileStat label="Streak" value={`${streak}d`} icon="flame" color="#f59e0b" />
            <ProfileStat label="Workouts" value={`${workoutLogs.length}`} icon="barbell-outline" color="#a3e635" />
            <ProfileStat label="Age" value={`${profile.age}`} icon="person-outline" color="#00d2eb" />
          </View>

          {/* Info Cards */}
          <GlassCard style={styles.infoCard}>
            <InfoRow label="Weight" value={`${profile.weight} kg`} icon="scale-outline" />
            <InfoRow label="Height" value={`${profile.height} cm`} icon="resize-outline" />
            <InfoRow label="Weekly Target" value={`${profile.weeklyTarget} workouts`} icon="calendar-outline" />
          </GlassCard>

          {/* Goals */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Goal
          </Text>
          <View style={styles.goalPicker}>
            {Object.entries(GOAL_LABELS).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  Haptics.selectionAsync();
                  updateProfile({ goal: key as typeof profile.goal });
                }}
                style={[
                  styles.goalBtn,
                  {
                    backgroundColor:
                      profile.goal === key
                        ? colors.primary + "20"
                        : colors.muted,
                    borderColor:
                      profile.goal === key ? colors.primary + "60" : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={
                    key === "lose_weight"
                      ? "trending-down-outline"
                      : key === "build_muscle"
                      ? "barbell-outline"
                      : key === "maintain"
                      ? "checkmark-circle-outline"
                      : "flash-outline"
                  }
                  size={18}
                  color={profile.goal === key ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.goalLabel,
                    {
                      color:
                        profile.goal === key ? colors.primary : colors.mutedForeground,
                      fontFamily:
                        profile.goal === key ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Settings */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Settings
          </Text>
          <GlassCard style={styles.settingsCard}>
            {[
              { icon: "notifications-outline" as const, label: "Notifications" },
              { icon: "moon-outline" as const, label: "Dark Mode" },
              { icon: "share-outline" as const, label: "Share Progress" },
              { icon: "shield-checkmark-outline" as const, label: "Privacy" },
            ].map((s, i) => (
              <SettingsRow key={s.label} icon={s.icon} label={s.label} isLast={i === 3} />
            ))}
          </GlassCard>
        </ScrollView>
      )}
    </View>
  );
}

function ChatBubble({ message }: { message: OviaMessage }) {
  const colors = useColors();
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.smallAvatar, { backgroundColor: colors.accent + "20" }]}>
          <Ionicons name="sparkles" size={12} color={colors.accent} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.userBubble, { backgroundColor: colors.primary }]
            : [styles.assistantBubble, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function ProfileStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.profileStatItem, { backgroundColor: color + "15", borderColor: color + "30" }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.profileStatValue, { color: colors.foreground }]}>
        {value}
      </Text>
      <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function SettingsRow({
  icon,
  label,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  isLast: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[
        styles.settingsRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <Ionicons name={icon} size={18} color={colors.mutedForeground} />
      <Text style={[styles.settingsLabel, { color: colors.foreground }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
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
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  tabRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabLabel: { fontSize: 14 },
  chatContent: { padding: 16, gap: 12 },
  oviaHero: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  oviaAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  oviaName: { fontSize: 20, fontFamily: "Inter_700Bold" },
  oviaSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 8,
  },
  bubbleRowUser: { justifyContent: "flex-end" },
  smallAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    maxWidth: "78%",
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  typingIndicator: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  profileContent: { padding: 16, gap: 16 },
  avatarSection: { alignItems: "center", gap: 8, paddingVertical: 16 },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  avatarInitial: { fontSize: 36, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  profileGoal: { fontSize: 14, fontFamily: "Inter_400Regular" },
  profileStats: { flexDirection: "row", gap: 10 },
  profileStatItem: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  profileStatValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  profileStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoCard: { padding: 0, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  goalPicker: { gap: 8 },
  goalBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  goalLabel: { fontSize: 14 },
  settingsCard: { padding: 0, overflow: "hidden" },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingsLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
});
