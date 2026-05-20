import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useReduceMotion } from "@/hooks/useReduceMotion";
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

const THUMB_SCALE = 72 / CARD_WIDTH;
const PRESET_THUMB_SCALE = 44 / CARD_WIDTH;

function estimateThumbnailHeight(vs: CardVisibleStats, hasMessage: boolean): number {
  const BASE_H = 244;
  const STREAK_H = 76;
  const GRID_H = 101;
  const BOTTOM_H = 76;
  const MSG_H = 56;

  let h = BASE_H;
  if (vs.streak) h += STREAK_H;
  if (vs.workouts || vs.calories || vs.time) h += GRID_H;
  if (vs.weightChange || vs.topPR) h += BOTTOM_H;
  if (hasMessage) h += MSG_H;

  return Math.max(52, Math.min(104, Math.round(h * THUMB_SCALE)));
}

const STORAGE_KEY_PRESETS = "@raimzeal_card_presets";
export const STORAGE_KEY_ACTION = "@raimzeal_card_action";
export const STORAGE_KEY_BADGE_DISMISSED = "@raimzeal_card_badge_dismissed";
const STORAGE_KEY_PINCH_HINT_SEEN = "@raimzeal_pinch_hint_seen";

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
  onGenerate: (result: CardCustomizationResult) => Promise<void>;
  generating?: boolean;
  cardPreviewData: CardPreviewData;
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

const PRESET_ITEM_H = 56;

interface SortablePresetItemProps {
  preset: CardPreset;
  itemIndex: number;
  totalItems: number;
  draggingIdx: SharedValue<number>;
  dragTranslateY: SharedValue<number>;
  hoveredIdx: SharedValue<number>;
  isActive: boolean;
  onLoadPreset: (p: CardPreset) => void;
  onDeletePreset: (id: string) => void;
  onPanEnd: (fromIdx: number, toIdx: number) => void;
  colors: ReturnType<typeof useColors>;
}

