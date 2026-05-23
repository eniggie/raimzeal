import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
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
import { useAuth } from "@/contexts/AuthContext";

const SUGGESTIONS = [
  "Design my workout plan for this week",
  "What should I eat today to hit my goals?",
  "Help me stay motivated right now",
  "Best supplements for my goals?",
  "How do I recover faster?",
  "What are my next fitness goals?",
];

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/gs, "$1")
    .replace(/\*(.+?)\*/gs, "$1")
    .replace(/#{1,6}\s?/g, "")
    .replace(/`(.+?)`/gs, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^\s*[-*+]\s/gm, "• ")
    .trim();
}

function getApiBase(): string {
  if (Platform.OS === "web") return "/api";
  // EXPO_PUBLIC_DOMAIN is injected as $REPLIT_DEV_DOMAIN by the workflow
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  if (domain) return `https://${domain}/api`;
  const explicit = process.env["EXPO_PUBLIC_API_BASE"];
  if (explicit) return explicit;
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
    goals: user?.goals ?? [],
    weight: user?.weight ?? null,
    height: user?.height ?? null,
    age: user?.age ?? null,
    units: user?.units ?? "metric",
    fitnessLevel: user?.fitnessLevel ?? "intermediate",
    bloodGroup: user?.bloodType && user?.rhFactor ? `${user.bloodType}${user.rhFactor}` : (user?.bloodType ?? null),
    genotype: user?.genotype ?? null,
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

export default function OviaScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
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
  } = useFitness();

  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  // Tab bar height: ~49px icon area + bottom safe area inset, floats above content
  const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 49;
  // Header height used so KAV knows how far from the top the keyboard-avoiding
  // region starts (prevents the input from shooting too high on iOS).
  const headerHeight = topPad + 16 + 44 + 12; // paddingTop + titleFontApprox + paddingBottom

  // Weekly Ovia digest — fires once per 7 days on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAndSendWeeklyDigest() {
      if (isTyping || !session?.access_token) return;
      try {
        const AsyncStorage = (
          await import("@react-native-async-storage/async-storage")
        ).default;
        const WEEKLY_KEY = "ovia_weekly_msg_date";
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const lastStr = await AsyncStorage.getItem(WEEKLY_KEY);
        const now = Date.now();
        const shouldSend = !lastStr || now - parseInt(lastStr, 10) >= WEEK_MS;
        if (!shouldSend || cancelled) return;
        await AsyncStorage.setItem(WEEKLY_KEY, now.toString());
        if (cancelled) return;
        setIsTyping(true);
        const userCtx = buildOviaContext(
          user, streak, workoutLogs, mealLogs, bodyMeasurements, waterIntake, personalRecords
        );
        const response = await fetch(`${getApiBase()}/ovia/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: [], userContext: userCtx, weeklyDigest: true }),
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
              };
              if (json.content) fullContent += json.content;
              if (json.done || json.error) break;
            } catch { }
          }
        }
        if (cancelled) return;
        addOviaMessage({
          role: "assistant",
          content:
            stripMarkdown(fullContent) ||
            `Welcome back, ${user?.name?.split(" ")[0] ?? "Champion"}! Here is your weekly Ovia AI check-in. Keep pushing — you are building something extraordinary.`,
        });
      } catch {
        // silent fail — weekly digest is best-effort
      } finally {
        if (!cancelled) setIsTyping(false);
      }
    }

    const timer = setTimeout(checkAndSendWeeklyDigest, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Core send — accepts the message directly so suggestion chips can auto-send
  async function handleSendMessage(msg: string) {
    if (!msg.trim() || isTyping) return;
    if (!session?.access_token) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChatInput("");
    addOviaMessage({ role: "user", content: msg });
    setIsTyping(true);

    const allMessages = [
      ...oviaMessages,
      { id: "pending", role: "user" as const, content: msg },
    ].map((m) => ({ role: m.role, content: m.content }));

    const userContext = buildOviaContext(
      user, streak, workoutLogs, mealLogs, bodyMeasurements, waterIntake, personalRecords
    );

    let accumulated = "";
    try {
      const response = await fetch(`${getApiBase()}/ovia/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: allMessages, userContext }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error("No response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
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
            };
            if (json.content) {
              accumulated += json.content;
              setStreamingContent(accumulated);
            }
            if (json.done || json.error) {
              streamDone = true;
              break;
            }
          } catch { }
        }
      }
      addOviaMessage({
        role: "assistant",
        content: stripMarkdown(accumulated) || "I could not generate a response. Please try again.",
      });
    } catch {
      addOviaMessage({
        role: "assistant",
        content: `Sorry ${user?.name?.split(" ")[0] ?? "Champion"}, I am having trouble connecting right now. Please check your connection and try again.`,
      });
    } finally {
      setStreamingContent("");
      setIsTyping(false);
    }
  }

  // Called by the send button and keyboard return
  async function handleSend() {
    await handleSendMessage(chatInput.trim());
  }

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Ovia AI</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight + TAB_BAR_HEIGHT + bottomPad : 0}
      >
        <FlatList
          ref={flatListRef}
          data={oviaMessages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
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
                Fitness coach, wellness guide and mindset mentor
              </Text>
              <View style={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => handleSendMessage(s)}
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
              streamingContent ? (
                /* Live streaming bubble — shows content as it arrives */
                <View style={[styles.bubbleRow]}>
                  <View style={[styles.smallAvatar, { backgroundColor: colors.accent + "20" }]}>
                    <Ionicons name="sparkles" size={12} color={colors.accent} />
                  </View>
                  <View
                    style={[
                      styles.bubble,
                      styles.assistantBubble,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.bubbleText, { color: colors.foreground }]}>
                      {streamingContent}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Waiting dots — shown before first chunk arrives */
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
              )
            ) : null
          }
        />

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + TAB_BAR_HEIGHT,
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
        <Text style={[styles.bubbleText, { color: isUser ? colors.primaryForeground : colors.foreground }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  chatContent: { padding: 16, gap: 12 },
  oviaHero: { alignItems: "center", paddingVertical: 24, gap: 8 },
  oviaAvatar: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  oviaName: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  oviaSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
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
});
