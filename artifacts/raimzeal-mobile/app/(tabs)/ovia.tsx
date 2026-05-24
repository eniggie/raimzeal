import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, OviaMessage } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";

const SUGGESTIONS = [
  "Design my food plan for this week 🥗",
  "What foods suit my blood group? 🩸",
  "Create my meal plan for today 🍽️",
  "What vitamins do I need? 💊",
  "Design my workout plan 💪",
  "How do I recover faster? ⚡",
  "Help me sleep better 😴",
  "What should I eat for fat loss? 🔥",
  "Check my protein intake 🥩",
  "Give me a breathing exercise 🌬️",
  "Explain genotype diets for AS 🧬",
  "What's my BMI and is it healthy? 📊",
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
  const router = useRouter();
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
    updateProfile,
  } = useFitness();

  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const recognitionRef = useRef<unknown>(null);

  // Stop recognition when the screen unmounts (e.g. user switches tabs mid-recording)
  useEffect(() => {
    return () => {
      const rec = recognitionRef.current as Record<string, unknown> | null;
      if (rec) {
        try { (rec["stop"] as () => void)(); } catch { /* ignore */ }
      }
    };
  }, []);

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
      if (response.status === 429) {
        const firstName = user?.name?.split(" ")[0] ?? "Champion";
        addOviaMessage({
          role: "assistant",
          content: `Hey ${firstName}! 😅 You've hit your 15 message daily limit. Your quota resets every 24 hours. Come back tomorrow and let's keep crushing those goals! 🔥`,
        });
        setQuotaRemaining(0);
        return;
      }
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
              quotaRemaining?: number;
              searching?: string;
              profileUpdated?: Record<string, unknown>;
            };
            if (typeof json.quotaRemaining === "number") {
              setQuotaRemaining(json.quotaRemaining);
            }
            if (json.profileUpdated) {
              const p = json.profileUpdated;
              updateProfile({
                ...(p["name"] ? { name: p["name"] as string } : {}),
                ...(p["age"] !== undefined ? { age: p["age"] as number } : {}),
                ...(p["weight"] !== undefined ? { weight: p["weight"] as number } : {}),
                ...(p["height"] !== undefined ? { height: p["height"] as number } : {}),
                ...(p["blood_type"] ? { bloodType: p["blood_type"] as "A" | "B" | "AB" | "O" } : {}),
                ...(p["rh_factor"] ? { rhFactor: p["rh_factor"] as "+" | "-" } : {}),
                ...(p["genotype"] ? { genotype: p["genotype"] as "AA" | "AS" | "AC" | "SS" | "SC" } : {}),
                ...(p["fitness_level"] ? { fitnessLevel: p["fitness_level"] as "beginner" | "intermediate" | "advanced" } : {}),
                ...(p["goals"] ? { goals: p["goals"] as string[] } : {}),
                ...(p["units"] ? { units: p["units"] as "metric" | "imperial" } : {}),
              });
            }
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
    } catch (err) {
      const isNetworkError = err instanceof TypeError && String(err.message).toLowerCase().includes("fetch");
      addOviaMessage({
        role: "assistant",
        content: isNetworkError
          ? `Sorry ${user?.name?.split(" ")[0] ?? "Champion"}, I could not reach the server. Make sure you have an internet connection and try again.`
          : `Sorry ${user?.name?.split(" ")[0] ?? "Champion"}, something went wrong on my end. Please try again in a moment.`,
      });
    } finally {
      setStreamingContent("");
      setIsTyping(false);
    }
  }

  // Called by the send button and keyboard return
  async function handleSend() {
    if (isRecording) stopVoice();
    await handleSendMessage(chatInput.trim());
  }

  function stopVoice() {
    const rec = recognitionRef.current as Record<string, unknown> | null;
    if (rec) (rec["stop"] as () => void)();
    setIsRecording(false);
    setInterimText("");
  }

  function toggleVoice() {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Voice Input",
        "Tap the microphone key on your keyboard to dictate, or type your message below.",
        [{ text: "Got it" }]
      );
      return;
    }

    type AnyRec = Record<string, unknown>;
    const w = window as unknown as AnyRec;
    const SR = (w["SpeechRecognition"] ?? w["webkitSpeechRecognition"]) as
      | (new () => AnyRec)
      | undefined;

    if (!SR) {
      Alert.alert("Not Supported", "Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) { stopVoice(); return; }

    const rec: AnyRec = new SR();
    rec["continuous"] = true;
    rec["interimResults"] = true;
    rec["lang"] = "en-US";

    rec["onresult"] = (e: unknown) => {
      const event = e as AnyRec;
      const results = event["results"] as {
        [i: number]: { [j: number]: { transcript: string }; isFinal: boolean };
        length: number;
      };
      const startIdx = event["resultIndex"] as number;
      let interim = "";
      for (let i = startIdx; i < results.length; i++) {
        const r = results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) setChatInput((prev) => (prev ? `${prev} ${t}` : t));
          setInterimText("");
        } else {
          interim += r[0].transcript;
        }
      }
      if (interim) setInterimText(interim);
    };

    rec["onend"] = () => { setIsRecording(false); setInterimText(""); };
    rec["onerror"] = () => { setIsRecording(false); setInterimText(""); };

    recognitionRef.current = rec;
    (rec["start"] as () => void)();
    setIsRecording(true);
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
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Ovia AI</Text>
          {quotaRemaining !== null && (
            <View style={[
              styles.quotaBadge,
              { backgroundColor: quotaRemaining <= 3 ? colors.accent + "20" : colors.muted,
                borderColor: quotaRemaining <= 3 ? colors.accent + "60" : colors.border }
            ]}>
              <Text style={[
                styles.quotaText,
                { color: quotaRemaining <= 3 ? colors.accent : colors.mutedForeground }
              ]}>
                {quotaRemaining} left today
              </Text>
            </View>
          )}
        </View>
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
                Food therapy, fitness, nutrition & healthcare 🔥
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

              {/* Membership upgrade hint */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push("/membership");
                }}
                style={[styles.upgradeHint, { backgroundColor: "#F59E0B10", borderColor: "#F59E0B40" }]}
              >
                <Ionicons name="star" size={14} color="#F59E0B" />
                <Text style={[styles.upgradeHintText, { color: colors.mutedForeground }]}>
                  Rise — 200 msgs/day · Reign — 500 · Legacy — unlimited
                </Text>
                <Text style={{ fontSize: 11, color: "#F59E0B", fontFamily: "Inter_600SemiBold" }}>
                  Upgrade →
                </Text>
              </TouchableOpacity>
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
          {/* Mic button */}
          <TouchableOpacity
            onPress={toggleVoice}
            style={[
              styles.micBtn,
              {
                backgroundColor: isRecording ? colors.accent + "20" : colors.muted,
                borderColor: isRecording ? colors.accent : colors.border,
              },
            ]}
          >
            <Ionicons
              name={isRecording ? "mic" : "mic-outline"}
              size={18}
              color={isRecording ? colors.accent : colors.mutedForeground}
            />
          </TouchableOpacity>

          <TextInput
            value={isRecording && interimText ? interimText : chatInput}
            onChangeText={isRecording ? undefined : setChatInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isRecording}
            placeholder={isRecording ? "🎙 Listening..." : "Ask Ovia about fitness, nutrition, health..."}
            placeholderTextColor={isRecording ? colors.accent : colors.mutedForeground}
            style={[
              styles.chatInput,
              {
                backgroundColor: isRecording ? colors.accent + "10" : colors.muted,
                color: isRecording ? colors.accent : colors.foreground,
                borderColor: isRecording ? colors.accent + "60" : colors.border,
              },
            ]}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!chatInput.trim() && !interimText}
            style={[
              styles.sendBtn,
              { backgroundColor: (chatInput.trim() || interimText) ? colors.primary : colors.muted },
            ]}
          >
            <Ionicons
              name="arrow-up"
              size={18}
              color={(chatInput.trim() || interimText) ? colors.primaryForeground : colors.mutedForeground}
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
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  quotaBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  quotaText: { fontSize: 11, fontFamily: "Inter_500Medium" },
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
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 10, gap: 8, borderTopWidth: 1 },
  chatInput: { flex: 1, height: 44, borderRadius: 22, paddingHorizontal: 16, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  upgradeHint: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14, marginHorizontal: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  upgradeHintText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
});
