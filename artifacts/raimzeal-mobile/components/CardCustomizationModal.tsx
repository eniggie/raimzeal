import React, { useState, useEffect } from "react";
import {
  Dimensions,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import ShareProgressCard, {
  CARD_THEMES,
  CARD_WIDTH,
  CardThemeId,
  CardVisibleStats,
  DEFAULT_THEME_ID,
  DEFAULT_VISIBLE_STATS,
  ShareProgressCardProps,
} from "@/components/ShareProgressCard";

const STORAGE_KEY_STATS = "@raimzeal_card_visible_stats";
const STORAGE_KEY_MESSAGE = "@raimzeal_card_custom_message";
const STORAGE_KEY_THEME = "@raimzeal_card_theme";

interface StatToggleConfig {
  key: keyof CardVisibleStats;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const STAT_TOGGLES: StatToggleConfig[] = [
  {
    key: "streak",
    label: "Day Streak",
    description: "Your current workout streak",
    icon: "flame",
  },
  {
    key: "workouts",
    label: "Total Workouts",
    description: "Number of workouts completed",
    icon: "barbell-outline",
  },
  {
    key: "calories",
    label: "Calories Burned",
    description: "Total calories burned in training",
    icon: "flash-outline",
  },
  {
    key: "time",
    label: "Time Trained",
    description: "Total time spent training",
    icon: "time-outline",
  },
  {
    key: "weightChange",
    label: "Weight Change",
    description: "How much weight you've lost or gained",
    icon: "scale-outline",
  },
  {
    key: "topPR",
    label: "Personal Record",
    description: "Your top personal record",
    icon: "trophy-outline",
  },
];

export type CardAction = "share" | "save" | "both";

export interface CardCustomizationResult {
  visibleStats: CardVisibleStats;
  customMessage: string;
  themeId: CardThemeId;
  action: CardAction;
}

export type CardPreviewData = Omit<ShareProgressCardProps, "visibleStats" | "customMessage" | "themeId">;

interface Props {
  visible: boolean;
  onClose: () => void;
  onGenerate: (result: CardCustomizationResult) => void;
  generating?: boolean;
  cardPreviewData: CardPreviewData;
}


function isDefaultCustomization(
  stats: CardVisibleStats,
  message: string,
  themeId: CardThemeId,
): boolean {
  if (themeId !== DEFAULT_THEME_ID) return false;
  if (message !== "") return false;
  for (const key of Object.keys(DEFAULT_VISIBLE_STATS) as (keyof CardVisibleStats)[]) {
    if (stats[key] !== DEFAULT_VISIBLE_STATS[key]) return false;
  }
  return true;
}

export default function CardCustomizationModal({
  visible,
  onClose,
  onGenerate,
  generating,
  cardPreviewData,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [visibleStats, setVisibleStats] = useState<CardVisibleStats>({
    ...DEFAULT_VISIBLE_STATS,
  });
  const [customMessage, setCustomMessage] = useState("");
  const [selectedThemeId, setSelectedThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRestoredFromStorage(false);
    async function loadSaved() {
      try {
        const [savedStats, savedMessage, savedTheme] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_STATS),
          AsyncStorage.getItem(STORAGE_KEY_MESSAGE),
          AsyncStorage.getItem(STORAGE_KEY_THEME),
        ]);

        let effectiveStats = { ...DEFAULT_VISIBLE_STATS };
        if (savedStats) {
          const parsed = JSON.parse(savedStats) as Partial<CardVisibleStats>;
          effectiveStats = { ...DEFAULT_VISIBLE_STATS, ...parsed };
        }
        const effectiveMessage = savedMessage ?? "";
        const effectiveTheme = (savedTheme as CardThemeId) ?? DEFAULT_THEME_ID;

        const differsFromDefaults =
          isDefaultCustomization(effectiveStats, effectiveMessage, effectiveTheme) === false;

        setVisibleStats(effectiveStats);
        setCustomMessage(effectiveMessage);
        setSelectedThemeId(effectiveTheme);
        setRestoredFromStorage(differsFromDefaults);
      } catch {
        setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
        setCustomMessage("");
        setSelectedThemeId(DEFAULT_THEME_ID);
        setRestoredFromStorage(false);
      }
    }
    loadSaved();
  }, [visible]);

  function toggleStat(key: keyof CardVisibleStats) {
    setVisibleStats((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function saveToStorage(stats: CardVisibleStats, message: string, themeId: CardThemeId) {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats)),
        AsyncStorage.setItem(STORAGE_KEY_MESSAGE, message),
        AsyncStorage.setItem(STORAGE_KEY_THEME, themeId),
      ]);
    } catch {
      // ignore storage errors
    }
  }

  async function handleGenerate(action: CardAction) {
    await saveToStorage(visibleStats, customMessage.trim(), selectedThemeId);
    onGenerate({ visibleStats, customMessage: customMessage.trim(), themeId: selectedThemeId, action });
  }

  async function handleResetDefaults() {
    setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
    setCustomMessage("");
    setSelectedThemeId(DEFAULT_THEME_ID);
    setRestoredFromStorage(false);
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_STATS),
        AsyncStorage.removeItem(STORAGE_KEY_MESSAGE),
        AsyncStorage.removeItem(STORAGE_KEY_THEME),
      ]);
    } catch {
      // ignore
    }
  }

  const anyStatEnabled = Object.values(visibleStats).some(Boolean);
  const bottomPad = Platform.OS === "ios" ? insets.bottom : 16;

  const [cardNativeHeight, setCardNativeHeight] = useState(500);
  const [zoomVisible, setZoomVisible] = useState(false);

  const screenWidth = Dimensions.get("window").width;
  const previewContainerWidth = screenWidth - 40;
  const cardScale = previewContainerWidth / CARD_WIDTH;
  const scaledCardHeight = cardNativeHeight * cardScale;

  const zoomScale = Math.min((screenWidth - 48) / CARD_WIDTH, 1);
  const zoomCardHeight = cardNativeHeight * zoomScale;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Title row */}
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Customize Your Card
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Choose what to show on your progress card
              </Text>
              {restoredFromStorage && (
                <View style={[styles.restoredBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                  <Text style={[styles.restoredBadgeText, { color: colors.primary }]}>
                    Restored from last time
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.titleActions}>
              <TouchableOpacity
                onPress={handleResetDefaults}
                style={[styles.resetBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              >
                <Ionicons name="refresh-outline" size={14} color={colors.mutedForeground} />
                <Text style={[styles.resetBtnText, { color: colors.mutedForeground }]}>Reset to defaults</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: colors.muted }]}
              >
                <Ionicons name="close" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Live card preview */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              CARD PREVIEW
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setZoomVisible(true)}
              style={[
                styles.previewContainer,
                { width: previewContainerWidth, height: scaledCardHeight },
              ]}
            >
              <View
                style={[
                  styles.previewScaler,
                  {
                    width: CARD_WIDTH,
                    transform: [{ scale: cardScale }],
                  },
                ]}
                onLayout={(e) => setCardNativeHeight(e.nativeEvent.layout.height)}
              >
                <ShareProgressCard
                  {...cardPreviewData}
                  visibleStats={visibleStats}
                  customMessage={customMessage.trim()}
                  themeId={selectedThemeId}
                />
              </View>
              <View style={styles.zoomHint}>
                <Ionicons name="expand-outline" size={13} color="#fff" />
                <Text style={styles.zoomHintText}>Tap to zoom</Text>
              </View>
            </TouchableOpacity>

            {/* Color theme picker */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              COLOR THEME
            </Text>
            <View style={styles.themeRow}>
              {CARD_THEMES.map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    onPress={() => setSelectedThemeId(theme.id)}
                    activeOpacity={0.75}
                    style={styles.themeItem}
                  >
                    <View
                      style={[
                        styles.themeSwatch,
                        { backgroundColor: theme.accent },
                        isSelected && styles.themeSwatchSelected,
                        isSelected && { borderColor: theme.accent },
                      ]}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.themeLabel,
                        {
                          color: isSelected ? colors.foreground : colors.mutedForeground,
                          fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                        },
                      ]}
                    >
                      {theme.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Stat toggles */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              VISIBLE STATS
            </Text>
            <View style={[styles.togglesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {STAT_TOGGLES.map((item, index) => {
                const isOn = visibleStats[item.key];
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => toggleStat(item.key)}
                    activeOpacity={0.7}
                    style={[
                      styles.toggleRow,
                      index < STAT_TOGGLES.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.toggleIconWrap,
                        { backgroundColor: isOn ? colors.primary + "20" : colors.muted },
                      ]}
                    >
                      <Ionicons
                        name={item.icon}
                        size={17}
                        color={isOn ? colors.primary : colors.mutedForeground}
                      />
                    </View>
                    <View style={styles.toggleTextWrap}>
                      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>
                        {item.label}
                      </Text>
                      <Text style={[styles.toggleDesc, { color: colors.mutedForeground }]}>
                        {item.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: isOn ? colors.primary : colors.muted,
                          borderColor: isOn ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.pillKnob,
                          {
                            backgroundColor: isOn ? colors.primaryForeground : colors.mutedForeground,
                            alignSelf: isOn ? "flex-end" : "flex-start",
                          },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom message */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              YOUR MESSAGE (OPTIONAL)
            </Text>
            <View
              style={[
                styles.messageInputWrap,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Ionicons name="chatbubble-outline" size={16} color={colors.mutedForeground} style={styles.messageIcon} />
              <TextInput
                value={customMessage}
                onChangeText={setCustomMessage}
                placeholder="Add a motivational quote or personal note…"
                placeholderTextColor={colors.mutedForeground}
                maxLength={120}
                multiline
                style={[styles.messageInput, { color: colors.foreground }]}
              />
            </View>
            <Text style={[styles.charCount, { color: colors.mutedForeground }]}>
              {customMessage.length}/120
            </Text>
          </ScrollView>

          {/* Action buttons */}
          {generating ? (
            <View style={[styles.generateBtn, { backgroundColor: colors.muted }]}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text style={[styles.generateBtnText, { color: colors.mutedForeground }]}>
                Working…
              </Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() => handleGenerate("share")}
                disabled={!anyStatEnabled}
                activeOpacity={0.85}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: anyStatEnabled ? colors.primary : colors.muted,
                    flex: 1,
                  },
                ]}
              >
                <Ionicons
                  name="share-social"
                  size={17}
                  color={anyStatEnabled ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: anyStatEnabled ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  Share
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleGenerate("save")}
                disabled={!anyStatEnabled}
                activeOpacity={0.85}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: anyStatEnabled ? colors.secondary : colors.muted,
                    flex: 1,
                  },
                ]}
              >
                <Ionicons
                  name="image-outline"
                  size={17}
                  color={anyStatEnabled ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: anyStatEnabled ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleGenerate("both")}
                disabled={!anyStatEnabled}
                activeOpacity={0.85}
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: anyStatEnabled ? colors.accent : colors.muted,
                    flex: 1,
                  },
                ]}
              >
                <Ionicons
                  name="layers-outline"
                  size={17}
                  color={anyStatEnabled ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: anyStatEnabled ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  Both
                </Text>
              </TouchableOpacity>
            </View>
          )}
          {anyStatEnabled && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Both saves to your camera roll and opens the share sheet
            </Text>
          )}
          {!anyStatEnabled && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Enable at least one stat to generate your card
            </Text>
          )}
        </View>
      </View>

      {/* Full-screen zoom modal */}
      <Modal
        visible={zoomVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setZoomVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.zoomOverlay}
          activeOpacity={1}
          onPress={() => setZoomVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.zoomCardWrap,
              { width: CARD_WIDTH * zoomScale, height: zoomCardHeight },
            ]}
          >
            <View
              style={[
                styles.previewScaler,
                {
                  width: CARD_WIDTH,
                  transform: [{ scale: zoomScale }],
                },
              ]}
            >
              <ShareProgressCard
                {...cardPreviewData}
                visibleStats={visibleStats}
                customMessage={customMessage.trim()}
                themeId={selectedThemeId}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.zoomCloseBtn, { top: insets.top + 16 }]}
            onPress={() => setZoomVisible(false)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close-circle" size={34} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>

          <Text style={styles.zoomDismissHint}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 8,
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  resetBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  restoredBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  restoredBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 12,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  previewContainer: {
    overflow: "hidden",
    marginBottom: 16,
    borderRadius: 20,
  },
  previewScaler: {
    transformOrigin: "top left",
  },
  // Theme picker
  themeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  themeItem: {
    alignItems: "center",
    gap: 6,
    minWidth: 52,
  },
  themeSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "transparent",
  },
  themeSwatchSelected: {
    borderWidth: 3,
  },
  themeLabel: {
    fontSize: 11,
    textAlign: "center",
  },
  // Stat toggles
  togglesCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  toggleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleTextWrap: {
    flex: 1,
    gap: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  toggleDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  pill: {
    width: 40,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    padding: 2,
    justifyContent: "center",
  },
  pillKnob: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  messageInputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 4,
  },
  messageIcon: {
    marginTop: 2,
  },
  messageInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 60,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginBottom: 16,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 8,
  },
  generateBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  zoomHint: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  zoomHintText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCardWrap: {
    overflow: "hidden",
    borderRadius: 20,
  },
  zoomCloseBtn: {
    position: "absolute",
    right: 20,
  },
  zoomDismissHint: {
    position: "absolute",
    bottom: 40,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
  },
});