function SortablePresetItem({
  preset,
  itemIndex,
  totalItems,
  draggingIdx,
  dragTranslateY,
  hoveredIdx,
  isActive,
  onLoadPreset,
  onDeletePreset,
  onPanEnd,
  colors,
}: SortablePresetItemProps) {
  const theme = CARD_THEMES.find((t) => t.id === preset.themeId) ?? CARD_THEMES[0];

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const dIdx = draggingIdx.value;
    const hIdx = hoveredIdx.value;

    if (dIdx === -1) {
      return { top: itemIndex * PRESET_ITEM_H, zIndex: 1, elevation: 1, shadowOpacity: 0 };
    }

    if (itemIndex === dIdx) {
      return {
        top: dIdx * PRESET_ITEM_H,
        transform: [{ translateY: dragTranslateY.value }],
        zIndex: 999,
        elevation: 8,
        shadowOpacity: 0.22,
      };
    }

    let targetSlot = itemIndex;
    if (hIdx > dIdx && itemIndex > dIdx && itemIndex <= hIdx) {
      targetSlot = itemIndex - 1;
    } else if (hIdx < dIdx && itemIndex < dIdx && itemIndex >= hIdx) {
      targetSlot = itemIndex + 1;
    }

    return {
      top: withSpring(targetSlot * PRESET_ITEM_H, { damping: 22, stiffness: 320 }),
      zIndex: 1,
      elevation: 1,
      shadowOpacity: 0,
    };
  });

  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      draggingIdx.value = itemIndex;
      hoveredIdx.value = itemIndex;
      dragTranslateY.value = 0;
    })
    .onUpdate((e) => {
      "worklet";
      dragTranslateY.value = e.translationY;
      const newH = Math.max(
        0,
        Math.min(
          totalItems - 1,
          Math.round((itemIndex * PRESET_ITEM_H + e.translationY) / PRESET_ITEM_H)
        )
      );
      hoveredIdx.value = newH;
    })
    .onEnd(() => {
      "worklet";
      const finalSlot = hoveredIdx.value;
      const fromSlot = draggingIdx.value;
      draggingIdx.value = -1;
      hoveredIdx.value = -1;
      dragTranslateY.value = 0;
      runOnJS(onPanEnd)(fromSlot, finalSlot);
    });

  return (
    <Reanimated.View
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          height: PRESET_ITEM_H - 4,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 6,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          paddingRight: 12,
          borderRadius: 12,
          borderWidth: 1.5,
          backgroundColor: isActive ? colors.primary + "18" : colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          overflow: "hidden",
        }}
      >
        <GestureDetector gesture={pan}>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Ionicons name="reorder-three-outline" size={22} color={colors.mutedForeground} />
          </View>
        </GestureDetector>
        <View style={[styles.presetDot, { backgroundColor: theme.accent }]} />
        <Text
          style={{
            flex: 1,
            fontSize: 13,
            fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
            color: isActive ? colors.primary : colors.foreground,
            marginLeft: 6,
          }}
          numberOfLines={1}
        >
          {preset.name}
        </Text>
        <TouchableOpacity
          onPress={() => onLoadPreset(preset)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ marginRight: 10 }}
        >
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={isActive ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDeletePreset(preset.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="close-circle"
            size={20}
            color={isActive ? colors.primary : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </Reanimated.View>
  );
}

interface SortablePresetListProps {
  presets: CardPreset[];
  onReorder: (newPresets: CardPreset[]) => void;
  onDone: () => void;
  activePresetId: string | null;
  onLoadPreset: (p: CardPreset) => void;
  onDeletePreset: (id: string) => void;
  colors: ReturnType<typeof useColors>;
}

function SortablePresetList({
  presets,
  onReorder,
  onDone,
  activePresetId,
  onLoadPreset,
  onDeletePreset,
  colors,
}: SortablePresetListProps) {
  const [items, setItems] = useState<CardPreset[]>(presets);

  useEffect(() => {
    setItems(presets);
  }, [presets]);

  const draggingIdx = useSharedValue(-1);
  const dragTranslateY = useSharedValue(0);
  const hoveredIdx = useSharedValue(-1);

  function handlePanEnd(fromIdx: number, toIdx: number) {
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    setItems((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onReorder(next);
      return next;
    });
  }

  return (
    <View style={{ marginBottom: 12 }}>
      <View
        style={{
          height: items.length * PRESET_ITEM_H,
          position: "relative",
          marginBottom: 10,
        }}
      >
        {items.map((preset, index) => (
          <SortablePresetItem
            key={preset.id}
            preset={preset}
            itemIndex={index}
            totalItems={items.length}
            draggingIdx={draggingIdx}
            dragTranslateY={dragTranslateY}
            hoveredIdx={hoveredIdx}
            isActive={preset.id === activePresetId}
            onLoadPreset={(p) => { onLoadPreset(p); onDone(); }}
            onDeletePreset={onDeletePreset}
            onPanEnd={handlePanEnd}
            colors={colors}
          />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          Drag{" "}
          <Ionicons name="reorder-three-outline" size={12} color={colors.mutedForeground} />
          {" "}to reorder
        </Text>
        <TouchableOpacity
          onPress={onDone}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: colors.primary + "18",
            borderWidth: 1,
            borderColor: colors.primary + "40",
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Ionicons name="checkmark-outline" size={13} color={colors.primary} />
          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ZoomableCard({
  children,
  cardWidth,
  cardHeight,
  scale,
  savedScale,
  translateX,
  translateY,
  savedTranslateX,
  savedTranslateY,
}: {
  children: React.ReactNode;
  cardWidth: number;
  cardHeight: number;
  scale: SharedValue<number>;
  savedScale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  savedTranslateX: SharedValue<number>;
  savedTranslateY: SharedValue<number>;
}) {
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      "worklet";
      scale.value = Math.min(4, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      "worklet";
      savedScale.value = scale.value;
      const maxX = Math.max(0, (cardWidth * scale.value - screenWidth) / 2);
      const maxY = Math.max(0, (cardHeight * scale.value - screenHeight) / 2);
      const clampedX = Math.min(maxX, Math.max(-maxX, translateX.value));
      const clampedY = Math.min(maxY, Math.max(-maxY, translateY.value));
      translateX.value = withSpring(clampedX);
      translateY.value = withSpring(clampedY);
      savedTranslateX.value = clampedX;
      savedTranslateY.value = clampedY;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      "worklet";
      const maxX = Math.max(0, (cardWidth * scale.value - screenWidth) / 2);
      const maxY = Math.max(0, (cardHeight * scale.value - screenHeight) / 2);
      translateX.value = Math.min(maxX, Math.max(-maxX, savedTranslateX.value + e.translationX));
      translateY.value = Math.min(maxY, Math.max(-maxY, savedTranslateY.value + e.translationY));
    })
    .onEnd(() => {
      "worklet";
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      "worklet";
      scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      savedScale.value = 1;
      translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, panGesture),
    pinchGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View
        style={[
          {
            width: cardWidth,
            height: cardHeight,
            borderRadius: 20,
            overflow: "hidden",
          },
          animatedStyle,
        ]}
      >
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
}

interface ThemeSwatchItemProps {
  theme: typeof CARD_THEMES[0];
  isSelected: boolean;
  visibleStats: CardVisibleStats;
  customMessage: string;
  cardPreviewData: CardPreviewData;
  estimatedHeight: number;
  colors: ReturnType<typeof useColors>;
  onSelect: (themeId: CardThemeId) => void;
}

function ThemeSwatchItem({
  theme,
  isSelected,
  visibleStats,
  customMessage,
  cardPreviewData,
  estimatedHeight,
  colors,
  onSelect,
}: ThemeSwatchItemProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReduceMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (!reduceMotion) {
      scale.value = withSequence(
        withSpring(0.88, { damping: 18, stiffness: 500 }),
        withSpring(1.07, { damping: 12, stiffness: 300 }),
        withSpring(1, { damping: 16, stiffness: 320 })
      );
    }
    onSelect(theme.id);
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      style={styles.themeThumbnailItem}
    >
      <Reanimated.View style={animatedStyle}>
        <View
          style={[
            styles.themeThumbnailFrame,
            {
              height: estimatedHeight,
              borderColor: isSelected ? theme.accent : colors.border,
              borderWidth: isSelected ? 2.5 : 1.5,
            },
          ]}
        >
          <View pointerEvents="none">
            <ShareProgressCard
              {...cardPreviewData}
              visibleStats={visibleStats}
              customMessage={customMessage}
              themeId={theme.id}
              renderScale={THUMB_SCALE}
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
      </Reanimated.View>
    </TouchableOpacity>
  );
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
  const reduceMotion = useReduceMotion();
  const reduceMotionRef = useRef(false);
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  const [visibleStats, setVisibleStats] = useState<CardVisibleStats>({
    ...DEFAULT_VISIBLE_STATS,
  });
  const [customMessage, setCustomMessage] = useState("");
  const [selectedThemeId, setSelectedThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const [displayedThemeId, setDisplayedThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const previewOpacity = useRef(new Animated.Value(1)).current;
  const themeTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionLongPressedRef = useRef(false);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [badgeDismissed, setBadgeDismissed] = useState(false);
  const [defaultAction, setDefaultAction] = useState<CardAction | null>(null);

  // Presets
  const [presets, setPresets] = useState<CardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [showInlineSave, setShowInlineSave] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const presetNameRef = useRef<TextInput>(null);

  // Preset thumbnail preview
  const [presetPreviewTarget, setPresetPreviewTarget] = useState<CardPreset | null>(null);
  const [presetPreviewVisible, setPresetPreviewVisible] = useState(false);
  const presetPreviewAnim = useRef(new Animated.Value(0)).current;

  // Badge fade-in + slide-in animation
  const badgeFadeAnim = useRef(new Animated.Value(0)).current;
  const badgeSlideAnim = useRef(new Animated.Value(5)).current;

  useEffect(() => {
    if (restoredFromStorage && !badgeDismissed) {
      badgeFadeAnim.setValue(0);
      badgeSlideAnim.setValue(5);
      if (reduceMotion) {
        badgeFadeAnim.setValue(1);
        badgeSlideAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(badgeFadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(badgeSlideAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      badgeFadeAnim.setValue(0);
      badgeSlideAnim.setValue(5);
    }
  }, [restoredFromStorage, badgeDismissed, reduceMotion]);

  // Card-preview chip: fade in then auto-dismiss after ~2.5 s
  const cardChipFadeAnim = useRef(new Animated.Value(0)).current;
  const cardChipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cardChipTimerRef.current !== null) {
      clearTimeout(cardChipTimerRef.current);
      cardChipTimerRef.current = null;
    }
    cardChipFadeAnim.stopAnimation();

    if (!restoredFromStorage) {
      cardChipFadeAnim.setValue(0);
      return;
    }

    if (reduceMotion) {
      cardChipFadeAnim.setValue(1);
      cardChipTimerRef.current = setTimeout(() => {
        cardChipFadeAnim.setValue(0);
        cardChipTimerRef.current = null;
      }, 2500);
    } else {
      cardChipFadeAnim.setValue(0);
      Animated.timing(cardChipFadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        cardChipTimerRef.current = setTimeout(() => {
          cardChipTimerRef.current = null;
          Animated.timing(cardChipFadeAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }, 2500);
      });
    }

    return () => {
      if (cardChipTimerRef.current !== null) {
        clearTimeout(cardChipTimerRef.current);
        cardChipTimerRef.current = null;
      }
    };
  }, [restoredFromStorage, reduceMotion]);

  // Confirmation / error toast
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmVariant, setConfirmVariant] = useState<"success" | "error">("success");
  const confirmOpacity = useRef(new Animated.Value(0)).current;

  // Undo-delete toast
  const [undoDeleteState, setUndoDeleteState] = useState<{ preset: CardPreset; index: number } | null>(null);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showConfirmation(msg: string, variant: "success" | "error" = "success") {
    confirmOpacity.stopAnimation();
    setConfirmMessage(msg);
    setConfirmVariant(variant);
    confirmOpacity.setValue(0);
    const holdDuration = variant === "error" ? 2200 : 1600;
    if (reduceMotionRef.current) {
      confirmOpacity.setValue(1);
      setTimeout(() => {
        confirmOpacity.setValue(0);
        setConfirmMessage(null);
      }, holdDuration);
    } else {
      Animated.sequence([
        Animated.timing(confirmOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(holdDuration),
        Animated.timing(confirmOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setConfirmMessage(null);
      });
    }
  }

  useEffect(() => {
    if (!visible) return;
    setRestoredFromStorage(false);
    setBadgeDismissed(false);
    setActivePresetId(null);
    setShowInlineSave(false);
    setPresetNameInput("");
    setThemeScrollAtEnd(false);
    setThemeHasOverflow(false);
    themeContainerWidth.current = 0;
    themeContentWidth.current = 0;

    async function loadSaved() {
      try {
        const [savedStats, savedMessage, savedTheme, loadedPresets, savedAction, dismissedFlag] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_STATS),
          AsyncStorage.getItem(STORAGE_KEY_MESSAGE),
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          loadPresets(),
          AsyncStorage.getItem(STORAGE_KEY_ACTION),
          AsyncStorage.getItem(STORAGE_KEY_BADGE_DISMISSED),
        ]);

        setPresets(loadedPresets);
        setReorderMode(false);

        let effectiveStats = { ...DEFAULT_VISIBLE_STATS };
        if (savedStats) {
          const parsed = JSON.parse(savedStats) as Partial<CardVisibleStats>;
          effectiveStats = { ...DEFAULT_VISIBLE_STATS, ...parsed };
        }
        const effectiveMessage = savedMessage ?? "";
        const effectiveTheme = (savedTheme as CardThemeId) ?? DEFAULT_THEME_ID;

        const hadSavedData = !!(savedStats || savedMessage || savedTheme);

        setVisibleStats(effectiveStats);
        setCustomMessage(effectiveMessage);
        setSelectedThemeId(effectiveTheme);
        setDisplayedThemeId(effectiveTheme);
        setRestoredFromStorage(hadSavedData);
        setBadgeDismissed(dismissedFlag === "1");
        const validActions: CardAction[] = ["share", "save", "both"];
        setDefaultAction(
          validActions.includes(savedAction as CardAction) ? (savedAction as CardAction) : null
        );
      } catch {
        setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
        setCustomMessage("");
        setSelectedThemeId(DEFAULT_THEME_ID);
        setDisplayedThemeId(DEFAULT_THEME_ID);
        setRestoredFromStorage(false);
        setBadgeDismissed(false);
        setDefaultAction(null);
      }
    }
    loadSaved();
  }, [visible]);

  function toggleStat(key: keyof CardVisibleStats) {
    setVisibleStats((prev) => ({ ...prev, [key]: !prev[key] }));
    setActivePresetId(null);
    setRestoredFromStorage(false);
    resetZoomPosition();
  }

  function handleThemeChange(themeId: CardThemeId) {
    setSelectedThemeId(themeId);
    setActivePresetId(null);
    setRestoredFromStorage(false);
    resetZoomPosition();
    if (themeTransitionTimer.current !== null) {
      clearTimeout(themeTransitionTimer.current);
      themeTransitionTimer.current = null;
    }
    if (reduceMotionRef.current) {
      setDisplayedThemeId(themeId);
    } else {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
      themeTransitionTimer.current = setTimeout(() => {
        themeTransitionTimer.current = null;
        setDisplayedThemeId(themeId);
      }, 90);
    }
  }

  function handleMessageChange(text: string) {
    setCustomMessage(text);
    setActivePresetId(null);
    setRestoredFromStorage(false);
    resetZoomPosition();
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
    try {
      await onGenerate({ visibleStats, customMessage: customMessage.trim(), themeId: selectedThemeId, action });
      const msg =
        action === "save"
          ? "Saved to camera roll"
          : action === "share"
          ? "Share sheet opened"
          : "Saved to camera roll · Share sheet opened";
      showConfirmation(msg, "success");
    } catch (err) {
      // "PERMISSION_DENIED" is a sentinel from the parent — the permission Alert
      // was already shown there. Skip the inline toast to avoid double feedback.
      if (err instanceof Error && err.message === "PERMISSION_DENIED") return;

      const fallback =
        action === "save"
          ? "Couldn't save — check your permissions"
          : action === "share"
          ? "Couldn't open share sheet"
          : "Couldn't save or share the card";
      const errMsg = err instanceof Error && err.message ? err.message : fallback;
      showConfirmation(errMsg, "error");
    }
  }

  async function handleSetDefault(action: CardAction) {
    actionLongPressedRef.current = true;
    setDefaultAction(action);
    AsyncStorage.setItem(STORAGE_KEY_ACTION, action).catch(() => {});
    const label = action === "share" ? "Share" : action === "save" ? "Save" : "Both";
    showConfirmation(`${label} set as default`, "success");
  }

  function handleDismissBadge() {
    const persist = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY_BADGE_DISMISSED, "1");
      } catch {
        // ignore
      }
    };

    if (reduceMotionRef.current) {
      setBadgeDismissed(true);
      persist();
    } else {
      badgeFadeAnim.stopAnimation();
      Animated.timing(badgeFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setBadgeDismissed(true);
          persist();
        }
      });
    }
  }

  async function handleResetDefaults() {
    setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
    setCustomMessage("");
    setSelectedThemeId(DEFAULT_THEME_ID);
    setDisplayedThemeId(DEFAULT_THEME_ID);
    setRestoredFromStorage(false);
    setBadgeDismissed(false);
    setActivePresetId(null);
    resetZoomPosition();
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_STATS),
        AsyncStorage.removeItem(STORAGE_KEY_MESSAGE),
        AsyncStorage.removeItem(STORAGE_KEY_THEME),
        AsyncStorage.removeItem(STORAGE_KEY_BADGE_DISMISSED),
      ]);
    } catch {
      // ignore
    }
  }

  function loadPreset(preset: CardPreset) {
    setVisibleStats({ ...DEFAULT_VISIBLE_STATS, ...preset.visibleStats });
    setCustomMessage(preset.customMessage);
    setSelectedThemeId(preset.themeId);
    setDisplayedThemeId(preset.themeId);
    setActivePresetId(preset.id);
    setRestoredFromStorage(false);
    resetZoomPosition();
  }

  function openPresetPreview(preset: CardPreset) {
    pinchScale.value = 1;
    pinchSavedScale.value = 1;
    pinchTranslateX.value = 0;
    pinchTranslateY.value = 0;
    pinchSavedTranslateX.value = 0;
    pinchSavedTranslateY.value = 0;
    setPresetPreviewTarget(preset);
    setPresetPreviewVisible(true);
    if (reduceMotionRef.current) {
      presetPreviewAnim.setValue(1);
    } else {
      presetPreviewAnim.setValue(0);
      Animated.spring(presetPreviewAnim, {
        toValue: 1,
        damping: 18,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }
  }

  function closePresetPreview() {
    if (reduceMotionRef.current) {
      presetPreviewAnim.setValue(0);
      setPresetPreviewVisible(false);
      setPresetPreviewTarget(null);
    } else {
      Animated.timing(presetPreviewAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setPresetPreviewVisible(false);
          setPresetPreviewTarget(null);
        }
      });
    }
  }

  function confirmLoadPreset(preset: CardPreset) {
    closePresetPreview();
    loadPreset(preset);
  }

  function openInlineSave() {
    const activePreset = presets.find((p) => p.id === activePresetId);
    setPresetNameInput(activePreset ? activePreset.name : "");
    setShowInlineSave(true);
    setTimeout(() => presetNameRef.current?.focus(), 100);
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
        setShowInlineSave(false);
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
    setShowInlineSave(false);
    showConfirmation(activePresetId ? `"${name}" updated` : `"${name}" saved`, "success");
  }

  async function handleReorderPresets(newOrder: CardPreset[]) {
    setPresets(newOrder);
    await savePresets(newOrder);
  }

  function dismissUndoToast(cb?: () => void) {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoOpacity.stopAnimation();
    if (reduceMotionRef.current) {
      undoOpacity.setValue(0);
      setUndoDeleteState(null);
      cb?.();
    } else {
      Animated.timing(undoOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setUndoDeleteState(null);
        cb?.();
      });
    }
  }

  function showUndoToast(preset: CardPreset, index: number) {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    undoOpacity.stopAnimation();
    setUndoDeleteState({ preset, index });
    if (reduceMotionRef.current) {
      undoOpacity.setValue(1);
    } else {
      undoOpacity.setValue(0);
      Animated.timing(undoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    undoTimerRef.current = setTimeout(() => {
      undoTimerRef.current = null;
      dismissUndoToast();
    }, 4000);
  }

  async function handleUndoDelete() {
    if (!undoDeleteState) return;
    const { preset, index } = undoDeleteState;
    dismissUndoToast(async () => {
      const restored = [...presets];
      restored.splice(index, 0, preset);
      await savePresets(restored);
      setPresets(restored);
    });
  }

  async function handleDeletePreset(presetId: string) {
    const index = presets.findIndex((p) => p.id === presetId);
    if (index === -1) return;
    const preset = presets[index];
    const updated = presets.filter((p) => p.id !== presetId);
    await savePresets(updated);
    setPresets(updated);
    if (activePresetId === presetId) setActivePresetId(null);
    showUndoToast(preset, index);
  }

  const anyStatEnabled = Object.values(visibleStats).some(Boolean);
  const bottomPad = Platform.OS === "ios" ? insets.bottom : 16;

  // Zoom shared values — lifted here so position survives open/close cycles
  const pinchScale = useSharedValue(1);
  const pinchSavedScale = useSharedValue(1);
  const pinchTranslateX = useSharedValue(0);
  const pinchTranslateY = useSharedValue(0);
  const pinchSavedTranslateX = useSharedValue(0);
  const pinchSavedTranslateY = useSharedValue(0);

  function resetZoomPosition() {
    pinchScale.value = withSpring(1, { damping: 15, stiffness: 200 });
    pinchSavedScale.value = 1;
    pinchTranslateX.value = withSpring(0, { damping: 15, stiffness: 200 });
    pinchTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    pinchSavedTranslateX.value = 0;
    pinchSavedTranslateY.value = 0;
  }

  const [cardNativeHeight, setCardNativeHeight] = useState(500);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [themeScrollAtEnd, setThemeScrollAtEnd] = useState(false);
  const [themeHasOverflow, setThemeHasOverflow] = useState(false);
  const themeContainerWidth = useRef(0);
  const themeContentWidth = useRef(0);
  const zoomAnim = useRef(new Animated.Value(0)).current;

  const [showPinchHint, setShowPinchHint] = useState(false);
  const pinchHintAnim = useRef(new Animated.Value(0)).current;

  function triggerPinchHint() {
    setShowPinchHint(true);
    if (reduceMotionRef.current) {
      pinchHintAnim.setValue(1);
      setTimeout(() => {
        setShowPinchHint(false);
        AsyncStorage.setItem(STORAGE_KEY_PINCH_HINT_SEEN, "1").catch(() => {});
      }, 2000);
    } else {
      pinchHintAnim.setValue(0);
      Animated.sequence([
        Animated.timing(pinchHintAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(pinchHintAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setShowPinchHint(false);
          AsyncStorage.setItem(STORAGE_KEY_PINCH_HINT_SEEN, "1").catch(() => {});
        }
      });
    }
  }

  async function openZoom() {
    setZoomVisible(true);
    if (reduceMotionRef.current) {
      zoomAnim.setValue(1);
    } else {
      zoomAnim.setValue(0);
      Animated.spring(zoomAnim, {
        toValue: 1,
        damping: 18,
        stiffness: 280,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY_PINCH_HINT_SEEN);
      if (!seen) {
        setTimeout(triggerPinchHint, 400);
      }
    } catch {
      // ignore
    }
  }

  function closeZoom() {
    if (reduceMotionRef.current) {
      zoomAnim.setValue(0);
      setZoomVisible(false);
    } else {
      Animated.timing(zoomAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setZoomVisible(false);
      });
    }
  }

  const screenWidth = Dimensions.get("window").width;
  const previewContainerWidth = screenWidth - 40;
  const cardScale = previewContainerWidth / CARD_WIDTH;
  const scaledCardHeight = cardNativeHeight * cardScale;

  // Show the zoom view at true 1:1 (CARD_WIDTH px) when the screen is wide enough.
  // This matches the captureRef output exactly: same dimensions, same component, no additional
  // wrapper scaling. On very narrow screens (<360 + 24px padding) we scale down to fit, but
  // still as close to 1:1 as possible. CARD_WIDTH = 360, so most modern phones (≥384pt) get 1:1.
  const zoomScale = Math.min(1, (screenWidth - 24) / CARD_WIDTH);
  const zoomIsOneToOne = zoomScale >= 1;
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
              {restoredFromStorage && !badgeDismissed && (
                <Animated.View style={[styles.restoredBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40", opacity: badgeFadeAnim, transform: [{ translateY: badgeSlideAnim }] }]}>
                  <Ionicons name="checkmark-circle" size={12} color={colors.primary} />
                  <Text style={[styles.restoredBadgeText, { color: colors.primary }]}>
                    Restored from last time
                  </Text>
                  <TouchableOpacity
                    onPress={handleDismissBadge}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={styles.restoredBadgeDismiss}
                  >
                    <Ionicons name="close" size={11} color={colors.primary} />
                  </TouchableOpacity>
                </Animated.View>
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
            scrollEnabled={!reorderMode}
          >
            {/* ── Presets section ── */}
            <View style={styles.presetsHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                PRESETS
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (showInlineSave) {
                    setShowInlineSave(false);
                  } else {
                    openInlineSave();
                  }
                }}
                style={[styles.savePresetBtn, { backgroundColor: showInlineSave ? colors.muted : colors.primary + "18", borderColor: showInlineSave ? colors.border : colors.primary + "40" }]}
              >
                <Ionicons name={showInlineSave ? "close-outline" : activePresetId ? "save-outline" : "add-circle-outline"} size={13} color={showInlineSave ? colors.mutedForeground : colors.primary} />
                <Text style={[styles.savePresetBtnText, { color: showInlineSave ? colors.mutedForeground : colors.primary }]}>
                  {showInlineSave ? "Cancel" : activePresetId ? "Update Preset" : "Save Preset"}
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
            ) : reorderMode ? (
              <SortablePresetList
                presets={presets}
                onReorder={handleReorderPresets}
                onDone={() => { setReorderMode(false); showConfirmation("Order saved"); }}
                activePresetId={activePresetId}
                onLoadPreset={loadPreset}
                onDeletePreset={(id) => {
                  handleDeletePreset(id);
                  if (presets.length <= 1) setReorderMode(false);
                }}
                colors={colors}
              />
            ) : (
              <>
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
                        onPress={() => openPresetPreview(preset)}
                        onLongPress={() => setReorderMode(true)}
                        delayLongPress={350}
                        activeOpacity={0.75}
                        style={styles.presetChip}
                      >
                        <View
                          style={[
                            styles.presetThumbnailFrame,
                            {
                              borderColor: isActive ? colors.primary : colors.border,
                              borderWidth: isActive ? 2 : 1.5,
                            },
                          ]}
                        >
                          <View pointerEvents="none">
                            <ShareProgressCard
                              {...cardPreviewData}
                              visibleStats={preset.visibleStats}
                              customMessage={preset.customMessage}
                              themeId={preset.themeId}
                              renderScale={PRESET_THUMB_SCALE}
                            />
                          </View>
                          {isActive && (
                            <View style={[styles.presetThumbnailCheck, { backgroundColor: theme.accent }]}>
                              <Ionicons name="checkmark" size={8} color="#fff" />
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDeletePreset(preset.id)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            style={styles.presetThumbnailDelete}
                          >
                            <Ionicons
                              name="close-circle"
                              size={16}
                              color={isActive ? colors.primary : colors.mutedForeground}
                            />
                          </TouchableOpacity>
                        </View>
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
                      </TouchableOpacity>
                    );
                  })}
                  {presets.length < MAX_PRESETS && (
                    <Text style={[styles.presetsSlotHint, { color: colors.mutedForeground }]}>
                      {MAX_PRESETS - presets.length} slot{MAX_PRESETS - presets.length !== 1 ? "s" : ""} left
                    </Text>
                  )}
                </ScrollView>
                {presets.length > 1 && (
                  <Text style={[styles.reorderHint, { color: colors.mutedForeground }]}>
                    Long-press any preset to reorder
                  </Text>
                )}
              </>
            )}

            {showInlineSave && !reorderMode && (
              <View style={[styles.inlineSaveWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.inlineSaveLabel, { color: colors.foreground }]}>
                  {activePresetId ? "Update preset name" : "Name this preset"}
                </Text>
                <View style={[styles.inlineSaveInputRow]}>
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
                      styles.inlineSaveInput,
                      {
                        color: colors.foreground,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={handleSavePreset}
                    disabled={!presetNameInput.trim() || savingPreset}
                    style={[
                      styles.inlineSaveConfirmBtn,
                      {
                        backgroundColor: presetNameInput.trim() ? colors.primary : colors.muted,
                      },
                    ]}
                  >
                    {savingPreset ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={[styles.inlineSaveConfirmText, { color: presetNameInput.trim() ? colors.primaryForeground : colors.mutedForeground }]}>
                        {activePresetId ? "Update" : "Save"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={[styles.inlineSaveCharCount, { color: colors.mutedForeground }]}>
                  {presetNameInput.trim().length}/32
                </Text>
              </View>
            )}

            {activePreset && !reorderMode && !showInlineSave && (
              <View style={[styles.activePresetBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
                <Ionicons name="bookmark" size={12} color={colors.primary} />
                <Text style={[styles.activePresetBannerText, { color: colors.primary }]}>
                  Viewing "{activePreset.name}" — edit below to update it
                </Text>
              </View>
            )}

            {/* Live card preview */}
            <View style={styles.previewSectionHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                LIVE PREVIEW
              </Text>
              <View style={[styles.exactMatchBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "35" }]}>
                <Ionicons name={zoomIsOneToOne ? "expand-outline" : "eye-outline"} size={11} color={colors.primary} />
                <Text style={[styles.exactMatchBadgeText, { color: colors.primary }]}>
                  {zoomIsOneToOne ? "Tap for 1:1 preview" : "Scaled to fit"}
                </Text>
              </View>
            </View>
            <Text style={[styles.previewSubtitle, { color: colors.mutedForeground }]}>
              Same card, same content — tap to see{zoomIsOneToOne ? " the 1:1 pixel-accurate view" : " a larger preview"}
            </Text>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={openZoom}
              style={[
                styles.previewContainer,
                {
                  width: previewContainerWidth,
                  height: scaledCardHeight,
                  // Match the card's own corner radius at the rendered scale so the
                  // clip boundary is identical to what the card itself draws.
                  borderRadius: 20 * cardScale,
                  // Match the card's background (#0a0a0b) so no modal background
                  // bleeds through corner gaps between clip and card border radius.
                  backgroundColor: "#0a0a0b",
                },
              ]}
            >
              <Animated.View style={{ opacity: previewOpacity }}>
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
                    themeId={displayedThemeId}
                  />
                </View>
              </Animated.View>
              {restoredFromStorage && (
                <Animated.View
                  style={[
                    styles.cardChip,
                    { opacity: cardChipFadeAnim },
                  ]}
                  pointerEvents="none"
                >
                  <Ionicons name="time-outline" size={11} color="#fff" />
                  <Text style={styles.cardChipText}>Last used</Text>
                </Animated.View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openZoom}
              activeOpacity={0.75}
              style={[styles.zoomHintRow, { borderColor: colors.border, backgroundColor: colors.muted }]}
            >
              <Ionicons name="expand-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.zoomHintRowText, { color: colors.mutedForeground }]}>Tap to see full-size preview</Text>
              <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
            </TouchableOpacity>

            {/* Color theme picker */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              COLOR THEME
            </Text>
            <View
              style={styles.themeThumbnailsWrapper}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                themeContainerWidth.current = w;
                setThemeHasOverflow(themeContentWidth.current > w + 4);
              }}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.themeThumbnailsScroll}
                onContentSizeChange={(w) => {
                  themeContentWidth.current = w;
                  setThemeHasOverflow(w > themeContainerWidth.current + 4);
                }}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                  const distanceFromEnd = contentSize.width - layoutMeasurement.width - contentOffset.x;
                  setThemeScrollAtEnd(distanceFromEnd < 16);
                }}
                scrollEventThrottle={16}
              >
                {CARD_THEMES.map((theme) => (
                  <ThemeSwatchItem
                    key={theme.id}
                    theme={theme}
                    isSelected={selectedThemeId === theme.id}
                    visibleStats={visibleStats}
                    customMessage={customMessage.trim()}
                    cardPreviewData={cardPreviewData}
                    estimatedHeight={estimateThumbnailHeight(visibleStats, customMessage.trim().length > 0)}
                    colors={colors}
                    onSelect={handleThemeChange}
                  />
                ))}
              </ScrollView>
              {themeHasOverflow && !themeScrollAtEnd && (
                <LinearGradient
                  colors={["transparent", colors.background]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.themeFadeRight}
                  pointerEvents="none"
                />
              )}
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
                  { action: "share" as CardAction, icon: "share-social", label: "Share", subtitle: "Opens your share sheet", bg: colors.primary },
                  { action: "save" as CardAction, icon: "image-outline", label: "Save", subtitle: "Saves to camera roll", bg: colors.secondary },
                  { action: "both" as CardAction, icon: "layers-outline", label: "Both", subtitle: "Saves & opens share sheet", bg: colors.accent },
                ] as const
              ).map(({ action, icon, label, subtitle, bg }) => {
                const isPreferred = anyStatEnabled && defaultAction === action;
                return (
                  <TouchableOpacity
                    key={action}
                    onPress={() => {
                      if (actionLongPressedRef.current) {
                        actionLongPressedRef.current = false;
                        return;
                      }
                      handleGenerate(action);
                    }}
                    onLongPress={() => handleSetDefault(action)}
                    delayLongPress={500}
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
                    <View style={styles.actionBtnInner}>
                      <View style={styles.actionBtnTop}>
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
                      </View>
                      <Text
                        style={[
                          styles.actionBtnSubtitle,
                          {
                            color: anyStatEnabled
                              ? colors.primaryForeground + "BB"
                              : colors.mutedForeground + "99",
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {subtitle}
                      </Text>
                      {isPreferred && (
                        <Text style={styles.preferredLabel}>★ Last used</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {!anyStatEnabled && (
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
              Enable at least one stat to generate your card
            </Text>
          )}
          {confirmMessage && (
            <Animated.View style={[styles.confirmToastWrap, { opacity: confirmOpacity }]}>
              <View
                style={[
                  styles.confirmToast,
                  confirmVariant === "error"
                    ? { backgroundColor: "#ff443618", borderColor: "#ff443640" }
                    : { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" },
                ]}
              >
                <Ionicons
                  name={confirmVariant === "error" ? "alert-circle" : "checkmark-circle"}
                  size={14}
                  color={confirmVariant === "error" ? "#ff4436" : colors.primary}
                />
                <Text
                  style={[
                    styles.confirmToastText,
                    { color: confirmVariant === "error" ? "#ff4436" : colors.primary },
                  ]}
                >
                  {confirmMessage}
                </Text>
              </View>
            </Animated.View>
          )}
          {undoDeleteState && (
            <Animated.View style={[styles.confirmToastWrap, { opacity: undoOpacity }]}>
              <View
                style={[
                  styles.confirmToast,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    gap: 0,
                    paddingHorizontal: 12,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                <Text
                  style={[
                    styles.confirmToastText,
                    { color: colors.mutedForeground, marginLeft: 6, marginRight: 10 },
                  ]}
                >
                  "{undoDeleteState.preset.name}" deleted
                </Text>
                <TouchableOpacity onPress={handleUndoDelete} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text
                    style={[
                      styles.confirmToastText,
                      { color: colors.primary, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    Undo
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </View>
      </View>

      {/* Full-screen zoom modal */}
      <Modal
        visible={zoomVisible}
        animationType="none"
        transparent
        onRequestClose={closeZoom}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.zoomOverlay,
            {
              opacity: zoomAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closeZoom}
          />

          <Animated.View
            style={{
              transform: [
                {
                  scale: zoomAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            }}
          >
            <ZoomableCard
              cardWidth={CARD_WIDTH * zoomScale}
              cardHeight={zoomCardHeight}
              scale={pinchScale}
              savedScale={pinchSavedScale}
              translateX={pinchTranslateX}
              translateY={pinchTranslateY}
              savedTranslateX={pinchSavedTranslateX}
              savedTranslateY={pinchSavedTranslateY}
            >
              {zoomIsOneToOne ? (
                // True 1:1 render — no scaling transform applied.
                // This matches the captureRef output exactly: same pixel dimensions,
                // same component instance, same layout — just shown on-screen.
                <ShareProgressCard
                  {...cardPreviewData}
                  visibleStats={visibleStats}
                  customMessage={customMessage.trim()}
                  themeId={selectedThemeId}
                />
              ) : (
                // Narrow screen: scale down to fit, same approach as the modal preview.
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
              )}
            </ZoomableCard>
          </Animated.View>

          <Animated.View
            style={[
              styles.zoomCloseBtnWrap,
              { top: insets.top + 16 },
              {
                opacity: zoomAnim,
                transform: [
                  {
                    translateY: zoomAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                ],
              },
            ]}
            pointerEvents="box-none"
          >
            <TouchableOpacity
              style={styles.zoomCloseBtn}
              onPress={closeZoom}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close-circle" size={34} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          </Animated.View>

          <View style={styles.zoomFooter}>
            <View style={styles.zoomExactBadge}>
              <Ionicons name="checkmark-circle" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.zoomExactBadgeText}>
                {zoomIsOneToOne ? "1:1 scale · Closest view to the final image" : "Scaled to fit · pinch to zoom in"}
              </Text>
            </View>
            <Text style={styles.zoomDismissHint}>Pinch to zoom · double-tap to reset</Text>
          </View>

          {showPinchHint && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFillObject,
                styles.pinchHintOverlay,
                { opacity: pinchHintAnim },
              ]}
            >
              <View style={styles.pinchHintCard}>
                <View style={styles.pinchIconRow}>
                  <View style={styles.pinchFinger} />
                  <View style={styles.pinchArrowLeft}>
                    <Ionicons name="arrow-back" size={14} color="rgba(255,255,255,0.9)" />
                  </View>
                  <View style={styles.pinchArrowRight}>
                    <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.9)" />
                  </View>
                  <View style={[styles.pinchFinger, { marginLeft: 18 }]} />
                </View>
                <Text style={styles.pinchHintTitle}>Pinch to zoom</Text>
                <Text style={styles.pinchHintSub}>Double-tap to reset</Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>

      {/* Preset thumbnail preview modal */}
      <Modal
        visible={presetPreviewVisible}
        animationType="none"
        transparent
        onRequestClose={closePresetPreview}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.zoomOverlay,
            { opacity: presetPreviewAnim },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={closePresetPreview}
          />

          {presetPreviewTarget && (
            <>
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: presetPreviewAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.85, 1],
                      }),
                    },
                  ],
                }}
              >
                <ZoomableCard
                  cardWidth={CARD_WIDTH * zoomScale}
                  cardHeight={cardNativeHeight * zoomScale}
                  scale={pinchScale}
                  savedScale={pinchSavedScale}
                  translateX={pinchTranslateX}
                  translateY={pinchTranslateY}
                  savedTranslateX={pinchSavedTranslateX}
                  savedTranslateY={pinchSavedTranslateY}
                >
                  {zoomIsOneToOne ? (
                    <ShareProgressCard
                      {...cardPreviewData}
                      visibleStats={presetPreviewTarget.visibleStats}
                      customMessage={presetPreviewTarget.customMessage}
                      themeId={presetPreviewTarget.themeId}
                    />
                  ) : (
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
                        visibleStats={presetPreviewTarget.visibleStats}
                        customMessage={presetPreviewTarget.customMessage}
                        themeId={presetPreviewTarget.themeId}
                      />
                    </View>
                  )}
                </ZoomableCard>
              </Animated.View>

              <Animated.View
                style={[
                  styles.zoomCloseBtnWrap,
                  { top: insets.top + 16 },
                  {
                    opacity: presetPreviewAnim,
                    transform: [
                      {
                        translateY: presetPreviewAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-8, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="box-none"
              >
                <TouchableOpacity
                  style={styles.zoomCloseBtn}
                  onPress={closePresetPreview}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close-circle" size={34} color="rgba(255,255,255,0.85)" />
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={[
                  styles.presetPreviewFooter,
                  {
                    bottom: insets.bottom + 28,
                    opacity: presetPreviewAnim,
                    transform: [
                      {
                        translateY: presetPreviewAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [12, 0],
                        }),
                      },
                    ],
                  },
                ]}
                pointerEvents="box-none"
              >
                <View style={styles.presetPreviewNameBadge} pointerEvents="none">
                  <Text style={styles.presetPreviewNameText} numberOfLines={1}>
                    {presetPreviewTarget.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.presetPreviewLoadBtn}
                  activeOpacity={0.85}
                  onPress={() => confirmLoadPreset(presetPreviewTarget)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.presetPreviewLoadBtnText}>Load preset</Text>
                </TouchableOpacity>
              </Animated.View>
            </>
          )}
        </Animated.View>
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
  restoredBadgeDismiss: {
    marginLeft: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardChip: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  cardChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#fff",
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
    gap: 10,
    paddingBottom: 4,
    marginBottom: 12,
    alignItems: "flex-start",
  },
  presetChip: {
    alignItems: "center",
    gap: 5,
    width: 60,
  },
  presetThumbnailFrame: {
    width: 44,
    height: 66,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  presetThumbnailCheck: {
    position: "absolute",
    bottom: 4,
    left: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  presetThumbnailDelete: {
    position: "absolute",
    top: 3,
    right: 3,
  },
  presetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  presetChipText: {
    fontSize: 11,
    textAlign: "center",
  },
  presetsSlotHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 4,
    paddingTop: 20,
  },
  reorderHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: -6,
    marginBottom: 10,
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
  previewSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  exactMatchBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  exactMatchBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  previewSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 10,
  },
  previewContainer: {
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 20,
    marginBottom: 8,
  },
  previewScaler: {
    transformOrigin: "top left",
  },
  zoomHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: "center",
  },
  zoomHintRowText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
    textAlign: "center",
  },
  // Theme thumbnail picker
  themeThumbnailsWrapper: {
    position: "relative",
    marginBottom: 16,
  },
  themeFadeRight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 56,
    pointerEvents: "none",
  },
  themeThumbnailsScroll: {
    gap: 10,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  themeThumbnailItem: {
    alignItems: "center",
    gap: 6,
  },
  themeThumbnailFrame: {
    width: 72,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
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
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
  },
  actionBtnInner: {
    alignItems: "center",
    gap: 3,
  },
  actionBtnTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  actionBtnSubtitle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  preferredLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    color: "rgba(255,255,255,0.92)",
    marginTop: 4,
    letterSpacing: 0.3,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCloseBtnWrap: {
    position: "absolute",
    right: 20,
  },
  zoomCloseBtn: {},
  zoomFooter: {
    position: "absolute",
    bottom: 36,
    alignItems: "center",
    gap: 8,
  },
  zoomExactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  zoomExactBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
  },
  zoomDismissHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  pinchHintOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  pinchHintCard: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  pinchIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    height: 36,
  },
  pinchFinger: {
    width: 18,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  pinchArrowLeft: {
    marginRight: 4,
    marginLeft: 10,
  },
  pinchArrowRight: {
    marginLeft: 4,
    marginRight: 10,
  },
  pinchHintTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  pinchHintSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  // Inline save preset form
  inlineSaveWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    marginBottom: 12,
  },
  inlineSaveLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  inlineSaveInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineSaveInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  inlineSaveConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
  },
  inlineSaveConfirmText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  inlineSaveCharCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
    marginTop: 5,
  },
  // Preset preview footer
  presetPreviewFooter: {
    position: "absolute",
    alignItems: "center",
    gap: 12,
  },
  presetPreviewNameBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  presetPreviewNameText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  presetPreviewLoadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 30,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },
  presetPreviewLoadBtnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  // Confirmation toast
  confirmToastWrap: {
    alignItems: "center",
    marginTop: 6,
  },
  confirmToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  confirmToastText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
