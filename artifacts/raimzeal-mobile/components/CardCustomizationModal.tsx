import React, { useState, useEffect, useRef } from "react";
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
  Alert,
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
export const STORAGE_KEY_THEME = "@raimzeal_card_theme";
const STORAGE_KEY_PRESETS = "@raimzeal_card_presets";
const STORAGE_KEY_ACTION = "@raimzeal_card_action";

const MAX_PRESETS = 5;

interface StatToggleConfig {
  key: keyof CardVisibleStats;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export interface CardPreset {
  id: string;
  name: string;
  visibleStats: CardVisibleStats;
  customMessage: string;
  themeId: CardThemeId;
  createdAt: number;
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

async function loadPresets(): Promise<CardPreset[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PRESETS);
    if (!raw) return [];
    return JSON.parse(raw) as CardPreset[];
  } catch {
    return [];
  }
}

async function savePresets(presets: CardPreset[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));
  } catch {
    // ignore
  }
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
  const [defaultAction, setDefaultAction] = useState<CardAction | null>(null);

  // Presets
  const [presets, setPresets] = useState<CardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const presetNameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setRestoredFromStorage(false);
    setActivePresetId(null);

    async function loadSaved() {
      try {
        const [savedStats, savedMessage, savedTheme, loadedPresets, savedAction] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_STATS),
          AsyncStorage.getItem(STORAGE_KEY_MESSAGE),
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          loadPresets(),
          AsyncStorage.getItem(STORAGE_KEY_ACTION),
        ]);

        setPresets(loadedPresets);

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
        const validActions: CardAction[] = ["share", "save", "both"];
        setDefaultAction(
          validActions.includes(savedAction as CardAction) ? (savedAction as CardAction) : null
        );
      } catch {
        setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
        setCustomMessage("");
        setSelectedThemeId(DEFAULT_THEME_ID);
        setRestoredFromStorage(false);
        setDefaultAction(null);
      }
    }
    loadSaved();
  }, [visible]);

  function toggleStat(key: keyof CardVisibleStats) {
    setVisibleStats((prev) => ({ ...prev, [key]: !prev[key] }));
    setActivePresetId(null);
  }

  function handleThemeChange(themeId: CardThemeId) {
    setSelectedThemeId(themeId);
    setActivePresetId(null);
  }

  function handleMessageChange(text: string) {
    setCustomMessage(text);
    setActivePresetId(null);
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
    AsyncStorage.setItem(STORAGE_KEY_ACTION, action).catch(() => {
      // best-effort — never block the primary action
    });
    setDefaultAction(action);
    onGenerate({ visibleStats, customMessage: customMessage.trim(), themeId: selectedThemeId, action });
  }

  async function handleResetDefaults() {
    setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
    setCustomMessage("");
    setSelectedThemeId(DEFAULT_THEME_ID);
    setRestoredFromStorage(false);
    setActivePresetId(null);
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

  function loadPreset(preset: CardPreset) {
    setVisibleStats({ ...DEFAULT_VISIBLE_STATS, ...preset.visibleStats });
    setCustomMessage(preset.customMessage);
    setSelectedThemeId(preset.themeId);
    setActivePresetId(preset.id);
    setRestoredFromStorage(false);
  }

  function openSavePresetModal() {
    const activePreset = presets.find((p) => p.id === activePresetId);
    setPresetNameInput(activePreset ? activePreset.name : "");
    setShowSavePresetModal(true);
    setTimeout(() => presetNameRef.current?.focus(), 150);
  }

  async function handleSavePreset() {
    const name = presetNameInput.trim();
    if (!name) return;
    setSavingPreset(true);

    let updatedPresets: CardPreset[];

    if (activePresetId) {
      // Overwrite existing preset
      updatedPresets = presets.map((p) =>
        p.id === activePresetId
          ? { ...p, name, visibleStats, customMessage: customMessage.trim(), themeId: selectedThemeId }
          : p
      );
    } else {
      if (presets.length >= MAX_PRESETS) {
        setSavingPreset(false);
        setShowSavePresetModal(false);
        Alert.alert(
          "Preset limit reached",
          `You can save up to ${MAX_PRESETS} presets. Delete one to make room.`
        );
        return;
      }
      const newPreset: CardPreset = {
        id: `preset_${Date.now()}`,
        name,
        visibleStats: { ...visibleStats },
        customMessage: customMessage.trim(),
        themeId: selectedThemeId,
        createdAt: Date.now(),
      };
      updatedPresets = [...presets, newPreset];
      setActivePresetId(newPreset.id);
    }

    await savePresets(updatedPresets);
    setPresets(updatedPresets);
    setSavingPreset(false);
    setShowSavePresetModal(false);
  }

  async function handleDeletePreset(presetId: string) {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;

    Alert.alert(
      "Delete Preset",
      `Delete "${preset.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const updated = presets.filter((p) => p.id !== presetId);
            await savePresets(updated);
            setPresets(updated);
            if (activePresetId === presetId) setActivePresetId(null);
          },
        },
      ]
    );
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

  const activePreset = presets.find((p) => p.id === activePresetId);

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
                <Text style={[styles.resetBtnText, { color: colors.mutedForeground }]}>Reset</Text>
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
            {/* ── Presets section ── */}
            <View style={styles.presetsHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                PRESETS
              </Text>
              <TouchableOpacity
                onPress={openSavePresetModal}
                style={[styles.savePresetBtn, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}
              >
                <Ionicons name={activePresetId ? "save-outline" : "add-circle-outline"} size={13} color={colors.primary} />
                <Text style={[styles.savePresetBtnText, { color: colors.primary }]}>
                  {activePresetId ? "Update Preset" : "Save Preset"}
                </Text>
              </TouchableOpacity>
            </View>

            {presets.length === 0 ? (
              <View style={[styles.presetsEmptyCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Ionicons name="bookmark-outline" size={20} color={colors.mutedForeground} />
                <Text style={[styles.presetsEmptyText, { color: colors.mutedForeground }]}>
                  No presets yet — set up a card and tap "Save Preset"
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsScroll}
              >
                {presets.map((preset) => {
                  const isActive = preset.id === activePresetId;
                  const theme = CARD_THEMES.find((t) => t.id === preset.themeId) ?? CARD_THEMES[0];
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      onPress={() => loadPreset(preset)}
                      activeOpacity={0.75}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isActive ? colors.primary + "18" : colors.card,
                          borderColor: isActive ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <View style={[styles.presetDot, { backgroundColor: theme.accent }]} />
                      <Text
                        style={[
                          styles.presetChipText,
                          {
                            color: isActive ? colors.primary : colors.foreground,
                            fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {preset.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleDeletePreset(preset.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={15}
                          color={isActive ? colors.primary : colors.mutedForeground}
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
                {presets.length < MAX_PRESETS && (
                  <Text style={[styles.presetsSlotHint, { color: colors.mutedForeground }]}>
                    {MAX_PRESETS - presets.length} slot{MAX_PRESETS - presets.length !== 1 ? "s" : ""} left
                  </Text>
                )}
              </ScrollView>
            )}

            {activePreset && (
              <View style={[styles.activePresetBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
                <Ionicons name="bookmark" size={12} color={colors.primary} />
                <Text style={[styles.activePresetBannerText, { color: colors.primary }]}>
                  Viewing "{activePreset.name}" — edit below to update it
                </Text>
              </View>
            )}

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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.themeThumbnailsScroll}
            >
              {CARD_THEMES.map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                return (
                  <TouchableOpacity
                    key={theme.id}
                    onPress={() => handleThemeChange(theme.id)}
                    activeOpacity={0.75}
                    style={styles.themeThumbnailItem}
                  >
                    <View
                      style={[
                        styles.themeThumbnailFrame,
                        {
                          borderColor: isSelected ? theme.accent : colors.border,
                          borderWidth: isSelected ? 2.5 : 1.5,
                        },
                      ]}
                    >
                      <View style={styles.themeThumbnailScaler} pointerEvents="none">
                        <ShareProgressCard
                          {...cardPreviewData}
                          visibleStats={visibleStats}
                          customMessage={customMessage.trim()}
                          themeId={theme.id}
                        />
                      </View>
                      {isSelected && (
                        <View style={[styles.themeThumbnailCheck, { backgroundColor: theme.accent }]}>
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.themeThumbnailLabel,
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
            </ScrollView>

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
                onChangeText={handleMessageChange}
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
              {(
                [
                  { action: "share" as CardAction, icon: "share-social", label: "Share", bg: colors.primary },
                  { action: "save" as CardAction, icon: "image-outline", label: "Save", bg: colors.secondary },
                  { action: "both" as CardAction, icon: "layers-outline", label: "Both", bg: colors.accent },
                ] as const
              ).map(({ action, icon, label, bg }) => {
                const isPreferred = anyStatEnabled && defaultAction === action;
                return (
                  <TouchableOpacity
                    key={action}
                    onPress={() => handleGenerate(action)}
                    disabled={!anyStatEnabled}
                    activeOpacity={0.85}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: anyStatEnabled ? bg : colors.muted,
                        flex: 1,
                        borderWidth: isPreferred ? 2.5 : 0,
                        borderColor: isPreferred ? colors.primaryForeground : "transparent",
                      },
                    ]}
                  >
                    {isPreferred && (
                      <View style={styles.preferredDot} />
                    )}
                    <Ionicons
                      name={icon}
                      size={17}
                      color={anyStatEnabled ? colors.primaryForeground : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: anyStatEnabled ? colors.primaryForeground : colors.mutedForeground },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {anyStatEnabled && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              {defaultAction
                ? `${defaultAction.charAt(0).toUpperCase() + defaultAction.slice(1)} is your saved preference`
                : "Both saves to your camera roll and opens the share sheet"}
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

      {/* Save Preset modal */}
      <Modal
        visible={showSavePresetModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSavePresetModal(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.presetModalOverlay}
          activeOpacity={1}
          onPress={() => setShowSavePresetModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={[styles.presetModalCard, { backgroundColor: colors.background, borderColor: colors.border }]}
          >
            <Text style={[styles.presetModalTitle, { color: colors.foreground }]}>
              {activePresetId ? "Update Preset" : "Save Preset"}
            </Text>
            <Text style={[styles.presetModalSubtitle, { color: colors.mutedForeground }]}>
              {activePresetId
                ? "Rename or overwrite this preset with the current settings."
                : "Give this combination a name so you can quickly switch back to it."}
            </Text>
            <TextInput
              ref={presetNameRef}
              value={presetNameInput}
              onChangeText={setPresetNameInput}
              placeholder="e.g. Workout Card, Full Stats…"
              placeholderTextColor={colors.mutedForeground}
              maxLength={32}
              returnKeyType="done"
              onSubmitEditing={handleSavePreset}
              style={[
                styles.presetNameInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />
            <Text style={[styles.presetCharCount, { color: colors.mutedForeground }]}>
              {presetNameInput.trim().length}/32
            </Text>
            <View style={styles.presetModalActions}>
              <TouchableOpacity
                onPress={() => setShowSavePresetModal(false)}
                style={[styles.presetModalCancelBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              >
                <Text style={[styles.presetModalCancelText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSavePreset}
                disabled={!presetNameInput.trim() || savingPreset}
                style={[
                  styles.presetModalSaveBtn,
                  {
                    backgroundColor: presetNameInput.trim() ? colors.primary : colors.muted,
                  },
                ]}
              >
                {savingPreset ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.presetModalSaveText, { color: presetNameInput.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                    {activePresetId ? "Update" : "Save"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
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
    paddingVertical: 4,
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
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  // Presets
  presetsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  savePresetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  savePresetBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  presetsEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  presetsEmptyText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  presetsScroll: {
    gap: 8,
    paddingBottom: 4,
    marginBottom: 12,
    alignItems: "center",
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    maxWidth: 180,
  },
  presetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  presetChipText: {
    fontSize: 13,
    flexShrink: 1,
  },
  presetsSlotHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 4,
  },
  activePresetBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  activePresetBannerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  // Card preview
  previewContainer: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 20,
    marginBottom: 16,
  },
  previewScaler: {
    transformOrigin: "top left",
  },
  // Theme thumbnail picker
  themeThumbnailsScroll: {
    gap: 10,
    paddingBottom: 4,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  themeThumbnailItem: {
    alignItems: "center",
    gap: 6,
  },
  themeThumbnailFrame: {
    width: 72,
    height: 88,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  themeThumbnailScaler: {
    width: CARD_WIDTH,
    transform: [{ scale: 72 / CARD_WIDTH }],
    transformOrigin: "top left",
  },
  themeThumbnailCheck: {
    position: "absolute",
    bottom: 5,
    right: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  themeThumbnailLabel: {
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
  preferredDot: {
    position: "absolute",
    top: 5,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.9)",
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
  // Save preset modal
  presetModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  presetModalCard: {
    width: "100%",
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  presetModalTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    marginBottom: 6,
  },
  presetModalSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 18,
  },
  presetNameInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  presetCharCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: 4,
    marginBottom: 20,
  },
  presetModalActions: {
    flexDirection: "row",
    gap: 10,
  },
  presetModalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  presetModalCancelText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  presetModalSaveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  presetModalSaveText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
