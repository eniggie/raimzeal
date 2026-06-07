import React, { useCallback, useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
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
import { usePermissionToast } from "@/hooks/usePermissionToast";
import { useFitness, OviaMessage } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBase } from "@/lib/db";

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

  const { showPermissionToast, permissionToastElement } = usePermissionToast();

  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  // ── AI Tools panel state ────────────────────────────────────────────────────
  type AiToolResult = { title: string; content: unknown } | null;
  const [aiToolLoading, setAiToolLoading] = useState<"workout" | "meal" | "body" | null>(null);
  const [aiToolResult, setAiToolResult] = useState<AiToolResult>(null);
  const [aiToolModalVisible, setAiToolModalVisible] = useState(false);
  // Holds the AbortController for the active Ovia streaming request so we can
  // cancel it cleanly when the screen unmounts or the user navigates away.
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Stop any active recording (and cancel any in-flight stream) when the screen
  // unmounts or the user switches tabs.
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
        Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
        recordingRef.current = null;
      }
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = null;
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
        if (!response.body) throw new Error("No response body from Ovia");
        const reader = response.body.getReader();
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
    const abortController = new AbortController();
    fetchAbortRef.current = abortController;
    try {
      const response = await fetch(`${getApiBase()}/ovia/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: allMessages, userContext }),
        signal: abortController.signal,
      });
      if (response.status === 429) {
        const firstName = user?.name?.split(" ")[0] ?? "Champion";
        let limitMsg = "daily limit";
        try {
          const errBody = (await response.json()) as { error?: string };
          if (errBody?.error) limitMsg = errBody.error;
        } catch { /* use fallback */ }
        addOviaMessage({
          role: "assistant",
          content: `Hey ${firstName}! 😅 ${limitMsg} Your quota resets every 24 hours. Come back tomorrow and let's keep crushing those goals! 🔥`,
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
              setStreamingContent(stripMarkdown(accumulated));
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
      // AbortError is a deliberate cancellation (screen unmount / tab switch) — do not show an error.
      if (err instanceof Error && err.name === "AbortError") return;
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
    if (isRecording) return; // let the user finish recording first
    await handleSendMessage(chatInput.trim());
  }

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        showPermissionToast("Microphone access blocked — tap to open Settings");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      showPermissionToast("Microphone access blocked — tap to open Settings");
    }
  }

  const stopRecordingAndTranscribe = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) { setIsRecording(false); return; }
    setIsRecording(false);
    recordingRef.current = null;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) {
        Alert.alert("Voice Input", "Recording failed — please try again.");
        return;
      }
      if (!session?.access_token) {
        Alert.alert("Voice Input", "Please sign in to use voice input.");
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setInterimText("Transcribing…");

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64",
      });

      const response = await fetch(`${getApiBase()}/ovia/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ audio: base64, mimeType: "audio/m4a" }),
      });

      setInterimText("");

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as { text?: string; error?: string };
      if (data.text) setChatInput(data.text);
    } catch {
      setInterimText("");
      Alert.alert("Voice Input", "Could not transcribe audio. Please try again.");
    }
  }, [session?.access_token, router]);

  function handleVoice() {
    if (isRecording) {
      stopRecordingAndTranscribe();
    } else {
      startRecording();
    }
  }

  // ── AI Tools handlers ───────────────────────────────────────────────────────
  async function runAiTool(tool: "workout" | "meal" | "body") {
    if (!session?.access_token) {
      Alert.alert("Sign in required", "Please sign in to use AI Tools.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAiToolLoading(tool);
    try {
      const userCtx = buildOviaContext(
        user, streak, workoutLogs, mealLogs, bodyMeasurements, waterIntake, personalRecords
      );
      const endpoint =
        tool === "workout" ? "/ovia/workout-plan" :
        tool === "meal"    ? "/ovia/meal-plan"    : "/ovia/body-analysis";
      const res = await fetch(`${getApiBase()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userContext: userCtx }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        Alert.alert("Ovia AI", body.error ?? "Could not generate. Please try again.");
        return;
      }
      const data = await res.json() as Record<string, unknown>;
      const title =
        tool === "workout" ? "Your 7-Day Workout Plan" :
        tool === "meal"    ? "Your 7-Day Meal Plan"    : "Body Composition Analysis";
      const content = data["plan"] ?? data["mealPlan"] ?? data["analysis"];
      setAiToolResult({ title, content });
      setAiToolModalVisible(true);
    } catch {
      Alert.alert("Ovia AI", "Network error. Please check your connection and try again.");
    } finally {
      setAiToolLoading(null);
    }
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

              {/* AI Tools section */}
              <View style={styles.aiToolsSection}>
                <Text style={[styles.aiToolsLabel, { color: colors.mutedForeground }]}>
                  AI TOOLS
                </Text>
                <View style={styles.aiToolsRow}>
                  {([ 
                    { key: "workout" as const, icon: "barbell-outline", label: "Workout Plan", color: "#2E8B57" },
                    { key: "meal"    as const, icon: "nutrition-outline", label: "Meal Plan",    color: "#C9A84C" },
                    { key: "body"    as const, icon: "body-outline",     label: "Body Analysis", color: "#8B31C7" },
                  ] as const).map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      activeOpacity={0.8}
                      onPress={() => runAiTool(t.key)}
                      disabled={aiToolLoading !== null}
                      style={[
                        styles.aiToolCard,
                        {
                          backgroundColor: t.color + "18",
                          borderColor: t.color + "50",
                          opacity: aiToolLoading !== null && aiToolLoading !== t.key ? 0.5 : 1,
                        },
                      ]}
                    >
                      {aiToolLoading === t.key ? (
                        <ActivityIndicator size="small" color={t.color} />
                      ) : (
                        <Ionicons name={t.icon} size={22} color={t.color} />
                      )}
                      <Text style={[styles.aiToolCardLabel, { color: t.color }]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
          {/* Mic button */}
          <TouchableOpacity
            onPress={handleVoice}
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
            value={isRecording ? "" : (interimText || chatInput)}
            onChangeText={isRecording || interimText ? undefined : setChatInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            editable={!isRecording && !interimText}
            placeholder={
              isRecording
                ? "🎙 Recording… tap mic to finish"
                : interimText
                ? interimText
                : "Ask Ovia about fitness, nutrition, health..."
            }
            placeholderTextColor={isRecording || interimText ? colors.accent : colors.mutedForeground}
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
      {permissionToastElement}

      {/* AI Tool Result Modal */}
      <Modal
        visible={aiToolModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAiToolModalVisible(false)}
      >
        <AiToolResultSheet
          result={aiToolResult}
          onClose={() => setAiToolModalVisible(false)}
        />
      </Modal>
    </View>
  );
}

// ── AI Tool Result Sheet ──────────────────────────────────────────────────────
type AiToolResultSheetProps = {
  result: { title: string; content: unknown } | null;
  onClose: () => void;
};

function AiToolResultSheet({ result, onClose }: AiToolResultSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  function renderContent() {
    if (!result) return null;
    const c = result.content as Record<string, unknown> | null;
    if (!c) return <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>No data returned.</Text>;

    // Workout plan
    if (Array.isArray((c as any)["days"]) && (c as any)["summary"] !== undefined && (c as any)["macros"] === undefined) {
      const plan = c as { summary: string; days: Array<{ day: string; focus: string; duration_min: number; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>; rest: boolean }>; tips: string[] };
      return (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <Text style={[sheetStyles.summary, { color: colors.foreground }]}>{plan.summary}</Text>
          {plan.days?.map((d) => (
            <View key={d.day} style={[sheetStyles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={sheetStyles.dayHeader}>
                <Text style={[sheetStyles.dayName, { color: colors.foreground }]}>{d.day}</Text>
                {d.rest ? (
                  <Text style={[sheetStyles.restBadge, { color: colors.mutedForeground }]}>Rest Day</Text>
                ) : (
                  <Text style={[sheetStyles.focusText, { color: "#2E8B57" }]}>{d.focus} · {d.duration_min}min</Text>
                )}
              </View>
              {!d.rest && d.exercises?.map((ex, i) => (
                <View key={i} style={sheetStyles.exerciseRow}>
                  <Text style={[sheetStyles.exName, { color: colors.foreground }]}>{ex.name}</Text>
                  <Text style={[sheetStyles.exMeta, { color: colors.mutedForeground }]}>{ex.sets}×{ex.reps}{ex.notes ? `  ${ex.notes}` : ""}</Text>
                </View>
              ))}
            </View>
          ))}
          {plan.tips?.length > 0 && (
            <View style={[sheetStyles.tipsCard, { backgroundColor: "#2E8B5718", borderColor: "#2E8B5740" }]}>
              <Text style={[sheetStyles.tipsTitle, { color: "#2E8B57" }]}>COACH TIPS</Text>
              {plan.tips.map((t, i) => <Text key={i} style={[sheetStyles.tipText, { color: colors.foreground }]}>• {t}</Text>)}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      );
    }

    // Meal plan
    if ((c as any)["daily_calories"] !== undefined && Array.isArray((c as any)["days"])) {
      const mp = c as { daily_calories: number; macros: { protein_g: number; carbs_g: number; fat_g: number }; days: Array<{ day: string; meals: Array<{ type: string; name: string; calories: number; notes: string }> }>; tips: string[] };
      return (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={[sheetStyles.macroRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={sheetStyles.macroItem}>
              <Text style={[sheetStyles.macroVal, { color: "#C9A84C" }]}>{mp.daily_calories}</Text>
              <Text style={[sheetStyles.macroKey, { color: colors.mutedForeground }]}>kcal/day</Text>
            </View>
            <View style={sheetStyles.macroItem}>
              <Text style={[sheetStyles.macroVal, { color: "#2E8B57" }]}>{mp.macros?.protein_g}g</Text>
              <Text style={[sheetStyles.macroKey, { color: colors.mutedForeground }]}>Protein</Text>
            </View>
            <View style={sheetStyles.macroItem}>
              <Text style={[sheetStyles.macroVal, { color: "#3b82f6" }]}>{mp.macros?.carbs_g}g</Text>
              <Text style={[sheetStyles.macroKey, { color: colors.mutedForeground }]}>Carbs</Text>
            </View>
            <View style={sheetStyles.macroItem}>
              <Text style={[sheetStyles.macroVal, { color: "#f97316" }]}>{mp.macros?.fat_g}g</Text>
              <Text style={[sheetStyles.macroKey, { color: colors.mutedForeground }]}>Fat</Text>
            </View>
          </View>
          {mp.days?.map((d) => (
            <View key={d.day} style={[sheetStyles.dayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[sheetStyles.dayName, { color: colors.foreground, marginBottom: 8 }]}>{d.day}</Text>
              {d.meals?.map((m, i) => (
                <View key={i} style={sheetStyles.mealRow}>
                  <View style={sheetStyles.mealLeft}>
                    <Text style={[sheetStyles.mealType, { color: "#C9A84C" }]}>{m.type}</Text>
                    <Text style={[sheetStyles.mealName, { color: colors.foreground }]}>{m.name}</Text>
                    {m.notes ? <Text style={[sheetStyles.mealNotes, { color: colors.mutedForeground }]}>{m.notes}</Text> : null}
                  </View>
                  <Text style={[sheetStyles.mealCal, { color: colors.mutedForeground }]}>{m.calories} kcal</Text>
                </View>
              ))}
            </View>
          ))}
          {mp.tips?.length > 0 && (
            <View style={[sheetStyles.tipsCard, { backgroundColor: "#C9A84C18", borderColor: "#C9A84C40" }]}>
              <Text style={[sheetStyles.tipsTitle, { color: "#C9A84C" }]}>FOOD THERAPY TIPS</Text>
              {mp.tips.map((t, i) => <Text key={i} style={[sheetStyles.tipText, { color: colors.foreground }]}>• {t}</Text>)}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      );
    }

    // Body analysis
    if ((c as any)["bmi"] !== undefined) {
      const a = c as { bmi: number; bmi_category: string; estimated_body_fat_pct: number; lean_mass_kg: number; bmr_kcal: number; tdee_kcal: number; ideal_weight_range: { min: number; max: number; unit: string }; summary: string; strengths: string[]; focus_areas: string[]; recommendations: string[] };
      return (
        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
          <View style={[sheetStyles.macroRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "BMI", value: a.bmi?.toFixed(1), color: "#8B31C7" },
              { label: "Body Fat", value: `${a.estimated_body_fat_pct?.toFixed(1)}%`, color: "#f97316" },
              { label: "BMR", value: `${a.bmr_kcal} kcal`, color: "#2E8B57" },
              { label: "TDEE", value: `${a.tdee_kcal} kcal`, color: "#3b82f6" },
            ].map((item) => (
              <View key={item.label} style={sheetStyles.macroItem}>
                <Text style={[sheetStyles.macroVal, { color: item.color, fontSize: 15 }]}>{item.value}</Text>
                <Text style={[sheetStyles.macroKey, { color: colors.mutedForeground }]}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={[sheetStyles.dayCard, { backgroundColor: "#8B31C718", borderColor: "#8B31C740" }]}>
            <Text style={[sheetStyles.tipsTitle, { color: "#8B31C7" }]}>BMI: {a.bmi_category?.toUpperCase()}</Text>
            <Text style={[sheetStyles.tipText, { color: colors.foreground }]}>{a.summary}</Text>
            {a.ideal_weight_range && (
              <Text style={[sheetStyles.tipText, { color: colors.mutedForeground, marginTop: 6 }]}>
                Ideal weight range: {a.ideal_weight_range.min}–{a.ideal_weight_range.max} {a.ideal_weight_range.unit}
              </Text>
            )}
          </View>
          {a.strengths?.length > 0 && (
            <View style={[sheetStyles.tipsCard, { backgroundColor: "#2E8B5718", borderColor: "#2E8B5740" }]}>
              <Text style={[sheetStyles.tipsTitle, { color: "#2E8B57" }]}>STRENGTHS</Text>
              {a.strengths.map((s, i) => <Text key={i} style={[sheetStyles.tipText, { color: colors.foreground }]}>✓ {s}</Text>)}
            </View>
          )}
          {a.focus_areas?.length > 0 && (
            <View style={[sheetStyles.tipsCard, { backgroundColor: "#f9731618", borderColor: "#f9731640" }]}>
              <Text style={[sheetStyles.tipsTitle, { color: "#f97316" }]}>AREAS TO IMPROVE</Text>
              {a.focus_areas.map((s, i) => <Text key={i} style={[sheetStyles.tipText, { color: colors.foreground }]}>→ {s}</Text>)}
            </View>
          )}
          {a.recommendations?.length > 0 && (
            <View style={[sheetStyles.tipsCard, { backgroundColor: "#3b82f618", borderColor: "#3b82f640" }]}>
              <Text style={[sheetStyles.tipsTitle, { color: "#3b82f6" }]}>RECOMMENDATIONS</Text>
              {a.recommendations.map((s, i) => <Text key={i} style={[sheetStyles.tipText, { color: colors.foreground }]}>{i + 1}. {s}</Text>)}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      );
    }

    return <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>Could not render result.</Text>;
  }

  return (
    <View style={[sheetStyles.sheet, { backgroundColor: colors.background, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <View style={[sheetStyles.sheetHeader, { borderBottomColor: colors.border }]}>
        <View style={{ width: 32 }} />
        <Text style={[sheetStyles.sheetTitle, { color: colors.foreground }]} numberOfLines={1}>
          {result?.title ?? ""}
        </Text>
        <TouchableOpacity onPress={onClose} style={sheetStyles.closeBtn}>
          <Ionicons name="close" size={20} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
      <View style={sheetStyles.sheetBody}>
        {renderContent()}
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  sheet: { flex: 1 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  sheetTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold", flex: 1, textAlign: "center" },
  closeBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sheetBody: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  summary: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 16 },
  dayCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  dayName: { fontSize: 14, fontFamily: "SpaceGrotesk_700Bold" },
  restBadge: { fontSize: 12, fontFamily: "Inter_400Regular" },
  focusText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  exerciseRow: { paddingVertical: 4, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  exName: { fontSize: 13, fontFamily: "Inter_500Medium" },
  exMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  macroRow: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  macroItem: { flex: 1, alignItems: "center" },
  macroVal: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  macroKey: { fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
  mealRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#ffffff08" },
  mealLeft: { flex: 1 },
  mealType: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, textTransform: "uppercase" },
  mealName: { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 1 },
  mealNotes: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  mealCal: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tipsCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  tipsTitle: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  tipText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 4 },
});

function ChatBubble({ message }: { message: OviaMessage }) {
  const colors = useColors();
  const isUser = message.role === "user";
  const [speaking, setSpeaking] = React.useState(false);

  const handleSpeak = React.useCallback(async () => {
    const ExpoSpeech = await import("expo-speech");
    if (speaking) {
      ExpoSpeech.stop();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      ExpoSpeech.speak(message.content, {
        language: "en-US",
        onDone: () => setSpeaking(false),
        onError: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
      });
    }
  }, [speaking, message.content]);

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.smallAvatar, { backgroundColor: colors.accent + "20" }]}>
          <Ionicons name="sparkles" size={12} color={colors.accent} />
        </View>
      )}
      <View style={{ flex: 1, maxWidth: "85%" }}>
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
        {!isUser && (
          <TouchableOpacity
            onPress={handleSpeak}
            style={[styles.speakBtn, { borderColor: colors.border }]}
            accessibilityLabel={speaking ? "Stop reading" : "Read aloud"}
          >
            <Ionicons
              name={speaking ? "stop-circle-outline" : "volume-medium-outline"}
              size={14}
              color={speaking ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.speakBtnText, { color: speaking ? colors.primary : colors.mutedForeground }]}>
              {speaking ? "Stop" : "Read aloud"}
            </Text>
          </TouchableOpacity>
        )}
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
  bubble: { padding: 12, borderRadius: 16 },
  speakBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, alignSelf: "flex-start" },
  speakBtnText: { fontSize: 11, fontFamily: "Inter_400Regular" },
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
  aiToolsSection: { width: "100%", marginTop: 20, gap: 8 },
  aiToolsLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, textTransform: "uppercase", paddingHorizontal: 4 },
  aiToolsRow: { flexDirection: "row", gap: 10 },
  aiToolCard: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16, borderRadius: 14, borderWidth: 1 },
  aiToolCardLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textAlign: "center" },
});
