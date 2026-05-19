import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  InteractionManager,
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, OviaMessage } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { GlassCard } from "@/components/GlassCard";
import { exportToPdf } from "@/lib/pdf";
import { captureAndShareCard, captureAndSaveCard } from "@/lib/shareCard";
import { isSupabaseConfigured } from "@/lib/supabase";
import ShareProgressCard, { CardThemeId, CardVisibleStats, DEFAULT_THEME_ID, DEFAULT_VISIBLE_STATS } from "@/components/ShareProgressCard";
import CardCustomizationModal, { CardCustomizationResult } from "@/components/CardCustomizationModal";

type Tab = "ovia" | "profile";

const GOAL_LABELS: Record<string, string> = {
  muscle_gain: "Build Muscle",
  weight_loss: "Lose Weight",
  endurance: "Improve Endurance",
  flexibility: "Improve Flexibility",
  build_muscle: "Build Muscle",
  improve_fitness: "Improve Fitness",
  lose_weight: "Lose Weight",
  stress_relief: "Stress Relief",
};

const SUGGESTIONS = [
  "Design my workout plan for this week",
  "What should I eat today to hit my goals?",
  "Help me stay motivated right now",
  "Best supplements for my goals?",
  "How do I recover faster?",
  "What are my next fitness goals?",
];

function getApiBase(): string {
  if (Platform.OS === "web") return "/api";
  const pub = process.env["EXPO_PUBLIC_API_BASE"];
  if (pub) return pub;
  return "http://localhost:80/api";
}

