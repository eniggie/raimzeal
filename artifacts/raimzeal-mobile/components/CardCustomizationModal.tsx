import React, { useState, useEffect, useRef, memo, useCallback, useMemo, forwardRef, useImperativeHandle } from "react";
import {
  Animated,
  Easing,
  AppState,
  Dimensions,
  Image,
  Keyboard,
  Linking,
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
  Switch,
  NativeSyntheticEvent,
  NativeScrollEvent,
  PanResponder,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
  SharedValue,
  useReducedMotion,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import CropPhotoModal, { CropData } from "@/components/CropPhotoModal";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFitness } from "@/contexts/FitnessContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getApiBase, syncPresetsToCloud, fetchPresetsFromCloud, type StoredCardPreset } from "@/lib/db";
import { useColors } from "@/hooks/useColors";
import { useReduceMotion } from "@/hooks/useReduceMotion";
import { useThumbnailSize, ThumbnailSize } from "@/hooks/useThumbnailSize";
import { useToastSwipeHint } from "@/hooks/useToastSwipeHint";
import { usePermissions } from "@/contexts/PermissionsContext";
import ShareProgressCard, {
  CARD_THEMES,
  CARD_WIDTH,
  CardThemeId,
  CardVisibleStats,
  DEFAULT_THEME_ID,
  DEFAULT_VISIBLE_STATS,
  ShareProgressCardProps,
} from "@/components/ShareProgressCard";

const AnimatedIonicons = Animated.createAnimatedComponent(Ionicons);

export const STORAGE_KEY_STATS = "@raimzeal_card_visible_stats";
export const STORAGE_KEY_MESSAGE = "@raimzeal_card_custom_message";
export const STORAGE_KEY_THEME = "@raimzeal_card_theme";
export const STORAGE_KEY_BG_PHOTO = "@raimzeal_card_bg_photo";

const DEFAULT_DIM_LEVEL = 0.62;
const DIM_MIN = 0.25;
const DIM_MAX = 0.88;

const DEFAULT_BLUR_RADIUS = 18;
const BLUR_MIN = 0;
const BLUR_MAX = 24;

const THUMB_SCALE = 72 / CARD_WIDTH;
const PRESET_THUMB_SCALE = 44 / CARD_WIDTH;

export type { ThumbnailSize } from "@/hooks/useThumbnailSize";

const THUMB_SIZE_OFFSETS: Record<ThumbnailSize, number> = {
  s: -18,
  m: 0,
  l: 26,
};

function estimateThumbnailHeight(
  vs: CardVisibleStats,
  hasMessage: boolean,
  size: ThumbnailSize = "m"
): number {
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

  const base = Math.round(h * THUMB_SCALE);
  return Math.max(44, Math.min(130, base + THUMB_SIZE_OFFSETS[size]));
}

export const STORAGE_KEY_PRESETS = "@raimzeal_card_presets";
const STORAGE_KEY_PENDING_PRESET_SYNC = "@raimzeal_pending_preset_sync";
export const STORAGE_KEY_ACTION = "@raimzeal_card_action";
export const STORAGE_KEY_BADGE_DISMISSED = "@raimzeal_card_badge_dismissed";
export const STORAGE_KEY_AUTO_TRIGGER_DELAY = "@raimzeal_card_auto_trigger_delay";
export const STORAGE_KEY_AUTO_TRIGGER_DELAY_CUSTOMISED = "@raimzeal_countdown_customised";
const STORAGE_KEY_ACTIVE_PRESET = "@raimzeal_active_preset_id";
const STORAGE_KEY_PINCH_HINT_SEEN = "@raimzeal_pinch_hint_seen";
const STORAGE_KEY_PRESET_SWIPE_HINT_SEEN = "@raimzeal_preset_swipe_hint_seen";
const STORAGE_KEY_ZOOM_SWIPE_DOWN_HINT_SEEN = "@raimzeal_zoom_swipe_down_hint_seen";
const STORAGE_KEY_LONGPRESS_HINT_SEEN = "@raimzeal_longpress_hint_seen";
const STORAGE_KEY_DISABLED_BTN_LP_HINT_SEEN = "@raimzeal_disabled_btn_lp_hint_seen";
const DISABLED_BTN_LP_HINT_MAX_SHOWS = 2;
const STORAGE_KEY_CHIP_DISMISS_COUNT = "@raimzeal_chip_dismiss_count";
const STORAGE_KEY_TAP_GENERATE_HINT_SEEN = "@raimzeal_tap_generate_hint_seen";
const STORAGE_KEY_STATS_NUDGE_SEEN = "@raimzeal_stats_nudge_seen";
const STORAGE_KEY_TAP_AGAIN_HINT_SEEN = "@raimzeal_tap_again_hint_seen";
const STORAGE_KEY_LONGPRESS_HINT_OPENS = "@raimzeal_longpress_hint_opens";
export const STORAGE_KEY_LONGPRESS_AND_RUN = "@raimzeal_card_longpress_and_run";
const STORAGE_KEY_MODIFIED_CHIP_HINT_SEEN = "@raimzeal_modified_chip_hint_seen";
const LONGPRESS_HINT_MAX_OPENS = 3;
const DEFAULT_AUTO_TRIGGER_DELAY = 3;

// How long the long-press hint lingers (in ms) before its fade-out begins.
// 600 ms gives new users enough time to read the hint before it disappears.
const LONG_PRESS_HINT_DISMISS_DELAY_MS = 600;

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
  backgroundPhotoUri?: string;
  backgroundPhotoDimLevel?: number;
  backgroundPhotoBlurRadius?: number;
  backgroundPhotoCrop?: CropData;
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

export type CardAction = "share" | "save" | "both" | "copy";

export interface CardCustomizationResult {
  visibleStats: CardVisibleStats;
  customMessage: string;
  themeId: CardThemeId;
  action: CardAction;
  backgroundPhotoUri?: string;
  backgroundPhotoCrop?: CropData;
  backgroundPhotoDimLevel?: number;
  backgroundPhotoBlurRadius?: number;
}

export type CardPreviewData = Omit<ShareProgressCardProps, "visibleStats" | "customMessage" | "themeId">;

interface Props {
  visible: boolean;
  onClose: () => void;
  onGenerate: (result: CardCustomizationResult) => Promise<void>;
  generating?: boolean;
  cardPreviewData: CardPreviewData;
  /** Called when the user taps the ✕ on the restore badge inside the modal. */
  onBadgeDismiss?: () => void;
  /**
   * Cloud-backed initial value of the badge-dismissed preference.
   * When true, the badge is suppressed immediately (without waiting for
   * AsyncStorage), ensuring cross-device consistency for authenticated users.
   */
  initialBadgeDismissed?: boolean;
  /**
   * Cloud-backed initial value of the preferred action.
   * When provided it overrides AsyncStorage on first open, ensuring the
   * setting is restored correctly on a fresh device / reinstall.
   * Pass `null` to indicate the user has explicitly cleared their preference.
   */
  initialDefaultAction?: CardAction | null;
  /** Called whenever the user sets or clears their preferred action. */
  onDefaultActionChange?: (val: CardAction | null) => void;
  /**
   * Cloud-backed initial value of the long-press-and-run preference.
   * When provided it overrides AsyncStorage on first open, ensuring the
   * setting is restored correctly on a fresh device / reinstall.
   */
  initialLongPressAndRun?: boolean;
  /** Called whenever the user toggles the long-press-and-run switch. */
  onLongPressAndRunChange?: (val: boolean) => void;
  /**
   * Called whenever the user picks a new auto-trigger delay inside the modal.
   * Receives the string value ("off" | "1" | "3" | "5").
   * When provided the parent can persist the value to the cloud alongside other
   * synced preferences so the setting roams across devices.
   */
  onAutoTriggerDelayChange?: (val: string) => void;
  /**
   * Boot-time pre-loaded auto-trigger delay ("off" | "1" | "3" | "5").
   * When provided it overrides the AsyncStorage value read on open, eliminating
   * the flash from DEFAULT_AUTO_TRIGGER_DELAY to the stored preference.
   * Pass undefined to fall back to the modal's own AsyncStorage read.
   */
  initialAutoTriggerDelay?: string | null;
  /**
   * Whether the user has ever opened the countdown picker.
   * When true the banner shows "Xs · Change" instead of plain "Change",
   * reassuring power users that their chosen delay is still in effect.
   */
  hasCustomisedCountdown?: boolean;
}

/**
 * Imperative handle exposed via forwardRef.
 * Callers can scroll to and pulse the stat-toggles section regardless of
 * whether any stats are currently enabled — useful for onboarding nudges or
 * info banners rendered outside the modal.
 */
export interface CardCustomizationModalHandle {
  /** Scroll to the VISIBLE STATS toggles and briefly highlight them. */
  highlightStatToggles: () => void;
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
  // Fire-and-forget cloud sync for authenticated users.
  // On failure the snapshot is queued in AsyncStorage for retry on next open.
  if (!isSupabaseConfigured) return;
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.user) return;
    const userId = session.user.id;
    syncPresetsToCloud(userId, presets as unknown as import("@/lib/db").StoredCardPreset[])
      .then((ok) => {
        if (ok) {
          AsyncStorage.removeItem(STORAGE_KEY_PENDING_PRESET_SYNC).catch(() => {});
        } else {
          AsyncStorage.setItem(
            STORAGE_KEY_PENDING_PRESET_SYNC,
            JSON.stringify({ userId, presets })
          ).catch(() => {});
        }
      })
      .catch(() => {
        AsyncStorage.setItem(
          STORAGE_KEY_PENDING_PRESET_SYNC,
          JSON.stringify({ userId, presets })
        ).catch(() => {});
      });
  }).catch(() => {});
}

const PRESET_ITEM_H = 56;

interface SortablePresetItemProps {
  preset: CardPreset;
  itemIndex: number;
  totalItems: number;
  draggingIdx: SharedValue<number>;
  dragTranslateY: SharedValue<number>;
  hoveredIdx: SharedValue<number>;
  reduceMotionShared: SharedValue<boolean>;
  snapFromIdx: SharedValue<number>;
  snapTargetIdx: SharedValue<number>;
  isDragging: SharedValue<boolean>;
  isActive: boolean;
  onLoadPreset: (p: CardPreset) => void;
  onDeletePreset: (id: string) => void;
  onRename: (preset: CardPreset) => void;
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
  reduceMotionShared,
  snapFromIdx,
  snapTargetIdx,
  isDragging,
  isActive,
  onLoadPreset,
  onDeletePreset,
  onRename,
  onPanEnd,
  colors,
}: SortablePresetItemProps) {
  const theme = CARD_THEMES.find((t) => t.id === preset.themeId) ?? CARD_THEMES[0];

  const trashShake = useSharedValue(0);
  const trashAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: trashShake.value }],
  }));

  const reduceMotion = useReduceMotion();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!confirmingDelete) return;
    confirmTimerRef.current = setTimeout(() => setConfirmingDelete(false), 4000);
    return () => {
      if (confirmTimerRef.current !== null) {
        clearTimeout(confirmTimerRef.current);
        confirmTimerRef.current = null;
      }
    };
  }, [confirmingDelete]);
  const rowOpacity = useSharedValue(1);
  const rowSlideX = useSharedValue(0);
  const itemTopShared = useSharedValue(itemIndex * PRESET_ITEM_H);
  useEffect(() => {
    itemTopShared.value = reduceMotion
      ? itemIndex * PRESET_ITEM_H
      : withTiming(itemIndex * PRESET_ITEM_H, { duration: 180 });
  }, [itemIndex]);
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
    transform: [{ translateX: rowSlideX.value }],
  }));

  const animatedStyle = useAnimatedStyle(() => {
    "worklet";
    const dIdx = draggingIdx.value;
    const hIdx = hoveredIdx.value;

    if (dIdx === -1) {
      const snapTop =
        reduceMotionShared.value &&
        snapFromIdx.value >= 0 &&
        snapFromIdx.value === itemIndex
          ? snapTargetIdx.value * PRESET_ITEM_H
          : itemTopShared.value;
      return { top: snapTop, zIndex: 1, elevation: 1, shadowOpacity: 0 };
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
      top: reduceMotionShared.value
        ? targetSlot * PRESET_ITEM_H
        : withSpring(targetSlot * PRESET_ITEM_H, { damping: 22, stiffness: 320 }),
      zIndex: 1,
      elevation: 1,
      shadowOpacity: 0,
    };
  });

  const pan = Gesture.Pan()
    .onStart(() => {
      "worklet";
      if (isDragging.value) return;
      isDragging.value = true;
      draggingIdx.value = itemIndex;
      hoveredIdx.value = itemIndex;
      dragTranslateY.value = 0;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
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
      if (reduceMotionShared.value) {
        snapFromIdx.value = fromSlot;
        snapTargetIdx.value = finalSlot;
      }
      draggingIdx.value = -1;
      hoveredIdx.value = -1;
      dragTranslateY.value = 0;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
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
      <Reanimated.View style={[{ flex: 1 }, fadeStyle]}>
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
        {preset.backgroundPhotoUri ? (
          <View
            style={[
              styles.presetRowPhoto,
              { borderColor: theme.accent, overflow: "hidden" },
            ]}
          >
            <Image
              source={{ uri: preset.backgroundPhotoUri }}
              style={[
                StyleSheet.absoluteFillObject,
                preset.backgroundPhotoCrop
                  ? {
                      transform: [
                        { scale: preset.backgroundPhotoCrop.scale },
                        {
                          translateX:
                            preset.backgroundPhotoCrop.panX *
                            (28 / CARD_WIDTH),
                        },
                        {
                          translateY:
                            preset.backgroundPhotoCrop.panY *
                            (28 / CARD_WIDTH),
                        },
                      ],
                    }
                  : undefined,
              ]}
              resizeMode="cover"
            />
          </View>
        ) : (
          <View style={[styles.presetDot, { backgroundColor: theme.accent }]} />
        )}
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
        {confirmingDelete ? (
          <View style={{ flexDirection: "row", alignItems: "center", marginRight: 2 }}>
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color: "#EF4444",
                marginRight: 8,
              }}
            >
              Delete?
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (confirmTimerRef.current !== null) {
                  clearTimeout(confirmTimerRef.current);
                  confirmTimerRef.current = null;
                }
                setConfirmingDelete(false);
                if (reduceMotion) {
                  onDeletePreset(preset.id);
                  return;
                }
                trashShake.value = withSequence(
                  withTiming(-5, { duration: 50 }),
                  withTiming(5, { duration: 50 }),
                  withTiming(-5, { duration: 50 }),
                  withTiming(5, { duration: 50 }),
                  withTiming(0, { duration: 50 }, (finished) => {
                    "worklet";
                    if (finished) {
                      rowOpacity.value = withTiming(0, { duration: 180 });
                      rowSlideX.value = withTiming(30, { duration: 180 }, (done) => {
                        "worklet";
                        if (done) {
                          runOnJS(onDeletePreset)(preset.id);
                        }
                      });
                    }
                  }),
                );
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 10 }}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#EF4444" }}>
                Yes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setConfirmingDelete(false);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 2 }}
            >
              <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                No
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onRename(preset);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 8 }}
            >
              <Ionicons
                name="pencil-outline"
                size={17}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onLoadPreset(preset);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 10 }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color={isActive ? colors.primary : colors.mutedForeground}
              />
            </TouchableOpacity>
            <Reanimated.View style={trashAnimStyle}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  setConfirmingDelete(true);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={isActive ? colors.primary : colors.mutedForeground}
                />
              </TouchableOpacity>
            </Reanimated.View>
          </>
        )}
        </View>
      </Reanimated.View>
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
  onRename: (preset: CardPreset) => void;
  colors: ReturnType<typeof useColors>;
}

function SortablePresetList({
  presets,
  onReorder,
  onDone,
  activePresetId,
  onLoadPreset,
  onDeletePreset,
  onRename,
  colors,
}: SortablePresetListProps) {
  const [items, setItems] = useState<CardPreset[]>(presets);

  useEffect(() => {
    setItems(presets);
  }, [presets]);

  const reduceMotion = useReduceMotion();
  const reduceMotionShared = useSharedValue(reduceMotion);
  useEffect(() => {
    reduceMotionShared.value = reduceMotion;
  }, [reduceMotion]);

  const draggingIdx = useSharedValue(-1);
  const dragTranslateY = useSharedValue(0);
  const hoveredIdx = useSharedValue(-1);
  const snapFromIdx = useSharedValue(-1);
  const snapTargetIdx = useSharedValue(-1);
  const isDragging = useSharedValue(false);

  useEffect(() => {
    snapFromIdx.value = -1;
    snapTargetIdx.value = -1;
  }, [items]);

  function handlePanEnd(fromIdx: number, toIdx: number) {
    isDragging.value = false;
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    setItems((prev) => {
      if (fromIdx >= prev.length || toIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      onReorder(next);
      return next;
    });
    snapFromIdx.value = -1;
    snapTargetIdx.value = -1;
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
            reduceMotionShared={reduceMotionShared}
            snapFromIdx={snapFromIdx}
            snapTargetIdx={snapTargetIdx}
            isDragging={isDragging}
            isActive={preset.id === activePresetId}
            onLoadPreset={(p) => { onLoadPreset(p); onDone(); }}
            onDeletePreset={onDeletePreset}
            onRename={onRename}
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
  reduceMotionShared,
  onFirstGesture,
  onPresetDragX,
  onPresetNavigateDir,
  onPresetSnapBack,
  onSwipeDown,
  onSwipeDownProgress,
  onDismiss,
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
  reduceMotionShared: SharedValue<boolean>;
  onFirstGesture?: () => void;
  onPresetDragX?: (dx: number) => void;
  onPresetNavigateDir?: (dir: 1 | -1) => void;
  onPresetSnapBack?: () => void;
  onSwipeDown?: (velocityY: number) => void;
  onSwipeDownProgress?: (dy: number) => void;
  onDismiss?: () => void;
}) {
  const screenWidth = Dimensions.get("window").width;
  const screenHeight = Dimensions.get("window").height;

  const atBoundary = useSharedValue(0);
  // -1 = left edge, 0 = none, 1 = right edge
  const atPanBoundaryX = useSharedValue(0);
  // -1 = top edge, 0 = none, 1 = bottom edge
  const atPanBoundaryY = useSharedValue(0);
  // 0 = undecided, 1 = horizontal (preset nav), -1 = vertical
  const gestureAxisLocked = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      "worklet";
      if (onFirstGesture) runOnJS(onFirstGesture)();
    })
    .onUpdate((e) => {
      "worklet";
      const raw = savedScale.value * e.scale;
      const clamped = Math.min(4, Math.max(1, raw));
      scale.value = clamped;
      // Apply rubber-band damping (20%) to the translate values when the
      // pinch-driven scale change pushes them past the new boundaries —
      // mirrors the same over-travel logic used in panGesture.onUpdate so
      // the whole zoom-and-pan interaction feels consistently elastic.
      const maxX = Math.max(0, (cardWidth * clamped - screenWidth) / 2);
      const maxY = Math.max(0, (cardHeight * clamped - screenHeight) / 2);
      const tx = translateX.value;
      const ty = translateY.value;
      translateX.value =
        tx > maxX
          ? maxX + (tx - maxX) * 0.2
          : tx < -maxX
          ? -maxX + (tx + maxX) * 0.2
          : tx;
      translateY.value =
        ty > maxY
          ? maxY + (ty - maxY) * 0.2
          : ty < -maxY
          ? -maxY + (ty + maxY) * 0.2
          : ty;
      if (clamped <= 1) {
        if (atBoundary.value !== 1) {
          atBoundary.value = 1;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      } else if (clamped >= 4) {
        if (atBoundary.value !== 4) {
          atBoundary.value = 4;
          runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
        }
      } else {
        atBoundary.value = 0;
      }
    })
    .onEnd(() => {
      "worklet";
      savedScale.value = scale.value;
      const maxX = Math.max(0, (cardWidth * scale.value - screenWidth) / 2);
      const maxY = Math.max(0, (cardHeight * scale.value - screenHeight) / 2);
      const clampedX = Math.min(maxX, Math.max(-maxX, translateX.value));
      const clampedY = Math.min(maxY, Math.max(-maxY, translateY.value));
      // When a pinch-out returns scale to 1 the card must be centred — any
      // leftover pan offset would leave it floating off-centre. Spring config
      // matches doubleTapGesture (damping 15, stiffness 200) for consistent feel.
      const targetX = scale.value <= 1 ? 0 : clampedX;
      const targetY = scale.value <= 1 ? 0 : clampedY;
      if (reduceMotionShared.value) {
        translateX.value = targetX;
        translateY.value = targetY;
      } else {
        const springCfg =
          scale.value <= 1
            ? { damping: 15, stiffness: 200 }
            : undefined;
        translateX.value = withSpring(targetX, springCfg);
        translateY.value = withSpring(targetY, springCfg);
      }
      savedTranslateX.value = targetX;
      savedTranslateY.value = targetY;
    });

  const panGesture = Gesture.Pan()
    .averageTouches(true)
    .onBegin(() => {
      "worklet";
      gestureAxisLocked.value = 0;
      atPanBoundaryX.value = 0;
      atPanBoundaryY.value = 0;
      if (onFirstGesture) runOnJS(onFirstGesture)();
    })
    .onUpdate((e) => {
      "worklet";
      // At scale 1, lock to horizontal or vertical on the first decisive move.
      if (scale.value === 1 && gestureAxisLocked.value === 0) {
        const absDx = Math.abs(e.translationX);
        const absDy = Math.abs(e.translationY);
        if (absDx > 8 && absDx > absDy * 1.5) gestureAxisLocked.value = 1;
        else if (absDy > 12 && absDy > absDx * 1.5) gestureAxisLocked.value = -1;
      }

      // Horizontal drag at scale 1 → finger-follow for preset navigation.
      // Drive the outer Animated.Value directly via JS callback so the card
      // tracks the finger with zero rubber-banding on the pinch translate.
      // Skip entirely in reduced-motion: tap-only navigation is the intended path.
      if (scale.value === 1 && gestureAxisLocked.value === 1) {
        if (onPresetDragX && !reduceMotionShared.value) runOnJS(onPresetDragX)(e.translationX);
        return;
      }

      // Normal pan/zoom translate logic (zoomed, or vertical at scale 1).
      const maxX = Math.max(0, (cardWidth * scale.value - screenWidth) / 2);
      const maxY = Math.max(0, (cardHeight * scale.value - screenHeight) / 2);
      const rawX = savedTranslateX.value + e.translationX;
      const rawY = savedTranslateY.value + e.translationY;
      // Apply rubber-band damping (20%) when dragging past the boundary so the
      // card follows the finger slightly beyond the edge instead of stopping hard.
      const dampX =
        rawX > maxX
          ? maxX + (rawX - maxX) * 0.2
          : rawX < -maxX
          ? -maxX + (rawX + maxX) * 0.2
          : rawX;
      const dampY =
        rawY > maxY
          ? maxY + (rawY - maxY) * 0.2
          : rawY < -maxY
          ? -maxY + (rawY + maxY) * 0.2
          : rawY;
      translateX.value = dampX;
      translateY.value = dampY;
      // Fire a Light haptic once per axis when the finger reaches the pan boundary.
      // Guard with maxX/maxY > 0 so we only buzz when the card is actually zoomed
      // in (i.e. there is a real translation limit to bump against).
      if (maxX > 0) {
        if (rawX > maxX) {
          if (atPanBoundaryX.value !== 1) {
            atPanBoundaryX.value = 1;
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          }
        } else if (rawX < -maxX) {
          if (atPanBoundaryX.value !== -1) {
            atPanBoundaryX.value = -1;
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          }
        } else {
          atPanBoundaryX.value = 0;
        }
      }
      if (maxY > 0) {
        if (rawY > maxY) {
          if (atPanBoundaryY.value !== 1) {
            atPanBoundaryY.value = 1;
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          }
        } else if (rawY < -maxY) {
          if (atPanBoundaryY.value !== -1) {
            atPanBoundaryY.value = -1;
            runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
          }
        } else {
          atPanBoundaryY.value = 0;
        }
      }
      // Feed swipe-down progress at scale 1 so the outer overlay can track
      // the drag and animate along with the gesture.
      if (
        onSwipeDownProgress &&
        scale.value === 1 &&
        e.translationY > 0 &&
        e.translationY > Math.abs(e.translationX) * 1.2
      ) {
        runOnJS(onSwipeDownProgress)(e.translationY);
      }
    })
    .onEnd((e) => {
      "worklet";
      // Horizontal drag at scale 1 → commit or snap back for preset navigation.
      // In reduced-motion the card was never moved (onPresetDragX was skipped),
      // so there is nothing to snap back — just return and let tap controls handle it.
      if (scale.value === 1 && gestureAxisLocked.value === 1) {
        if (!reduceMotionShared.value) {
          const absDx = Math.abs(e.translationX);
          // RNGH velocityX is in px/s; 500 px/s ≈ the 0.5 px/ms PanResponder threshold.
          const absVx = Math.abs(e.velocityX);
          if (absDx > 60 || absVx > 500) {
            const dir: 1 | -1 = e.translationX < 0 ? 1 : -1;
            if (onPresetNavigateDir) {
              runOnJS(Haptics.selectionAsync)();
              runOnJS(onPresetNavigateDir)(dir);
            }
          } else {
            if (onPresetSnapBack) runOnJS(onPresetSnapBack)();
          }
        }
        return;
      }

      const maxX = Math.max(0, (cardWidth * scale.value - screenWidth) / 2);
      const maxY = Math.max(0, (cardHeight * scale.value - screenHeight) / 2);
      const clampedX = Math.min(maxX, Math.max(-maxX, translateX.value));
      const clampedY = Math.min(maxY, Math.max(-maxY, translateY.value));
      // When scale is back to 1 the card must be centred — snap to origin so
      // no leftover pan offset remains after zooming out. Spring config matches
      // doubleTapGesture (damping 15, stiffness 200) for a consistent feel.
      const targetX = scale.value === 1 ? 0 : clampedX;
      const targetY = scale.value === 1 ? 0 : clampedY;
      if (reduceMotionShared.value) {
        translateX.value = targetX;
        translateY.value = targetY;
      } else {
        const springBase =
          scale.value === 1
            ? { damping: 15, stiffness: 200 }
            : { damping: 22, stiffness: 280 };
        translateX.value = withSpring(targetX, { ...springBase, velocity: e.velocityX });
        translateY.value = withSpring(targetY, { ...springBase, velocity: e.velocityY });
      }
      savedTranslateX.value = targetX;
      savedTranslateY.value = targetY;

      // Swipe-down dismiss — fires from inside RNGH so it works even when
      // the inner gesture handler has claimed the touch (e.g. when zoomed in).
      // At scale 1 the thresholds match the outer PanResponder so behaviour
      // is identical whether the outer or inner handler fires first.
      // At scale > 1 we require a noticeably fast/long swipe so normal panning
      // while zoomed is not accidentally interpreted as a dismiss gesture.
      const isDownward =
        e.translationY > 0 && e.translationY > Math.abs(e.translationX);
      if (isDownward && onSwipeDown) {
        const atScale1 = scale.value === 1;
        const dismissAtScale1 =
          atScale1 && (e.translationY > 80 || e.velocityY > 0.5);
        const dismissZoomed =
          !atScale1 && (e.velocityY > 1.2 || e.translationY > 120);
        if (dismissAtScale1 || dismissZoomed) {
          runOnJS(onSwipeDown)(e.velocityY);
          return;
        }
      }

      // Gesture didn't result in a dismiss — reset any in-progress drag
      // animation so the overlay snaps back to its resting position.
      if (onSwipeDownProgress) {
        runOnJS(onSwipeDownProgress)(0);
      }
    })
    .onFinalize((_e, success) => {
      "worklet";
      // If the gesture was cancelled or failed mid-swipe, reset everything.
      if (!success) {
        if (gestureAxisLocked.value === 1 && onPresetSnapBack && !reduceMotionShared.value) {
          runOnJS(onPresetSnapBack)();
        }
        if (onSwipeDownProgress) runOnJS(onSwipeDownProgress)(0);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onBegin(() => {
      "worklet";
      if (onFirstGesture) runOnJS(onFirstGesture)();
    })
    .onEnd(() => {
      "worklet";
      if (scale.value <= 1 && onDismiss) {
        // Already at scale 1 — second double-tap dismisses the overlay entirely.
        runOnJS(Haptics.selectionAsync)();
        runOnJS(onDismiss)();
        return;
      }
      // Zoomed in — double-tap resets scale and position back to defaults.
      // Light impact gives a decisive "snap-back" feel distinct from the
      // lighter selectionAsync used for the dismiss path.
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      if (reduceMotionShared.value) {
        scale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
      } else {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
        translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
      }
      savedScale.value = 1;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    });

  // Single tap while already at scale 1 dismisses the overlay — mirrors the
  // standard image-viewer convention (tap-to-close when there is nothing to
  // zoom into). requireToFail ensures the double-tap gesture gets priority:
  // the single-tap only fires after the double-tap window expires. While
  // zoomed in the tap is silently ignored so pan/pinch control is unaffected.
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .requireExternalGestureToFail(doubleTapGesture)
    .onBegin(() => {
      "worklet";
      if (onFirstGesture) runOnJS(onFirstGesture)();
    })
    .onEnd(() => {
      "worklet";
      if (scale.value <= 1 && onDismiss) {
        runOnJS(Haptics.selectionAsync)();
        runOnJS(onDismiss)();
      }
    });

  const composed = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, singleTapGesture, panGesture),
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

interface DimLevelSliderProps {
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useColors>;
}

function DimLevelSlider({ value, onChange, colors }: DimLevelSliderProps) {
  const trackWidthSV = useSharedValue(0);
  const knobX = useSharedValue(0);
  const savedX = useSharedValue(0);
  const lastDimUpdateTime = useSharedValue(0);

  useEffect(() => {
    const w = trackWidthSV.value;
    if (w === 0) return;
    const ratio = (value - DIM_MIN) / (DIM_MAX - DIM_MIN);
    const x = ratio * w;
    knobX.value = x;
    savedX.value = x;
  }, [value, trackWidthSV.value]);

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onUpdate((e) => {
      "worklet";
      const w = trackWidthSV.value;
      if (w === 0) return;
      const x = Math.max(0, Math.min(w, savedX.value + e.translationX));
      knobX.value = x;
      const now = Date.now();
      if (now - lastDimUpdateTime.value >= 32) {
        lastDimUpdateTime.value = now;
        const ratio = x / w;
        const newVal = DIM_MIN + ratio * (DIM_MAX - DIM_MIN);
        runOnJS(onChange)(Math.round(newVal * 100) / 100);
      }
    })
    .onEnd((e) => {
      "worklet";
      const w = trackWidthSV.value;
      if (w === 0) return;
      const x = Math.max(0, Math.min(w, savedX.value + e.translationX));
      savedX.value = x;
      knobX.value = x;
      const ratio = x / w;
      runOnJS(onChange)(Math.round((DIM_MIN + ratio * (DIM_MAX - DIM_MIN)) * 100) / 100);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: knobX.value,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value - 12 }],
  }));

  function handleTrackLayout(w: number) {
    trackWidthSV.value = w;
    const ratio = (value - DIM_MIN) / (DIM_MAX - DIM_MIN);
    const x = ratio * w;
    knobX.value = x;
    savedX.value = x;
  }

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
          Dim level
        </Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
          {value < 0.38 ? "Subtle" : value < 0.55 ? "Light" : value < 0.72 ? "Medium" : "Strong"}
        </Text>
      </View>
      <View
        style={{ height: 36, justifyContent: "center" }}
        onLayout={(e) => handleTrackLayout(e.nativeEvent.layout.width)}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            width: "100%",
            overflow: "visible",
          }}
        >
          <Reanimated.View
            style={[
              { height: 4, borderRadius: 2, backgroundColor: colors.primary },
              fillStyle,
            ]}
          />
        </View>
        <GestureDetector gesture={pan}>
          <Reanimated.View
            style={[
              {
                position: "absolute",
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.primary,
                top: 6,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 3,
              },
              knobStyle,
            ]}
          />
        </GestureDetector>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          Subtle
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          Strong
        </Text>
      </View>
    </View>
  );
}