function buildOviaContext(
  user: ReturnType<typeof useFitness>["user"],
  streak: number,
  workoutLogs: ReturnType<typeof useFitness>["workoutLogs"],
  mealLogs: ReturnType<typeof useFitness>["mealLogs"],
  bodyMeasurements: ReturnType<typeof useFitness>["bodyMeasurements"],
  waterIntake: ReturnType<typeof useFitness>["waterIntake"],
  personalRecords: ReturnType<typeof useFitness>["personalRecords"]
) {
  const today = new Date().toISOString().split("T")[0];
  const todayMeals = mealLogs.filter((m) => m.date === today);
  const todayCalories = todayMeals.reduce((s, m) => s + m.calories, 0);
  const todayProtein = todayMeals.reduce((s, m) => s + m.protein, 0);
  const todayCarbs = todayMeals.reduce((s, m) => s + m.carbs, 0);
  const todayFat = todayMeals.reduce((s, m) => s + m.fat, 0);
  const todayWater = waterIntake.find((w) => w.date === today)?.glasses ?? 0;
  const latestMeasurement = bodyMeasurements[0] ?? null;
  const recent = workoutLogs.slice(0, 5).map((w) => ({
    name: w.workoutName,
    calories: w.caloriesBurned,
    date: w.date,
    duration: w.duration,
  }));
  // Meal breakdown by type
  const mealBreakdown = todayMeals.reduce<Record<string, { count: number; calories: number }>>(
    (acc, m) => {
      if (!acc[m.mealType]) acc[m.mealType] = { count: 0, calories: 0 };
      acc[m.mealType].count++;
      acc[m.mealType].calories += m.calories;
      return acc;
    },
    {}
  );
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    goals: user?.goals ?? [],
    weight: user?.weight ?? null,
    height: user?.height ?? null,
    age: user?.age ?? null,
    units: user?.units ?? "metric",
    fitnessLevel: user?.fitnessLevel ?? "intermediate",
    streak,
    recentWorkouts: recent,
    todayCalories: todayCalories || null,
    todayProtein: todayProtein || null,
    todayCarbs: todayCarbs || null,
    todayFat: todayFat || null,
    todayWaterGlasses: todayWater,
    mealBreakdown: Object.keys(mealBreakdown).length > 0 ? mealBreakdown : null,
    latestBodyMeasurement: latestMeasurement
      ? {
          date: latestMeasurement.date,
          weight: latestMeasurement.weight,
          chest: latestMeasurement.chest,
          waist: latestMeasurement.waist,
          hips: latestMeasurement.hips,
          arms: latestMeasurement.arms,
          thighs: latestMeasurement.thighs,
        }
      : null,
    personalRecords: personalRecords.slice(0, 5),
  };
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    user,
    oviaMessages,
    addOviaMessage,
    streak,
    workoutLogs,
    mealLogs,
    bodyMeasurements,
    waterIntake,
    personalRecords,
    settings,
  } = useFitness();
  const { signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("ovia");
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [cardAction, setCardAction] = useState<"share" | "save">("share");
  const [cardVisibleStats, setCardVisibleStats] = useState<CardVisibleStats>({ ...DEFAULT_VISIBLE_STATS });
  const [cardCustomMessage, setCardCustomMessage] = useState("");
  const [cardThemeId, setCardThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);

  const cardRef = useRef<View>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const flatListRef = useRef<FlatList>(null);

  const primaryGoal = user?.goals?.[0] ?? "improve_fitness";

  async function handleSend() {
    if (!chatInput.trim() || isTyping) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const userMsg = chatInput.trim();
    setChatInput("");
    addOviaMessage({ role: "user", content: userMsg });
    setIsTyping(true);

    const allMessages = [
      ...oviaMessages,
      { id: "pending", role: "user" as const, content: userMsg },
    ].map((m) => ({ role: m.role, content: m.content }));

    const userContext = buildOviaContext(user, streak, workoutLogs, mealLogs, bodyMeasurements, waterIntake, personalRecords);

    try {
      const response = await fetch(`${getApiBase()}/ovia/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, userContext }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6)) as {
              content?: string;
              done?: boolean;
              error?: string;
              searching?: string;
            };
            if (json.content) fullContent += json.content;
            if (json.done || json.error) break;
          } catch {
            // skip
          }
        }
      }

      addOviaMessage({
        role: "assistant",
        content: fullContent || "I could not generate a response. Please try again.",
      });
    } catch {
      addOviaMessage({
        role: "assistant",
        content:
          `Sorry ${user?.name?.split(" ")[0] ?? "Champion"}, I am having trouble connecting right now. Please check your internet connection and try again.`,
      });
    } finally {
      setIsTyping(false);
    }
  }

  async function handleExportPdf() {
    setExportLoading(true);
    try {
      await exportToPdf({
        isOnboarded: true,
        isLoggedIn: true,
        user,
        workoutLogs,
        mealLogs,
        bodyMeasurements,
        waterIntake,
        streak,
        personalRecords,
        settings,
        oviaMessages,
      });
    } catch (e) {
      Alert.alert("Export failed", "Could not generate PDF. Please try again.");
    }
    setExportLoading(false);
  }

  function handleShareProgress() {
    setCardAction("share");
    setShowCustomizeModal(true);
  }

  function handleSaveToLibrary() {
    setCardAction("save");
    setShowCustomizeModal(true);
  }

  async function handleGenerateCard({ visibleStats, customMessage, themeId }: CardCustomizationResult) {
    setCardVisibleStats(visibleStats);
    setCardCustomMessage(customMessage);
    setCardThemeId(themeId);
    const isSave = cardAction === "save";
    if (isSave) {
      setSaveLoading(true);
    } else {
      setShareLoading(true);
    }
    // Wait for all pending interactions and layout to finish before capturing
    // so the offscreen card has fully re-rendered with the new props.
    InteractionManager.runAfterInteractions(async () => {
      try {
        if (isSave) {
          const saved = await captureAndSaveCard(cardRef);
          if (saved) {
            Alert.alert("Saved!", "Your progress card has been saved to your camera roll.");
          }
        } else {
          await captureAndShareCard(cardRef);
        }
      } catch (e) {
        Alert.alert(
          isSave ? "Save failed" : "Share failed",
          "Could not generate progress card. Please try again."
        );
      }
      setSaveLoading(false);
      setShareLoading(false);
      setShowCustomizeModal(false);
    });
  }

  async function handleLogout() {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await signOut();
            if (!isSupabaseConfigured) {
              Alert.alert("Signed out", "You have been signed out.");
            }
          },
        },
      ]
    );
  }

  // Compute card props (sort measurements by date so first=oldest, last=newest)
  const sortedMeasurements = [...bodyMeasurements].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const startWeight = sortedMeasurements[0]?.weight ?? user?.weight ?? 0;
  const latestWeight =
    sortedMeasurements[sortedMeasurements.length - 1]?.weight ?? user?.weight ?? 0;
  const weightDelta = startWeight > 0 ? +(startWeight - latestWeight).toFixed(1) : 0;
  const cardProps = {
    userName: user?.name ?? "Athlete",
    goalLabel: (user?.goals?.[0] ?? "improve_fitness")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
    streak,
    totalWorkouts: workoutLogs.length,
    totalCalBurned: workoutLogs.reduce((s, l) => s + l.caloriesBurned, 0),
    totalMinutes: workoutLogs.reduce((s, l) => s + l.duration, 0),
    weightDelta,
    weightUnit: settings.weightUnit,
    topPR: personalRecords[0] ?? null,
    date: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Off-screen progress card for ViewShot capture */}
      <View style={styles.offScreen} pointerEvents="none">
        <ShareProgressCard
          ref={cardRef}
          {...cardProps}
          visibleStats={cardVisibleStats}
          customMessage={cardCustomMessage}
          themeId={cardThemeId}
        />
      </View>

      {/* Card customization modal */}
      <CardCustomizationModal
        visible={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onGenerate={handleGenerateCard}
        generating={shareLoading || saveLoading}
        cardPreviewData={cardProps}
      />

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

      {/* ── OVIA TAB ── */}
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
            contentContainerStyle={[styles.chatContent, { paddingBottom: isTyping ? 60 : 16 }]}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            showsVerticalScrollIndicator={false}
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
                <Text style={[styles.oviaName, { color: colors.foreground }]}>Ovia AI</Text>
                <Text style={[styles.oviaSubtitle, { color: colors.mutedForeground }]}>
                  World-class fitness coach, nutritionist and mindset mentor
                </Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setChatInput(s)}
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
                <View style={styles.typingRow}>
                  <View
                    style={[
                      styles.typingBubble,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={[styles.tDot, { backgroundColor: colors.mutedForeground }]} />
                    <View style={[styles.tDot, { backgroundColor: colors.mutedForeground }]} />
                    <View style={[styles.tDot, { backgroundColor: colors.mutedForeground }]} />
                  </View>
                </View>
              ) : null
            }
          />

          {/* Chat input */}
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
              placeholder="Ask Ovia about fitness, nutrition, health..."
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
                { backgroundColor: chatInput.trim() ? colors.primary : colors.muted },
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
        /* ── PROFILE TAB ── */
        <ScrollView
          contentContainerStyle={[
            styles.profileContent,
            { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/edit-profile")}
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.primary + "20", borderColor: colors.primary + "40" },
              ]}
            >
              <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                {(user?.name ?? "A").charAt(0).toUpperCase()}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {user?.name ?? "Athlete"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {user?.email ?? ""}
            </Text>
            <Text style={[styles.profileGoal, { color: colors.mutedForeground }]}>
              Goal: {GOAL_LABELS[primaryGoal] ?? "Improve Fitness"}
            </Text>
          </View>

          {/* Stats */}
          <View style={styles.profileStats}>
            <ProfileStat label="Streak" value={`${streak}d`} icon="flame" color={colors.warning} />
            <ProfileStat
              label="Workouts"
              value={`${workoutLogs.length}`}
              icon="barbell-outline"
              color={colors.primary}
            />
            <ProfileStat
              label="Age"
              value={`${user?.age ?? "—"}`}
              icon="person-outline"
              color={colors.secondary}
            />
          </View>

          {/* Info card */}
          <GlassCard style={styles.infoCard}>
            <InfoRow
              label="Weight"
              value={`${user?.weight ?? "—"} ${user?.units === "imperial" ? "lbs" : "kg"}`}
              icon="scale-outline"
            />
            <InfoRow
              label="Height"
              value={`${user?.height ?? "—"} ${user?.units === "imperial" ? "in" : "cm"}`}
              icon="resize-outline"
            />
            <InfoRow
              label="Fitness Level"
              value={
                user?.fitnessLevel
                  ? user.fitnessLevel.charAt(0).toUpperCase() + user.fitnessLevel.slice(1)
                  : "—"
              }
              icon="trophy-outline"
            />
          </GlassCard>

          {/* Account actions */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="create-outline"
              label="Edit Profile"
              color={colors.primary}
              onPress={() => router.push("/edit-profile")}
            />
            <ActionRow
              icon="share-social-outline"
              label={shareLoading ? "Creating Card…" : "Share Progress"}
              color={colors.accent}
              onPress={handleShareProgress}
              loading={shareLoading}
            />
            <ActionRow
              icon="image-outline"
              label={saveLoading ? "Saving to Photos…" : "Save Card to Camera Roll"}
              color={colors.primary}
              onPress={handleSaveToLibrary}
              loading={saveLoading}
            />
            <ActionRow
              icon="document-text-outline"
              label={exportLoading ? "Generating PDF…" : "Export Data as PDF"}
              color={colors.secondary}
              onPress={handleExportPdf}
              loading={exportLoading}
            />
            <ActionRow
              icon="notifications-outline"
              label="Reminders & Notifications"
              color={colors.accent}
              onPress={() => router.push("/reminders")}
            />
            <ActionRow
              icon="shield-checkmark-outline"
              label="Privacy & Security"
              color={colors.warning}
              onPress={() =>
                Alert.alert("Privacy", "Your data is stored securely and never shared.")
              }
            />
            <ActionRow
              icon="help-circle-outline"
              label="Help & Support"
              color={colors.mutedForeground}
              onPress={() =>
                Alert.alert("Support", "Email us at support@raimzeal.com")
              }
            />
            <ActionRow
              icon="log-out-outline"
              label="Sign Out"
              color={colors.destructive}
              onPress={handleLogout}
              isLast
            />
          </GlassCard>

          {/* App version */}
          <Text style={[styles.version, { color: colors.mutedForeground }]}>
            RAIMZEAL v1.0.0
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

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
        <Text style={[styles.bubbleText, { color: isUser ? colors.primaryForeground : colors.foreground }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function ProfileStat({
  label, value, icon, color,
}: {
  label: string; value: string; icon: keyof typeof Ionicons.glyphMap; color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.profileStatItem, { backgroundColor: color + "15", borderColor: color + "30" }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.profileStatValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={16} color={colors.mutedForeground} />
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  );
}

function ActionRow({
  icon, label, color, onPress, loading, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  loading?: boolean;
  isLast?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={loading}
      style={[
        styles.actionRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
      {loading ? (
        <ActivityIndicator size="small" color={colors.mutedForeground} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  offScreen: { position: "absolute", left: -9999, top: 0, opacity: 0 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, gap: 12 },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  tabRow: { flexDirection: "row", borderRadius: 10, padding: 3 },
  tabBtn: {
    flex: 1, paddingVertical: 7, borderRadius: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  tabLabel: { fontSize: 14 },
  // Chat
  chatContent: { padding: 16, gap: 12 },
  oviaHero: { alignItems: "center", paddingVertical: 24, gap: 8 },
  oviaAvatar: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  oviaName: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  oviaSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  suggestion: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  suggestionText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  bubbleRowUser: { justifyContent: "flex-end" },
  smallAvatar: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", padding: 12, borderRadius: 16 },
  userBubble: { borderBottomRightRadius: 4 },
  assistantBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  typingRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 8 },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 4, padding: 12, borderRadius: 16, borderWidth: 1 },
  tDot: { width: 6, height: 6, borderRadius: 3 },
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 10, borderTopWidth: 1 },
  chatInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  // Profile
  profileContent: { padding: 16, gap: 16 },
  avatarSection: { alignItems: "center", gap: 6, paddingVertical: 16 },
  avatarCircle: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarInitial: { fontSize: 36, fontFamily: "SpaceGrotesk_700Bold" },
  profileName: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileGoal: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileStats: { flexDirection: "row", gap: 10 },
  profileStatItem: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 4 },
  profileStatValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  profileStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoCard: { padding: 0, overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  actionsCard: { padding: 0, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  actionIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