interface BlurLevelSliderProps {
  value: number;
  onChange: (v: number) => void;
  colors: ReturnType<typeof useColors>;
}

function BlurLevelSlider({ value, onChange, colors }: BlurLevelSliderProps) {
  const trackWidthSV = useSharedValue(0);
  const knobX = useSharedValue(0);
  const savedX = useSharedValue(0);
  const lastBlurUpdateTime = useSharedValue(0);

  useEffect(() => {
    const w = trackWidthSV.value;
    if (w === 0) return;
    const ratio = (value - BLUR_MIN) / (BLUR_MAX - BLUR_MIN);
    const x = ratio * w;
    knobX.value = x;
    savedX.value = x;
  }, [value, trackWidthSV.value]);

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .onUpdate((e) => {
      "worklet";
      const w = trackWidthSV.value;
      if (w === 0) return;
      const x = Math.max(0, Math.min(w, savedX.value + e.translationX));
      knobX.value = x;
      const now = Date.now();
      if (now - lastBlurUpdateTime.value >= 32) {
        lastBlurUpdateTime.value = now;
        const ratio = x / w;
        const newVal = Math.round(BLUR_MIN + ratio * (BLUR_MAX - BLUR_MIN));
        runOnJS(onChange)(newVal);
      }
    })
    .onEnd((e) => {
      "worklet";
      const w = trackWidthSV.value;
      if (w === 0) return;
      const x = Math.max(0, Math.min(w, savedX.value + e.translationX));
      savedX.value = x;
      knobX.value = x;
      const ratio = x / w;
      const finalVal = Math.round(BLUR_MIN + ratio * (BLUR_MAX - BLUR_MIN));
      runOnJS(onChange)(finalVal);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: knobX.value,
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobX.value - 12 }],
  }));

  function handleTrackLayout(w: number) {
    trackWidthSV.value = w;
    const ratio = (value - BLUR_MIN) / (BLUR_MAX - BLUR_MIN);
    const x = ratio * w;
    knobX.value = x;
    savedX.value = x;
  }

  const blurLabel = value <= 4 ? "Sharp" : value <= 12 ? "Light" : value <= 18 ? "Medium" : "Blurry";

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
          Blur
        </Text>
        <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
          {blurLabel}
        </Text>
      </View>
      <View
        style={{ height: 36, justifyContent: "center" }}
        onLayout={(e) => handleTrackLayout(e.nativeEvent.layout.width)}
      >
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.border,
            width: "100%",
            overflow: "visible",
          }}
        >
          <Reanimated.View
            style={[
              { height: 4, borderRadius: 2, backgroundColor: colors.primary },
              fillStyle,
            ]}
          />
        </View>
        <GestureDetector gesture={pan}>
          <Reanimated.View
            style={[
              {
                position: "absolute",
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: colors.primary,
                top: 6,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 3,
                elevation: 3,
              },
              knobStyle,
            ]}
          />
        </GestureDetector>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          Sharp
        </Text>
        <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
          Blurry
        </Text>
      </View>
    </View>
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

const ThemeSwatchItem = memo(function ThemeSwatchItem({
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
  const animatedHeight = useSharedValue(estimatedHeight);

  useEffect(() => {
    if (reduceMotion) {
      animatedHeight.value = estimatedHeight;
    } else {
      animatedHeight.value = withSpring(estimatedHeight, { damping: 18, stiffness: 280, mass: 0.6 });
    }
  }, [estimatedHeight, reduceMotion]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const frameStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
  }));

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
      <Reanimated.View style={scaleStyle}>
        <Reanimated.View
          style={[
            styles.themeThumbnailFrame,
            {
              borderColor: isSelected ? theme.accent : colors.border,
              borderWidth: isSelected ? 2.5 : 1.5,
            },
            frameStyle,
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
        </Reanimated.View>
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
});

interface PresetOriginRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PresetChipItemProps {
  preset: CardPreset;
  isActive: boolean;
  isModified?: boolean;
  savedAt?: number;
  cardPreviewData: CardPreviewData;
  colors: ReturnType<typeof useColors>;
  onPress: (preset: CardPreset, originRect: PresetOriginRect) => void;
  onLongPress: (preset: CardPreset) => void;
  onDelete: (id: string) => void;
  chipRefSetter?: (el: React.ElementRef<typeof TouchableOpacity> | null) => void;
  onLayout?: (x: number) => void;
}

const PresetChipItem = memo(function PresetChipItem({
  preset,
  isActive,
  isModified = false,
  savedAt,
  cardPreviewData,
  colors,
  onPress,
  onLongPress,
  onDelete,
  chipRefSetter,
  onLayout,
}: PresetChipItemProps) {
  const theme = CARD_THEMES.find((t) => t.id === preset.themeId) ?? CARD_THEMES[0];
  const chipRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  // Keep the latest setter in a ref so the handleRef callback stays stable
  // (won't break memo even if the parent passes a new inline function each render)
  const chipRefSetterRef = useRef(chipRefSetter);
  chipRefSetterRef.current = chipRefSetter;
  const handleChipRef = useCallback((el: React.ElementRef<typeof TouchableOpacity> | null) => {
    (chipRef as React.MutableRefObject<React.ElementRef<typeof TouchableOpacity> | null>).current = el;
    chipRefSetterRef.current?.(el);
  }, []);

  const reduceMotion = useReduceMotion();
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!savedAt) return;
    pulseScale.setValue(1);
    Animated.sequence([
      Animated.timing(pulseScale, { toValue: 1.08, duration: 120, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      Animated.timing(pulseScale, { toValue: 0.96, duration: 100, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      Animated.timing(pulseScale, { toValue: 1, duration: 150, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
    ]).start();
  }, [savedAt]);

  const prevPhotoUri = useRef(preset.backgroundPhotoUri);
  const photoFadeAnim = useSharedValue(1);
  const photoAnimStyle = useAnimatedStyle(() => ({ opacity: photoFadeAnim.value }));

  useEffect(() => {
    const prev = prevPhotoUri.current;
    prevPhotoUri.current = preset.backgroundPhotoUri;
    if (preset.backgroundPhotoUri && preset.backgroundPhotoUri !== prev && !reduceMotion) {
      photoFadeAnim.value = 0;
      photoFadeAnim.value = withTiming(1, { duration: 220 });
    }
  }, [preset.backgroundPhotoUri]);

  return (
    <TouchableOpacity
      ref={handleChipRef}
      onPress={() => {
        if (chipRef.current) {
          chipRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
            onPress(preset, { x, y, width, height });
          });
        } else {
          onPress(preset, { x: 0, y: 0, width: 0, height: 0 });
        }
      }}
      onLongPress={() => onLongPress(preset)}
      delayLongPress={350}
      activeOpacity={0.75}
      style={styles.presetChip}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.x)}
    >
      <Animated.View style={{ transform: [{ scale: pulseScale }], alignItems: "center", gap: 5 }}>
      <Animated.View
        style={[
          styles.presetThumbnailFrame,
          {
            borderColor: isActive
              ? isModified
                ? colors.primary + "55"
                : colors.primary
              : colors.border,
            borderWidth: isActive ? 2 : 1.5,
            borderStyle: isActive && isModified ? "dashed" : "solid",
          },
        ]}
      >
        <Reanimated.View style={photoAnimStyle} pointerEvents="none">
          <ShareProgressCard
            {...cardPreviewData}
            visibleStats={preset.visibleStats}
            customMessage={preset.customMessage}
            themeId={preset.themeId}
            renderScale={PRESET_THUMB_SCALE}
            backgroundPhotoUri={preset.backgroundPhotoUri}
            backgroundPhotoCrop={preset.backgroundPhotoCrop}
            backgroundPhotoDimLevel={preset.backgroundPhotoDimLevel}
            backgroundPhotoBlurRadius={preset.backgroundPhotoBlurRadius}
          />
        </Reanimated.View>
        {preset.backgroundPhotoUri ? (
          <Image
            source={{ uri: preset.backgroundPhotoUri }}
            style={styles.presetThumbnailPhoto}
            resizeMode="cover"
          />
        ) : null}
        {isActive && (
          <View
            style={[
              styles.presetThumbnailCheck,
              {
                backgroundColor: theme.accent,
                opacity: isModified ? 0.45 : 1,
              },
            ]}
          >
            <Ionicons name={isModified ? "ellipsis-horizontal" : "checkmark"} size={8} color="#fff" />
          </View>
        )}
        <TouchableOpacity
          onPress={() => onDelete(preset.id)}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={styles.presetThumbnailDelete}
        >
          <Ionicons
            name="close-circle"
            size={16}
            color={isActive ? (isModified ? colors.primary + "88" : colors.primary) : colors.mutedForeground}
          />
        </TouchableOpacity>
      </Animated.View>
      <Text
        style={[
          styles.presetChipText,
          {
            color: isActive
              ? isModified
                ? colors.primary + "99"
                : colors.primary
              : colors.foreground,
            fontFamily: isActive && !isModified ? "Inter_600SemiBold" : "Inter_400Regular",
          },
        ]}
        numberOfLines={1}
      >
        {preset.name}
      </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

const PRESET_CHIP_WIDTH = 60;
const PRESET_CHIP_GAP = 10;

/**
 * Writes a value to AsyncStorage and retries once on failure so that a
 * transient storage-busy error does not silently discard a one-time hint
 * dismissal. After the single retry the error is swallowed — there is nothing
 * more the UI can do at that point.
 */
async function setItemWithRetry(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Second failure — silently drop; the hint may reappear next session
      // but this avoids an unhandled rejection bubbling up to the user.
    }
  }
}

const CardCustomizationModal = forwardRef<CardCustomizationModalHandle, Props>(function CardCustomizationModal({
  visible,
  onClose,
  onGenerate,
  generating,
  cardPreviewData,
  onBadgeDismiss,
  initialBadgeDismissed,
  initialDefaultAction,
  onDefaultActionChange,
  initialLongPressAndRun,
  onLongPressAndRunChange,
  onAutoTriggerDelayChange,
  initialAutoTriggerDelay,
  hasCustomisedCountdown = false,
}: Props, ref) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const { settings, updateSettings } = useFitness();
  const { cameraRollStatus } = usePermissions();
  const reduceMotionRef = useRef(false);
  const reduceMotionShared = useSharedValue(reduceMotion);
  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
    reduceMotionShared.value = reduceMotion;
  }, [reduceMotion]);

  // Stabilise the cardPreviewData object reference so memoized thumbnail
  // children (ThemeSwatchItem, PresetChipItem) can short-circuit on reference
  // equality rather than deep-field comparison on every render.
  const stableCardPreviewData = useMemo<typeof cardPreviewData>(
    () => ({
      ...cardPreviewData,
    }),
    [
      cardPreviewData.userName,
      cardPreviewData.goalLabel,
      cardPreviewData.streak,
      cardPreviewData.totalWorkouts,
      cardPreviewData.totalCalBurned,
      cardPreviewData.totalMinutes,
      cardPreviewData.weightDelta,
      cardPreviewData.weightUnit,
      cardPreviewData.topPR?.exercise,
      cardPreviewData.topPR?.weight,
      cardPreviewData.date,
      cardPreviewData.renderScale,
      cardPreviewData.backgroundPhotoUri,
      cardPreviewData.backgroundPhotoDimLevel,
      cardPreviewData.backgroundPhotoCrop?.scale,
      cardPreviewData.backgroundPhotoCrop?.panX,
      cardPreviewData.backgroundPhotoCrop?.panY,
    ]
  );

  const [visibleStats, setVisibleStats] = useState<CardVisibleStats>({
    ...DEFAULT_VISIBLE_STATS,
  });
  const [customMessage, setCustomMessage] = useState("");
  const [backgroundPhotoUri, setBackgroundPhotoUri] = useState<string | null>(null);
  const [backgroundPhotoCrop, setBackgroundPhotoCrop] = useState<CropData | null>(null);
  const [backgroundPhotoDimLevel, setBackgroundPhotoDimLevel] = useState(DEFAULT_DIM_LEVEL);
  const backgroundPhotoDimLevelRef = useRef<number>(DEFAULT_DIM_LEVEL);
  const [backgroundPhotoBlurRadius, setBackgroundPhotoBlurRadius] = useState(DEFAULT_BLUR_RADIUS);
  const dimPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bgPhotoCloudUriRef = useRef<string | null>(null);

  function applyDimLevel(level: number) {
    backgroundPhotoDimLevelRef.current = level;
    setBackgroundPhotoDimLevel(level);
  }
  const [showCropModal, setShowCropModal] = useState(false);
  const [pendingCropUri, setPendingCropUri] = useState<string | null>(null);
  const [selectedThemeId, setSelectedThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const [displayedThemeId, setDisplayedThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const [thumbnailSize, setThumbnailSize] = useThumbnailSize();
  const sizeLabelOpacity = useSharedValue(thumbnailSize !== "m" ? 1 : 0);
  const sizeLabelHeight = useSharedValue(thumbnailSize !== "m" ? 24 : 0);
  const sizeLabelTranslateY = useSharedValue(0);
  const labelNaturalHeightRef = useRef<number>(24);
  const sizeLabelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sizeLabelOpacity.value,
    height: sizeLabelHeight.value,
    overflow: "hidden",
    transform: [{ translateY: sizeLabelTranslateY.value }],
  }));
  useEffect(() => {
    const visible = thumbnailSize !== "m";
    const rm = reduceMotionRef.current;
    if (rm) {
      sizeLabelOpacity.value = visible ? 1 : 0;
      sizeLabelHeight.value = visible ? labelNaturalHeightRef.current : 0;
      sizeLabelTranslateY.value = 0;
      return;
    }
    sizeLabelOpacity.value = withTiming(visible ? 1 : 0, { duration: 200 });
    sizeLabelHeight.value = withTiming(
      visible ? labelNaturalHeightRef.current : 0,
      { duration: 200 }
    );
    if (visible) {
      // Reset to start position, then spring in with a subtle overshoot
      sizeLabelTranslateY.value = 8;
      sizeLabelTranslateY.value = withSpring(0, { damping: 18, stiffness: 280 });
    } else {
      // Exit: slide down cleanly with timing so the hide feels crisp
      sizeLabelTranslateY.value = withTiming(8, { duration: 200 });
    }
  }, [thumbnailSize]);

  // Thumbnail row crossfade + scale animation on size change
  const thumbRowOpacity = useSharedValue(1);
  const thumbRowScale = useSharedValue(1);
  const thumbRowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: thumbRowOpacity.value,
    transform: [{ scale: thumbRowScale.value }],
  }));
  const presetsRowOpacity = useSharedValue(1);
  const presetsRowScale = useSharedValue(1);
  const presetsRowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: presetsRowOpacity.value,
    transform: [{ scale: presetsRowScale.value }],
  }));
  const prevThumbnailSizeRef = useRef<ThumbnailSize>(thumbnailSize);
  useEffect(() => {
    if (prevThumbnailSizeRef.current === thumbnailSize) return;
    prevThumbnailSizeRef.current = thumbnailSize;
    if (reduceMotionRef.current) return;
    thumbRowOpacity.value = withSequence(
      withTiming(0, { duration: 90 }),
      withTiming(1, { duration: 180 })
    );
    thumbRowScale.value = withSequence(
      withTiming(0.97, { duration: 90 }),
      withTiming(1, { duration: 180 })
    );
    presetsRowOpacity.value = withSequence(
      withTiming(0, { duration: 90 }),
      withTiming(1, { duration: 180 })
    );
    presetsRowScale.value = withSequence(
      withTiming(0.97, { duration: 90 }),
      withTiming(1, { duration: 180 })
    );
  }, [thumbnailSize]);
  const previewOpacity = useRef(new Animated.Value(1)).current;
  const themeTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const knobAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(
      STAT_TOGGLES.map((t) => [
        t.key,
        new Animated.Value(DEFAULT_VISIBLE_STATS[t.key as keyof typeof DEFAULT_VISIBLE_STATS] ? 20 : 0),
      ])
    )
  ).current;
  const pillColorAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(
      STAT_TOGGLES.map((t) => [
        t.key,
        new Animated.Value(DEFAULT_VISIBLE_STATS[t.key as keyof typeof DEFAULT_VISIBLE_STATS] ? 1 : 0),
      ])
    )
  ).current;
  const rowBgAnims = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(
      STAT_TOGGLES.map((t) => [
        t.key,
        new Animated.Value(DEFAULT_VISIBLE_STATS[t.key as keyof typeof DEFAULT_VISIBLE_STATS] ? 1 : 0),
      ])
    )
  ).current;
  const actionLongPressedRef = useRef(false);
  const modalScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const statTogglesYOffsetRef = useRef(0);
  const statTogglesPulseAnim = useRef(new Animated.Value(0)).current;
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const [badgeDismissed, setBadgeDismissed] = useState(false);
  // Seed from the boot-preloaded prop so the very first render shows the
  // correct saved action. loadSaved() will confirm/update from AsyncStorage.
  const [defaultAction, setDefaultAction] = useState<CardAction | null>(
    initialDefaultAction !== undefined ? initialDefaultAction : null,
  );
  const defaultActionPulseAnim = useRef(new Animated.Value(1)).current;
  const hasPulsedDefaultRef = useRef(false);
  const hasUserTappedRef = useRef(false);
  const secondPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thirdPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedAction, setSelectedAction] = useState<CardAction | null>(
    initialDefaultAction !== undefined ? initialDefaultAction : null,
  );
  const [showLongPressHint, setShowLongPressHint] = useState(false);
  const longPressHintFadeAnim = useRef(new Animated.Value(0)).current;
  const longPressHintSlideAnim = useRef(new Animated.Value(6)).current;
  const longPressHintIsFirstRender = useRef(true);
  const [longPressAndRun, setLongPressAndRun] = useState(true);

  // User-chosen auto-trigger delay (0 = off, 1/3/5 = seconds).
  // Seed from the boot-preloaded prop so the first render shows the correct
  // delay. loadSaved() will confirm/update from AsyncStorage on open.
  const [autoTriggerDelay, setAutoTriggerDelay] = useState<number>(() => {
    if (initialAutoTriggerDelay !== undefined && initialAutoTriggerDelay !== null) {
      if (initialAutoTriggerDelay === "off") return 0;
      const p = parseInt(initialAutoTriggerDelay, 10);
      if (!isNaN(p) && p > 0) return p;
    }
    return DEFAULT_AUTO_TRIGGER_DELAY;
  });

  // Auto-trigger state: counts down from delay then fires the default action
  const [autoTriggerCountdown, setAutoTriggerCountdown] = useState<number | null>(null);
  const [autoTriggerBannerWidth, setAutoTriggerBannerWidth] = useState(0);
  const [autoTriggerAction, setAutoTriggerAction] = useState<CardAction | null>(null);
  const [autoTriggerBannerVisible, setAutoTriggerBannerVisible] = useState(false);
  const [autoTriggerGenerating, setAutoTriggerGenerating] = useState(false);
  const [autoTriggerIsPaused, setAutoTriggerIsPaused] = useState(false);
  const [timerResetFlashVisible, setTimerResetFlashVisible] = useState(false);
  const timerResetFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Shows "✓ Done!" in the banner for ~800 ms after auto-generation finishes.
  const [autoTriggerSuccessFlash, setAutoTriggerSuccessFlash] = useState(false);
  const autoTriggerSuccessFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce timer for resuming the countdown on AppState "active" so rapid
  // inactive→active flickers (notification banners, lock screen dismiss) do
  // not restart the timer before the user has really returned to the app.
  const resumeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoTriggerGeneratingRef = useRef(false);
  // Set to true when the user taps Cancel while generation is in progress so
  // the handleGenerate callback can discard the result without showing a toast.
  const generateCancelledRef = useRef(false);
  const autoTriggerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Progress bar animation: goes from 1 → 0 over the full countdown window
  const autoTriggerProgress = useRef(new Animated.Value(1)).current;
  const autoTriggerProgressAnim = useRef<Animated.CompositeAnimation | null>(null);
  // Banner entrance/exit animation: 0 = hidden, 1 = visible
  const autoTriggerBannerAnim = useRef(new Animated.Value(0)).current;
  const hideAutoTriggerBannerRef = useRef<((then?: () => void) => void) | null>(null);
  // Monotonically-increasing session counter; callbacks check against this so
  // any in-flight fade from a prior session becomes a no-op.
  const autoTriggerSessionIdRef = useRef(0);
  // Refs that mirror the active countdown's action and delay so resetAutoTriggerOnInteraction
  // can restart the countdown without stale closures.
  const autoTriggerActiveActionRef = useRef<CardAction | null>(null);
  const autoTriggerActiveDelayRef = useRef<number>(0);
  // Tracks remaining seconds for the active countdown so the AppState handler
  // can resume from the right position after the app returns to the foreground.
  const autoTriggerRemainingRef = useRef<number>(0);
  // True while the countdown is suspended due to the app being backgrounded.
  const autoTriggerIsPausedRef = useRef(false);
  // Keep a ref to always call the latest handleGenerate (avoids stale closure in interval)
  const handleGenerateRef = useRef<((action: CardAction) => Promise<void>) | null>(null);
  // Tracks the current visible prop so the interval can guard against firing after close
  const visibleRef = useRef(visible);
  // Tracks the current selectedAction so the interval always fires/displays the user's
  // in-session choice rather than the defaultAction captured at countdown start.
  const selectedActionRef = useRef<CardAction | null>(null);

  // Presets
  const [presets, setPresets] = useState<CardPreset[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  // Mirror activePresetId in a ref so animation callbacks (which close over a
  // potentially-stale value) can always read the latest settled ID.
  const activePresetIdRef = useRef<string | null>(null);
  activePresetIdRef.current = activePresetId;
  const [activePresetModified, setActivePresetModified] = useState(false);
  const [presetSavedAt, setPresetSavedAt] = useState<number>(0);
  const [showInlineSave, setShowInlineSave] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [renameTargetPreset, setRenameTargetPreset] = useState<CardPreset | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [renamingPreset, setRenamingPreset] = useState(false);
  const presetNameRef = useRef<TextInput>(null);
  const renameInputRef = useRef<TextInput>(null);
  const inlineSaveRef = useRef<View>(null);
  const pendingPresetSwapIdRef = useRef<string | null>(null);

  // When the active preset changes:
  // - If the inline-save field is already open, update it in-place to the new
  //   preset's name so the user never has to close and reopen it.
  // - Otherwise clear any stale draft so the next openInlineSave() pre-fills
  //   with the newly active preset's name.
  useEffect(() => {
    if (showInlineSave) {
      const newPreset = presets.find((p) => p.id === activePresetId);
      setPresetNameInput(newPreset ? newPreset.name : "");
    } else {
      setPresetNameInput("");
    }
  }, [activePresetId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inline-save expand/collapse animation
  const INLINE_SAVE_EXPANDED_H = 118;
  const inlineSaveHeight = useSharedValue(0);
  const inlineSaveOpacity = useSharedValue(0);
  const inlineSaveTranslateY = useSharedValue(0);
  const activePresetBannerOpacity = useSharedValue(1);
  const activePresetBannerTranslateY = useSharedValue(0);
  const inlineSaveOpen = useRef(false);
  // Tracks whether the close animation is still in flight so rapid re-taps
  // cannot reopen the panel before it finishes sliding away (~160 ms).
  const inlineSaveAnimating = useRef(false);
  const inlineSaveAnimatingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const open = showInlineSave && !reorderMode;
    // Banner should be hidden whenever the inline-save panel is open OR
    // reorder mode is active — both states displace it from the layout.
    const bannerHidden = showInlineSave || reorderMode;
    if (!open && inlineSaveOpen.current) {
      // Blur the input so the keyboard dismisses when the field collapses
      presetNameRef.current?.blur();
    }
    // Lock the toggle button only on a true open→closed transition so that
    // initial-mount and dependency changes while already closed don't create
    // spurious tap suppression.
    const wasOpen = inlineSaveOpen.current;
    inlineSaveOpen.current = open;
    if (reduceMotion) {
      inlineSaveHeight.value = open ? INLINE_SAVE_EXPANDED_H : 0;
      inlineSaveOpacity.value = open ? 1 : 0;
      inlineSaveTranslateY.value = 0;
      activePresetBannerOpacity.value = bannerHidden ? 0 : 1;
      activePresetBannerTranslateY.value = 0;
    } else if (open) {
      // Inline-save panel opens → slide banner up and out
      inlineSaveHeight.value = withSpring(INLINE_SAVE_EXPANDED_H, { damping: 20, stiffness: 260, mass: 0.7 });
      inlineSaveOpacity.value = withTiming(1, { duration: 180 });
      inlineSaveTranslateY.value = -10;
      inlineSaveTranslateY.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.6 });
      activePresetBannerOpacity.value = withTiming(0, { duration: 150 });
      activePresetBannerTranslateY.value = withTiming(-10, { duration: 150 });
    } else if (bannerHidden) {
      // Reorder mode turned on (inline-save panel is closed) → slide banner
      // up and out with the same motion as the inline-save open path.
      inlineSaveHeight.value = withTiming(0, { duration: 160 });
      inlineSaveOpacity.value = withTiming(0, { duration: 120 });
      inlineSaveTranslateY.value = 0;
      activePresetBannerOpacity.value = withTiming(0, { duration: 150 });
      activePresetBannerTranslateY.value = withTiming(-10, { duration: 150 });
    } else {
      // Everything closed (including reorder mode off) → slide banner back in
      // Lock the toggle button for the duration of the close animation only
      // when transitioning from open to closed — prevents a double-tap from
      // reopening the panel while it is still sliding away.
      if (wasOpen) {
        if (inlineSaveAnimatingTimer.current) clearTimeout(inlineSaveAnimatingTimer.current);
        inlineSaveAnimating.current = true;
        inlineSaveAnimatingTimer.current = setTimeout(() => {
          inlineSaveAnimating.current = false;
          inlineSaveAnimatingTimer.current = null;
        }, 160);
      }
      inlineSaveHeight.value = withTiming(0, { duration: 160 });
      inlineSaveOpacity.value = withTiming(0, { duration: 120 });
      inlineSaveTranslateY.value = 0;
      activePresetBannerTranslateY.value = withSpring(0, { damping: 13, stiffness: 190, mass: 0.7 });
      activePresetBannerOpacity.value = withDelay(60, withTiming(1, { duration: 220 }));
    }
  }, [showInlineSave, reorderMode, reduceMotion]);
  const activePresetBannerAnimStyle = useAnimatedStyle(() => ({
    opacity: activePresetBannerOpacity.value,
    transform: [{ translateY: activePresetBannerTranslateY.value }],
  }));
  const inlineSaveAnimStyle = useAnimatedStyle(() => ({
    height: inlineSaveHeight.value,
    opacity: inlineSaveOpacity.value,
    overflow: "hidden",
    transform: [{ translateY: inlineSaveTranslateY.value }],
    pointerEvents: inlineSaveHeight.value > 0 ? "auto" : "none",
  }));

  // Timer used to debounce the keyboard-hide → collapse so focus transitions
  // between inputs (keyboard hides briefly then re-appears) don't flicker the panel.
  const inlineSaveCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Collapse the inline save panel when the keyboard is truly dismissed (system
  // gesture, hardware back, or "Done"). When the user moves focus to another
  // input the keyboard will re-appear quickly; keyboardDidShow cancels the
  // pending close so the panel stays open during those focus transitions.
  useEffect(() => {
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      if (inlineSaveCloseTimerRef.current !== null) {
        clearTimeout(inlineSaveCloseTimerRef.current);
      }
      inlineSaveCloseTimerRef.current = setTimeout(() => {
        inlineSaveCloseTimerRef.current = null;
        setShowInlineSave(false);
      }, 150);
    });
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      if (inlineSaveCloseTimerRef.current !== null) {
        clearTimeout(inlineSaveCloseTimerRef.current);
        inlineSaveCloseTimerRef.current = null;
      }
    });
    return () => {
      hideSub.remove();
      showSub.remove();
      if (inlineSaveCloseTimerRef.current !== null) {
        clearTimeout(inlineSaveCloseTimerRef.current);
        inlineSaveCloseTimerRef.current = null;
      }
    };
  }, []);

  // When autoTriggerDelay changes while a countdown is active, immediately sync
  // the running timer to the new duration. This effect covers every call-site
  // (segmented chip, settings sheet, future surfaces) without each needing its
  // own restart logic.
  useEffect(() => {
    if (autoTriggerIntervalRef.current === null && !autoTriggerIsPausedRef.current) return;
    if (autoTriggerDelay === 0) {
      cancelAutoTrigger();
    } else {
      const action = autoTriggerActiveActionRef.current;
      if (action) startAutoTrigger(action, autoTriggerDelay);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTriggerDelay]);

  // Preset thumbnail preview
  const [presetPreviewTarget, setPresetPreviewTarget] = useState<CardPreset | null>(null);
  const [presetPreviewIndex, setPresetPreviewIndex] = useState(0);
  const presetPreviewIndexRef = useRef(0);
  const presetPreviewPresetsRef = useRef<CardPreset[]>([]);
  const [presetPreviewVisible, setPresetPreviewVisible] = useState(false);
  const presetPreviewAnim = useRef(new Animated.Value(0)).current;
  const presetPreviewTranslateX = useRef(new Animated.Value(0)).current;
  const presetPreviewTranslateY = useRef(new Animated.Value(0)).current;
  const presetPreviewOriginScale = useRef(new Animated.Value(1)).current;
  const presetPreviewOriginRect = useRef<PresetOriginRect>({ x: 0, y: 0, width: 0, height: 0 });
  // Map from preset id → the chip's native TouchableOpacity node, used to
  // re-measure origin rect when the user navigates between presets in the preview.
  const presetChipRefsMap = useRef<Map<string, React.ElementRef<typeof TouchableOpacity> | null>>(new Map());
  // Ref for the horizontal preset chips ScrollView so we can scroll it to
  // bring the active chip into view when the preview closes.
  const presetChipsScrollRef = useRef<ScrollView>(null);
  // Per-chip measured x-offsets (chip index → x within the scroll content).
  // Updated via onLayout on each PresetChipItem; drives snapToOffsets so every
  // chip snaps cleanly regardless of padding or list length.
  const chipXOffsetsRef = useRef<number[]>([]);
  const [chipSnapOffsets, setChipSnapOffsets] = useState<number[]>([]);
  const presetCardOpacity = useRef(new Animated.Value(1)).current;
  const presetCardTranslateX = useRef(new Animated.Value(0)).current;

  // Badge fade-in + slide-in animation
  const badgeFadeAnim = useRef(new Animated.Value(0)).current;
  const badgeSlideAnim = useRef(new Animated.Value(5)).current;

  // Timer that fires the badge-dismissed persist after the undo window expires
  const badgePersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPermissionToastShownAtRef = useRef<number>(0);

  useEffect(() => {
    badgeFadeAnim.stopAnimation();
    badgeSlideAnim.stopAnimation();
    if (visible && restoredFromStorage && !badgeDismissed) {
      badgeFadeAnim.setValue(0);
      badgeSlideAnim.setValue(5);
      if (reduceMotion) {
        badgeFadeAnim.setValue(1);
        badgeSlideAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(badgeFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(badgeSlideAnim, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      badgeFadeAnim.setValue(0);
      badgeSlideAnim.setValue(5);
    }
  }, [visible, restoredFromStorage, badgeDismissed, reduceMotion]);

  useEffect(() => {
    if (!visible) {
      longPressHintFadeAnim.stopAnimation();
      longPressHintSlideAnim.stopAnimation();
      longPressHintFadeAnim.setValue(0);
      longPressHintSlideAnim.setValue(6);
      return;
    }
    if (longPressHintIsFirstRender.current) {
      longPressHintIsFirstRender.current = false;
      if (showLongPressHint) {
        // Already visible on mount — snap straight to final state, no animation
        longPressHintFadeAnim.setValue(1);
        longPressHintSlideAnim.setValue(0);
      }
      // If false on mount, initial values (0 / 6) are already the hidden state
      return;
    }
    if (showLongPressHint) {
      longPressHintFadeAnim.setValue(0);
      longPressHintSlideAnim.setValue(6);
      if (reduceMotionRef.current) {
        longPressHintFadeAnim.setValue(1);
        longPressHintSlideAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(longPressHintFadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(longPressHintSlideAnim, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.back(1.2)),
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      longPressHintFadeAnim.setValue(0);
      longPressHintSlideAnim.setValue(6);
    }
  }, [showLongPressHint, visible]);

  function dismissLongPressHint() {
    setItemWithRetry(STORAGE_KEY_LONGPRESS_HINT_SEEN, "1").catch(() => {});
    if (reduceMotionRef.current) {
      setShowLongPressHint(false);
      return;
    }
    Animated.parallel([
      Animated.spring(longPressHintFadeAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      }),
      Animated.spring(longPressHintSlideAnim, {
        toValue: 10,
        useNativeDriver: true,
        damping: 14,
        stiffness: 180,
        mass: 0.8,
      }),
    ]).start(() => {
      setShowLongPressHint(false);
    });
  }

  // Card-preview chip: fade in then auto-dismiss after ~2.5 s
  const cardChipFadeAnim = useRef(new Animated.Value(0)).current;
  const cardChipSlideAnim = useRef(new Animated.Value(6)).current;
  const cardChipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showCardChip, setShowCardChip] = useState(false);
  const [chipDismissCount, setChipDismissCount] = useState(0);

  useEffect(() => {
    if (cardChipTimerRef.current !== null) {
      clearTimeout(cardChipTimerRef.current);
      cardChipTimerRef.current = null;
    }
    cardChipFadeAnim.stopAnimation();
    cardChipSlideAnim.stopAnimation();

    if (!visible) {
      cardChipFadeAnim.setValue(0);
      cardChipSlideAnim.setValue(6);
      setShowCardChip(false);
      return;
    }
    if (!restoredFromStorage) {
      return;
    }

    setShowCardChip(true);

    if (reduceMotion) {
      cardChipFadeAnim.setValue(1);
      cardChipSlideAnim.setValue(0);
      cardChipTimerRef.current = setTimeout(() => {
        cardChipFadeAnim.setValue(0);
        cardChipTimerRef.current = null;
        setChipDismissCount((prev) => {
          const next = prev + 1;
          AsyncStorage.setItem(STORAGE_KEY_CHIP_DISMISS_COUNT, String(next)).catch(() => {});
          return next;
        });
      }, 2500);
    } else {
      cardChipFadeAnim.setValue(0);
      cardChipSlideAnim.setValue(6);
      Animated.parallel([
        Animated.timing(cardChipFadeAnim, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cardChipSlideAnim, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        cardChipTimerRef.current = setTimeout(() => {
          cardChipTimerRef.current = null;
          setChipDismissCount((prev) => {
            const next = prev + 1;
            AsyncStorage.setItem(STORAGE_KEY_CHIP_DISMISS_COUNT, String(next)).catch(() => {});
            return next;
          });
          Animated.parallel([
            Animated.timing(cardChipFadeAnim, {
              toValue: 0,
              duration: 500,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(cardChipSlideAnim, {
              toValue: -6,
              duration: 500,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start();
        }, 2500);
      });
    }

    return () => {
      if (cardChipTimerRef.current !== null) {
        clearTimeout(cardChipTimerRef.current);
        cardChipTimerRef.current = null;
      }
    };
  }, [restoredFromStorage, reduceMotion, visible]);

  function dismissCardChip() {
    if (cardChipTimerRef.current !== null) {
      clearTimeout(cardChipTimerRef.current);
      cardChipTimerRef.current = null;
    }
    cardChipFadeAnim.stopAnimation();
    cardChipSlideAnim.stopAnimation();
    const nextCount = chipDismissCount + 1;
    setChipDismissCount(nextCount);
    AsyncStorage.setItem(STORAGE_KEY_CHIP_DISMISS_COUNT, String(nextCount)).catch(() => {});
    if (reduceMotion) {
      cardChipFadeAnim.setValue(0);
      setShowCardChip(false);
    } else {
      Animated.parallel([
        Animated.timing(cardChipFadeAnim, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(cardChipSlideAnim, {
          toValue: -6,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowCardChip(false);
      });
    }
  }

  // Confirmation / error toast
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmVariant, setConfirmVariant] = useState<"success" | "error">("success");
  const [confirmIcon, setConfirmIcon] = useState<keyof typeof Ionicons.glyphMap | null>(null);
  const [confirmSecondaryIcon, setConfirmSecondaryIcon] = useState<keyof typeof Ionicons.glyphMap | null>(null);
  const [confirmRetryFn, setConfirmRetryFn] = useState<(() => void) | null>(null);
  const [confirmActionFn, setConfirmActionFn] = useState<(() => void) | null>(null);
  const [confirmActionLabel, setConfirmActionLabel] = useState<string | null>(null);
  const confirmOpacity = useRef(new Animated.Value(0)).current;
  const confirmTranslateY = useRef(new Animated.Value(16)).current;
  const confirmSwipeY = useRef(new Animated.Value(0)).current;
  const confirmProgressAnim = useRef(new Animated.Value(1)).current;
  const [confirmHasCountdown, setConfirmHasCountdown] = useState(false);
  const [confirmKeepOpen, setConfirmKeepOpen] = useState(false);
  const [confirmOnPressFn, setConfirmOnPressFn] = useState<(() => void) | null>(null);
  const confirmDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const confirmActionFnRef = useRef<(() => void) | null>(null);
  const confirmHasCountdownRef = useRef(false);
  const confirmSwipingRef = useRef(false);
  const pendingConfirmationArgsRef = useRef<null | [
    msg: string,
    variant?: "success" | "error",
    icon?: keyof typeof Ionicons.glyphMap,
    retryFn?: () => void,
    actionFn?: () => void,
    actionLabel?: string,
    holdDurationOverrideMs?: number,
    secondaryIcon?: keyof typeof Ionicons.glyphMap,
    keepOpen?: boolean,
    onPressFn?: () => void,
  ]>(null);
  const showConfirmationRef = useRef<((...args: [
    msg: string,
    variant?: "success" | "error",
    icon?: keyof typeof Ionicons.glyphMap,
    retryFn?: () => void,
    actionFn?: () => void,
    actionLabel?: string,
    holdDurationOverrideMs?: number,
    secondaryIcon?: keyof typeof Ionicons.glyphMap,
    keepOpen?: boolean,
    onPressFn?: () => void,
  ]) => void) | null>(null);

  // Swipe-to-dismiss hint for the confirm toast (shown once on the first confirm toast the user sees)
  const {
    hintSeen: toastSwipeHintSeen,
    swipeHintOpacity,
    swipeHintSlideAnim,
    triggerToastSwipeHint,
    dismissToastSwipeHint,
    clearToastSwipeHintInstant,
  } = useToastSwipeHint();
  // Swipe-to-dismiss hint for the undo-delete toast (tracked separately so it appears
  // every time a new undo toast shows, independent of whether the confirm hint has fired)
  const {
    hintSeen: undoToastSwipeHintSeen,
    swipeHintOpacity: undoSwipeHintOpacity,
    swipeHintSlideAnim: undoSwipeHintSlideAnim,
    triggerToastSwipeHint: triggerUndoToastSwipeHint,
    dismissToastSwipeHint: dismissUndoToastSwipeHint,
  } = useToastSwipeHint("@raimzeal_undo_toast_swipe_hint_seen");

  // Undo-delete toast
  const [undoDeleteState, setUndoDeleteState] = useState<{ preset: CardPreset; index: number } | null>(null);
  const undoOpacity = useRef(new Animated.Value(0)).current;
  const undoTranslateY = useRef(new Animated.Value(8)).current;
  const undoProgressAnim = useRef(new Animated.Value(1)).current;
  const undoSwipeY = useRef(new Animated.Value(0)).current;
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const undoRemainingMsRef = useRef<number>(0);
  const undoSegmentStartRef = useRef<number>(0);
  const undoTransitionIdRef = useRef<number>(0);
  const undoToastBgPausedRef = useRef(false);
  const undoToastResumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoSwipingRef = useRef(false);
  const pendingUndoToastArgsRef = useRef<null | [preset: CardPreset, index: number]>(null);
  const showUndoToastRef = useRef<((preset: CardPreset, index: number) => void) | null>(null);

  function dismissConfirmToast() {
    if (confirmDismissTimerRef.current !== null) {
      clearTimeout(confirmDismissTimerRef.current);
      confirmDismissTimerRef.current = null;
    }
    if (confirmAnimRef.current !== null) {
      confirmAnimRef.current.stop();
      confirmAnimRef.current = null;
    }
    clearToastSwipeHintInstant();
    confirmOpacity.stopAnimation();
    confirmTranslateY.stopAnimation();
    confirmSwipeY.stopAnimation();
    confirmProgressAnim.stopAnimation();
    confirmOpacity.setValue(0);
    confirmTranslateY.setValue(16);
    confirmSwipeY.setValue(0);
    confirmProgressAnim.setValue(1);
    setConfirmHasCountdown(false);
    confirmHasCountdownRef.current = false;
    setConfirmKeepOpen(false);
    setConfirmMessage(null);
    setConfirmIcon(null);
    setConfirmSecondaryIcon(null);
    setConfirmRetryFn(null);
    setConfirmActionFn(null);
    confirmActionFnRef.current = null;
    setConfirmActionLabel(null);
  }

  function dismissConfirmToastAnimated(onComplete?: () => void) {
    if (confirmDismissTimerRef.current !== null) {
      clearTimeout(confirmDismissTimerRef.current);
      confirmDismissTimerRef.current = null;
    }
    if (confirmAnimRef.current !== null) {
      confirmAnimRef.current.stop();
      confirmAnimRef.current = null;
    }
    dismissToastSwipeHint();
    confirmOpacity.stopAnimation();
    confirmTranslateY.stopAnimation();
    confirmSwipeY.stopAnimation();
    confirmProgressAnim.stopAnimation();
    Animated.timing(confirmOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      confirmOpacity.setValue(0);
      confirmTranslateY.setValue(16);
      confirmSwipeY.setValue(0);
      confirmProgressAnim.setValue(1);
      setConfirmHasCountdown(false);
      confirmHasCountdownRef.current = false;
      setConfirmKeepOpen(false);
      setConfirmMessage(null);
      setConfirmRetryFn(null);
      setConfirmActionFn(null);
      confirmActionFnRef.current = null;
      setConfirmActionLabel(null);
      if (finished) onComplete?.();
    });
  }

  const confirmToastPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        gestureState.dy < -6 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy),
      onPanResponderGrant: () => {
        confirmSwipingRef.current = true;
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy < 0) {
          confirmSwipeY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy < -30 || gestureState.vy < -0.5) {
          confirmSwipingRef.current = false;
          const pending = pendingConfirmationArgsRef.current;
          pendingConfirmationArgsRef.current = null;
          const actionFn = confirmHasCountdownRef.current ? confirmActionFnRef.current : null;
          if (reduceMotionRef.current) {
            dismissConfirmToast();
            actionFn?.();
            if (pending) showConfirmationRef.current?.(...pending);
          } else {
            dismissConfirmToastAnimated(() => {
              actionFn?.();
              if (pending) showConfirmationRef.current?.(...pending);
            });
          }
        } else {
          Animated.spring(confirmSwipeY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 50,
            stiffness: 400,
            mass: 0.6,
            overshootClamping: true,
          }).start(() => {
            confirmSwipingRef.current = false;
            const pending = pendingConfirmationArgsRef.current;
            pendingConfirmationArgsRef.current = null;
            if (pending) showConfirmationRef.current?.(...pending);
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(confirmSwipeY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 50,
          stiffness: 400,
          mass: 0.6,
          overshootClamping: true,
        }).start(() => {
          confirmSwipingRef.current = false;
          const pending = pendingConfirmationArgsRef.current;
          pendingConfirmationArgsRef.current = null;
          if (pending) showConfirmationRef.current?.(...pending);
        });
      },
    })
  ).current;

  const undoToastPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) =>
        gestureState.dy < -6 && Math.abs(gestureState.dx) < Math.abs(gestureState.dy),
      onPanResponderGrant: () => {
        undoSwipingRef.current = true;
        pauseUndoToast();
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy < 0) {
          undoSwipeY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy < -30 || gestureState.vy < -0.5) {
          undoSwipingRef.current = false;
          const pending = pendingUndoToastArgsRef.current;
          pendingUndoToastArgsRef.current = null;
          if (reduceMotionRef.current) {
            dismissUndoToast(() => {
              if (pending) showUndoToastRef.current?.(...pending);
            });
          } else {
            dismissUndoToastAnimated(() => {
              if (pending) showUndoToastRef.current?.(...pending);
            });
          }
        } else {
          Animated.spring(undoSwipeY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 50,
            stiffness: 400,
            mass: 0.6,
            overshootClamping: true,
          }).start(() => {
            undoSwipingRef.current = false;
            const pending = pendingUndoToastArgsRef.current;
            pendingUndoToastArgsRef.current = null;
            if (pending) showUndoToastRef.current?.(...pending);
            resumeUndoToast();
          });
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(undoSwipeY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 50,
          stiffness: 400,
          mass: 0.6,
          overshootClamping: true,
        }).start(() => {
          undoSwipingRef.current = false;
          const pending = pendingUndoToastArgsRef.current;
          pendingUndoToastArgsRef.current = null;
          if (pending) showUndoToastRef.current?.(...pending);
          resumeUndoToast();
        });
      },
    })
  ).current;

  function showConfirmation(
    msg: string,
    variant: "success" | "error" = "success",
    icon?: keyof typeof Ionicons.glyphMap,
    retryFn?: () => void,
    actionFn?: () => void,
    actionLabel?: string,
    holdDurationOverrideMs?: number,
    secondaryIcon?: keyof typeof Ionicons.glyphMap,
    keepOpen?: boolean,
    onPressFn?: () => void,
  ) {
    showConfirmationRef.current = showConfirmation;
    if (confirmSwipingRef.current) {
      pendingConfirmationArgsRef.current = [msg, variant, icon, retryFn, actionFn, actionLabel, holdDurationOverrideMs, secondaryIcon, keepOpen, onPressFn];
      return;
    }
    if (confirmDismissTimerRef.current !== null) {
      clearTimeout(confirmDismissTimerRef.current);
      confirmDismissTimerRef.current = null;
    }
    if (confirmAnimRef.current !== null) {
      confirmAnimRef.current.stop();
      confirmAnimRef.current = null;
    }
    confirmOpacity.stopAnimation();
    confirmTranslateY.stopAnimation();
    confirmSwipeY.stopAnimation();
    setConfirmMessage(msg);
    setConfirmVariant(variant);
    setConfirmIcon(icon ?? null);
    setConfirmSecondaryIcon(secondaryIcon ?? null);
    setConfirmRetryFn(retryFn ? () => retryFn : null);
    setConfirmActionFn(actionFn ? () => actionFn : null);
    confirmActionFnRef.current = actionFn ?? null;
    setConfirmActionLabel(actionLabel ?? null);
    setConfirmKeepOpen(!!keepOpen);
    setConfirmOnPressFn(onPressFn ? () => onPressFn : null);
    confirmOpacity.setValue(0);
    confirmTranslateY.setValue(16);
    confirmSwipeY.setValue(0);
    confirmProgressAnim.stopAnimation();
    confirmProgressAnim.setValue(1);
    if (!toastSwipeHintSeen) {
      triggerToastSwipeHint(reduceMotionRef.current);
    }
    const holdDuration = holdDurationOverrideMs ?? (retryFn ? 4500 : variant === "error" ? 2200 : 1600);
    const noAutoDismiss = (!holdDurationOverrideMs && !!actionFn) || !!keepOpen;
    const showProgress = !!holdDurationOverrideMs && !reduceMotionRef.current;
    setConfirmHasCountdown(!!holdDurationOverrideMs);
    confirmHasCountdownRef.current = !!holdDurationOverrideMs;
    if (reduceMotionRef.current) {
      confirmOpacity.setValue(1);
      confirmTranslateY.setValue(0);
      if (!noAutoDismiss) {
        confirmDismissTimerRef.current = setTimeout(() => {
          confirmDismissTimerRef.current = null;
          confirmOpacity.setValue(0);
          confirmTranslateY.setValue(16);
          confirmProgressAnim.setValue(1);
          setConfirmHasCountdown(false);
          confirmHasCountdownRef.current = false;
          setConfirmMessage(null);
        }, holdDuration);
      }
    } else if (noAutoDismiss) {
      Animated.parallel([
        Animated.timing(confirmOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(confirmTranslateY, { toValue: 0, damping: 50, stiffness: 400, mass: 0.6, overshootClamping: true, useNativeDriver: true }),
      ]).start();
    } else {
      if (showProgress) {
        Animated.timing(confirmProgressAnim, {
          toValue: 0,
          duration: holdDuration,
          useNativeDriver: false,
        }).start();
      }
      const seq = Animated.sequence([
        Animated.parallel([
          Animated.timing(confirmOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(confirmTranslateY, { toValue: 0, damping: 50, stiffness: 400, mass: 0.6, overshootClamping: true, useNativeDriver: true }),
        ]),
        Animated.delay(holdDuration),
        Animated.parallel([
          Animated.timing(confirmOpacity, { toValue: 0, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.timing(confirmTranslateY, { toValue: -8, duration: 400, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ]);
      confirmAnimRef.current = seq;
      seq.start(({ finished }) => {
        confirmAnimRef.current = null;
        if (finished) {
          confirmTranslateY.setValue(16);
          confirmProgressAnim.setValue(1);
          setConfirmHasCountdown(false);
          confirmHasCountdownRef.current = false;
          setConfirmMessage(null);
        }
      });
    }
  }

  useEffect(() => {
    if (!visible) {
      // Reset pulse so next open can animate again
      hasPulsedDefaultRef.current = false;
      hasUserTappedRef.current = false;
      if (secondPulseTimerRef.current !== null) {
        clearTimeout(secondPulseTimerRef.current);
        secondPulseTimerRef.current = null;
      }
      if (thirdPulseTimerRef.current !== null) {
        clearTimeout(thirdPulseTimerRef.current);
        thirdPulseTimerRef.current = null;
      }
      // Clean up any pending auto-trigger when the modal closes
      if (autoTriggerIntervalRef.current !== null) {
        clearInterval(autoTriggerIntervalRef.current);
        autoTriggerIntervalRef.current = null;
      }
      autoTriggerProgressAnim.current?.stop();
      autoTriggerProgressAnim.current = null;
      autoTriggerIsPausedRef.current = false;
      // Bump session ID so any in-flight banner fade callback becomes a no-op
      autoTriggerSessionIdRef.current += 1;
      setAutoTriggerBannerVisible(false);
      autoTriggerGeneratingRef.current = false;
      generateCancelledRef.current = false;
      if (autoTriggerSuccessFlashTimerRef.current !== null) {
        clearTimeout(autoTriggerSuccessFlashTimerRef.current);
        autoTriggerSuccessFlashTimerRef.current = null;
      }
      setAutoTriggerSuccessFlash(false);
      if (resumeDebounceTimerRef.current !== null) {
        clearTimeout(resumeDebounceTimerRef.current);
        resumeDebounceTimerRef.current = null;
      }
      setAutoTriggerGenerating(false);
      setAutoTriggerCountdown(null);
      setAutoTriggerAction(null);
      // Clear any mid-swipe gesture state on the confirm toast so stale
      // swipe flags and queued toasts don't persist into the next open.
      confirmSwipingRef.current = false;
      pendingConfirmationArgsRef.current = null;
      // Same cleanup for the undo-delete toast swipe guard.
      undoSwipingRef.current = false;
      pendingUndoToastArgsRef.current = null;
      // Dismiss any in-progress undo-delete toast so the timer and animation
      // don't fire against unmounted/invisible state after the modal closes.
      if (undoTimerRef.current !== null) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
      if (undoAnimRef.current !== null) {
        undoAnimRef.current.stop();
        undoAnimRef.current = null;
      }
      setUndoDeleteState(null);
      // Flush any pending badge-dismissed persist immediately so the
      // preference is not lost if the user closes the modal mid-undo-window.
      if (badgePersistTimerRef.current !== null) {
        clearTimeout(badgePersistTimerRef.current);
        badgePersistTimerRef.current = null;
        AsyncStorage.setItem(STORAGE_KEY_BADGE_DISMISSED, "1").catch(() => {});
        onBadgeDismiss?.();
      }
      return;
    }
    setRestoredFromStorage(false);
    setBadgeDismissed(false);
    setShowInlineSave(false);
    setPresetNameInput("");
    setThemeScrollAtEnd(false);
    setThemeHasOverflow(false);
    themeContainerWidth.current = 0;
    themeContentWidth.current = 0;
    // Synchronously reset ALL one-time hints to hidden before the async storage
    // read starts. This prevents stale state from a previous session flickering
    // visible for even one render frame while the storage flag is in flight.
    // loadSaved() re-shows each hint only after confirming eligibility.
    setShowLongPressHint(false);
    // disabled-btn LP hint: set dismissed=true as a guard; loadSaved() will
    // lift it (set to false) if the user hasn't permanently dismissed the hint.
    setDisabledBtnLpHintDismissed(true);
    disabledBtnLpHintFadeAnim.setValue(0);
    setDisabledBtnLpHintMounted(false);
    // tap-generate and tap-again hints: reset in case they were left visible
    // when the modal was previously closed mid-hint.
    setShowTapGenerateHint(false);
    setTapGenerateHintMounted(false);
    tapGenerateHintFadeAnim.setValue(0);
    setTapAgainHintMounted(false);
    tapAgainHintFadeAnim.setValue(0);
    // Eligibility refs: reset so stale values from the previous open cannot
    // trigger hints before loadSaved() has read the current storage state.
    openedWithNoSavedActionRef.current = false;
    tapAgainHintEligibleRef.current = false;

    // Cancellation flag: prevents async loadSaved from acting after the modal closes
    let cancelled = false;

    async function loadSaved() {
      try {
        const [savedStats, savedMessage, savedTheme, loadedPresets, savedAction, dismissedFlag, savedBgPhoto, lpHintSeen, lpHintOpensRaw, savedLpAndRun, savedAutoTriggerDelay, savedActivePresetId, disabledBtnLpHintSeenRaw, savedChipDismissCount, tapGenerateHintSeenRaw, statsNudgeSeenRaw, tapAgainHintSeenRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_STATS),
          AsyncStorage.getItem(STORAGE_KEY_MESSAGE),
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          loadPresets(),
          AsyncStorage.getItem(STORAGE_KEY_ACTION),
          AsyncStorage.getItem(STORAGE_KEY_BADGE_DISMISSED),
          AsyncStorage.getItem(STORAGE_KEY_BG_PHOTO),
          AsyncStorage.getItem(STORAGE_KEY_LONGPRESS_HINT_SEEN),
          AsyncStorage.getItem(STORAGE_KEY_LONGPRESS_HINT_OPENS),
          AsyncStorage.getItem(STORAGE_KEY_LONGPRESS_AND_RUN),
          AsyncStorage.getItem(STORAGE_KEY_AUTO_TRIGGER_DELAY),
          AsyncStorage.getItem(STORAGE_KEY_ACTIVE_PRESET),
          AsyncStorage.getItem(STORAGE_KEY_DISABLED_BTN_LP_HINT_SEEN),
          AsyncStorage.getItem(STORAGE_KEY_CHIP_DISMISS_COUNT),
          AsyncStorage.getItem(STORAGE_KEY_TAP_GENERATE_HINT_SEEN),
          AsyncStorage.getItem(STORAGE_KEY_STATS_NUDGE_SEEN),
          AsyncStorage.getItem(STORAGE_KEY_TAP_AGAIN_HINT_SEEN),
        ]);

        if (cancelled) return;

        setPresets(loadedPresets);
        setReorderMode(false);
        const restoredActiveId = savedActivePresetId && loadedPresets.some((p) => p.id === savedActivePresetId)
          ? savedActivePresetId
          : null;
        setActivePresetId(restoredActiveId);

        // ── Background cloud merge (non-blocking) ──────────────────────────
        // 1. Drain any pending offline sync that failed during a previous session.
        // 2. Fetch cloud presets and merge: cloud wins for matching IDs,
        //    local-only presets (offline additions) are appended and re-synced.
        if (isSupabaseConfigured) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session?.user || cancelled) return;
            const userId = session.user.id;

            // Drain pending offline write
            AsyncStorage.getItem(STORAGE_KEY_PENDING_PRESET_SYNC)
              .then((pendingRaw) => {
                if (!pendingRaw || cancelled) return;
                try {
                  const pending = JSON.parse(pendingRaw) as { userId: string; presets: CardPreset[] };
                  if (pending.userId === userId) {
                    syncPresetsToCloud(userId, pending.presets as unknown as import("@/lib/db").StoredCardPreset[])
                      .then((ok) => {
                        if (ok) AsyncStorage.removeItem(STORAGE_KEY_PENDING_PRESET_SYNC).catch(() => {});
                      })
                      .catch(() => {});
                  }
                } catch { /* corrupted queue entry — ignore */ }
              })
              .catch(() => {});

            // Fetch and merge cloud presets
            fetchPresetsFromCloud(userId)
              .then((cloudPresets) => {
                if (!cloudPresets || cloudPresets.length === 0 || cancelled) return;
                setPresets((current) => {
                  const cloudById = new Map(cloudPresets.map((p) => [p.id, p]));
                  // Start from cloud list (cloud wins for any shared ID)
                  const merged: CardPreset[] = [...cloudPresets as unknown as CardPreset[]];
                  // Keep local-only presets (offline additions not yet in cloud)
                  for (const local of current) {
                    if (!cloudById.has(local.id)) merged.push(local);
                  }
                  merged.sort((a, b) => a.createdAt - b.createdAt);
                  const capped = merged.slice(0, MAX_PRESETS);
                  if (JSON.stringify(capped) === JSON.stringify(current)) return current;
                  // Persist merged result — savePresets re-syncs local-only entries to cloud
                  savePresets(capped).catch(() => {});
                  return capped;
                });
              })
              .catch(() => {});
          }).catch(() => {});
        }

        let effectiveStats = { ...DEFAULT_VISIBLE_STATS };
        if (savedStats) {
          const parsed = JSON.parse(savedStats) as Partial<CardVisibleStats>;
          effectiveStats = { ...DEFAULT_VISIBLE_STATS, ...parsed };
        }
        const effectiveMessage = savedMessage ?? "";
        const effectiveTheme = (savedTheme as CardThemeId) ?? DEFAULT_THEME_ID;

        const hadSavedData = !!(savedStats || savedMessage || savedTheme);

        setVisibleStats(effectiveStats);
        syncKnobsImmediate(effectiveStats);
        setCustomMessage(effectiveMessage);
        if (savedBgPhoto) {
          try {
            const parsed = JSON.parse(savedBgPhoto) as { uri: string; scale?: number; panX?: number; panY?: number; dimLevel?: number; blurRadius?: number };
            setBackgroundPhotoUri(parsed.uri);
            if (parsed.scale != null) {
              setBackgroundPhotoCrop({ scale: parsed.scale, panX: parsed.panX ?? 0, panY: parsed.panY ?? 0 });
            } else {
              setBackgroundPhotoCrop(null);
            }
            applyDimLevel(parsed.dimLevel ?? settings.backgroundPhotoDimLevel ?? DEFAULT_DIM_LEVEL);
            setBackgroundPhotoBlurRadius(parsed.blurRadius ?? settings.backgroundPhotoBlurRadius ?? DEFAULT_BLUR_RADIUS);
          } catch {
            // Legacy: plain URI string stored before crop was introduced
            setBackgroundPhotoUri(savedBgPhoto);
            setBackgroundPhotoCrop(null);
            applyDimLevel(settings.backgroundPhotoDimLevel ?? DEFAULT_DIM_LEVEL);
            setBackgroundPhotoBlurRadius(settings.backgroundPhotoBlurRadius ?? DEFAULT_BLUR_RADIUS);
          }
        } else {
          setBackgroundPhotoUri(null);
          setBackgroundPhotoCrop(null);
          applyDimLevel(settings.backgroundPhotoDimLevel ?? DEFAULT_DIM_LEVEL);
          setBackgroundPhotoBlurRadius(settings.backgroundPhotoBlurRadius ?? DEFAULT_BLUR_RADIUS);
        }
        setSelectedThemeId(effectiveTheme);
        setDisplayedThemeId(effectiveTheme);
        setRestoredFromStorage(hadSavedData);
        // Badge is dismissed if AsyncStorage says so OR if the cloud-backed
        // preference (initialBadgeDismissed) is true — the latter ensures a
        // fresh device honours the user's cross-device setting immediately.
        setBadgeDismissed(dismissedFlag === "1" || initialBadgeDismissed === true);
        setChipDismissCount(parseInt(savedChipDismissCount ?? "0", 10) || 0);
        const validActions: CardAction[] = ["share", "save", "both", "copy"];
        const asyncStorageAction = validActions.includes(savedAction as CardAction)
          ? (savedAction as CardAction)
          : null;
        // Preferred action: cloud value (initialDefaultAction) wins when provided
        // (authenticated user on a fresh device); fall back to AsyncStorage.
        const resolvedAction = initialDefaultAction !== undefined
          ? initialDefaultAction
          : asyncStorageAction;
        setDefaultAction(resolvedAction);
        setSelectedAction(resolvedAction);

        // Tap-generate hint: eligible only when the user has no prior saved action
        // and hasn't already seen/dismissed the hint.
        openedWithNoSavedActionRef.current = resolvedAction === null && tapGenerateHintSeenRaw !== "1";

        // Tap-again hint: eligible until the user has seen it once (globally).
        tapAgainHintEligibleRef.current = tapAgainHintSeenRaw !== "1";

        // Long-press-and-run preference: cloud value (initialLongPressAndRun) wins when
        // provided (authenticated user on a fresh device); fall back to AsyncStorage.
        if (initialLongPressAndRun !== undefined) {
          setLongPressAndRun(initialLongPressAndRun);
        } else {
          setLongPressAndRun(savedLpAndRun === null ? true : savedLpAndRun !== "0");
        }

        // Long-press hint: show for up to LONGPRESS_HINT_MAX_OPENS sessions, dismiss once user long-presses.
        // Skip entirely if the user already has a default set (they've already discovered the gesture).
        if (lpHintSeen !== "1" && resolvedAction === null) {
          const opens = parseInt(lpHintOpensRaw ?? "0", 10) || 0;
          const nextOpens = opens + 1;
          if (nextOpens <= LONGPRESS_HINT_MAX_OPENS) {
            setShowLongPressHint(true);
            setItemWithRetry(STORAGE_KEY_LONGPRESS_HINT_OPENS, String(nextOpens)).catch(() => {});
          } else {
            setShowLongPressHint(false);
          }
        } else {
          setShowLongPressHint(false);
        }

        // Disabled-button long-press hint: persisted dismiss count (backward-compat: "1" → count of 1)
        // The guard (dismissed=true) was set synchronously above. Lift it here
        // when the hint has not been permanently suppressed AND it is relevant
        // to show it this session.
        {
          const rawCount = disabledBtnLpHintSeenRaw !== null ? parseInt(disabledBtnLpHintSeenRaw, 10) : 0;
          const parsedCount = isNaN(rawCount) ? 0 : rawCount;
          disabledBtnLpHintShowCountRef.current = Math.min(parsedCount, DISABLED_BTN_LP_HINT_MAX_SHOWS);

          const allStatsOff = !Object.values(effectiveStats).some(Boolean);

          if (parsedCount >= DISABLED_BTN_LP_HINT_MAX_SHOWS) {
            // Permanently suppressed — guard stays.
          } else if (parsedCount === 0 || allStatsOff) {
            // Two cases where the hint should be eligible this session:
            // 1. Never dismissed (count=0) — first-time user, lift guard immediately.
            // 2. Dismissed before but still below the max AND reopened with all stats
            //    already off (cross-session rediscovery) — lift guard so the effect
            //    can surface the hint again. The within-session transition path
            //    (≥1 → 0 detected via disabledBtnLpHintPrevAnyStatEnabled) is
            //    unchanged and continues to work as before.
            setDisabledBtnLpHintDismissed(false);
          }
          // else: count > 0 and at least one stat is on — guard stays (hint is
          // not relevant when stats are enabled; the effect won't show it anyway,
          // but keeping dismissed=true avoids a redundant state update).
        }

        // Stats nudge: show once to first-time users so they know stats can be customised.
        // Set both state (to re-trigger the effect that may have already run) and the ref
        // (for the async timeout callback guard that reads it via closure).
        if (statsNudgeSeenRaw !== "1") {
          statsNudgeEligibleRef.current = true;
          setStatsNudgeEligible(true);
        }

        // Auto-trigger: if there's a default action and at least one stat enabled, start countdown
        const effectiveAnyStatEnabled = Object.values(effectiveStats).some(Boolean);
        let effectiveAutoTriggerDelay = DEFAULT_AUTO_TRIGGER_DELAY;
        // Prefer the boot-preloaded value (passed as prop) so the countdown
        // never flashes from DEFAULT_AUTO_TRIGGER_DELAY to the stored value.
        const rawDelaySource = initialAutoTriggerDelay !== undefined ? initialAutoTriggerDelay : savedAutoTriggerDelay;
        if (rawDelaySource === "off") {
          effectiveAutoTriggerDelay = 0;
        } else if (rawDelaySource !== null) {
          const parsed = parseInt(rawDelaySource, 10);
          if (!isNaN(parsed) && parsed > 0) effectiveAutoTriggerDelay = parsed;
        }
        setAutoTriggerDelay(effectiveAutoTriggerDelay);
        if (resolvedAction && effectiveAnyStatEnabled && effectiveAutoTriggerDelay > 0) {
          startAutoTrigger(resolvedAction, effectiveAutoTriggerDelay);
        }
      } catch {
        setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
        syncKnobsImmediate({ ...DEFAULT_VISIBLE_STATS });
        setCustomMessage("");
        setBackgroundPhotoUri(null);
        setBackgroundPhotoCrop(null);
        setSelectedThemeId(DEFAULT_THEME_ID);
        setDisplayedThemeId(DEFAULT_THEME_ID);
        setThumbnailSize("m");
        setRestoredFromStorage(false);
        setBadgeDismissed(false);
        setDefaultAction(null);
        setSelectedAction(null);
        setShowLongPressHint(false);
        // Lift the disabled-btn guard on error (unknown state — allow showing).
        setDisabledBtnLpHintDismissed(false);
      }
    }
    loadSaved();
    return () => { cancelled = true; };
  }, [visible]);

  // Reset the auto-trigger banner animation value on close so the next open
  // always starts from a clean hidden state rather than a stale in-flight value.
  useEffect(() => {
    if (!visible) {
      autoTriggerBannerAnim.stopAnimation();
      autoTriggerBannerAnim.setValue(0);
    }
  }, [visible]);

  // Pulse the default action button once when the modal opens with a saved default.
  // A softer follow-up pulse (1 → 1.03 → 1) fires ~1.5 s later if the user hasn't tapped yet.
  useEffect(() => {
    if (!visible) {
      defaultActionPulseAnim.stopAnimation();
      defaultActionPulseAnim.setValue(1);
      return;
    }
    if (defaultAction === null) return;
    if (hasPulsedDefaultRef.current) return;
    hasPulsedDefaultRef.current = true;
    if (reduceMotionRef.current) return;
    defaultActionPulseAnim.setValue(1);
    Animated.sequence([
      Animated.timing(defaultActionPulseAnim, { toValue: 1.06, duration: 150, useNativeDriver: true }),
      Animated.timing(defaultActionPulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    // Schedule the softer follow-up pulse
    secondPulseTimerRef.current = setTimeout(() => {
      secondPulseTimerRef.current = null;
      if (hasUserTappedRef.current) return;
      if (reduceMotionRef.current) return;
      Animated.sequence([
        Animated.timing(defaultActionPulseAnim, { toValue: 1.03, duration: 200, useNativeDriver: true }),
        Animated.timing(defaultActionPulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      // Schedule the third ultra-subtle pulse ~4 s after mount (2500 ms after the second)
      thirdPulseTimerRef.current = setTimeout(() => {
        thirdPulseTimerRef.current = null;
        if (hasUserTappedRef.current) return;
        if (reduceMotionRef.current) return;
        Animated.sequence([
          Animated.timing(defaultActionPulseAnim, { toValue: 1.02, duration: 250, useNativeDriver: true }),
          Animated.timing(defaultActionPulseAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();
      }, 2500);
    }, 1500);
  }, [defaultAction, visible]);

  // When the user switches their selected action while a countdown is running, either cancel
  // the countdown (if the new action is photo-blocked) or update the banner label to stay in sync.
  useEffect(() => {
    if (autoTriggerCountdown !== null && selectedAction !== null) {
      const requiresPhotoAccess = selectedAction === "save" || selectedAction === "both";
      if (requiresPhotoAccess && cameraRollStatus === "restricted") {
        cancelAutoTrigger();
        showConfirmation(
          "Photo access restricted by device policy — contact your admin",
          "error",
          "lock-closed-outline",
        );
        return;
      }
      if (requiresPhotoAccess && cameraRollStatus === "denied") {
        cancelAutoTrigger();
        showConfirmation(
          "Photo access needed — tap to open Settings",
          "error",
          "lock-closed-outline",
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          () => Linking.openSettings(),
        );
        return;
      }
      setAutoTriggerAction(selectedAction);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAction, cameraRollStatus]);

  // Persist the dim/blur level to AsyncStorage (debounced) whenever the user moves the sliders.
  // Also syncs the preference to the cloud so it survives reinstalls on a new device.
  useEffect(() => {
    if (!backgroundPhotoUri) return;
    if (dimPersistTimerRef.current) clearTimeout(dimPersistTimerRef.current);
    dimPersistTimerRef.current = setTimeout(() => {
      const payload = backgroundPhotoCrop
        ? JSON.stringify({ uri: backgroundPhotoUri, ...backgroundPhotoCrop, dimLevel: backgroundPhotoDimLevel, blurRadius: backgroundPhotoBlurRadius })
        : JSON.stringify({ uri: backgroundPhotoUri, dimLevel: backgroundPhotoDimLevel, blurRadius: backgroundPhotoBlurRadius });
      AsyncStorage.setItem(STORAGE_KEY_BG_PHOTO, payload).catch(() => {});
      updateSettings({ backgroundPhotoDimLevel, backgroundPhotoBlurRadius });
    }, 250);
    return () => {
      if (dimPersistTimerRef.current) clearTimeout(dimPersistTimerRef.current);
    };
  }, [backgroundPhotoDimLevel, backgroundPhotoBlurRadius, backgroundPhotoUri, backgroundPhotoCrop]);

  // Fire-and-forget background upload when the user picks a new local photo.
  // Skips HTTPS URLs (already cloud-stored) and default bundled assets.
  // On success, stores the storagePath in cloud preferences so the photo can
  // be restored on a fresh device via the reconciliation effect in profile.tsx.
  useEffect(() => {
    if (!backgroundPhotoUri) return;
    if (
      !backgroundPhotoUri.startsWith("file://") &&
      !backgroundPhotoUri.startsWith("ph://") &&
      !backgroundPhotoUri.startsWith("content://")
    ) return;
    if (bgPhotoCloudUriRef.current === backgroundPhotoUri) return;
    if (!isSupabaseConfigured) return;
    const uriToUpload = backgroundPhotoUri;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const ext = uriToUpload.split(".").pop()?.toLowerCase() ?? "jpg";
      const contentType =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const filename = `card_bg_${Date.now()}.${ext}`;
      fetch(`${getApiBase()}/user/card-bg-photo/upload-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ filename, contentType }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<{ uploadUrl: string; storagePath: string }>) : null))
        .then(async (data) => {
          if (!data) return;
          if (backgroundPhotoUri !== uriToUpload) return;
          const fileRes = await fetch(uriToUpload);
          const blob = await fileRes.blob();
          const putRes = await fetch(data.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": contentType },
            body: blob,
          });
          if (!putRes.ok) return;
          bgPhotoCloudUriRef.current = uriToUpload;
          updateSettings({ cardBgPhotoStoragePath: data.storagePath });
        })
        .catch(() => {});
    }).catch(() => {});
  }, [backgroundPhotoUri]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        lastPermissionToastShownAtRef.current = 0;
        AsyncStorage.getItem(STORAGE_KEY_ACTION).then((saved) => {
          const validActions: CardAction[] = ["share", "save", "both", "copy"];
          setDefaultAction(
            validActions.includes(saved as CardAction) ? (saved as CardAction) : null
          );
        }).catch(() => {});

        // Debounce the countdown resume by 300 ms so rapid inactive→active
        // flickers (notification banners, lock screen preview) don't restart
        // the timer before the user has truly returned to the app.
        if (autoTriggerIsPausedRef.current) {
          if (resumeDebounceTimerRef.current !== null) {
            clearTimeout(resumeDebounceTimerRef.current);
          }
          resumeDebounceTimerRef.current = setTimeout(() => {
            resumeDebounceTimerRef.current = null;
            // Re-check: the app may have re-backgrounded during the debounce.
            if (!autoTriggerIsPausedRef.current) return;
            autoTriggerIsPausedRef.current = false;
            setAutoTriggerIsPaused(false);

            const remaining = autoTriggerRemainingRef.current;
            const action = autoTriggerActiveActionRef.current;
            const delay = autoTriggerActiveDelayRef.current;
            if (action && delay > 0 && remaining > 0) {
              // Restart the progress bar animation from the paused position
              if (!reduceMotionRef.current) {
                const progressFrom = remaining / delay;
                autoTriggerProgress.setValue(progressFrom);
                autoTriggerProgressAnim.current = Animated.timing(autoTriggerProgress, {
                  toValue: 0,
                  duration: remaining * 1000,
                  useNativeDriver: true,
                });
                autoTriggerProgressAnim.current.start();
              }
              // Restart the interval for the remaining seconds
              let rem = remaining;
              autoTriggerIntervalRef.current = setInterval(() => {
                rem -= 1;
                autoTriggerRemainingRef.current = rem;
                const effectiveAction = selectedActionRef.current ?? action;
                if (rem <= 0) {
                  clearInterval(autoTriggerIntervalRef.current!);
                  autoTriggerIntervalRef.current = null;
                  setAutoTriggerCountdown(null);
                  autoTriggerGeneratingRef.current = true;
                  setAutoTriggerGenerating(true);
                  if (visibleRef.current) {
                    handleGenerateRef.current?.(effectiveAction);
                  }
                } else {
                  setAutoTriggerCountdown(rem);
                  setAutoTriggerAction(effectiveAction);
                }
              }, 1000);
            }
          }, 300);
        }
        // Also debounce-resume the undo-delete toast if it was paused by backgrounding.
        if (undoToastBgPausedRef.current) {
          if (undoToastResumeDebounceRef.current !== null) {
            clearTimeout(undoToastResumeDebounceRef.current);
          }
          undoToastResumeDebounceRef.current = setTimeout(() => {
            undoToastResumeDebounceRef.current = null;
            // Re-check: the app may have re-backgrounded during the debounce.
            if (!undoToastBgPausedRef.current) return;
            undoToastBgPausedRef.current = false;
            resumeUndoToast();
          }, 300);
        }
      } else if (nextState === "background" || nextState === "inactive") {
        // Cancel any pending resume debounce — the app went away again before
        // the 300 ms elapsed, so do not restart the countdown.
        if (resumeDebounceTimerRef.current !== null) {
          clearTimeout(resumeDebounceTimerRef.current);
          resumeDebounceTimerRef.current = null;
        }
        // Pause the countdown while the app is not in the foreground so it
        // does not fire silently behind the user's back.
        if (autoTriggerIntervalRef.current !== null && !autoTriggerGeneratingRef.current) {
          clearInterval(autoTriggerIntervalRef.current);
          autoTriggerIntervalRef.current = null;
          autoTriggerProgressAnim.current?.stop();
          autoTriggerProgressAnim.current = null;
          autoTriggerIsPausedRef.current = true;
          // Update React state so the banner immediately switches to the
          // "Paused · X in Ys" UI while the app is in the background.
          setAutoTriggerIsPaused(true);
        }
        // Also pause the undo-delete toast timer so it doesn't silently fire
        // while the user is away from the app.
        if (undoToastResumeDebounceRef.current !== null) {
          clearTimeout(undoToastResumeDebounceRef.current);
          undoToastResumeDebounceRef.current = null;
        }
        if (undoTimerRef.current !== null) {
          pauseUndoToast();
          undoToastBgPausedRef.current = true;
        }
      }
    });
    return () => {
      subscription.remove();
      // Cancel any in-flight resume debounce so it doesn't fire after the
      // effect is torn down (e.g. modal closed while app was backgrounded).
      if (resumeDebounceTimerRef.current !== null) {
        clearTimeout(resumeDebounceTimerRef.current);
        resumeDebounceTimerRef.current = null;
      }
      if (undoToastResumeDebounceRef.current !== null) {
        clearTimeout(undoToastResumeDebounceRef.current);
        undoToastResumeDebounceRef.current = null;
      }
    };
  }, [visible]);

  function syncKnobsImmediate(stats: CardVisibleStats) {
    STAT_TOGGLES.forEach(({ key }) => {
      knobAnims[key].setValue(stats[key as keyof CardVisibleStats] ? 20 : 0);
      pillColorAnims[key].setValue(stats[key as keyof CardVisibleStats] ? 1 : 0);
      rowBgAnims[key].setValue(stats[key as keyof CardVisibleStats] ? 1 : 0);
    });
  }

  function toggleStat(key: keyof CardVisibleStats) {
    if (showInlineSave) { setShowInlineSave(false); Keyboard.dismiss(); }
    Haptics.selectionAsync();
    setVisibleStats((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      const toValue = next[key] ? 20 : 0;
      const colorToValue = next[key] ? 1 : 0;
      if (reduceMotionRef.current) {
        knobAnims[key].setValue(toValue);
        pillColorAnims[key].setValue(colorToValue);
        rowBgAnims[key].setValue(next[key] ? 1 : 0);
      } else {
        Animated.spring(knobAnims[key], {
          toValue,
          damping: 50,
          stiffness: 400,
          mass: 0.6,
          overshootClamping: true,
          useNativeDriver: true,
        }).start();
        Animated.spring(pillColorAnims[key], {
          toValue: colorToValue,
          damping: 50,
          stiffness: 400,
          mass: 0.6,
          overshootClamping: true,
          useNativeDriver: false,
        }).start();
        if (next[key]) {
          Animated.sequence([
            Animated.timing(rowBgAnims[key], { toValue: 2, duration: 80, useNativeDriver: false, easing: Easing.out(Easing.ease) }),
            Animated.timing(rowBgAnims[key], { toValue: 1, duration: 280, useNativeDriver: false, easing: Easing.out(Easing.quad) }),
          ]).start();
        } else {
          Animated.timing(rowBgAnims[key], { toValue: 0, duration: 200, useNativeDriver: false, easing: Easing.out(Easing.quad) }).start();
        }
      }
      return next;
    });
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    setRestoredFromStorage(false);
    resetZoomPosition();
    if (!reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
  }

  function handleThemeChange(themeId: CardThemeId) {
    if (showInlineSave) { setShowInlineSave(false); Keyboard.dismiss(); }
    setSelectedThemeId(themeId);
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
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
    // Each keystroke counts as interaction — reset the auto-trigger countdown so the
    // timer doesn't fire while the user is still typing their custom message.
    resetAutoTriggerOnInteraction();
    const wasEmpty = customMessage === '';
    const isEmpty = text === '';
    setCustomMessage(text);
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    setRestoredFromStorage(false);
    resetZoomPosition();
    if (wasEmpty !== isEmpty && !reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
  }

  async function saveToStorage(
    stats: CardVisibleStats,
    message: string,
    themeId: CardThemeId,
    bgUri: string | null,
    bgCrop: CropData | null,
    dimLevel: number,
    blurRadius: number
  ) {
    try {
      const ops: Promise<void>[] = [
        AsyncStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats)),
        AsyncStorage.setItem(STORAGE_KEY_MESSAGE, message),
        AsyncStorage.setItem(STORAGE_KEY_THEME, themeId),
      ];
      if (bgUri) {
        const payload = bgCrop
          ? JSON.stringify({ uri: bgUri, ...bgCrop, dimLevel, blurRadius })
          : JSON.stringify({ uri: bgUri, dimLevel, blurRadius });
        ops.push(AsyncStorage.setItem(STORAGE_KEY_BG_PHOTO, payload));
      } else {
        ops.push(AsyncStorage.removeItem(STORAGE_KEY_BG_PHOTO));
      }
      await Promise.all(ops);
      updateSettings({ cardCustomMessage: message });
    } catch {
      // ignore storage errors
    }
  }

  function hideAutoTriggerBanner(then?: () => void) {
    const sessionId = autoTriggerSessionIdRef.current;
    Animated.timing(autoTriggerBannerAnim, {
      toValue: 0,
      duration: reduceMotionRef.current ? 150 : 250,
      useNativeDriver: true,
    }).start(() => {
      // No-op if a new session started while we were fading out
      if (autoTriggerSessionIdRef.current !== sessionId) return;
      setAutoTriggerBannerVisible(false);
      then?.();
    });
  }

  function cancelAutoTrigger() {
    if (autoTriggerIntervalRef.current !== null) {
      clearInterval(autoTriggerIntervalRef.current);
      autoTriggerIntervalRef.current = null;
    }
    autoTriggerProgressAnim.current?.stop();
    autoTriggerProgressAnim.current = null;
    autoTriggerProgress.setValue(1);
    autoTriggerIsPausedRef.current = false;
    setAutoTriggerIsPaused(false);
    // When generation has already started from the auto-trigger, the banner is
    // being kept visible in "generating" mode — let the useEffect watching the
    // `generating` prop handle the fade-out instead of hiding it here.
    if (autoTriggerGeneratingRef.current) return;
    hideAutoTriggerBanner(() => {
      setAutoTriggerCountdown(null);
      setAutoTriggerAction(null);
    });
  }

  // Called when the user taps ✕ during the "generating" state of the banner.
  // Flags the in-flight handleGenerate to discard its result and immediately
  // dismisses the banner without waiting for onGenerate to complete.
  function cancelGeneration() {
    generateCancelledRef.current = true;
    autoTriggerGeneratingRef.current = false;
    hideAutoTriggerBannerRef.current?.(() => {
      setAutoTriggerGenerating(false);
      setAutoTriggerAction(null);
    });
  }

  function pauseAutoTrigger() {
    if (autoTriggerIntervalRef.current === null) return;
    clearInterval(autoTriggerIntervalRef.current);
    autoTriggerIntervalRef.current = null;
    autoTriggerProgressAnim.current?.stop();
    autoTriggerProgressAnim.current = null;
    autoTriggerIsPausedRef.current = true;
    setAutoTriggerIsPaused(true);
  }

  function resumeAutoTrigger() {
    if (!autoTriggerIsPausedRef.current) return;
    autoTriggerIsPausedRef.current = false;
    setAutoTriggerIsPaused(false);
    const remaining = autoTriggerRemainingRef.current;
    const action = autoTriggerActiveActionRef.current;
    const delay = autoTriggerActiveDelayRef.current;
    if (!action || delay <= 0 || remaining <= 0) return;
    if (!reduceMotionRef.current) {
      const progressFrom = remaining / delay;
      autoTriggerProgress.setValue(progressFrom);
      autoTriggerProgressAnim.current = Animated.timing(autoTriggerProgress, {
        toValue: 0,
        duration: remaining * 1000,
        useNativeDriver: true,
      });
      autoTriggerProgressAnim.current.start();
    }
    let rem = remaining;
    autoTriggerIntervalRef.current = setInterval(() => {
      rem -= 1;
      autoTriggerRemainingRef.current = rem;
      const effectiveAction = selectedActionRef.current ?? action;
      if (rem <= 0) {
        clearInterval(autoTriggerIntervalRef.current!);
        autoTriggerIntervalRef.current = null;
        setAutoTriggerCountdown(null);
        autoTriggerGeneratingRef.current = true;
        setAutoTriggerGenerating(true);
        if (visibleRef.current) {
          handleGenerateRef.current?.(effectiveAction);
        }
      } else {
        setAutoTriggerCountdown(rem);
        setAutoTriggerAction(effectiveAction);
      }
    }, 1000);
  }

  async function handleGenerate(action: CardAction) {
    // Each new invocation starts with a clean slate — a prior cancellation
    // should not bleed into this run.
    generateCancelledRef.current = false;
    cancelAutoTrigger();
    dismissTapGenerateHint();
    await saveToStorage(visibleStats, customMessage.trim(), selectedThemeId, backgroundPhotoUri, backgroundPhotoCrop, backgroundPhotoDimLevel, backgroundPhotoBlurRadius);
    AsyncStorage.setItem(STORAGE_KEY_ACTION, action).catch(() => {
      // best-effort — never block the primary action
    });
    updateSettings({ defaultCardAction: action });
    onDefaultActionChange?.(action);
    setDefaultAction(action);
    setSelectedAction(action);
    try {
      await onGenerate({ visibleStats, customMessage: customMessage.trim(), themeId: selectedThemeId, action, backgroundPhotoUri: backgroundPhotoUri ?? undefined, backgroundPhotoCrop: backgroundPhotoCrop ?? undefined, backgroundPhotoDimLevel: backgroundPhotoUri ? backgroundPhotoDimLevel : undefined, backgroundPhotoBlurRadius: backgroundPhotoUri ? backgroundPhotoBlurRadius : undefined });
      // User cancelled mid-generation — banner already dismissed; discard result silently.
      if (generateCancelledRef.current) return;
      const msg =
        action === "save"
          ? "Saved to camera roll"
          : action === "share"
          ? "Share sheet opened"
          : action === "copy"
          ? "Copied to clipboard"
          : "Saved to camera roll · Share sheet opened";
      const icon: keyof typeof Ionicons.glyphMap =
        action === "save"
          ? "camera"
          : action === "share"
          ? "share-social"
          : action === "copy"
          ? "copy-outline"
          : "layers-outline";
      showConfirmation(msg, "success", icon);
    } catch (err) {
      // User cancelled while generation was in flight — banner already gone; swallow the error.
      if (generateCancelledRef.current) return;
      // "PERMISSION_RESTRICTED" means a managed-device policy blocks access.
      // Show a non-actionable message — no "Open Settings" link.
      if (err instanceof Error && err.message === "PERMISSION_RESTRICTED") {
        showConfirmation(
          "Photo access restricted by device policy — contact your admin",
          "error",
          "lock-closed-outline",
        );
        return;
      }

      // "PERMISSION_DENIED" is a sentinel from the parent — show an inline error
      // toast with a tappable "Open Settings" link instead of a modal Alert.
      if (err instanceof Error && err.message === "PERMISSION_DENIED") {
        const permIcon: keyof typeof Ionicons.glyphMap =
          action === "save"
            ? "camera-outline"
            : action === "share"
            ? "share-social-outline"
            : action === "copy"
            ? "copy-outline"
            : "lock-closed-outline";
        const permSecondaryIcon: keyof typeof Ionicons.glyphMap | undefined =
          action === "save" || action === "share" || action === "copy"
            ? "lock-closed-outline"
            : undefined;
        const permMessage =
          action === "save"
            ? "Camera access blocked — tap to open Settings"
            : "Storage access blocked — tap to open Settings";
        showConfirmation(
          permMessage,
          "error",
          permIcon,
          undefined,
          () => Linking.openSettings(),
          "Open Settings",
          undefined,
          permSecondaryIcon,
        );
        return;
      }

      const fallback =
        action === "save"
          ? "Couldn't save — check your permissions"
          : action === "share"
          ? "Couldn't open share sheet"
          : action === "copy"
          ? "Couldn't copy to clipboard"
          : "Couldn't save or share the card";
      const errMsg = err instanceof Error && err.message ? err.message : fallback;
      const errIcon: keyof typeof Ionicons.glyphMap =
        action === "save"
          ? "camera-outline"
          : action === "share"
          ? "share-social-outline"
          : action === "copy"
          ? "copy-outline"
          : "layers-outline";
      showConfirmation(errMsg, "error", errIcon, () => handleGenerate(action));
    }
  }

  // Always keep refs current so the interval calls the latest version and sees latest visibility
  handleGenerateRef.current = handleGenerate;
  visibleRef.current = visible;
  selectedActionRef.current = selectedAction;
  hideAutoTriggerBannerRef.current = hideAutoTriggerBanner;

  // When generation triggered by auto-trigger completes (or errors), show a
  // brief "✓ Done!" flash for 800 ms then fade the banner out.
  useEffect(() => {
    if (!generating && autoTriggerGenerating) {
      // Skip the flash if the user already manually cancelled — the banner is
      // already being hidden by cancelGeneration().
      if (generateCancelledRef.current) return;
      setAutoTriggerSuccessFlash(true);
      autoTriggerSuccessFlashTimerRef.current = setTimeout(() => {
        autoTriggerSuccessFlashTimerRef.current = null;
        setAutoTriggerSuccessFlash(false);
        hideAutoTriggerBannerRef.current?.(() => {
          autoTriggerGeneratingRef.current = false;
          setAutoTriggerGenerating(false);
          setAutoTriggerAction(null);
        });
      }, 800);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  function startAutoTrigger(action: CardAction, delay: number) {
    // Never start the countdown for a photo-requiring action when permission is denied.
    const requiresPhotoAccess = action === "save" || action === "both";
    if (requiresPhotoAccess && cameraRollStatus === "denied") return;
    // Track the active countdown's parameters so resetAutoTriggerOnInteraction can restart it.
    autoTriggerActiveActionRef.current = action;
    autoTriggerActiveDelayRef.current = delay;
    autoTriggerIsPausedRef.current = false;
    setAutoTriggerIsPaused(false);

    // Cancel any pending nudge-pulse timers — the countdown banner is now drawing
    // the user's attention, so the pulses are no longer needed and would clash.
    if (secondPulseTimerRef.current !== null) {
      clearTimeout(secondPulseTimerRef.current);
      secondPulseTimerRef.current = null;
    }
    if (thirdPulseTimerRef.current !== null) {
      clearTimeout(thirdPulseTimerRef.current);
      thirdPulseTimerRef.current = null;
    }

    if (autoTriggerIntervalRef.current !== null) {
      clearInterval(autoTriggerIntervalRef.current);
      autoTriggerIntervalRef.current = null;
    }
    // Reset and start the smooth progress bar (skip when reduce-motion is on)
    autoTriggerProgressAnim.current?.stop();
    autoTriggerProgressAnim.current = null;
    autoTriggerProgress.setValue(1);
    if (!reduceMotionRef.current) {
      autoTriggerProgressAnim.current = Animated.timing(autoTriggerProgress, {
        toValue: 0,
        duration: delay * 1000,
        useNativeDriver: true,
      });
      autoTriggerProgressAnim.current.start();
    }
    setAutoTriggerAction(selectedActionRef.current ?? action);
    const DELAY = delay;
    setAutoTriggerCountdown(DELAY);

    // Invalidate any in-flight banner callback from the previous session, then animate in
    autoTriggerSessionIdRef.current += 1;
    autoTriggerBannerAnim.stopAnimation();
    autoTriggerBannerAnim.setValue(0);
    setAutoTriggerBannerVisible(true);
    Animated.timing(autoTriggerBannerAnim, {
      toValue: 1,
      duration: reduceMotionRef.current ? 150 : 300,
      useNativeDriver: true,
    }).start();

    let remaining = DELAY;
    autoTriggerRemainingRef.current = remaining;
    autoTriggerIntervalRef.current = setInterval(() => {
      remaining -= 1;
      autoTriggerRemainingRef.current = remaining;
      // Prefer the user's in-session selectedAction over the defaultAction that was
      // passed in at countdown start, so the label and fired action stay in sync with
      // whichever button is currently highlighted.
      const effectiveAction = selectedActionRef.current ?? action;
      if (remaining <= 0) {
        clearInterval(autoTriggerIntervalRef.current!);
        autoTriggerIntervalRef.current = null;
        // Transition banner to "generating" state and fire action immediately
        setAutoTriggerCountdown(null);
        autoTriggerGeneratingRef.current = true;
        setAutoTriggerGenerating(true);
        // Guard: only fire if the modal is still open
        if (visibleRef.current) {
          handleGenerateRef.current?.(effectiveAction);
        }
      } else {
        setAutoTriggerCountdown(remaining);
        setAutoTriggerAction(effectiveAction);
      }
    }, 1000);
  }

  // Resets the auto-trigger countdown when the user interacts with the settings panel
  // (scroll, touch, etc.), preventing accidental triggers while they are still deciding.
  // Calling this when no countdown is active is a safe no-op.
  function resetAutoTriggerOnInteraction() {
    if (autoTriggerIsPausedRef.current) return;
    if (autoTriggerIntervalRef.current === null) return;
    const action = autoTriggerActiveActionRef.current;
    const delay = autoTriggerActiveDelayRef.current;
    if (!action || delay <= 0) return;
    // Brief "Timer reset" flash in the banner (skip for reduce-motion users)
    if (!reduceMotionRef.current) {
      if (timerResetFlashTimerRef.current !== null) {
        clearTimeout(timerResetFlashTimerRef.current);
      }
      setTimerResetFlashVisible(true);
      timerResetFlashTimerRef.current = setTimeout(() => {
        timerResetFlashTimerRef.current = null;
        setTimerResetFlashVisible(false);
      }, 350);
    }
    startAutoTrigger(action, delay);
  }

  async function handleSetDefault(action: CardAction) {
    actionLongPressedRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const label = action === "share" ? "Share" : action === "save" ? "Save" : action === "copy" ? "Copy" : "Both";
    // Dismiss the long-press hint permanently once the user has discovered the gesture.
    // Wait LONG_PRESS_HINT_DISMISS_DELAY_MS first so the confirmation toast has time to
    // appear before the hint fades, avoiding the jarring effect of two things changing at
    // once, and giving new users enough time to absorb what the hint was telling them.
    if (showLongPressHint) {
      setTimeout(() => dismissLongPressHint(), LONG_PRESS_HINT_DISMISS_DELAY_MS);
    }

    const isAlreadyDefault = defaultAction === action;

    if (isAlreadyDefault) {
      // Long-pressing the currently-preferred button: offer to change or clear
      Alert.alert(
        "Preferred action",
        `${label} is your current preferred action.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Change preferred",
            onPress: () => {
              // Re-show set-as-preferred alert for this action
              Alert.alert(
                "Set as preferred",
                autoTriggerDelay > 0
                  ? `Always open with ${label}? ${label} will auto-trigger after ${autoTriggerDelay} second${autoTriggerDelay === 1 ? "" : "s"} each time you open the card builder.`
                  : `Always open with ${label}? ${label} will be your preferred action (auto-trigger is off).`,
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Set as preferred",
                    onPress: () => {
                      setDefaultAction(action);
                      setSelectedAction(action);
                      AsyncStorage.setItem(STORAGE_KEY_ACTION, action).catch(() => {});
                      updateSettings({ defaultCardAction: action });
                      onDefaultActionChange?.(action);
                      showConfirmation(`★ ${label} set as preferred`, "success", "star-outline");
                    },
                  },
                ]
              );
            },
          },
          {
            text: "Clear preference",
            style: "destructive",
            onPress: () => {
              setDefaultAction(null);
              AsyncStorage.removeItem(STORAGE_KEY_ACTION).catch(() => {});
              updateSettings({ defaultCardAction: undefined });
              onDefaultActionChange?.(null);
              // Restore the long-press hint so the user knows they can set one again
              AsyncStorage.removeItem(STORAGE_KEY_LONGPRESS_HINT_SEEN).catch(() => {});
              setShowLongPressHint(true);
              showConfirmation("Preference cleared", "success", "star-half-outline");
            },
          },
        ]
      );
      return;
    }

    if (longPressAndRun) {
      // "Long-press and run" mode: set default immediately and generate in one gesture
      const isSwitching = defaultAction !== null && defaultAction !== action;
      const oldLabel = defaultAction === "share" ? "Share" : defaultAction === "save" ? "Save" : defaultAction === "copy" ? "Copy" : defaultAction === "both" ? "Both" : null;
      setDefaultAction(action);
      setSelectedAction(action);
      AsyncStorage.setItem(STORAGE_KEY_ACTION, action).catch(() => {});
      updateSettings({ defaultCardAction: action });
      onDefaultActionChange?.(action);
      showConfirmation(
        isSwitching && oldLabel
          ? `★ ${oldLabel} → ★ ${label} · generating…`
          : `★ ${label} set as default · generating…`,
        "success", "star-outline", undefined, undefined, undefined, undefined, undefined, true
      );
      await handleGenerate(action);
    } else {
      // "Set-only" mode: show confirmation alert before setting default
      const currentLabel = defaultAction === "share" ? "Share" : defaultAction === "save" ? "Save" : defaultAction === "copy" ? "Copy" : defaultAction === "both" ? "Both" : null;
      const isSwitching = defaultAction !== null && currentLabel !== null;
      Alert.alert(
        isSwitching ? "Switch preferred action" : "Set as preferred",
        isSwitching
          ? `Replace ★ ${currentLabel} with ${label}?`
          : autoTriggerDelay > 0
            ? `Always open with ${label}? ${label} will auto-trigger after ${autoTriggerDelay} second${autoTriggerDelay === 1 ? "" : "s"} each time you open the card builder.`
            : `Always open with ${label}? ${label} will be your preferred action (auto-trigger is off).`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: isSwitching ? "Switch" : "Set as preferred",
            onPress: () => {
              setDefaultAction(action);
              setSelectedAction(action);
              AsyncStorage.setItem(STORAGE_KEY_ACTION, action).catch(() => {});
              updateSettings({ defaultCardAction: action });
              onDefaultActionChange?.(action);
              showConfirmation(`★ ${label} set as preferred`, "success", "star-outline");
            },
          },
        ]
      );
    }
  }

  function handleDismissBadge() {
    // Delay the actual persist so the user has time to undo (respects their undo window setting).
    const undoMs = (settings.undoWindowSeconds ?? 3) * 1000;
    const schedulePersist = () => {
      if (badgePersistTimerRef.current !== null) {
        clearTimeout(badgePersistTimerRef.current);
      }
      badgePersistTimerRef.current = setTimeout(async () => {
        badgePersistTimerRef.current = null;
        try {
          await AsyncStorage.setItem(STORAGE_KEY_BADGE_DISMISSED, "1");
        } catch {
          // ignore
        }
        // Sync the preference to the cloud settings object so it persists
        // across devices (authenticated users).
        onBadgeDismiss?.();
      }, undoMs);
    };

    const showUndoToast = () => {
      showConfirmation(
        "Badge dismissed",
        "success",
        "ribbon-outline",
        undefined,
        () => {
          // Undo: cancel the pending persist and re-show the badge.
          if (badgePersistTimerRef.current !== null) {
            clearTimeout(badgePersistTimerRef.current);
            badgePersistTimerRef.current = null;
          }
          setBadgeDismissed(false);
        },
        "Undo",
        undoMs,
      );
    };

    if (reduceMotionRef.current) {
      setBadgeDismissed(true);
      schedulePersist();
      showUndoToast();
      dismissCardChip();
    } else {
      badgeFadeAnim.stopAnimation();
      badgeSlideAnim.stopAnimation();
      Animated.parallel([
        Animated.timing(badgeFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(badgeSlideAnim, {
          toValue: -5,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          setBadgeDismissed(true);
          schedulePersist();
          showUndoToast();
        }
      });
      dismissCardChip();
    }
  }

  async function handleResetDefaults() {
    setVisibleStats({ ...DEFAULT_VISIBLE_STATS });
    syncKnobsImmediate({ ...DEFAULT_VISIBLE_STATS });
    setCustomMessage("");
    setBackgroundPhotoUri(null);
    setBackgroundPhotoCrop(null);
    applyDimLevel(DEFAULT_DIM_LEVEL);
    setSelectedThemeId(DEFAULT_THEME_ID);
    setDisplayedThemeId(DEFAULT_THEME_ID);
    setThumbnailSize("m");
    setRestoredFromStorage(false);
    setBadgeDismissed(false);
    setActivePresetId(null);
    setActivePresetModified(false);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    resetZoomPosition();
    dismissCardChip();
    try {
      setThumbnailSize("m");
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEY_STATS),
        AsyncStorage.removeItem(STORAGE_KEY_MESSAGE),
        AsyncStorage.removeItem(STORAGE_KEY_THEME),
        AsyncStorage.removeItem(STORAGE_KEY_BADGE_DISMISSED),
        AsyncStorage.removeItem(STORAGE_KEY_BG_PHOTO),
      ]);
      updateSettings({ cardCustomMessage: "" });
    } catch {
      // ignore
    }
  }

  async function pickBackgroundFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setPendingCropUri(uri);
      setShowCropModal(true);
    } else {
      pendingPresetSwapIdRef.current = null;
    }
  }

  /**
   * Show a specific permission-denied toast for the given permission type.
   *
   * Encapsulates the 30-second cooldown guard, the correct human-readable
   * message, and the icon pair so every permission-gated action in this modal
   * just calls `showPermissionDeniedToast("photoLibrary")` (or "camera",
   * "microphone", "location") rather than duplicating the guard and strings.
   *
   * Add new entries to the `messages` map as new permission-gated features
   * are added — do NOT use the generic "Storage access blocked" fallback.
   */
  function showPermissionDeniedToast(
    permissionType: "photoLibrary" | "camera" | "microphone" | "location",
  ) {
    const messages: Record<
      "photoLibrary" | "camera" | "microphone" | "location",
      { message: string; icon: keyof typeof Ionicons.glyphMap }
    > = {
      photoLibrary: { message: "Photo library access blocked — tap to open Settings", icon: "images-outline" },
      camera: { message: "Camera access blocked — tap to open Settings", icon: "camera-outline" },
      microphone: { message: "Microphone access blocked — tap to open Settings", icon: "mic-outline" },
      location: { message: "Location access blocked — tap to open Settings", icon: "location-outline" },
    };
    const now = Date.now();
    if (now - lastPermissionToastShownAtRef.current < 30_000) return;
    lastPermissionToastShownAtRef.current = now;
    const { message, icon } = messages[permissionType];
    showConfirmation(
      message,
      "error",
      icon,
      undefined,
      () => Linking.openSettings(),
      "Settings",
      undefined,
      "lock-closed-outline",
    );
  }

  async function handlePickBackgroundPhoto() {
    if (showInlineSave) { setShowInlineSave(false); Keyboard.dismiss(); }
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (canAskAgain) {
          Alert.alert(
            "Photo Library Access",
            "RAIMZEAL needs access to your photo library to set a background image for your card.",
            [
              {
                text: "Allow Access",
                onPress: async () => {
                  const { status: retryStatus, canAskAgain: retryCanAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (retryStatus === "granted") {
                    await pickBackgroundFromLibrary();
                  } else if (!retryCanAskAgain) {
                    showPermissionDeniedToast("photoLibrary");
                  }
                },
              },
              { text: "Not Now", style: "cancel" },
            ],
          );
        } else {
          showPermissionDeniedToast("photoLibrary");
        }
        return;
      }
      await pickBackgroundFromLibrary();
    } catch {
      // ignore picker errors
    }
  }

  async function handleSwapPresetPhoto(presetId: string) {
    try {
      const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        if (canAskAgain) {
          Alert.alert(
            "Photo Library Access",
            "RAIMZEAL needs access to your photo library to update this preset's background.",
            [
              {
                text: "Allow Access",
                onPress: async () => {
                  const { status: retryStatus, canAskAgain: retryCanAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                  if (retryStatus === "granted") {
                    pendingPresetSwapIdRef.current = presetId;
                    await pickBackgroundFromLibrary();
                  } else if (!retryCanAskAgain) {
                    showPermissionDeniedToast("photoLibrary");
                  }
                },
              },
              { text: "Not Now", style: "cancel" },
            ],
          );
        } else {
          showPermissionDeniedToast("photoLibrary");
        }
        return;
      }
      pendingPresetSwapIdRef.current = presetId;
      await pickBackgroundFromLibrary();
    } catch {
      pendingPresetSwapIdRef.current = null;
    }
  }

  function handleCropConfirm(crop: CropData) {
    if (!pendingCropUri) return;
    setShowCropModal(false);
    const uri = pendingCropUri;
    setPendingCropUri(null);

    const swapPresetId = pendingPresetSwapIdRef.current;
    pendingPresetSwapIdRef.current = null;

    if (swapPresetId) {
      const updatedPresets = presets.map((p) =>
        p.id === swapPresetId
          ? { ...p, backgroundPhotoUri: uri, backgroundPhotoCrop: crop }
          : p
      );
      setPresets(updatedPresets);
      savePresets(updatedPresets).catch(() => {});
      updateSettings({ cardPresets: updatedPresets as unknown as StoredCardPreset[] });
      if (swapPresetId === activePresetId) {
        setBackgroundPhotoUri(uri);
        setBackgroundPhotoCrop(crop);
        setActivePresetModified(false);
        if (!reduceMotionRef.current) {
          previewOpacity.stopAnimation();
          Animated.sequence([
            Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
            Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
          ]).start();
        }
      }
      return;
    }

    setBackgroundPhotoUri(uri);
    setBackgroundPhotoCrop(crop);
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    setRestoredFromStorage(false);
    const payload = JSON.stringify({ uri, ...crop, dimLevel: backgroundPhotoDimLevel, blurRadius: backgroundPhotoBlurRadius });
    AsyncStorage.setItem(STORAGE_KEY_BG_PHOTO, payload).catch(() => {});
    if (!reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
  }

  function handleCropCancel() {
    setShowCropModal(false);
    setPendingCropUri(null);
    pendingPresetSwapIdRef.current = null;
  }

  function handleAdjustCrop() {
    if (!backgroundPhotoUri) return;
    setPendingCropUri(backgroundPhotoUri);
    setShowCropModal(true);
  }

  function handleDimLevelChange(level: number) {
    applyDimLevel(level);
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    if (!reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
  }

  function handleBlurRadiusChange(radius: number) {
    setBackgroundPhotoBlurRadius(radius);
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    if (!reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
  }

  function handleRemoveBackgroundPhoto() {
    if (showInlineSave) { setShowInlineSave(false); Keyboard.dismiss(); }
    setBackgroundPhotoUri(null);
    setBackgroundPhotoCrop(null);
    applyDimLevel(DEFAULT_DIM_LEVEL);
    setBackgroundPhotoBlurRadius(DEFAULT_BLUR_RADIUS);
    setActivePresetModified(true);
    AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    setRestoredFromStorage(false);
    AsyncStorage.removeItem(STORAGE_KEY_BG_PHOTO).catch(() => {});
    dismissCardChip();
    if (!reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
  }

  function loadPreset(preset: CardPreset) {
    const stats = { ...DEFAULT_VISIBLE_STATS, ...preset.visibleStats };
    setVisibleStats(stats);
    syncKnobsImmediate(stats);
    setCustomMessage(preset.customMessage);
    setSelectedThemeId(preset.themeId);
    setDisplayedThemeId(preset.themeId);
    setActivePresetId(preset.id);
    setActivePresetModified(false);
    AsyncStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, preset.id).catch(() => {});
    setRestoredFromStorage(false);
    setBackgroundPhotoUri(preset.backgroundPhotoUri ?? null);
    setBackgroundPhotoCrop(preset.backgroundPhotoCrop ?? null);
    applyDimLevel(preset.backgroundPhotoDimLevel ?? DEFAULT_DIM_LEVEL);
    setBackgroundPhotoBlurRadius(preset.backgroundPhotoBlurRadius ?? DEFAULT_BLUR_RADIUS);
    if (!reduceMotionRef.current) {
      previewOpacity.stopAnimation();
      Animated.sequence([
        Animated.timing(previewOpacity, { toValue: 0, duration: 90, useNativeDriver: true }),
        Animated.timing(previewOpacity, { toValue: 1, duration: 230, useNativeDriver: true }),
      ]).start();
    }
    resetZoomPosition();
    dismissCardChip();
    dismissSwipeHintEarly();
  }

  function openPresetPreview(preset: CardPreset, originRect?: PresetOriginRect) {
    const idx = presets.findIndex((p) => p.id === preset.id);
    const safeIdx = idx >= 0 ? idx : 0;
    presetPreviewIndexRef.current = safeIdx;
    presetPreviewPresetsRef.current = presets;
    setPresetPreviewIndex(safeIdx);
    pinchScale.value = 1;
    pinchSavedScale.value = 1;
    pinchTranslateX.value = 0;
    pinchTranslateY.value = 0;
    pinchSavedTranslateX.value = 0;
    pinchSavedTranslateY.value = 0;
    presetCardOpacity.setValue(1);
    presetCardTranslateX.setValue(0);
    setPresetPreviewTarget(preset);
    setPresetPreviewVisible(true);
    if (reduceMotionRef.current) {
      presetPreviewAnim.setValue(1);
      presetPreviewTranslateX.setValue(0);
      presetPreviewTranslateY.setValue(0);
      presetPreviewOriginScale.setValue(1);
    } else {
      const win = Dimensions.get("window");
      const screenW = win.width;
      const screenH = win.height;
      const rect = originRect ?? { x: 0, y: 0, width: 0, height: 0 };
      presetPreviewOriginRect.current = rect;

      const launchAnimation = (
        initialTX: number,
        initialTY: number,
        initialScale: number
      ) => {
        presetPreviewAnim.setValue(0);
        presetPreviewTranslateX.setValue(initialTX);
        presetPreviewTranslateY.setValue(initialTY);
        presetPreviewOriginScale.setValue(initialScale);
        const springConfig = { damping: 16, stiffness: 400, mass: 0.6, useNativeDriver: true as const };
        Animated.parallel([
          Animated.spring(presetPreviewAnim, { toValue: 1, ...springConfig }),
          Animated.spring(presetPreviewTranslateX, { toValue: 0, ...springConfig }),
          Animated.spring(presetPreviewTranslateY, { toValue: 0, ...springConfig }),
          Animated.spring(presetPreviewOriginScale, { toValue: 1, ...springConfig }),
        ]).start();
      };

      if (rect.width > 0 && rect.height > 0) {
        const originCenterX = rect.x + rect.width / 2;
        const originCenterY = rect.y + rect.height / 2;
        const previewCardW = CARD_WIDTH * zoomScale;
        const initialScale = rect.width / previewCardW;
        launchAnimation(
          originCenterX - screenW / 2,
          originCenterY - screenH / 2,
          initialScale
        );
      } else {
        launchAnimation(0, 0, 0.85);
      }
    }
    if (presets.length > 1) {
      AsyncStorage.getItem(STORAGE_KEY_PRESET_SWIPE_HINT_SEEN).then((seen) => {
        if (!seen) {
          setTimeout(triggerSwipeHint, 500);
        }
      }).catch(() => {});
    }
  }

  function closePresetPreview() {
    // Scrolls the horizontal chip row so the active chip is visible.
    // Uses the ref so the callback always reads the post-render settled value.
    const scrollChipsToActive = (animated: boolean) => {
      const id = activePresetIdRef.current;
      if (!id) return;
      const idx = presets.findIndex((p) => p.id === id);
      if (idx < 0) return;
      const offset = chipXOffsetsRef.current[idx] ?? idx * (PRESET_CHIP_WIDTH + PRESET_CHIP_GAP);
      presetChipsScrollRef.current?.scrollTo({ x: offset, animated });
    };

    if (reduceMotionRef.current) {
      presetPreviewAnim.setValue(0);
      presetPreviewTranslateX.setValue(0);
      presetPreviewTranslateY.setValue(0);
      presetPreviewOriginScale.setValue(1);
      presetPreviewSwipeDragY.setValue(0);
      setPresetPreviewVisible(false);
      setPresetPreviewTarget(null);
      // Defer one tick so any batched state updates (e.g. from confirmLoadPreset
      // calling loadPreset immediately after) are committed before we read the ref.
      setTimeout(() => scrollChipsToActive(false), 0);
    } else {
      const win = Dimensions.get("window");
      const screenW = win.width;
      const screenH = win.height;
      const { x, y, width, height } = presetPreviewOriginRect.current;
      const originCenterX = x + width / 2;
      const originCenterY = y + height / 2;
      const previewCardW = CARD_WIDTH * zoomScale;
      const targetScale = width > 0 ? width / previewCardW : 0.85;
      const CLOSE_DURATION = 180;
      const closeEasing = Easing.out(Easing.cubic);
      const timingConfig = { duration: CLOSE_DURATION, easing: closeEasing, useNativeDriver: true as const };
      Animated.parallel([
        Animated.timing(presetPreviewAnim, { toValue: 0, ...timingConfig }),
        Animated.timing(presetPreviewTranslateX, { toValue: width > 0 ? originCenterX - screenW / 2 : 0, ...timingConfig }),
        Animated.timing(presetPreviewTranslateY, { toValue: height > 0 ? originCenterY - screenH / 2 : 0, ...timingConfig }),
        Animated.timing(presetPreviewOriginScale, { toValue: targetScale, ...timingConfig }),
        Animated.timing(presetPreviewSwipeDragY, { toValue: 0, ...timingConfig }),
      ]).start(({ finished }) => {
        if (finished) {
          setPresetPreviewVisible(false);
          setPresetPreviewTarget(null);
          presetPreviewTranslateX.setValue(0);
          presetPreviewTranslateY.setValue(0);
          presetPreviewOriginScale.setValue(1);
          presetPreviewSwipeDragY.setValue(0);
          // By the time the timing animation finishes React has re-rendered
          // and activePresetIdRef.current holds the settled active preset ID.
          scrollChipsToActive(true);
        }
      });
    }
  }

  function navigatePresetPreview(dir: 1 | -1) {
    const currentPresets = presetPreviewPresetsRef.current;
    const newIdx = presetPreviewIndexRef.current + dir;
    if (newIdx < 0 || newIdx >= currentPresets.length) return;
    const nextPreset = currentPresets[newIdx];
    dismissSwipeHintEarly();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pinchScale.value = 1;
    pinchSavedScale.value = 1;
    pinchTranslateX.value = 0;
    pinchTranslateY.value = 0;
    pinchSavedTranslateX.value = 0;
    pinchSavedTranslateY.value = 0;

    // Re-measure the chip for the preset we're navigating to so that
    // closePresetPreview() returns to the correct chip rather than the
    // one that was originally tapped.  measureInWindow returns zeros when
    // the chip is scrolled out of view; we treat that as "off-screen" and
    // fall back to a fade-out (the width === 0 guard in closePresetPreview
    // already handles this case).
    const chipNode = presetChipRefsMap.current.get(nextPreset.id);
    if (chipNode) {
      chipNode.measureInWindow((x: number, y: number, width: number, height: number) => {
        presetPreviewOriginRect.current = { x, y, width, height };
      });
    } else {
      presetPreviewOriginRect.current = { x: 0, y: 0, width: 0, height: 0 };
    }

    if (reduceMotionRef.current) {
      presetPreviewIndexRef.current = newIdx;
      setPresetPreviewIndex(newIdx);
      setPresetPreviewTarget(nextPreset);
    } else {
      const slideOutX = dir * -Dimensions.get("window").width;
      const slideInX = dir * Dimensions.get("window").width;
      Animated.timing(presetCardTranslateX, {
        toValue: slideOutX,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        presetPreviewIndexRef.current = newIdx;
        setPresetPreviewIndex(newIdx);
        setPresetPreviewTarget(nextPreset);
        presetCardTranslateX.setValue(slideInX);
        Animated.spring(presetCardTranslateX, {
          toValue: 0,
          damping: 50,
          stiffness: 400,
          mass: 0.6,
          overshootClamping: true,
          useNativeDriver: true,
        }).start();
      });
    }
  }

  function confirmLoadPreset(preset: CardPreset) {
    const chipNode = presetChipRefsMap.current.get(preset.id);
    if (chipNode) {
      chipNode.measureInWindow((x: number, y: number, width: number, height: number) => {
        presetPreviewOriginRect.current = { x, y, width, height };
        closePresetPreview();
        loadPreset(preset);
      });
    } else {
      closePresetPreview();
      loadPreset(preset);
    }
  }

  function openInlineSave() {
    if (!presetNameInput) {
      const activePreset = presets.find((p) => p.id === activePresetId);
      setPresetNameInput(activePreset ? activePreset.name : "");
    }
    setShowInlineSave(true);
    setTimeout(() => {
      presetNameRef.current?.focus();
      // After the keyboard finishes animating in, scroll the input into view
      setTimeout(() => {
        if (inlineSaveRef.current && modalScrollRef.current) {
          inlineSaveRef.current.measureLayout(
            modalScrollRef.current.getScrollableNode(),
            (_x: number, y: number) => {
              modalScrollRef.current?.scrollTo({ y, animated: true });
            },
            () => {
              // Fallback: best-effort scroll toward the bottom of the presets area
              modalScrollRef.current?.scrollTo({ y: 9999, animated: true });
            }
          );
        }
      }, 350);
    }, 100);
  }

  async function handleSavePreset() {
    const name = presetNameInput.trim();
    if (!name) return;
    setSavingPreset(true);

    let updatedPresets: CardPreset[];

    let isRename = false;
    let oldPresetName: string | undefined;
    if (activePresetId) {
      // Overwrite existing preset
      const existingPreset = presets.find((p) => p.id === activePresetId);
      if (existingPreset) {
        oldPresetName = existingPreset.name;
        const trimmedMessage = customMessage.trim();
        const nameChanged = existingPreset.name !== name;
        const statsChanged = JSON.stringify(existingPreset.visibleStats) !== JSON.stringify(visibleStats);
        const messageChanged = (existingPreset.customMessage ?? "") !== trimmedMessage;
        const themeChanged = existingPreset.themeId !== selectedThemeId;
        const photoChanged = (existingPreset.backgroundPhotoUri ?? null) !== backgroundPhotoUri;
        const existingCrop = existingPreset.backgroundPhotoCrop ?? null;
        const cropChanged =
          existingCrop?.scale !== (backgroundPhotoCrop?.scale ?? null) ||
          existingCrop?.panX !== (backgroundPhotoCrop?.panX ?? null) ||
          existingCrop?.panY !== (backgroundPhotoCrop?.panY ?? null);
        const dimLevelChanged = (existingPreset.backgroundPhotoDimLevel ?? DEFAULT_DIM_LEVEL) !== backgroundPhotoDimLevelRef.current;
        const blurLevelChanged = (existingPreset.backgroundPhotoBlurRadius ?? DEFAULT_BLUR_RADIUS) !== backgroundPhotoBlurRadius;
        isRename = nameChanged && !statsChanged && !messageChanged && !themeChanged && !photoChanged && !cropChanged && !dimLevelChanged && !blurLevelChanged;
      }
      updatedPresets = presets.map((p) =>
        p.id === activePresetId
          ? { ...p, name, visibleStats, customMessage: customMessage.trim(), themeId: selectedThemeId, backgroundPhotoUri: backgroundPhotoUri ?? undefined, backgroundPhotoDimLevel: backgroundPhotoUri ? backgroundPhotoDimLevelRef.current : undefined, backgroundPhotoBlurRadius: backgroundPhotoUri ? backgroundPhotoBlurRadius : undefined, backgroundPhotoCrop: backgroundPhotoUri && backgroundPhotoCrop ? backgroundPhotoCrop : undefined }
          : p
      );
    } else {
      if (presets.length >= MAX_PRESETS) {
        setSavingPreset(false);
        setShowInlineSave(false);
        Keyboard.dismiss();
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
        backgroundPhotoUri: backgroundPhotoUri ?? undefined,
        backgroundPhotoDimLevel: backgroundPhotoUri ? backgroundPhotoDimLevelRef.current : undefined,
        backgroundPhotoBlurRadius: backgroundPhotoUri ? backgroundPhotoBlurRadius : undefined,
        backgroundPhotoCrop: backgroundPhotoUri && backgroundPhotoCrop ? backgroundPhotoCrop : undefined,
      };
      updatedPresets = [...presets, newPreset];
      setActivePresetId(newPreset.id);
      setActivePresetModified(false);
      AsyncStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, newPreset.id).catch(() => {});
    }

    const wasUpdate = !!activePresetId;
    await savePresets(updatedPresets);
    updateSettings({ cardPresets: updatedPresets as unknown as StoredCardPreset[] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPresets(updatedPresets);
    setActivePresetModified(false);
    if (wasUpdate) {
      setPresetSavedAt(Date.now());
      AsyncStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, activePresetId).catch(() => {});
    }
    setSavingPreset(false);
    setShowInlineSave(false);
    setPresetNameInput("");
    showConfirmation(activePresetId ? (isRename ? `"${oldPresetName}" renamed to "${name}"` : `"${name}" updated`) : `"${name}" saved`, "success", isRename ? "create-outline" : "save-outline");
  }

  async function handleReorderPresets(newOrder: CardPreset[]) {
    setPresets(newOrder);
    await savePresets(newOrder);
    updateSettings({ cardPresets: newOrder as unknown as StoredCardPreset[] });
  }

  function dismissUndoToast(cb?: () => void) {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoAnimRef.current !== null) {
      undoAnimRef.current.stop();
      undoAnimRef.current = null;
    }
    undoOpacity.stopAnimation();
    undoTranslateY.stopAnimation();
    undoProgressAnim.stopAnimation();
    undoSwipeY.stopAnimation();
    if (reduceMotionRef.current) {
      undoOpacity.setValue(0);
      undoTranslateY.setValue(8);
      undoSwipeY.setValue(0);
      setUndoDeleteState(null);
      cb?.();
    } else {
      Animated.parallel([
        Animated.timing(undoOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(undoTranslateY, { toValue: 8, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        undoSwipeY.setValue(0);
        setUndoDeleteState(null);
        cb?.();
      });
    }
  }

  function dismissUndoToastAnimated(cb?: () => void) {
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoAnimRef.current !== null) {
      undoAnimRef.current.stop();
      undoAnimRef.current = null;
    }
    dismissUndoToastSwipeHint();
    undoOpacity.stopAnimation();
    undoTranslateY.stopAnimation();
    undoProgressAnim.stopAnimation();
    undoSwipeY.stopAnimation();
    Animated.parallel([
      Animated.timing(undoOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(undoSwipeY, { toValue: -60, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      undoOpacity.setValue(0);
      undoTranslateY.setValue(8);
      undoSwipeY.setValue(0);
      undoProgressAnim.setValue(1);
      setUndoDeleteState(null);
      if (finished) cb?.();
    });
  }

  // Called only when the countdown timer fires on its own (natural expiry).
  // Slides the toast upward and fades it out over ~200 ms, mirroring the
  // polished entry animation, before unmounting it.
  function dismissUndoToastOnExpiry() {
    if (undoAnimRef.current !== null) {
      undoAnimRef.current.stop();
      undoAnimRef.current = null;
    }
    undoOpacity.stopAnimation();
    undoTranslateY.stopAnimation();
    undoProgressAnim.stopAnimation();
    undoSwipeY.stopAnimation();
    if (reduceMotionRef.current) {
      undoOpacity.setValue(0);
      undoTranslateY.setValue(8);
      undoSwipeY.setValue(0);
      setUndoDeleteState(null);
    } else {
      Animated.parallel([
        Animated.timing(undoOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(undoTranslateY, { toValue: -12, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        undoSwipeY.setValue(0);
        undoTranslateY.setValue(8);
        setUndoDeleteState(null);
      });
    }
  }

  function pauseUndoToast() {
    const elapsed = Date.now() - undoSegmentStartRef.current;
    undoRemainingMsRef.current = Math.max(0, undoRemainingMsRef.current - elapsed);
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoAnimRef.current !== null) {
      undoAnimRef.current.stop();
      undoAnimRef.current = null;
    }
    undoProgressAnim.stopAnimation();
  }

  function resumeUndoToast() {
    const remaining = undoRemainingMsRef.current;
    if (remaining <= 0) {
      dismissUndoToast();
      return;
    }
    undoSegmentStartRef.current = Date.now();
    if (!reduceMotionRef.current) {
      const progressAnim = Animated.timing(undoProgressAnim, {
        toValue: 0,
        duration: remaining,
        useNativeDriver: false,
      });
      undoAnimRef.current = progressAnim;
      progressAnim.start(({ finished }) => {
        if (finished) undoAnimRef.current = null;
      });
      undoTimerRef.current = setTimeout(() => {
        undoTimerRef.current = null;
        dismissUndoToastOnExpiry();
      }, remaining);
    }
    // Reduce-motion: no animation and no auto-dismiss timer — toast stays
    // until the user explicitly taps Undo or swipes to dismiss.
  }

  function showUndoToast(preset: CardPreset, index: number) {
    showUndoToastRef.current = showUndoToast;
    if (undoSwipingRef.current) {
      pendingUndoToastArgsRef.current = [preset, index];
      return;
    }
    const undoMs = (settings.undoWindowSeconds ?? 3) * 1000;
    if (undoTimerRef.current !== null) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoAnimRef.current !== null) {
      undoAnimRef.current.stop();
      undoAnimRef.current = null;
    }
    undoOpacity.stopAnimation();
    undoTranslateY.stopAnimation();
    undoProgressAnim.stopAnimation();
    undoSwipeY.stopAnimation();

    const previousToastVisible = undoDeleteState !== null;

    // Bump the transition token so any in-flight fade-out callback from a
    // previous call can detect it has been superseded and bail out.
    undoTransitionIdRef.current += 1;
    const myTransitionId = undoTransitionIdRef.current;

    const startFreshToast = () => {
      // Guard: a newer showUndoToast call has already taken over — do nothing.
      if (undoTransitionIdRef.current !== myTransitionId) return;

      // Defensively clear any timer that may have been scheduled by an earlier
      // interrupted transition before starting a new one.
      if (undoTimerRef.current !== null) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }

      // Reset all animated values before fading the new toast in
      undoOpacity.setValue(0);
      undoTranslateY.setValue(8);
      undoProgressAnim.setValue(1);
      undoSwipeY.setValue(0);
      setUndoDeleteState({ preset, index });
      if (!undoToastSwipeHintSeen) {
        triggerUndoToastSwipeHint(reduceMotionRef.current);
      }
      undoRemainingMsRef.current = undoMs;
      undoSegmentStartRef.current = Date.now();
      if (reduceMotionRef.current) {
        undoOpacity.setValue(1);
        undoTranslateY.setValue(0);
        // Reduce-motion: no auto-dismiss timer — toast stays until the user
        // explicitly taps Undo or swipes away (same safety guarantee as the
        // confirm toast's reduce-motion path).
      } else {
        const enterAnim = Animated.parallel([
          Animated.timing(undoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(undoTranslateY, { toValue: 0, duration: 320, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
          Animated.timing(undoProgressAnim, {
            toValue: 0,
            duration: undoMs,
            useNativeDriver: false,
          }),
        ]);
        undoAnimRef.current = enterAnim;
        enterAnim.start(({ finished }) => {
          if (finished) undoAnimRef.current = null;
        });
        undoTimerRef.current = setTimeout(() => {
          undoTimerRef.current = null;
          dismissUndoToastOnExpiry();
        }, undoMs);
      }
    };

    if (previousToastVisible && !reduceMotionRef.current) {
      // Cross-fade: briefly fade the outgoing toast to 0, then start the new one.
      // Only proceed when the animation ran to completion (finished=true); if it
      // was interrupted by yet another delete, that newer call owns the token and
      // its own callback will handle the rest.
      Animated.timing(undoOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(({ finished }) => {
        if (finished) startFreshToast();
      });
    } else {
      // No previous toast visible (or reduce-motion): instant reset then fade in
      startFreshToast();
    }
  }

  async function handleUndoDelete() {
    if (!undoDeleteState) return;
    const { preset, index } = undoDeleteState;
    dismissUndoToast(async () => {
      const restored = [...presets];
      restored.splice(index, 0, preset);
      await savePresets(restored);
      updateSettings({ cardPresets: restored as unknown as StoredCardPreset[] });
      setPresets(restored);
    });
  }

  async function handleDeletePreset(presetId: string) {
    const index = presets.findIndex((p) => p.id === presetId);
    if (index === -1) return;
    const preset = presets[index];
    const updated = presets.filter((p) => p.id !== presetId);
    await savePresets(updated);
    updateSettings({ cardPresets: updated as unknown as StoredCardPreset[] });
    setPresets(updated);
    if (activePresetId === presetId) {
      setActivePresetId(null);
      setActivePresetModified(false);
      AsyncStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET).catch(() => {});
    }
    showUndoToast(preset, index);
  }

  async function handleRenameConfirm() {
    const name = renameInput.trim();
    if (!name || !renameTargetPreset) return;
    setRenamingPreset(true);
    const updatedPresets = presets.map((p) =>
      p.id === renameTargetPreset.id ? { ...p, name } : p
    );
    await savePresets(updatedPresets);
    updateSettings({ cardPresets: updatedPresets as unknown as StoredCardPreset[] });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPresets(updatedPresets);
    if (renameTargetPreset.id === activePresetId) {
      setPresetSavedAt(Date.now());
      AsyncStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, renameTargetPreset.id).catch(() => {});
    }
    setRenamingPreset(false);
    setRenameTargetPreset(null);
    setRenameInput("");
    showConfirmation(`Renamed to "${name}"`, "success", "create-outline");
  }

  function scrollToStatToggles() {
    modalScrollRef.current?.scrollTo({ y: statTogglesYOffsetRef.current, animated: !reduceMotionRef.current });
    statTogglesPulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(statTogglesPulseAnim, { toValue: 1, duration: reduceMotionRef.current ? 0 : 250, useNativeDriver: false }),
      Animated.delay(600),
      Animated.timing(statTogglesPulseAnim, { toValue: 0, duration: reduceMotionRef.current ? 0 : 400, useNativeDriver: false }),
    ]).start();
  }

  useImperativeHandle(ref, () => ({ highlightStatToggles: scrollToStatToggles }), []);

  const anyStatEnabled = Object.values(visibleStats).some(Boolean);

  // Reduce-motion preference (used to suppress lock-icon shake animation)
  const prefersReducedMotion = useReducedMotion();

  // Per-button lock-icon shake animations (one Animated.Value per action)
  const lockShakeAnims = useRef({
    share: new Animated.Value(0),
    save: new Animated.Value(0),
    copy: new Animated.Value(0),
    both: new Animated.Value(0),
  }).current;

  const triggerLockShake = useCallback((action: CardAction) => {
    if (prefersReducedMotion) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const anim = lockShakeAnims[action];
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue:  6, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(anim, { toValue: -6, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(anim, { toValue:  5, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(anim, { toValue: -5, duration: 50, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(anim, { toValue:  3, duration: 40, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(anim, { toValue:  0, duration: 40, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  }, [prefersReducedMotion, lockShakeAnims]);

  // Locked-button hint fade animation
  const [lockedHintMounted, setLockedHintMounted] = useState(!anyStatEnabled);
  const lockedHintFadeAnim = useRef(new Animated.Value(!anyStatEnabled ? 1 : 0)).current;
  const lockedHintIsFirstRender = useRef(true);

  // actionButtonsReady gates the extra UI that appears only when stats are enabled
  // (quick-generate button, long-press hint, setting rows). It lags anyStatEnabled
  // by the hint's 200 ms fade-out so those elements don't jump in while the hint
  // is still visible. It snaps to false immediately when all stats are disabled.
  const [actionButtonsReady, setActionButtonsReady] = useState(anyStatEnabled);

  useEffect(() => {
    if (lockedHintIsFirstRender.current) {
      lockedHintIsFirstRender.current = false;
      return;
    }
    if (!anyStatEnabled) {
      setActionButtonsReady(false);
      setLockedHintMounted(true);
      if (reduceMotionRef.current) {
        lockedHintFadeAnim.setValue(1);
      } else {
        lockedHintFadeAnim.setValue(0);
        Animated.timing(lockedHintFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    } else {
      if (reduceMotionRef.current) {
        lockedHintFadeAnim.setValue(0);
        setLockedHintMounted(false);
        setActionButtonsReady(true);
      } else {
        Animated.timing(lockedHintFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            setLockedHintMounted(false);
            setActionButtonsReady(true);
          }
        });
      }
    }
  }, [anyStatEnabled]);

  // Tap-generate hint: shown below the action row after the user picks an action for the first time
  const openedWithNoSavedActionRef = useRef(false);
  const [showTapGenerateHint, setShowTapGenerateHint] = useState(false);
  const [tapGenerateHintMounted, setTapGenerateHintMounted] = useState(false);
  const tapGenerateHintFadeAnim = useRef(new Animated.Value(0)).current;
  // First-render guard: prevents the reset-to-0 / fade-in from firing when the
  // hint is already visible on mount (e.g. after a hot reload or state restore).
  // Matches the pattern used for longPressHintIsFirstRender and
  // disabledBtnLpHintIsFirstRender.
  const tapGenerateHintIsFirstRender = useRef(true);

  useEffect(() => {
    if (!openedWithNoSavedActionRef.current) return;
    if (!selectedAction) return;
    if (tapGenerateHintIsFirstRender.current) {
      tapGenerateHintIsFirstRender.current = false;
      if (showTapGenerateHint) {
        // Already visible on mount (e.g. after a hot reload) — snap straight
        // to the final opaque state; no reset-to-0 flash needed.
        tapGenerateHintFadeAnim.setValue(1);
        return;
      }
      // Hint is not yet visible — fall through to show it now.
    }
    // Show the hint when the user first selects an action
    setTapGenerateHintMounted(true);
    setShowTapGenerateHint(true);
    if (reduceMotionRef.current) {
      tapGenerateHintFadeAnim.setValue(1);
    } else {
      tapGenerateHintFadeAnim.setValue(0);
      Animated.timing(tapGenerateHintFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [selectedAction]);

  function dismissTapGenerateHint() {
    if (!showTapGenerateHint && !tapGenerateHintMounted) return;
    openedWithNoSavedActionRef.current = false;
    setShowTapGenerateHint(false);
    AsyncStorage.setItem(STORAGE_KEY_TAP_GENERATE_HINT_SEEN, "1").catch(() => {});
    if (reduceMotionRef.current) {
      tapGenerateHintFadeAnim.setValue(0);
      setTapGenerateHintMounted(false);
    } else {
      Animated.timing(tapGenerateHintFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setTapGenerateHintMounted(false);
      });
    }
  }

  // Tap-again hint: shown below the selected action button the first time an action is chosen
  const tapAgainHintEligibleRef = useRef(false);
  const tapAgainHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapAgainHintMounted, setTapAgainHintMounted] = useState(false);
  const tapAgainHintFadeAnim = useRef(new Animated.Value(0)).current;

  function showTapAgainHint() {
    if (!tapAgainHintEligibleRef.current) return;
    tapAgainHintEligibleRef.current = false;
    AsyncStorage.setItem(STORAGE_KEY_TAP_AGAIN_HINT_SEEN, "1").catch(() => {});
    setTapAgainHintMounted(true);
    if (reduceMotionRef.current) {
      tapAgainHintFadeAnim.setValue(1);
    } else {
      tapAgainHintFadeAnim.setValue(0);
      Animated.timing(tapAgainHintFadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
    tapAgainHintTimerRef.current = setTimeout(() => {
      tapAgainHintTimerRef.current = null;
      dismissTapAgainHint();
    }, 3500);
  }

  function dismissTapAgainHint() {
    if (tapAgainHintTimerRef.current !== null) {
      clearTimeout(tapAgainHintTimerRef.current);
      tapAgainHintTimerRef.current = null;
    }
    if (!tapAgainHintMounted) return;
    if (reduceMotionRef.current) {
      tapAgainHintFadeAnim.setValue(0);
      setTapAgainHintMounted(false);
    } else {
      Animated.timing(tapAgainHintFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setTapAgainHintMounted(false);
      });
    }
  }

  // Stats-section nudge: first-launch coach mark near the action buttons, shown once to guide
  // new users to the VISIBLE STATS section even when all stats start enabled by default.
  //
  // Two-track eligibility: `statsNudgeEligible` (state) causes the effect to re-fire once
  // loadSaved() resolves and marks the user eligible — solving the async race where the effect
  // first runs (visible=true) before storage has been read.  `statsNudgeEligibleRef` (ref)
  // is used for guarding inside the 1.5 s timeout callback where stale closures would make
  // reading state unreliable.
  const [statsNudgeEligible, setStatsNudgeEligible] = useState(false);
  const statsNudgeEligibleRef = useRef(false);
  const [statsNudgeMounted, setStatsNudgeMounted] = useState(false);
  const statsNudgeFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      // Reset so the nudge doesn't linger or skip its intro delay on next open
      statsNudgeFadeAnim.setValue(0);
      setStatsNudgeMounted(false);
      return;
    }
    // Guard via ref — safe inside the async callback below
    if (!statsNudgeEligibleRef.current) return;
    // Delay so other UI settles first, then fade in
    const timer = setTimeout(() => {
      if (!statsNudgeEligibleRef.current) return;
      // Persist the seen flag immediately on display so the nudge never shows again,
      // even if the user never taps it.
      AsyncStorage.setItem(STORAGE_KEY_STATS_NUDGE_SEEN, "1").catch(() => {});
      statsNudgeEligibleRef.current = false;
      setStatsNudgeMounted(true);
      if (reduceMotionRef.current) {
        statsNudgeFadeAnim.setValue(1);
      } else {
        statsNudgeFadeAnim.setValue(0);
        Animated.timing(statsNudgeFadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      }
    }, 1500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, statsNudgeEligible]);

  function dismissStatsNudge() {
    statsNudgeEligibleRef.current = false;
    AsyncStorage.setItem(STORAGE_KEY_STATS_NUDGE_SEEN, "1").catch(() => {});
    if (reduceMotionRef.current) {
      statsNudgeFadeAnim.setValue(0);
      setStatsNudgeMounted(false);
    } else {
      Animated.timing(statsNudgeFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setStatsNudgeMounted(false);
      });
    }
  }

  // Disabled-button long-press hint: shown below action row when all stats off, dismissable & persisted
  const [disabledBtnLpHintDismissed, setDisabledBtnLpHintDismissed] = useState(false);
  // Tracks how many times the hint has been dismissed (stored as string count in AsyncStorage).
  // Max DISABLED_BTN_LP_HINT_MAX_SHOWS — once reached the hint is permanently suppressed.
  const disabledBtnLpHintShowCountRef = useRef(0);
  // Start hidden regardless of anyStatEnabled: the pre-load synchronous reset
  // (see the visible-effect block) guards this until storage confirms eligibility.
  const [disabledBtnLpHintMounted, setDisabledBtnLpHintMounted] = useState(false);
  const disabledBtnLpHintFadeAnim = useRef(new Animated.Value(0)).current;
  const disabledBtnLpHintIsFirstRender = useRef(true);
  // Tracks the previous anyStatEnabled value to detect ≥1 → 0 transitions.
  const disabledBtnLpHintPrevAnyStatEnabled = useRef(anyStatEnabled);
  useEffect(() => {
    if (disabledBtnLpHintIsFirstRender.current) {
      disabledBtnLpHintIsFirstRender.current = false;
      disabledBtnLpHintPrevAnyStatEnabled.current = anyStatEnabled;
      return;
    }

    const prevEnabled = disabledBtnLpHintPrevAnyStatEnabled.current;
    disabledBtnLpHintPrevAnyStatEnabled.current = anyStatEnabled;

    // When the user goes from having ≥1 stat enabled to 0 stats, and has previously dismissed
    // the hint but hasn't yet reached the max show count, reset the dismissed state so the hint
    // resurfaces once more (helping rediscovery without being indefinitely repetitive).
    if (
      !anyStatEnabled &&
      prevEnabled &&
      disabledBtnLpHintDismissed &&
      disabledBtnLpHintShowCountRef.current < DISABLED_BTN_LP_HINT_MAX_SHOWS
    ) {
      setDisabledBtnLpHintDismissed(false);
      return;
    }

    if (!anyStatEnabled && !disabledBtnLpHintDismissed) {
      setDisabledBtnLpHintMounted(true);
      if (reduceMotionRef.current) {
        disabledBtnLpHintFadeAnim.setValue(1);
      } else {
        disabledBtnLpHintFadeAnim.setValue(0);
        Animated.timing(disabledBtnLpHintFadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }
    } else {
      if (reduceMotionRef.current) {
        disabledBtnLpHintFadeAnim.setValue(0);
        setDisabledBtnLpHintMounted(false);
      } else {
        Animated.timing(disabledBtnLpHintFadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setDisabledBtnLpHintMounted(false);
        });
      }
    }
  }, [anyStatEnabled, disabledBtnLpHintDismissed]);

  function dismissDisabledBtnLpHint() {
    const newCount = disabledBtnLpHintShowCountRef.current + 1;
    disabledBtnLpHintShowCountRef.current = newCount;
    AsyncStorage.setItem(STORAGE_KEY_DISABLED_BTN_LP_HINT_SEEN, String(newCount)).catch(() => {});
    setDisabledBtnLpHintDismissed(true);
    if (reduceMotionRef.current) {
      disabledBtnLpHintFadeAnim.setValue(0);
      setDisabledBtnLpHintMounted(false);
    } else {
      Animated.timing(disabledBtnLpHintFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setDisabledBtnLpHintMounted(false);
      });
    }
  }

  const bottomPad = Platform.OS === "ios" ? insets.bottom : 16;

  // Zoom shared values — lifted here so position survives open/close cycles
  const pinchScale = useSharedValue(1);
  const pinchSavedScale = useSharedValue(1);
  const pinchTranslateX = useSharedValue(0);
  const pinchTranslateY = useSharedValue(0);
  const pinchSavedTranslateX = useSharedValue(0);
  const pinchSavedTranslateY = useSharedValue(0);

  function resetZoomPosition() {
    if (reduceMotionShared.value) {
      pinchScale.value = 1;
      pinchTranslateX.value = 0;
      pinchTranslateY.value = 0;
    } else {
      pinchScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      pinchTranslateX.value = withSpring(0, { damping: 15, stiffness: 200 });
      pinchTranslateY.value = withSpring(0, { damping: 15, stiffness: 200 });
    }
    pinchSavedScale.value = 1;
    pinchSavedTranslateX.value = 0;
    pinchSavedTranslateY.value = 0;
  }

  const [cardNativeHeight, setCardNativeHeight] = useState(500);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [themeScrollAtEnd, setThemeScrollAtEnd] = useState(false);
  const [themeHasOverflow, setThemeHasOverflow] = useState(false);
  useEffect(() => {
    if (CARD_THEMES.length <= 1) {
      setThemeHasOverflow(false);
    }
  }, [CARD_THEMES.length]);
  const themeContainerWidth = useRef(0);
  const themeContentWidth = useRef(0);
  const [presetScrollAtEnd, setPresetScrollAtEnd] = useState(false);
  const [presetHasOverflow, setPresetHasOverflow] = useState(false);
  useEffect(() => {
    if (presets.length <= 1) {
      setPresetHasOverflow(false);
    }
  }, [presets.length]);
  const presetContainerWidth = useRef(0);
  const presetContentWidth = useRef(0);
  const zoomAnim = useRef(new Animated.Value(0)).current;
  const zoomTranslateX = useRef(new Animated.Value(0)).current;
  const zoomTranslateY = useRef(new Animated.Value(0)).current;
  const zoomOriginScale = useRef(new Animated.Value(1)).current;
  const zoomSwipeDragY = useRef(new Animated.Value(0)).current;
  const presetPreviewSwipeDragY = useRef(new Animated.Value(0)).current;
  const zoomOriginRect = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const cardPreviewRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);

  const [showPinchHint, setShowPinchHint] = useState(false);
  const pinchHintAnim = useRef(new Animated.Value(0)).current;
  const pinchDismissAnim = useRef(new Animated.Value(0)).current;
  const pinchDismissOpacity = useMemo(
    () => pinchDismissAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 1] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const pinchDismissScale = useMemo(
    () => pinchDismissAnim.interpolate({ inputRange: [0, 0.45, 0.72, 1], outputRange: [1, 1, 1.08, 1] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [showModifiedChipHint, setShowModifiedChipHint] = useState(false);
  const modifiedChipHintAnim = useRef(new Animated.Value(0)).current;
  const modifiedChipHintShownThisSession = useRef(false);

  function triggerModifiedChipHint() {
    if (modifiedChipHintShownThisSession.current) return;
    modifiedChipHintShownThisSession.current = true;
    AsyncStorage.setItem(STORAGE_KEY_MODIFIED_CHIP_HINT_SEEN, "1").catch(() => {});
    setShowModifiedChipHint(true);
    if (reduceMotionRef.current) {
      modifiedChipHintAnim.setValue(1);
      setTimeout(() => {
        setShowModifiedChipHint(false);
        modifiedChipHintAnim.setValue(0);
        AsyncStorage.setItem(STORAGE_KEY_MODIFIED_CHIP_HINT_SEEN, "1").catch(() => {});
      }, 3000);
    } else {
      modifiedChipHintAnim.setValue(0);
      Animated.sequence([
        Animated.timing(modifiedChipHintAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2800),
        Animated.timing(modifiedChipHintAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          setShowModifiedChipHint(false);
          AsyncStorage.setItem(STORAGE_KEY_MODIFIED_CHIP_HINT_SEEN, "1").catch(() => {});
        }
      });
    }
  }

  useEffect(() => {
    if (!activePresetModified) return;
    AsyncStorage.getItem(STORAGE_KEY_MODIFIED_CHIP_HINT_SEEN).then((val) => {
      if (!val) triggerModifiedChipHint();
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePresetModified]);

  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const swipeHintAnim = useRef(new Animated.Value(0)).current;
  // Drives the "Tap to dismiss" label fade-in pulse — mirrors pinchDismissAnim.
  const swipeDismissAnim = useRef(new Animated.Value(0)).current;
  const swipeDismissOpacity = useMemo(
    () => swipeDismissAnim.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 1] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const swipeDismissScale = useMemo(
    () => swipeDismissAnim.interpolate({ inputRange: [0, 0.45, 0.72, 1], outputRange: [1, 1, 1.08, 1] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function triggerSwipeHint() {
    setShowSwipeHint(true);
    if (reduceMotionRef.current) {
      swipeHintAnim.setValue(1);
      swipeDismissAnim.setValue(1);
      setTimeout(() => {
        setShowSwipeHint(false);
        AsyncStorage.setItem(STORAGE_KEY_PRESET_SWIPE_HINT_SEEN, "1").catch(() => {});
      }, 2000);
    } else {
      swipeHintAnim.setValue(0);
      swipeDismissAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(swipeHintAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.delay(1800),
          Animated.timing(swipeHintAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(swipeDismissAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          setShowSwipeHint(false);
          AsyncStorage.setItem(STORAGE_KEY_PRESET_SWIPE_HINT_SEEN, "1").catch(() => {});
        }
      });
    }
  }

  function dismissSwipeHintEarly() {
    if (!showSwipeHint) return;
    swipeHintAnim.stopAnimation();
    swipeDismissAnim.stopAnimation();
    Animated.parallel([
      Animated.timing(swipeHintAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(swipeDismissAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) {
        setShowSwipeHint(false);
        AsyncStorage.setItem(STORAGE_KEY_PRESET_SWIPE_HINT_SEEN, "1").catch(() => {});
      }
    });
  }

  function triggerPinchHint() {
    setShowPinchHint(true);
    if (reduceMotionRef.current) {
      pinchHintAnim.setValue(1);
      pinchDismissAnim.setValue(1);
      setTimeout(() => {
        setShowPinchHint(false);
        AsyncStorage.setItem(STORAGE_KEY_PINCH_HINT_SEEN, "1").catch(() => {});
      }, 2000);
    } else {
      pinchHintAnim.setValue(0);
      pinchDismissAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pinchHintAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.delay(1800),
          Animated.timing(pinchHintAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.delay(600),
          Animated.timing(pinchDismissAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          setShowPinchHint(false);
          AsyncStorage.setItem(STORAGE_KEY_PINCH_HINT_SEEN, "1").catch(() => {});
        }
      });
    }
  }

  function dismissPinchHintEarly() {
    if (!showPinchHint) return;
    pinchHintAnim.stopAnimation();
    Animated.timing(pinchHintAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowPinchHint(false);
        AsyncStorage.setItem(STORAGE_KEY_PINCH_HINT_SEEN, "1").catch(() => {});
      }
    });
  }

  const [showZoomSwipeDownHint, setShowZoomSwipeDownHint] = useState(false);
  const zoomSwipeDownHintAnim = useRef(new Animated.Value(0)).current;
  const zoomSwipeDownArrowAnim = useRef(new Animated.Value(0)).current;
  const zoomSwipeDownHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function triggerZoomSwipeDownHint() {
    zoomSwipeDownHintTimerRef.current = null;
    if (reduceMotionRef.current) {
      AsyncStorage.setItem(STORAGE_KEY_ZOOM_SWIPE_DOWN_HINT_SEEN, "1").catch(() => {});
      return;
    }
    setShowZoomSwipeDownHint(true);
    {
      zoomSwipeDownHintAnim.setValue(0);
      zoomSwipeDownArrowAnim.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(zoomSwipeDownHintAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.delay(1800),
          Animated.timing(zoomSwipeDownHintAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.delay(400),
            Animated.timing(zoomSwipeDownArrowAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
            Animated.timing(zoomSwipeDownArrowAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          { iterations: 3 }
        ),
      ]).start(({ finished }) => {
        if (finished) {
          setShowZoomSwipeDownHint(false);
          AsyncStorage.setItem(STORAGE_KEY_ZOOM_SWIPE_DOWN_HINT_SEEN, "1").catch(() => {});
        }
      });
    }
  }

  function dismissZoomSwipeDownHintEarly() {
    if (!showZoomSwipeDownHint) return;
    zoomSwipeDownHintAnim.stopAnimation();
    zoomSwipeDownArrowAnim.stopAnimation();
    Animated.timing(zoomSwipeDownHintAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setShowZoomSwipeDownHint(false);
        AsyncStorage.setItem(STORAGE_KEY_ZOOM_SWIPE_DOWN_HINT_SEEN, "1").catch(() => {});
      }
    });
  }

  useEffect(() => {
    return () => {
      if (zoomSwipeDownHintTimerRef.current !== null) {
        clearTimeout(zoomSwipeDownHintTimerRef.current);
        zoomSwipeDownHintTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openZoom() {
    setZoomVisible(true);
    if (reduceMotionRef.current) {
      zoomAnim.setValue(1);
      zoomTranslateX.setValue(0);
      zoomTranslateY.setValue(0);
      zoomOriginScale.setValue(1);
    } else {
      const win = Dimensions.get("window");
      const screenW = win.width;
      const screenH = win.height;

      const launchAnimation = (
        initialTX: number,
        initialTY: number,
        initialScale: number
      ) => {
        zoomAnim.setValue(0);
        zoomTranslateX.setValue(initialTX);
        zoomTranslateY.setValue(initialTY);
        zoomOriginScale.setValue(initialScale);

        const springConfig = { damping: 16, stiffness: 400, mass: 0.6, useNativeDriver: true as const };
        Animated.parallel([
          Animated.spring(zoomAnim, { toValue: 1, ...springConfig }),
          Animated.spring(zoomTranslateX, { toValue: 0, ...springConfig }),
          Animated.spring(zoomTranslateY, { toValue: 0, ...springConfig }),
          Animated.spring(zoomOriginScale, { toValue: 1, ...springConfig }),
        ]).start();
      };

      if (cardPreviewRef.current) {
        cardPreviewRef.current.measureInWindow((px: number, py: number, width: number, height: number) => {
          const originCenterX = px + width / 2;
          const originCenterY = py + height / 2;
          const zoomCardW = CARD_WIDTH * zoomScale;
          const initialScale = width / zoomCardW;
          zoomOriginRect.current = { x: px, y: py, width, height };
          launchAnimation(
            originCenterX - screenW / 2,
            originCenterY - screenH / 2,
            initialScale
          );
        });
      } else {
        launchAnimation(0, 0, cardScale / zoomScale);
      }
    }
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY_PINCH_HINT_SEEN);
      if (!seen) {
        setTimeout(triggerPinchHint, 400);
      }
    } catch {
      // ignore
    }
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY_ZOOM_SWIPE_DOWN_HINT_SEEN);
      if (!seen) {
        zoomSwipeDownHintTimerRef.current = setTimeout(triggerZoomSwipeDownHint, 600);
      }
    } catch {
      // ignore
    }
  }

  function closeZoom(releaseVelocity = 0) {
    if (zoomSwipeDownHintTimerRef.current !== null) {
      clearTimeout(zoomSwipeDownHintTimerRef.current);
      zoomSwipeDownHintTimerRef.current = null;
    }
    dismissZoomSwipeDownHintEarly();
    if (reduceMotionRef.current) {
      zoomAnim.setValue(0);
      zoomTranslateX.setValue(0);
      zoomTranslateY.setValue(0);
      zoomOriginScale.setValue(1);
      zoomSwipeDragY.setValue(0);
      setZoomVisible(false);
    } else {
      const win = Dimensions.get("window");
      const screenW = win.width;
      const screenH = win.height;
      const { x, y, width, height } = zoomOriginRect.current;
      const originCenterX = x + width / 2;
      const originCenterY = y + height / 2;
      const zoomCardW = CARD_WIDTH * zoomScale;
      const targetScale = width > 0 ? width / zoomCardW : cardScale / zoomScale;
      const springConfig = { damping: 50, stiffness: 400, mass: 0.6, overshootClamping: true, useNativeDriver: true as const };
      Animated.parallel([
        Animated.spring(zoomAnim, { toValue: 0, ...springConfig }),
        Animated.spring(zoomTranslateX, { toValue: originCenterX - screenW / 2, ...springConfig }),
        Animated.spring(zoomTranslateY, { toValue: originCenterY - screenH / 2, velocity: releaseVelocity, ...springConfig }),
        Animated.spring(zoomOriginScale, { toValue: targetScale, ...springConfig }),
        Animated.spring(zoomSwipeDragY, { toValue: 0, ...springConfig }),
      ]).start(({ finished }) => {
        if (finished) {
          setZoomVisible(false);
          zoomTranslateX.setValue(0);
          zoomTranslateY.setValue(0);
          zoomOriginScale.setValue(1);
          zoomSwipeDragY.setValue(0);
        }
      });
    }
  }

  // Swipe-down gesture to dismiss the zoom overlay
  const closeZoomRef = useRef(closeZoom);
  closeZoomRef.current = closeZoom;

  // Stable handlers for ZoomableCard's onSwipeDown/onSwipeDownProgress so the
  // inner RNGH pan gesture can drive the dismiss animation directly.  This is
  // necessary because RNGH gestures take priority over the outer PanResponder
  // when the card is zoomed in, meaning the PanResponder never fires.
  const handleZoomSwipeDown = useCallback((velocityY: number) => {
    closeZoomRef.current(velocityY);
  }, []);

  const handleZoomDismiss = useCallback(() => {
    closeZoomRef.current(0);
  }, []);

  const swipeBackSpringConfig = {
    damping: 50,
    stiffness: 400,
    mass: 0.6,
    overshootClamping: true,
    useNativeDriver: true,
  } as const;

  const handleZoomSwipeDownProgress = useCallback((dy: number) => {
    if (dy > 0) {
      zoomSwipeDragY.setValue(dy);
    } else {
      Animated.spring(zoomSwipeDragY, {
        toValue: 0,
        ...swipeBackSpringConfig,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoomSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 12 && gs.dy > Math.abs(gs.dx) * 1.5,
      onPanResponderMove: (_, gs) => {
        zoomSwipeDragY.setValue(Math.max(0, gs.dy));
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          closeZoomRef.current(gs.vy);
        } else {
          Animated.spring(zoomSwipeDragY, {
            toValue: 0,
            damping: 50,
            stiffness: 400,
            mass: 0.6,
            overshootClamping: true,
            useNativeDriver: true,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(zoomSwipeDragY, {
          toValue: 0,
          damping: 50,
          stiffness: 400,
          mass: 0.6,
          overshootClamping: true,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  // Swipe-down gesture to dismiss the preset preview overlay
  const closePresetPreviewRef = useRef(closePresetPreview);
  closePresetPreviewRef.current = closePresetPreview;

  const navigatePresetPreviewRef = useRef<(dir: 1 | -1) => void>(navigatePresetPreview);
  navigatePresetPreviewRef.current = navigatePresetPreview;

  // Stable callbacks for ZoomableCard's drag-follow preset navigation.
  // Called from the RNGH worklet via runOnJS, so they must be stable references.
  const handlePresetDragX = useCallback((dx: number) => {
    presetCardTranslateX.setValue(dx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePresetNavigateDir = useCallback((dir: 1 | -1) => {
    const newIdx = presetPreviewIndexRef.current + dir;
    if (newIdx >= 0 && newIdx < presetPreviewPresetsRef.current.length) {
      navigatePresetPreviewRef.current(dir);
    } else {
      // Out of bounds — spring back to center so the card is never left stranded.
      Animated.spring(presetCardTranslateX, {
        toValue: 0,
        damping: 50,
        stiffness: 400,
        mass: 0.6,
        overshootClamping: true,
        useNativeDriver: true,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePresetSnapBack = useCallback(() => {
    Animated.spring(presetCardTranslateX, {
      toValue: 0,
      damping: 50,
      stiffness: 400,
      mass: 0.6,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracks whether the current PanResponder gesture was locked to horizontal
  // or vertical so that a single drag stays on one axis.
  const presetPreviewGestureDir = useRef<'h' | 'v' | null>(null);

  const snapBackSpring = {
    damping: 50,
    stiffness: 400,
    mass: 0.6,
    overshootClamping: true,
    useNativeDriver: true,
  } as const;

  const presetPreviewSwipePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);
        if (absDx > 8 && absDx > absDy * 1.5) return true;
        if (absDy > 12 && absDy > absDx * 1.5) return true;
        return false;
      },
      onPanResponderGrant: () => {
        presetPreviewGestureDir.current = null;
      },
      onPanResponderMove: (_, gs) => {
        const absDx = Math.abs(gs.dx);
        const absDy = Math.abs(gs.dy);
        if (!presetPreviewGestureDir.current) {
          if (absDx > absDy * 1.5) presetPreviewGestureDir.current = 'h';
          else if (absDy > absDx * 1.5) presetPreviewGestureDir.current = 'v';
        }
        if (presetPreviewGestureDir.current === 'h') {
          presetCardTranslateX.setValue(gs.dx);
        } else {
          presetPreviewSwipeDragY.setValue(Math.max(0, gs.dy));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (presetPreviewGestureDir.current === 'h') {
          const absDx = Math.abs(gs.dx);
          const absVx = Math.abs(gs.vx);
          if (absDx > 80 || absVx > 0.5) {
            const dir: 1 | -1 = gs.dx < 0 ? 1 : -1;
            const newIdx = presetPreviewIndexRef.current + dir;
            if (newIdx >= 0 && newIdx < presetPreviewPresetsRef.current.length) {
              navigatePresetPreviewRef.current(dir);
            } else {
              Animated.spring(presetCardTranslateX, { toValue: 0, ...snapBackSpring }).start();
            }
          } else {
            Animated.spring(presetCardTranslateX, { toValue: 0, ...snapBackSpring }).start();
          }
        } else {
          if (gs.dy > 80 || gs.vy > 0.5) {
            closePresetPreviewRef.current();
          } else {
            Animated.spring(presetPreviewSwipeDragY, { toValue: 0, ...snapBackSpring }).start();
          }
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(presetCardTranslateX, { toValue: 0, ...snapBackSpring }).start();
        Animated.spring(presetPreviewSwipeDragY, { toValue: 0, ...snapBackSpring }).start();
      },
    })
  ).current;

  // Stable handlers for preset preview ZoomableCard's onSwipeDown/onSwipeDownProgress.
  // Required for the same reason as the zoom view: RNGH can take gesture priority over
  // the outer PanResponder when the card is pinch-zoomed, so we need both paths.
  const handlePresetPreviewSwipeDown = useCallback((_velocityY: number) => {
    closePresetPreviewRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePresetPreviewDismiss = useCallback(() => {
    closePresetPreviewRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePresetPreviewSwipeDownProgress = useCallback((dy: number) => {
    if (dy > 0) {
      presetPreviewSwipeDragY.setValue(dy);
    } else {
      Animated.spring(presetPreviewSwipeDragY, {
        toValue: 0,
        ...swipeBackSpringConfig,
      }).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable callback wrappers via refs — give memoized child components stable function
  // references while always invoking the latest closure, eliminating stale-closure hazards.
  const handleDeletePresetRef = useRef(handleDeletePreset);
  handleDeletePresetRef.current = handleDeletePreset;
  const stableHandleDeletePreset = useCallback(
    (id: string) => handleDeletePresetRef.current(id),
    []
  );

  const openPresetPreviewRef = useRef(openPresetPreview);
  openPresetPreviewRef.current = openPresetPreview;
  const stableOpenPresetPreview = useCallback(
    (preset: CardPreset, originRect: PresetOriginRect) => openPresetPreviewRef.current(preset, originRect),
    []
  );

  const handleSwapPresetPhotoRef = useRef<(presetId: string) => Promise<void>>(() => Promise.resolve());
  handleSwapPresetPhotoRef.current = handleSwapPresetPhoto;

  const stableOnPresetLongPress = useCallback((preset: CardPreset) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      preset.name,
      undefined,
      [
        {
          text: "Rename",
          onPress: () => {
            setRenameTargetPreset(preset);
            setRenameInput(preset.name);
            setTimeout(() => renameInputRef.current?.focus(), 150);
          },
        },
        {
          text: "Change Photo",
          onPress: () => { handleSwapPresetPhotoRef.current(preset.id).catch(() => {}); },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }, []);

  const handleThemeChangeRef = useRef(handleThemeChange);
  handleThemeChangeRef.current = handleThemeChange;
  const stableHandleThemeChange = useCallback(
    (themeId: CardThemeId) => handleThemeChangeRef.current(themeId),
    []
  );

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
          onTouchStart={resetAutoTriggerOnInteraction}
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
                <Animated.View style={[styles.restoredBadge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40", opacity: badgeFadeAnim, transform: [{ translateY: badgeSlideAnim }] }]} pointerEvents={badgeDismissed ? "none" : "auto"}>
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
            ref={modalScrollRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            scrollEnabled={!reorderMode}
            onScrollBeginDrag={() => {
              resetAutoTriggerOnInteraction();
              if (showInlineSave) { setShowInlineSave(false); Keyboard.dismiss(); }
            }}
          >
            <View
              onStartShouldSetResponder={() => showInlineSave}
              onResponderRelease={() => { setShowInlineSave(false); Keyboard.dismiss(); }}
            >
            {/* ── Presets section ── */}
            <View style={styles.presetsHeader}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                PRESETS
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                {presets.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setReorderMode(true);
                    }}
                    style={[styles.savePresetBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  >
                    <Ionicons name="reorder-three-outline" size={13} color={colors.mutedForeground} />
                    <Text style={[styles.savePresetBtnText, { color: colors.mutedForeground }]}>
                      Manage
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    if (showInlineSave) {
                      setShowInlineSave(false);
                      setPresetNameInput("");
                    } else {
                      // Guard: ignore taps while the close animation is still running
                      // to prevent a double-tap from reopening the panel mid-slide.
                      if (inlineSaveAnimating.current) return;
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
                onDone={() => { setReorderMode(false); showConfirmation("Order saved", "success", "list-outline"); }}
                activePresetId={activePresetId}
                onLoadPreset={loadPreset}
                onDeletePreset={(id) => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                  handleDeletePreset(id);
                  showConfirmation("Preset deleted", "success", "trash-outline");
                  if (presets.length <= 1) setReorderMode(false);
                }}
                onRename={(preset) => {
                  setRenameTargetPreset(preset);
                  setRenameInput(preset.name);
                  setTimeout(() => renameInputRef.current?.focus(), 150);
                }}
                colors={colors}
              />
            ) : (
              <>
                <Reanimated.View
                  style={[styles.presetsThumbnailsWrapper, presetsRowAnimatedStyle]}
                  onLayout={(e) => {
                    if (presets.length <= 1) return;
                    const w = e.nativeEvent.layout.width;
                    presetContainerWidth.current = w;
                    setPresetHasOverflow(presetContentWidth.current > w + 4);
                  }}
                >
                <ScrollView
                  ref={presetChipsScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  decelerationRate="fast"
                  snapToOffsets={chipSnapOffsets.length > 0 ? chipSnapOffsets : undefined}
                  contentContainerStyle={styles.presetsScroll}
                  onContentSizeChange={(w) => {
                    if (presets.length <= 1) return;
                    presetContentWidth.current = w;
                    setPresetHasOverflow(w > presetContainerWidth.current + 4);
                  }}
                  onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
                    const distanceFromEnd = contentSize.width - layoutMeasurement.width - contentOffset.x;
                    setPresetScrollAtEnd(distanceFromEnd < 16);
                  }}
                  scrollEventThrottle={16}
                >
                  {presets.map((preset, chipIndex) => (
                    <PresetChipItem
                      key={preset.id}
                      preset={preset}
                      isActive={preset.id === activePresetId}
                      isModified={preset.id === activePresetId && activePresetModified}
                      savedAt={preset.id === activePresetId ? presetSavedAt : undefined}
                      cardPreviewData={stableCardPreviewData}
                      colors={colors}
                      onPress={stableOpenPresetPreview}
                      onLongPress={stableOnPresetLongPress}
                      onDelete={stableHandleDeletePreset}
                      chipRefSetter={(el) => presetChipRefsMap.current.set(preset.id, el)}
                      onLayout={(x) => {
                        chipXOffsetsRef.current[chipIndex] = x;
                        setChipSnapOffsets((prev) => {
                          // Slice to current preset count so deleted presets never
                          // leave stale trailing snap points in the offsets array.
                          const next = chipXOffsetsRef.current.slice(0, presets.length);
                          if (next.length === prev.length && next.every((v, i) => v === prev[i])) return prev;
                          return next;
                        });
                      }}
                    />
                  ))}
                  {presets.length < MAX_PRESETS && (
                    <Text style={[styles.presetsSlotHint, { color: colors.mutedForeground }]}>
                      {MAX_PRESETS - presets.length} slot{MAX_PRESETS - presets.length !== 1 ? "s" : ""} left
                    </Text>
                  )}
                </ScrollView>
                {presets.length > 1 && presetHasOverflow && !presetScrollAtEnd && (
                  <LinearGradient
                    colors={["transparent", colors.background]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.presetFadeRight}
                    pointerEvents="none"
                  />
                )}
                </Reanimated.View>
                {showModifiedChipHint && (
                  <Animated.View
                    style={[
                      styles.modifiedChipHint,
                      {
                        backgroundColor: colors.primary + "15",
                        borderColor: colors.primary + "40",
                        opacity: modifiedChipHintAnim,
                        transform: [
                          {
                            translateY: modifiedChipHintAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-6, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name="information-circle-outline" size={13} color={colors.primary + "cc"} />
                    <Text style={[styles.modifiedChipHintText, { color: colors.primary + "cc" }]}>
                      You've changed settings from this preset — it's still saved
                    </Text>
                  </Animated.View>
                )}
                {presets.length > 1 && settings.reorderHintFrequency !== "never" && (
                  <Text style={[styles.reorderHint, { color: colors.mutedForeground }]}>
                    Long-press to rename · Manage to reorder
                  </Text>
                )}
              </>
            )}

            <Reanimated.View style={inlineSaveAnimStyle}>
              <View ref={inlineSaveRef} style={[styles.inlineSaveWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
                    editable={showInlineSave}
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
            </Reanimated.View>

            {activePreset && !reorderMode && (
              <Reanimated.View style={[
                styles.activePresetBanner,
                {
                  backgroundColor: activePresetModified ? colors.primary + "1a" : colors.primary + "12",
                  borderColor: activePresetModified ? colors.primary + "55" : colors.primary + "30",
                  borderStyle: activePresetModified ? "dashed" : "solid",
                },
                activePresetBannerAnimStyle,
              ]}>
                <Ionicons
                  name={activePresetModified ? "pencil-outline" : "bookmark"}
                  size={12}
                  color={activePresetModified ? colors.primary + "aa" : colors.primary}
                />
                <Text style={[styles.activePresetBannerText, { color: activePresetModified ? colors.primary + "aa" : colors.primary }]}>
                  {activePresetModified
                    ? `"${activePreset.name}" modified`
                    : `Viewing "${activePreset.name}" — edit below to update it`}
                </Text>
                {activePresetModified && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      loadPreset(activePreset);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.revertButton,
                      { backgroundColor: colors.primary + "20", borderColor: colors.primary + "45" },
                    ]}
                  >
                    <Ionicons name="arrow-undo-outline" size={11} color={colors.primary} />
                    <Text style={[styles.revertButtonText, { color: colors.primary }]}>Revert</Text>
                  </TouchableOpacity>
                )}
              </Reanimated.View>
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
              ref={cardPreviewRef}
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
                    backgroundPhotoUri={backgroundPhotoUri ?? undefined}
                    backgroundPhotoCrop={backgroundPhotoCrop ?? undefined}
                    backgroundPhotoDimLevel={backgroundPhotoDimLevel}
                    backgroundPhotoBlurRadius={backgroundPhotoBlurRadius}
                  />
                </View>
              </Animated.View>
              {showCardChip && (
                <Animated.View
                  style={[
                    styles.cardChip,
                    {
                      opacity: cardChipFadeAnim,
                      transform: [{ translateY: cardChipSlideAnim }],
                    },
                  ]}
                  pointerEvents="auto"
                >
                  <TouchableOpacity
                    onPress={dismissCardChip}
                    activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Ionicons name="time-outline" size={11} color="#fff" />
                    <Text style={styles.cardChipText}>Last used</Text>
                    <Ionicons name="close" size={10} color="rgba(255,255,255,0.65)" style={{ marginLeft: 1, opacity: chipDismissCount >= 3 ? 0 : 1 }} />
                  </TouchableOpacity>
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
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginBottom: 0 }]}>
                COLOR THEME
              </Text>
              <View style={[styles.thumbSizePicker, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                {(["s", "m", "l"] as ThumbnailSize[]).map((sz) => (
                  <TouchableOpacity
                    key={sz}
                    onPress={() => setThumbnailSize(sz)}
                    style={[
                      styles.thumbSizeBtn,
                      thumbnailSize === sz && {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontFamily: thumbnailSize === sz ? "Inter_600SemiBold" : "Inter_400Regular",
                        color: thumbnailSize === sz ? colors.foreground : colors.mutedForeground,
                      }}
                    >
                      {sz.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Reanimated.View style={sizeLabelAnimatedStyle} pointerEvents="none">
              <View
                onLayout={(e) => {
                  const h = e.nativeEvent.layout.height;
                  if (h > 0) {
                    labelNaturalHeightRef.current = h;
                    if (thumbnailSize !== "m") {
                      sizeLabelHeight.value = h;
                    }
                  }
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Inter_400Regular",
                    color: colors.mutedForeground,
                    textAlign: "right",
                    marginTop: -4,
                    marginBottom: 6,
                  }}
                >
                  Preview size: {thumbnailSize === "s" ? "Small" : "Large"}
                </Text>
              </View>
            </Reanimated.View>
            <Reanimated.View
              style={[styles.themeThumbnailsWrapper, thumbRowAnimatedStyle]}
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
                    cardPreviewData={stableCardPreviewData}
                    estimatedHeight={estimateThumbnailHeight(visibleStats, customMessage.trim().length > 0, thumbnailSize)}
                    colors={colors}
                    onSelect={stableHandleThemeChange}
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
            </Reanimated.View>

            {/* Stat toggles */}
            <View
              onLayout={(e) => { statTogglesYOffsetRef.current = e.nativeEvent.layout.y; }}
            >
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              VISIBLE STATS
            </Text>
            <Animated.View
              style={[
                styles.togglesCard,
                {
                  backgroundColor: statTogglesPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [colors.card, colors.primary + "22"],
                  }),
                  borderColor: statTogglesPulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [colors.border, colors.primary + "88"],
                  }),
                },
              ]}
            >
              {STAT_TOGGLES.map((item, index) => {
                const isOn = visibleStats[item.key];
                const pillBg = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.muted, colors.primary],
                });
                const pillBorder = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.border, colors.primary],
                });
                const knobBg = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.mutedForeground, colors.primaryForeground],
                });
                const iconWrapBg = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.muted, colors.primary + "20"],
                });
                const iconColor = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.mutedForeground, colors.primary],
                });
                const labelColor = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.mutedForeground, colors.foreground],
                });
                const descColor = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.mutedForeground + "70", colors.mutedForeground],
                });
                const rowBg = rowBgAnims[item.key].interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: ["transparent", colors.primary + "08", colors.primary + "20"],
                  extrapolate: "clamp",
                });
                const dividerColor = pillColorAnims[item.key].interpolate({
                  inputRange: [0, 1],
                  outputRange: [colors.border, colors.border + "30"],
                });
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => toggleStat(item.key)}
                    activeOpacity={0.7}
                  >
                  <Animated.View
                    style={[
                      styles.toggleRow,
                      index < STAT_TOGGLES.length - 1 && {
                        borderBottomWidth: 1,
                        borderBottomColor: dividerColor,
                      },
                      { backgroundColor: rowBg },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.toggleIconWrap,
                        { backgroundColor: iconWrapBg },
                      ]}
                    >
                      <AnimatedIonicons
                        name={item.icon}
                        size={17}
                        color={iconColor as unknown as string}
                      />
                    </Animated.View>
                    <View style={styles.toggleTextWrap}>
                      <Animated.Text style={[styles.toggleLabel, { color: labelColor }]}>
                        {item.label}
                      </Animated.Text>
                      <Animated.Text style={[styles.toggleDesc, { color: descColor }]}>
                        {item.description}
                      </Animated.Text>
                    </View>
                    <Animated.View
                      style={[
                        styles.pill,
                        {
                          backgroundColor: pillBg,
                          borderColor: pillBorder,
                        },
                      ]}
                    >
                      <Animated.View
                        style={[
                          styles.pillKnob,
                          {
                            backgroundColor: knobBg,
                            transform: [{ translateX: knobAnims[item.key] }],
                          },
                        ]}
                      />
                    </Animated.View>
                  </Animated.View>
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
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
                onFocus={() => {
                  resetAutoTriggerOnInteraction();
                  if (showInlineSave) setShowInlineSave(false);
                }}
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

            {/* Background photo */}
            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              BACKGROUND PHOTO (OPTIONAL)
            </Text>
            {backgroundPhotoUri ? (
              <>
                <View
                  style={[
                    styles.bgPhotoRow,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Image
                    source={{ uri: backgroundPhotoUri }}
                    style={styles.bgPhotoThumb}
                    resizeMode="cover"
                  />
                  <View style={styles.bgPhotoInfo}>
                    <Text style={[styles.bgPhotoLabel, { color: colors.foreground }]}>
                      Background photo set
                    </Text>
                    <Text style={[styles.bgPhotoSub, { color: colors.mutedForeground }]}>
                      Blurred & dimmed behind card content
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleAdjustCrop}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.bgPhotoAdjustBtn, { backgroundColor: colors.muted }]}
                  >
                    <Ionicons name="crop-outline" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleRemoveBackgroundPhoto}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.bgPhotoRemoveBtn, { backgroundColor: colors.muted }]}
                  >
                    <Ionicons name="close" size={15} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <DimLevelSlider
                  value={backgroundPhotoDimLevel}
                  onChange={handleDimLevelChange}
                  colors={colors}
                />
                <BlurLevelSlider
                  value={backgroundPhotoBlurRadius}
                  onChange={handleBlurRadiusChange}
                  colors={colors}
                />
              </>
            ) : (
              <TouchableOpacity
                onPress={handlePickBackgroundPhoto}
                activeOpacity={0.75}
                style={[
                  styles.bgPhotoPickerBtn,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.bgPhotoPickerIcon, { backgroundColor: colors.muted }]}>
                  <Ionicons name="image-outline" size={20} color={colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bgPhotoPickerLabel, { color: colors.foreground }]}>
                    Choose background photo
                  </Text>
                  <Text style={[styles.bgPhotoPickerSub, { color: colors.mutedForeground }]}>
                    Pick a gym photo or any image from your library
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            </View>
          </ScrollView>

          {/* Auto-trigger countdown banner (countdown + generating states) */}
          {autoTriggerBannerVisible && autoTriggerAction && (
            <Animated.View
              onLayout={(e) => setAutoTriggerBannerWidth(e.nativeEvent.layout.width)}
              style={[
                styles.autoTriggerBanner,
                { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" },
                {
                  opacity: autoTriggerBannerAnim,
                  transform: reduceMotion
                    ? []
                    : [
                        {
                          translateY: autoTriggerBannerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [20, 0],
                          }),
                        },
                      ],
                },
              ]}
            >
              {autoTriggerGenerating ? (
                autoTriggerSuccessFlash ? (
                  <>
                    <Ionicons name="checkmark-circle" size={15} color="#2D8C4E" />
                    <Text style={[styles.autoTriggerText, { color: "#2D8C4E" }]}>
                      Done!
                    </Text>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 2 }} />
                    <Text style={[styles.autoTriggerText, { color: colors.primary }]}>
                      {`Generating with ${autoTriggerAction === "share" ? "Share" : autoTriggerAction === "save" ? "Save" : autoTriggerAction === "copy" ? "Copy" : "Both"}…`}
                    </Text>
                    <TouchableOpacity
                      onPress={cancelGeneration}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel generation"
                    >
                      <Ionicons name="close-circle" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </>
                )
              ) : (
                <>
                  <Ionicons name={autoTriggerIsPaused ? "pause-circle-outline" : "flash"} size={14} color={colors.primary} />
                  <Text style={[styles.autoTriggerText, { color: colors.primary }]}>
                    {autoTriggerIsPaused
                      ? `Paused · ${autoTriggerAction === "share" ? "Share" : autoTriggerAction === "save" ? "Save" : autoTriggerAction === "copy" ? "Copy" : "Both"} in ${autoTriggerCountdown}s`
                      : timerResetFlashVisible
                      ? "↺ Timer reset"
                      : `Generating with ${autoTriggerAction === "share" ? "Share" : autoTriggerAction === "save" ? "Save" : autoTriggerAction === "copy" ? "Copy" : "Both"} in ${autoTriggerCountdown}s…`}
                  </Text>
                  <TouchableOpacity
                    onPress={autoTriggerIsPaused ? resumeAutoTrigger : pauseAutoTrigger}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={autoTriggerIsPaused ? "Resume countdown" : "Pause countdown"}
                  >
                    <Ionicons name={autoTriggerIsPaused ? "play" : "pause"} size={14} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      cancelAutoTrigger();
                      onClose();
                      router.navigate({ pathname: "/(tabs)/profile", params: { scrollTo: "countdown" } });
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.autoTriggerChangeLink, { color: colors.primary }]}>
                      {hasCustomisedCountdown ? `${autoTriggerDelay}s · Change` : "Change"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={cancelAutoTrigger} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  {/* Smooth drain bar (left-anchored) — hidden for reduce-motion users */}
                  {!reduceMotion && (
                    <Animated.View
                      style={[
                        styles.autoTriggerBar,
                        {
                          backgroundColor: colors.primary + "60",
                          transform: [
                            {
                              translateX: autoTriggerProgress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-autoTriggerBannerWidth / 2, 0],
                              }),
                            },
                            { scaleX: autoTriggerProgress },
                          ],
                        },
                      ]}
                    />
                  )}
                </>
              )}
            </Animated.View>
          )}

          {/* Action buttons */}
          {generating ? (
            <View style={[styles.generateBtn, { backgroundColor: colors.muted }]}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text style={[styles.generateBtnText, { color: colors.mutedForeground }]}>
                Working…
              </Text>
            </View>
          ) : (
            <>
              {cameraRollStatus === "denied" && (
                <TouchableOpacity
                  onPress={() => Linking.openSettings()}
                  activeOpacity={0.8}
                  style={[styles.permissionBanner, { backgroundColor: "#f59e0b18", borderColor: "#f59e0b40" }]}
                >
                  <Ionicons name="lock-closed" size={14} color="#f59e0b" />
                  <Text style={[styles.permissionBannerText, { color: "#f59e0b" }]}>
                    Photo access is off — Save & Both are unavailable.{" "}
                    <Text style={[styles.permissionBannerLink, { color: "#f59e0b" }]}>Enable in Settings →</Text>
                  </Text>
                </TouchableOpacity>
              )}
              {/* Quick-generate button: visible when a selection is pre-loaded and no countdown is running */}
              {actionButtonsReady && selectedAction && autoTriggerCountdown === null && (() => {
                const requiresPhotoAccess = selectedAction === "save" || selectedAction === "both";
                const isPhotoBlocked = requiresPhotoAccess && cameraRollStatus === "denied";
                if (isPhotoBlocked) return null;
                const actionLabel = selectedAction === "share" ? "Share" : selectedAction === "save" ? "Save" : selectedAction === "copy" ? "Copy" : "Both";
                return (
                  <TouchableOpacity
                    onPress={() => handleGenerate(selectedAction)}
                    activeOpacity={0.82}
                    style={[styles.quickGenerateBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Ionicons name="flash" size={15} color={colors.primaryForeground} />
                    <Text style={[styles.quickGenerateBtnText, { color: colors.primaryForeground }]}>
                      Generate · {actionLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })()}
              <View style={styles.actionRow}>
                {(
                  [
                    { action: "share" as CardAction, icon: "share-social", label: "Share", subtitle: "Opens your share sheet", bg: colors.primary },
                    { action: "save" as CardAction, icon: "image-outline", label: "Save", subtitle: "Saves to camera roll", bg: colors.secondary },
                    { action: "copy" as CardAction, icon: "copy-outline", label: "Copy", subtitle: "Copies to clipboard", bg: colors.accent },
                    { action: "both" as CardAction, icon: "layers-outline", label: "Both", subtitle: "Saves & opens share sheet", bg: colors.mutedForeground },
                  ] as const
                ).map(({ action, icon, label, subtitle, bg }) => {
                  const requiresPhotoAccess = action === "save" || action === "both";
                  const isPhotoBlocked = requiresPhotoAccess && cameraRollStatus === "denied";
                  const isSelected = anyStatEnabled && selectedAction === action && !isPhotoBlocked;
                  const isAutoTarget = autoTriggerAction === action && autoTriggerCountdown !== null;
                  const isEnabled = anyStatEnabled && !isPhotoBlocked;
                  const isDefault = defaultAction === action && !isPhotoBlocked;
                  return (
                    <Animated.View
                      key={action}
                      style={[
                        { flex: 1 },
                        isDefault && { transform: [{ scale: defaultActionPulseAnim }] },
                      ]}
                    >
                    <TouchableOpacity
                      onPress={() => {
                        hasUserTappedRef.current = true;
                        if (secondPulseTimerRef.current !== null) {
                          clearTimeout(secondPulseTimerRef.current);
                          secondPulseTimerRef.current = null;
                        }
                        if (thirdPulseTimerRef.current !== null) {
                          clearTimeout(thirdPulseTimerRef.current);
                          thirdPulseTimerRef.current = null;
                        }
                        if (!anyStatEnabled) {
                          triggerLockShake(action);
                          showConfirmation("Enable a stat above to unlock", "error", "information-circle-outline", undefined, undefined, undefined, undefined, undefined, undefined, scrollToStatToggles);
                          return;
                        }
                        if (isPhotoBlocked) {
                          triggerLockShake(action);
                          // Let the shake finish (280 ms) before opening Settings,
                          // but skip the delay when Reduce Motion is on (no shake ran).
                          if (reduceMotionRef.current) {
                            Linking.openSettings();
                          } else {
                            setTimeout(() => Linking.openSettings(), 280);
                          }
                          return;
                        }
                        if (actionLongPressedRef.current) {
                          actionLongPressedRef.current = false;
                          return;
                        }
                        if (selectedAction === action) {
                          dismissTapAgainHint();
                          handleGenerate(action);
                        } else {
                          setSelectedAction(action);
                          showTapAgainHint();
                        }
                      }}
                      onLongPress={() => {
                        if (!anyStatEnabled) {
                          scrollToStatToggles();
                          return;
                        }
                        if (isPhotoBlocked) {
                          showConfirmation(
                            `Enable photo access to use ${label} as a default`,
                            "error",
                            "lock-closed-outline",
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            () => Linking.openSettings()
                          );
                          return;
                        }
                        handleSetDefault(action);
                      }}
                      delayLongPress={500}
                      activeOpacity={0.85}
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: isEnabled ? bg : colors.muted,
                          flex: 1,
                          borderWidth: (isSelected || isAutoTarget) ? 2.5 : 0,
                          borderColor: (isSelected || isAutoTarget) ? colors.primaryForeground : "transparent",
                        },
                      ]}
                    >
                      <View style={styles.actionBtnInner}>
                        <View style={styles.actionBtnTop}>
                          <Animated.View
                            style={(!anyStatEnabled || isPhotoBlocked) ? { transform: [{ translateX: lockShakeAnims[action] }] } : undefined}
                          >
                            <Ionicons
                              name={(!anyStatEnabled || isPhotoBlocked) ? "lock-closed-outline" : icon}
                              size={17}
                              color={isEnabled ? colors.primaryForeground : colors.mutedForeground}
                            />
                          </Animated.View>
                          <Text
                            style={[
                              styles.actionBtnText,
                              { color: isEnabled ? colors.primaryForeground : colors.mutedForeground },
                            ]}
                          >
                            {label}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.actionBtnSubtitle,
                            {
                              color: isEnabled
                                ? colors.primaryForeground + "BB"
                                : colors.mutedForeground + "99",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {isPhotoBlocked ? "Enable in Settings" : subtitle}
                        </Text>
                        {isSelected && !isDefault && !isPhotoBlocked && (
                          <Text style={styles.preferredLabel}>✓ Selected</Text>
                        )}
                        {isDefault && !isPhotoBlocked && (
                          <Text style={[styles.preferredLabel, { opacity: isSelected ? 1 : 0.45 }]}>★ Default</Text>
                        )}
                        {!isDefault && !isSelected && isEnabled && anyStatEnabled && (
                          <TouchableOpacity
                            onPress={() => handleSetDefault(action)}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Set ${label} as preferred action`}
                          >
                            <Text style={[styles.preferredLabel, { opacity: 0.35 }]}>★ Set default</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </>
          )}
          {tapGenerateHintMounted && (
            <Animated.View style={{ opacity: tapGenerateHintFadeAnim }}>
              <TouchableOpacity
                onPress={dismissTapGenerateHint}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Dismiss hint"
              >
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {"Tap Generate ↑ to create your card"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {tapAgainHintMounted && (
            <Animated.View style={{ opacity: tapAgainHintFadeAnim }}>
              <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                {"Tap again to generate"}
              </Text>
            </Animated.View>
          )}
          {statsNudgeMounted && (
            <Animated.View style={{ opacity: statsNudgeFadeAnim }}>
              <TouchableOpacity
                onPress={() => { scrollToStatToggles(); dismissStatsNudge(); }}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Show me the stats section"
              >
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {"Stats on your card can be customised · Tap to see"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {lockedHintMounted && (
            <Animated.View style={{ opacity: lockedHintFadeAnim }}>
              <TouchableOpacity
                onPress={scrollToStatToggles}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Go to stat toggles"
              >
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {"Enable at least one stat to generate your card · Tap to highlight"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {disabledBtnLpHintMounted && (
            <Animated.View style={{ opacity: disabledBtnLpHintFadeAnim }}>
              <TouchableOpacity
                onPress={() => { scrollToStatToggles(); dismissDisabledBtnLpHint(); }}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Jump to stat toggles"
              >
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {"Long-press any button to jump to the stat toggles · Tap to go there now"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {actionButtonsReady && showLongPressHint && (
            <Animated.View style={{ opacity: longPressHintFadeAnim, transform: [{ translateY: longPressHintSlideAnim }] }}>
              <TouchableOpacity
                onPress={dismissLongPressHint}
                activeOpacity={0.6}
                accessibilityRole="button"
                accessibilityLabel="Dismiss hint"
              >
                <Text style={[styles.hintText, { color: colors.mutedForeground }]}>
                  {longPressAndRun
                    ? "Long-press a button to set it as default and generate instantly"
                    : "Long-press a button to set it as your default"}{" · Tap to dismiss"}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {actionButtonsReady && (
            <View style={[styles.longPressSettingRow, { borderTopColor: colors.border }]}>
              <View style={styles.longPressSettingText}>
                <Text style={[styles.longPressSettingLabel, { color: colors.foreground }]}>
                  Long-press also generates
                </Text>
                <Text style={[styles.longPressSettingDesc, { color: colors.mutedForeground }]}>
                  {longPressAndRun
                    ? "Sets as default and runs in one gesture"
                    : "Sets as default only — tap to generate"}
                </Text>
              </View>
              <Switch
                value={longPressAndRun}
                onValueChange={(val) => {
                  setLongPressAndRun(val);
                  if (onLongPressAndRunChange) {
                    onLongPressAndRunChange(val);
                  } else {
                    AsyncStorage.setItem(STORAGE_KEY_LONGPRESS_AND_RUN, val ? "1" : "0").catch(() => {});
                  }
                }}
                trackColor={{ false: colors.muted, true: colors.primary + "99" }}
                thumbColor={longPressAndRun ? colors.primary : colors.mutedForeground}
              />
            </View>
          )}
          {actionButtonsReady && defaultAction && (
            <View style={[styles.longPressSettingRow, { borderTopColor: colors.border }]}>
              <View style={styles.longPressSettingText}>
                <Text style={[styles.longPressSettingLabel, { color: colors.foreground }]}>
                  Auto-trigger delay
                </Text>
                <Text style={[styles.longPressSettingDesc, { color: colors.mutedForeground }]}>
                  {autoTriggerDelay === 0
                    ? "Off — no countdown"
                    : `${autoTriggerDelay} second${autoTriggerDelay === 1 ? "" : "s"} countdown`}
                </Text>
              </View>
              <View style={styles.autoTriggerDelaySegmented}>
                {([0, 1, 3, 5] as const).map((val) => {
                  const active = autoTriggerDelay === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      onPress={() => {
                        if (val === autoTriggerDelay) return;
                        setAutoTriggerDelay(val);
                        const delayStr = val === 0 ? "off" : String(val);
                        if (onAutoTriggerDelayChange) {
                          onAutoTriggerDelayChange(delayStr);
                        } else {
                          AsyncStorage.setItem(
                            STORAGE_KEY_AUTO_TRIGGER_DELAY,
                            delayStr
                          ).catch(() => {});
                        }
                        // Mark the countdown as customised so the banner shows
                        // "Xs · Change" the next time it appears.
                        AsyncStorage.setItem(STORAGE_KEY_AUTO_TRIGGER_DELAY_CUSTOMISED, "1").catch(() => {});
                        // The useEffect watching autoTriggerDelay handles any
                        // in-flight countdown restart/cancel automatically.
                      }}
                      style={[
                        styles.autoTriggerDelayChip,
                        active && { backgroundColor: colors.primary },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={val === 0 ? "Off" : `${val} seconds`}
                    >
                      <Text
                        style={[
                          styles.autoTriggerDelayChipText,
                          { color: active ? "#fff" : colors.mutedForeground },
                        ]}
                      >
                        {val === 0 ? "Off" : `${val}s`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
          <View style={[styles.longPressSettingRow, { borderTopColor: colors.border }]}>
            {(() => {
              const photoBlocked = cameraRollStatus === "denied";
              const actions: { key: CardAction; label: string }[] = [
                { key: "share", label: "Share" },
                ...(!photoBlocked ? [{ key: "save" as CardAction, label: "Save" }] : []),
                { key: "copy", label: "Copy" },
                ...(!photoBlocked ? [{ key: "both" as CardAction, label: "Both" }] : []),
              ];
              return (
                <>
                  <View style={styles.longPressSettingText}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.longPressSettingLabel, { color: colors.foreground }]}>
                        Preferred action
                      </Text>
                      {defaultAction && (
                        <View
                          style={{
                            backgroundColor: colors.primary + "28",
                            borderRadius: 4,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                          }}
                        >
                          <Text style={{ color: colors.primary, fontSize: 11, fontFamily: "Inter_500Medium" }}>
                            {defaultAction === "share" ? "Share" : defaultAction === "save" ? "Save" : defaultAction === "copy" ? "Copy" : "Both"} ✓
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.longPressSettingDesc,
                        { color: defaultAction ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {defaultAction === "share"
                        ? "Share"
                        : defaultAction === "save"
                        ? "Save"
                        : defaultAction === "copy"
                        ? "Copy"
                        : defaultAction === "both"
                        ? "Both"
                        : "None"}
                    </Text>
                  </View>
                  <View style={styles.autoTriggerDelaySegmented}>
                    {actions.map(({ key, label }) => {
                      const active = defaultAction === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => {
                            if (active) {
                              Haptics.selectionAsync().catch(() => {});
                              setDefaultAction(null);
                              AsyncStorage.removeItem(STORAGE_KEY_ACTION).catch(() => {});
                              updateSettings({ defaultCardAction: undefined });
                              onDefaultActionChange?.(null);
                              AsyncStorage.removeItem(STORAGE_KEY_LONGPRESS_HINT_SEEN).catch(() => {});
                              setShowLongPressHint(true);
                              showConfirmation("Preference cleared", "success", "star-half-outline");
                            } else {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                              setDefaultAction(key);
                              setSelectedAction(key);
                              AsyncStorage.setItem(STORAGE_KEY_ACTION, key).catch(() => {});
                              updateSettings({ defaultCardAction: key });
                              onDefaultActionChange?.(key);
                              showConfirmation(`★ ${label} set as preferred`, "success", "star-outline");
                            }
                          }}
                          style={[
                            styles.autoTriggerDelayChip,
                            active && { backgroundColor: colors.primary, borderColor: colors.primary },
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          accessibilityLabel={
                            active
                              ? `${label}, currently selected. Tap to clear.`
                              : `Set ${label} as preferred action`
                          }
                        >
                          <Text
                            style={[
                              styles.autoTriggerDelayChipText,
                              { color: active ? "#fff" : colors.mutedForeground },
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              );
            })()}
          </View>
          {confirmMessage && (
            <Animated.View
              style={[styles.confirmToastWrap, { opacity: confirmOpacity, transform: [{ translateY: Animated.add(confirmTranslateY, confirmSwipeY) }] }]}
              {...confirmToastPanResponder.panHandlers}
            >
              <TouchableOpacity
                onPress={() => dismissToastSwipeHint()}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
              >
                <Animated.View
                  style={[styles.toastSwipeHint, { opacity: swipeHintOpacity, transform: [{ translateY: swipeHintSlideAnim }] }]}
                >
                  <Ionicons name="chevron-up" size={10} color="#fff" />
                  <Text style={styles.toastSwipeHintText}>swipe to dismiss</Text>
                </Animated.View>
              </TouchableOpacity>
              <View
                pointerEvents="box-none"
                style={[
                  styles.confirmToast,
                  confirmVariant === "error"
                    ? { backgroundColor: "#ff443618", borderColor: "#ff443640" }
                    : { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" },
                  confirmHasCountdown && {
                    flexDirection: "column",
                    gap: 0,
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                    overflow: "hidden",
                  },
                ]}
              >
                <TouchableOpacity
                  disabled={!confirmOnPressFn}
                  onPress={confirmOnPressFn ? () => { dismissConfirmToast(); confirmOnPressFn(); } : undefined}
                  activeOpacity={confirmOnPressFn ? 0.7 : 1}
                  style={
                    confirmHasCountdown
                      ? { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 7, gap: 6 }
                      : { flexDirection: "row", alignItems: "center", gap: 6 }
                  }
                >
                  {confirmSecondaryIcon ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                      <Ionicons
                        name={confirmVariant === "error" ? (confirmIcon ?? "alert-circle") : (confirmIcon ?? "checkmark-circle")}
                        size={14}
                        color={confirmVariant === "error" ? "#ff4436" : colors.primary}
                      />
                      <Ionicons
                        name={confirmSecondaryIcon}
                        size={10}
                        color={confirmVariant === "error" ? "#ff4436" : colors.primary}
                      />
                    </View>
                  ) : (
                    <Ionicons
                      name={confirmVariant === "error" ? (confirmIcon ?? "alert-circle") : (confirmIcon ?? "checkmark-circle")}
                      size={14}
                      color={confirmVariant === "error" ? "#ff4436" : colors.primary}
                    />
                  )}
                  <Text
                    style={[
                      styles.confirmToastText,
                      { color: confirmVariant === "error" ? "#ff4436" : colors.primary },
                    ]}
                  >
                    {confirmMessage}
                  </Text>
                  {confirmKeepOpen && (
                    reduceMotion
                      ? <Text style={{ fontSize: 12, color: colors.primary, marginLeft: 2, letterSpacing: 1 }}>···</Text>
                      : <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 4 }} />
                  )}
                  {confirmActionFn && confirmActionLabel && (
                    <TouchableOpacity
                      onPress={() => {
                        const fn = confirmActionFn;
                        dismissConfirmToast();
                        fn();
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[
                        styles.confirmRetryBtn,
                        confirmVariant !== "error" && { borderLeftColor: colors.primary + "40" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.confirmRetryText,
                          confirmVariant !== "error" && { color: colors.primary },
                        ]}
                      >
                        {confirmActionLabel}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {confirmVariant === "error" && confirmRetryFn && (
                    <TouchableOpacity
                      onPress={() => {
                        const fn = confirmRetryFn;
                        dismissConfirmToast();
                        fn();
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={styles.confirmRetryBtn}
                    >
                      <Text style={styles.confirmRetryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
                {confirmHasCountdown && (
                  <Animated.View
                    style={{
                      height: 3,
                      width: confirmProgressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 400],
                      }),
                      backgroundColor: colors.primary,
                      opacity: 0.7,
                    }}
                  />
                )}
              </View>
            </Animated.View>
          )}
          {undoDeleteState && (
            <Animated.View style={[styles.confirmToastWrap, { opacity: undoOpacity, transform: [{ translateY: Animated.add(undoTranslateY, undoSwipeY) }] }]} {...undoToastPanResponder.panHandlers}>
              <TouchableOpacity
                onPress={() => dismissUndoToastSwipeHint()}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
              >
                <Animated.View
                  style={[styles.toastSwipeHint, { opacity: undoSwipeHintOpacity, transform: [{ translateY: undoSwipeHintSlideAnim }] }]}
                >
                  <Ionicons name="chevron-up" size={10} color="#fff" />
                  <Text style={styles.toastSwipeHintText}>swipe to dismiss</Text>
                </Animated.View>
              </TouchableOpacity>
              <View
                style={[
                  styles.confirmToast,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    gap: 0,
                    paddingHorizontal: 0,
                    paddingVertical: 0,
                    flexDirection: "column",
                    overflow: "hidden",
                  },
                ]}
              >
                <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                  <Text
                    style={[
                      styles.confirmToastText,
                      { color: colors.mutedForeground, marginLeft: 6, marginRight: 10 },
                    ]}
                  >
                    "{undoDeleteState.preset.name}" deleted
                  </Text>
                  <TouchableOpacity
                    onPress={handleUndoDelete}
                    onPressIn={pauseUndoToast}
                    onPressOut={resumeUndoToast}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
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
                <Animated.View
                  style={{
                    height: 3,
                    width: undoProgressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 400],
                    }),
                    backgroundColor: colors.primary,
                    opacity: 0.7,
                  }}
                />
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
        onRequestClose={() => closeZoom()}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.zoomOverlay,
            {
              opacity: zoomAnim,
              transform: [{ translateY: zoomSwipeDragY }],
            },
          ]}
          {...zoomSwipePanResponder.panHandlers}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => closeZoom()}
          />

          <Animated.View
            style={{
              transform: [
                { translateX: zoomTranslateX },
                { translateY: zoomTranslateY },
                { scale: zoomOriginScale },
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
              reduceMotionShared={reduceMotionShared}
              onFirstGesture={dismissPinchHintEarly}
              onSwipeDown={handleZoomSwipeDown}
              onSwipeDownProgress={handleZoomSwipeDownProgress}
              onDismiss={handleZoomDismiss}
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
                  backgroundPhotoUri={backgroundPhotoUri ?? undefined}
                  backgroundPhotoCrop={backgroundPhotoCrop ?? undefined}
                  backgroundPhotoDimLevel={backgroundPhotoDimLevel}
                  backgroundPhotoBlurRadius={backgroundPhotoBlurRadius}
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
                    backgroundPhotoUri={backgroundPhotoUri ?? undefined}
                    backgroundPhotoCrop={backgroundPhotoCrop ?? undefined}
                    backgroundPhotoDimLevel={backgroundPhotoDimLevel}
                    backgroundPhotoBlurRadius={backgroundPhotoBlurRadius}
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
              onPress={() => closeZoom()}
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
              pointerEvents="box-none"
              style={[
                StyleSheet.absoluteFillObject,
                styles.pinchHintOverlay,
                { opacity: pinchHintAnim },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={dismissPinchHintEarly}
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
                  <Animated.Text
                    style={[
                      styles.pinchHintDismiss,
                      {
                        opacity: pinchDismissOpacity,
                        transform: [{ scale: pinchDismissScale }],
                      },
                    ]}
                  >
                    Tap to dismiss
                  </Animated.Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}

          {showZoomSwipeDownHint && (
            <Animated.View
              pointerEvents="box-none"
              style={[
                StyleSheet.absoluteFillObject,
                styles.zoomSwipeDownHintOverlay,
                { opacity: zoomSwipeDownHintAnim },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={dismissZoomSwipeDownHintEarly}
                style={styles.zoomSwipeDownHintCard}
              >
                <Animated.View
                  style={{
                    transform: [
                      {
                        translateY: zoomSwipeDownArrowAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 6],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons name="chevron-down" size={28} color="rgba(255,255,255,0.9)" />
                </Animated.View>
                <Text style={styles.zoomSwipeDownHintTitle}>Swipe down to close</Text>
                <Text style={styles.zoomSwipeDownHintSub}>Tap to dismiss</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </Animated.View>
      </Modal>

      {/* Preset thumbnail preview modal */}
      <Modal
        visible={presetPreviewVisible}
        animationType="none"
        transparent
        onRequestClose={() => closePresetPreview()}
        statusBarTranslucent
      >
        <Animated.View
          style={[
            styles.zoomOverlay,
            {
              opacity: presetPreviewAnim,
              transform: [{ translateY: presetPreviewSwipeDragY }],
            },
          ]}
          {...presetPreviewSwipePanResponder.panHandlers}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => closePresetPreview()}
          />

          {presetPreviewTarget && (
            <>
              <Animated.View
                style={{
                  transform: [
                    { translateX: presetPreviewTranslateX },
                    { translateY: presetPreviewTranslateY },
                    { scale: presetPreviewOriginScale },
                  ],
                }}
              >
              <Animated.View
                style={{
                  opacity: presetCardOpacity,
                  transform: [{ translateX: presetCardTranslateX }],
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
                  reduceMotionShared={reduceMotionShared}
                  onPresetDragX={handlePresetDragX}
                  onPresetNavigateDir={handlePresetNavigateDir}
                  onPresetSnapBack={handlePresetSnapBack}
                  onSwipeDown={handlePresetPreviewSwipeDown}
                  onSwipeDownProgress={handlePresetPreviewSwipeDownProgress}
                  onDismiss={handlePresetPreviewDismiss}
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
                  onPress={() => closePresetPreview()}
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
                {presetPreviewPresetsRef.current.length > 1 && (
                  <View style={styles.presetPreviewNavRow} pointerEvents="box-none">
                    <TouchableOpacity
                      style={[
                        styles.presetPreviewNavBtn,
                        presetPreviewIndex === 0 && styles.presetPreviewNavBtnDisabled,
                      ]}
                      onPress={() => { dismissSwipeHintEarly(); navigatePresetPreview(-1); }}
                      disabled={presetPreviewIndex === 0}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="chevron-back"
                        size={20}
                        color={presetPreviewIndex === 0 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)"}
                      />
                    </TouchableOpacity>
                    <View style={styles.presetPreviewNameBadge} pointerEvents="none">
                      <Text style={styles.presetPreviewNameText} numberOfLines={1}>
                        {presetPreviewTarget.name}
                      </Text>
                      <Text style={styles.presetPreviewNavCounter}>
                        {presetPreviewIndex + 1} / {presetPreviewPresetsRef.current.length}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.presetPreviewNavBtn,
                        presetPreviewIndex === presetPreviewPresetsRef.current.length - 1 && styles.presetPreviewNavBtnDisabled,
                      ]}
                      onPress={() => { dismissSwipeHintEarly(); navigatePresetPreview(1); }}
                      disabled={presetPreviewIndex === presetPreviewPresetsRef.current.length - 1}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={presetPreviewIndex === presetPreviewPresetsRef.current.length - 1 ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.85)"}
                      />
                    </TouchableOpacity>
                  </View>
                )}
                {presetPreviewPresetsRef.current.length === 1 && (
                  <View style={styles.presetPreviewNameBadge} pointerEvents="none">
                    <Text style={styles.presetPreviewNameText} numberOfLines={1}>
                      {presetPreviewTarget.name}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.presetPreviewLoadBtn}
                  activeOpacity={0.85}
                  onPress={() => confirmLoadPreset(presetPreviewTarget)}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.presetPreviewLoadBtnText}>Load preset</Text>
                </TouchableOpacity>
              </Animated.View>

              {showSwipeHint && (
                <Animated.View
                  pointerEvents="box-none"
                  style={[
                    StyleSheet.absoluteFillObject,
                    styles.swipeHintOverlay,
                    { opacity: swipeHintAnim },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={dismissSwipeHintEarly}
                  >
                    <View style={styles.swipeHintCard}>
                      <View style={styles.swipeHintIconRow}>
                        <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
                        <View style={styles.swipeHintFinger} />
                        <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.9)" />
                      </View>
                      <Text style={styles.swipeHintTitle}>Swipe to browse presets</Text>
                      <Animated.Text
                        style={[
                          styles.swipeHintSub,
                          {
                            opacity: swipeDismissOpacity,
                            transform: [{ scale: swipeDismissScale }],
                          },
                        ]}
                      >
                        Tap to dismiss
                      </Animated.Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </>
          )}
        </Animated.View>
      </Modal>

      {/* Inline rename prompt */}
      <Modal
        visible={!!renameTargetPreset}
        animationType="fade"
        transparent
        onRequestClose={() => { setRenameTargetPreset(null); setRenameInput(""); }}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" }}
          activeOpacity={1}
          onPress={() => { setRenameTargetPreset(null); setRenameInput(""); }}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => {}}
            style={{
              width: 300,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 20,
              gap: 14,
            }}
          >
            <Text style={{ fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
              Rename preset
            </Text>
            <TextInput
              ref={renameInputRef}
              value={renameInput}
              onChangeText={setRenameInput}
              placeholder="Preset name"
              placeholderTextColor={colors.mutedForeground}
              maxLength={32}
              returnKeyType="done"
              onSubmitEditing={handleRenameConfirm}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                fontSize: 14,
                fontFamily: "Inter_400Regular",
                color: colors.foreground,
                backgroundColor: colors.background,
              }}
            />
            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "right", marginTop: -8 }}>
              {renameInput.trim().length}/32
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setRenameTargetPreset(null); setRenameInput(""); }}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 14, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRenameConfirm}
                disabled={!renameInput.trim() || renamingPreset}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 10,
                  alignItems: "center",
                  backgroundColor: renameInput.trim() ? colors.primary : colors.muted,
                }}
              >
                {renamingPreset ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: renameInput.trim() ? colors.primaryForeground : colors.mutedForeground }}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <CropPhotoModal
        visible={showCropModal}
        photoUri={pendingCropUri}
        initialCrop={backgroundPhotoCrop ?? undefined}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
        cardOverlay={{
          ...stableCardPreviewData,
          visibleStats,
          customMessage,
          themeId: selectedThemeId,
        }}
      />
    </Modal>
  );
});

export default CardCustomizationModal;

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
    gap: PRESET_CHIP_GAP,
    paddingBottom: 4,
    alignItems: "flex-start",
  },
  presetChip: {
    alignItems: "center",
    gap: 5,
    width: PRESET_CHIP_WIDTH,
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
  presetRowPhoto: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  presetThumbnailPhoto: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
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
  modifiedChipHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    marginBottom: 4,
  },
  modifiedChipHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 15,
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
  revertButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  revertButtonText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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
  // Thumbnail size picker (S / M / L)
  thumbSizePicker: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
    gap: 2,
  },
  thumbSizeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: "transparent",
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
  // Preset thumbnail picker
  presetsThumbnailsWrapper: {
    position: "relative",
    overflow: "hidden",
    marginBottom: 12,
  },
  presetFadeRight: {
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
  autoTriggerBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  autoTriggerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  autoTriggerChangeLink: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "underline",
    opacity: 0.75,
  },
  autoTriggerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 2,
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
  quickGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 0,
  },
  quickGenerateBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  permissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
  },
  permissionBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  permissionBannerLink: {
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
  longPressSettingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  longPressSettingText: {
    flex: 1,
    gap: 2,
  },
  longPressSettingLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  longPressSettingDesc: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  autoTriggerDelaySegmented: {
    flexDirection: "row",
    gap: 4,
  },
  autoTriggerDelayChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(128,128,128,0.35)",
    minWidth: 34,
    alignItems: "center",
  },
  autoTriggerDelayChipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  pinchHintDismiss: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.38)",
    marginTop: 6,
  },
  swipeHintOverlay: {
    alignItems: "center",
    justifyContent: "center",
  },
  swipeHintCard: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  swipeHintIconRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    height: 36,
    gap: 12,
  },
  swipeHintFinger: {
    width: 18,
    height: 30,
    borderRadius: 9,
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  swipeHintTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#fff",
    marginBottom: 4,
  },
  swipeHintSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.6)",
  },
  zoomSwipeDownHintOverlay: {
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 60,
  },
  zoomSwipeDownHintCard: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  zoomSwipeDownHintTitle: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#fff",
    marginTop: 10,
    marginBottom: 4,
  },
  zoomSwipeDownHintSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.45)",
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
  presetPreviewNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  presetPreviewNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  presetPreviewNavBtnDisabled: {
    opacity: 0.4,
  },
  presetPreviewNavCounter: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 2,
  },
  // Confirmation toast
  toastSwipeHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 4,
    zIndex: 2,
  },
  toastSwipeHintText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#fff",
    opacity: 0.7,
    letterSpacing: 0.2,
  },
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
  confirmRetryBtn: {
    marginLeft: 6,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: "#ff443640",
  },
  confirmRetryText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#ff4436",
  },
  // Background photo section
  bgPhotoPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 4,
  },
  bgPhotoPickerIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  bgPhotoPickerLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginBottom: 2,
  },
  bgPhotoPickerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  bgPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
    marginBottom: 4,
  },
  bgPhotoThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  bgPhotoInfo: {
    flex: 1,
    gap: 2,
  },
  bgPhotoLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  bgPhotoSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  bgPhotoAdjustBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  bgPhotoRemoveBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
