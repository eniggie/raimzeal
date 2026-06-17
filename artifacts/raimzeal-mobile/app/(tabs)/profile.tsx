import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  FlatList,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useMacroGoals, DEFAULT_MACRO_GOALS } from "@/contexts/MacroGoalsContext";
import { exportToPdf, type DateRangeOption, type CustomDateRange } from "@/lib/pdf";
import {
  FILTER_HINT_STORAGE_KEY,
  REORDER_HINT_STORAGE_KEY,
  HISTORY_FILTER_HINT_STORAGE_KEY,
  PRESET_NUDGE_STORAGE_KEY,
  SWIPE_DELETE_HINT_STORAGE_KEY,
  HISTORY_SWIPE_DELETE_HINT_STORAGE_KEY,
  PRESET_LONG_PRESS_HINT_KEY,
  QUICK_FOOD_GRAMS_HINT_KEY,
  FAV_FOOD_GRAMS_HINT_KEY,
  RECENT_FOOD_GRAMS_HINT_KEY,
  PRESET_REORDER_HINT_KEY,
  INFO_BUTTON_TOOLTIP_KEY,
  FAV_RESET_DEFAULTS_HINT_KEY,
  RECENT_RESET_DEFAULTS_HINT_KEY,
  SCAN_SWIPE_HINT_KEY,
} from "@/lib/hints";
import { CameraRollRationaleModal } from "@/components/CameraRollRationaleModal";
import { usePermissionToast } from "@/hooks/usePermissionToast";
import { useTier } from "@/hooks/useTier";
import { usePer100gDefault } from "@/hooks/usePer100gDefault";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GlassCard } from "@/components/GlassCard";
import { captureAndShareCard, captureAndSaveCard, captureShareAndSaveCard, captureAndCopyCard, CaptureShareAndSaveResult } from "@/lib/shareCard";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getApiBase, clearAllUserData, PENDING_CLOUD_WIPE_KEY } from "@/lib/db";
import ShareProgressCard, { BackgroundPhotoCrop, CARD_THEMES, CardThemeId, CardVisibleStats, DEFAULT_THEME_ID, DEFAULT_VISIBLE_STATS } from "@/components/ShareProgressCard";
import CardCustomizationModal, { CardAction, CardCustomizationModalHandle, CardCustomizationResult, STORAGE_KEY_ACTION, STORAGE_KEY_AUTO_TRIGGER_DELAY, STORAGE_KEY_AUTO_TRIGGER_DELAY_CUSTOMISED, STORAGE_KEY_BADGE_DISMISSED, STORAGE_KEY_BG_PHOTO, STORAGE_KEY_LONGPRESS_AND_RUN, STORAGE_KEY_STATS, STORAGE_KEY_THEME } from "@/components/CardCustomizationModal";

// Default card background — bundled at build time so no camera-roll permission needed.
// Image.resolveAssetSource converts the static require into a local-file URI that
// react-native-view-shot can render during the off-screen capture.
const DEFAULT_CARD_BG_ASSET = require("@/assets/images/card-bg-default.jpeg");
function resolveDefaultCardBgUri(): string | null {
  try {
    return Image.resolveAssetSource(DEFAULT_CARD_BG_ASSET).uri;
  } catch {
    return null;
  }
}

const LAST_USED_GRAMS_KEY = "@nutrition_last_used_grams";
const LAST_USED_MEAL_KEY = "@nutrition_last_used_meal";
const LAST_USED_SERVING_KEY = "@nutrition_last_used_serving";
const DIGEST_SUBSCRIBED_KEY = "@digest_subscribed";

type MealDefaultEntry = {
  name: string;
  grams?: number;
  meal?: string;
  serving?: number;
};
const LAST_EXPORT_KEY = "@profile_last_export_timestamp";

function formatExportCustomLabel(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (start === end) return `Custom (${MONTHS[s.getMonth()]} ${s.getDate()})`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `Custom (${MONTHS[s.getMonth()]} ${s.getDate()}\u2013${e.getDate()})`;
  }
  return `Custom (${MONTHS[s.getMonth()]} ${s.getDate()} \u2013 ${MONTHS[e.getMonth()]} ${e.getDate()})`;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? "1 min ago" : `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr === 1 ? "1 hour ago" : `${diffHr} hours ago`;
  const diffDay = Math.floor(diffHr / 24);
  return diffDay === 1 ? "Yesterday" : `${diffDay} days ago`;
}

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

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    user,
    oviaMessages,
    streak,
    workoutLogs,
    mealLogs,
    bodyMeasurements,
    waterIntake,
    personalRecords,
    settings,
    favoriteFoods,
    updateSettings,
    resetState,
    resetHints,
    undismissHint,
    clearAllData,
    lastSyncedAt,
  } = useFitness();
  const [, setSyncTimeTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSyncTimeTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);
  const { signOut, user: authUser } = useAuth();
  const { tier, refetch: refetchTier } = useTier(authUser?.id ?? null);

  useFocusEffect(
    useCallback(() => {
      refetchTier();
    }, [refetchTier])
  );
  const [defaultPer100g, setDefaultPer100g] = usePer100gDefault();
  const { goals: macroGoals, setGoals: setMacroGoals } = useMacroGoals();
  const {
    cameraRollStatus,
    hasSeenRationale,
    markRationaleDismissed,
    resetRationale,
    requestCameraRollPermission,
    updateCameraRollStatus,
  } = usePermissions();

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const { showPermissionToast, permissionToastElement } = usePermissionToast();

  const [shareLoading, setShareLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPhotoRationaleModal, setShowPhotoRationaleModal] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [cardVisibleStats, setCardVisibleStats] = useState<CardVisibleStats>({ ...DEFAULT_VISIBLE_STATS });
  const [cardCustomMessage, setCardCustomMessage] = useState("");
  const [cardThemeId, setCardThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const [cardBgPhotoUri, setCardBgPhotoUri] = useState<string | undefined>(undefined);
  const [cardBgPhotoCrop, setCardBgPhotoCrop] = useState<BackgroundPhotoCrop | undefined>(undefined);
  const [defaultCardAction, setDefaultCardAction] = useState<CardAction | null>(null);
  const [autoTriggerDelay, setAutoTriggerDelay] = useState<string>("3");
  const [hasCustomisedCountdown, setHasCustomisedCountdown] = useState(false);

  const [showUndoWindowModal, setShowUndoWindowModal] = useState(false);
  const [undoWindowInput, setUndoWindowInput] = useState("");

  const [savedHistoryDateRange, setSavedHistoryDateRange] = useState<string | null>(null);
  const [savedCustomDateRange, setSavedCustomDateRange] = useState<CustomDateRange | null>(null);
  const [showExportRangeModal, setShowExportRangeModal] = useState(false);
  const [exportRangeSelection, setExportRangeSelection] = useState<DateRangeOption>("all");
  const [pendingClearAfterExport, setPendingClearAfterExport] = useState(false);

  const [mealDefaultsCount, setMealDefaultsCount] = useState<number | null>(null);
  const [showMealDefaultsSheet, setShowMealDefaultsSheet] = useState(false);
  const [mealDefaultsEntries, setMealDefaultsEntries] = useState<MealDefaultEntry[]>([]);

  const [digestSubscribed, setDigestSubscribed] = useState(false);
  const [digestLoading, setDigestLoading] = useState(false);

  const [hintsExpanded, setHintsExpanded] = useState(false);

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const flashAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const [flashColor, setFlashColor] = useState<string>(CARD_THEMES[0].accent);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);

  const profileScrollRef = useRef<ScrollView>(null);
  const settingsCardYRef = useRef<number>(0);
  const countdownRowYRef = useRef<number>(0);
  const countdownHighlightAnim = useRef(new Animated.Value(0)).current;
  const cardModalRef = useRef<CardCustomizationModalHandle>(null);
  const { scrollTo, openCard } = useLocalSearchParams<{ scrollTo?: string; openCard?: string }>();

  useEffect(() => {
    let cancelled = false;
    import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem("@nutrition_history_date_range").then((val) => {
        if (!cancelled) setSavedHistoryDateRange(val);
      });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
      AsyncStorage.getItem(DIGEST_SUBSCRIBED_KEY).then((val) => {
        if (!cancelled) setDigestSubscribed(val === "1");
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Auto-open the card customisation modal when navigated here with openCard=1
  // (e.g. from the "My Card" quick action on the home tab).
  useEffect(() => {
    if (openCard !== "1") return;
    const timeout = setTimeout(() => {
      setShowCustomizeModal(true);
    }, 350);
    return () => clearTimeout(timeout);
  }, [openCard]);

  useEffect(() => {
    if (scrollTo !== "countdown") return;
    const scrollTimeout = setTimeout(() => {
      profileScrollRef.current?.scrollTo({
        y: settingsCardYRef.current + countdownRowYRef.current,
        animated: true,
      });
    }, 350);
    const highlightTimeout = setTimeout(() => {
      countdownHighlightAnim.setValue(0);
      AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
        if (reduceMotion) {
          countdownHighlightAnim.setValue(1);
          setTimeout(() => countdownHighlightAnim.setValue(0), 1200);
        } else {
          Animated.sequence([
            Animated.timing(countdownHighlightAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
            Animated.timing(countdownHighlightAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
          ]).start();
        }
      });
    }, 650);
    return () => {
      clearTimeout(scrollTimeout);
      clearTimeout(highlightTimeout);
    };
  }, [scrollTo, countdownHighlightAnim]);

  // When the Profile screen mounts while signed in, check whether a previous
  // "Clear Everything" run left a pending cloud wipe (stored because the device
  // was offline at the time). If found and the stored user ID matches the current
  // user, retry the wipe now that we may be back online.
  useEffect(() => {
    if (!authUser?.id || !isSupabaseConfigured) return;
    const userId = authUser.id;
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => AsyncStorage.getItem(PENDING_CLOUD_WIPE_KEY))
      .then(async (pendingUserId) => {
        if (!pendingUserId || pendingUserId !== userId) return;
        try {
          await clearAllUserData(userId);
          const { default: AsyncStorage } = await import(
            "@react-native-async-storage/async-storage"
          );
          await AsyncStorage.removeItem(PENDING_CLOUD_WIPE_KEY);
        } catch {
          // Still offline — leave the flag in place for next mount.
        }
      })
      .catch(() => {});
  }, [authUser?.id]);

  useEffect(() => {
    let cancelled = false;
    async function loadSavedPreferences() {
      try {
        const AsyncStorage = (
          await import("@react-native-async-storage/async-storage")
        ).default;
        const [savedTheme, savedAction, savedDelay, savedBgPhoto, savedCountdownCustomised] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_ACTION),
          AsyncStorage.getItem(STORAGE_KEY_AUTO_TRIGGER_DELAY),
          AsyncStorage.getItem(STORAGE_KEY_BG_PHOTO),
          AsyncStorage.getItem(STORAGE_KEY_AUTO_TRIGGER_DELAY_CUSTOMISED),
        ]);
        if (!cancelled) {
          // Seed the default bundled background photo the first time (no saved photo yet).
          // The CardCustomizationModal reads the same key on open, so it will pre-populate
          // with the default image automatically without requiring camera-roll permission.
          if (!savedBgPhoto) {
            const defaultUri = resolveDefaultCardBgUri();
            if (defaultUri) {
              const payload = JSON.stringify({ uri: defaultUri, dimLevel: 0.62, blurRadius: 18 });
              AsyncStorage.setItem(STORAGE_KEY_BG_PHOTO, payload).catch(() => {});
              setCardBgPhotoUri(defaultUri);
            }
          } else {
            try {
              const parsed = JSON.parse(savedBgPhoto) as { uri?: string };
              if (parsed.uri) setCardBgPhotoUri(parsed.uri);
            } catch {
              if (savedBgPhoto.startsWith("http") || savedBgPhoto.startsWith("file")) {
                setCardBgPhotoUri(savedBgPhoto);
              }
            }
          }
          const isValidTheme = savedTheme && CARD_THEMES.some((t) => t.id === savedTheme);
          if (isValidTheme) setCardThemeId(savedTheme as CardThemeId);
          const validActions: CardAction[] = ["share", "save", "both", "copy"];
          if (savedAction && validActions.includes(savedAction as CardAction)) {
            setDefaultCardAction(savedAction as CardAction);
          }
          const validDelays = ["off", "1", "3", "5"];
          // Migrate legacy "2" (previously offered by the picker but removed in
          // favour of the "1s" chip that matches the modal UI) to "1".
          const migratedDelay = savedDelay === "2" ? "1" : savedDelay;
          if (migratedDelay && validDelays.includes(migratedDelay)) {
            setAutoTriggerDelay(migratedDelay);
            if (savedDelay !== migratedDelay) {
              AsyncStorage.setItem(STORAGE_KEY_AUTO_TRIGGER_DELAY, migratedDelay).catch(() => {});
            }
          }
          if (savedCountdownCustomised === "1") {
            setHasCustomisedCountdown(true);
          }
        }
      } catch {
        // ignore read errors; defaults remain
      }
    }
    loadSavedPreferences();
    return () => { cancelled = true; };
  }, []);

  // Reconcile STORAGE_KEY_BADGE_DISMISSED with the cloud-backed setting.
  // When Supabase hydration updates settings.showRestoreBadge (e.g. on a
  // fresh device), write the authoritative value back to AsyncStorage so
  // CardCustomizationModal's local load path stays consistent.
  useEffect(() => {
    const showBadge = settings.showRestoreBadge ?? true;
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        if (showBadge) {
          AsyncStorage.removeItem(STORAGE_KEY_BADGE_DISMISSED).catch(() => {});
        } else {
          AsyncStorage.setItem(STORAGE_KEY_BADGE_DISMISSED, "1").catch(() => {});
        }
      })
      .catch(() => {});
  }, [settings.showRestoreBadge]);

  // Reconcile STORAGE_KEY_LONGPRESS_AND_RUN with the cloud-backed setting.
  // When Supabase hydration delivers a value (e.g. on a fresh device), write
  // it back to AsyncStorage so the modal's local fallback path is consistent.
  useEffect(() => {
    if (settings.longPressAndRun === undefined) return;
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.setItem(
          STORAGE_KEY_LONGPRESS_AND_RUN,
          settings.longPressAndRun ? "1" : "0"
        ).catch(() => {});
      })
      .catch(() => {});
  }, [settings.longPressAndRun]);

  // Reconcile STORAGE_KEY_AUTO_TRIGGER_DELAY with the cloud-backed setting.
  // When Supabase hydration delivers a value (e.g. on a fresh device / reinstall),
  // update local state so the UI reflects the synced preference immediately and
  // write it back to AsyncStorage so CardCustomizationModal's local read stays consistent.
  useEffect(() => {
    if (settings.autoTriggerDelay === undefined) return;
    const validDelays = ["off", "1", "3", "5"];
    // Migrate legacy cloud value "2" (no longer offered in the UI) to "1" so it
    // is restored correctly on fresh installs and synced back to cloud.
    const delay =
      settings.autoTriggerDelay === "2" ? "1" : settings.autoTriggerDelay;
    if (!validDelays.includes(delay)) return;
    setAutoTriggerDelay(delay);
    if (delay !== settings.autoTriggerDelay) {
      // Write the corrected value back to cloud so it doesn't keep arriving as "2".
      updateSettings({ autoTriggerDelay: delay });
    }
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.setItem(STORAGE_KEY_AUTO_TRIGGER_DELAY, delay).catch(() => {});
      })
      .catch(() => {});
  }, [settings.autoTriggerDelay]);

  // Reconcile STORAGE_KEY_ACTION with the cloud-backed setting.
  // When Supabase hydration delivers a value (e.g. on a fresh device / reinstall),
  // update local state so the UI reflects the synced preference immediately and
  // write it back to AsyncStorage so CardCustomizationModal's local read stays consistent.
  useEffect(() => {
    if (settings.defaultCardAction === undefined) return;
    const validActions: CardAction[] = ["share", "save", "copy", "both"];
    if (!validActions.includes(settings.defaultCardAction as CardAction)) return;
    setDefaultCardAction(settings.defaultCardAction as CardAction);
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.setItem(STORAGE_KEY_ACTION, settings.defaultCardAction!).catch(() => {});
      })
      .catch(() => {});
  }, [settings.defaultCardAction]);

  // Reconcile STORAGE_KEY_THEME with the cloud-backed setting.
  // When Supabase hydration delivers a cardThemeId (e.g. on a fresh device / reinstall),
  // update local state so the card preview reflects the synced theme immediately and
  // write it back to AsyncStorage so CardCustomizationModal's local read stays consistent.
  useEffect(() => {
    if (settings.cardThemeId === undefined) return;
    const isValidTheme = CARD_THEMES.some((t) => t.id === settings.cardThemeId);
    if (!isValidTheme) return;
    setCardThemeId(settings.cardThemeId as CardThemeId);
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.setItem(STORAGE_KEY_THEME, settings.cardThemeId!).catch(() => {});
      })
      .catch(() => {});
  }, [settings.cardThemeId]);

  // Reconcile STORAGE_KEY_STATS with the cloud-backed setting.
  // When Supabase hydration delivers cardVisibleStats (e.g. on a fresh device / reinstall),
  // update local state so the card preview reflects the synced stats immediately and
  // write it back to AsyncStorage so CardCustomizationModal's local read stays consistent.
  useEffect(() => {
    if (settings.cardVisibleStats === undefined) return;
    const merged: CardVisibleStats = { ...DEFAULT_VISIBLE_STATS, ...settings.cardVisibleStats };
    setCardVisibleStats(merged);
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(settings.cardVisibleStats!)).catch(() => {});
      })
      .catch(() => {});
  }, [settings.cardVisibleStats]);

  // Reconcile cloud-backed background photo dim/blur settings with STORAGE_KEY_BG_PHOTO.
  // When Supabase hydration delivers these values (e.g. on a fresh device / reinstall),
  // merge them into the existing saved bg photo payload so CardCustomizationModal's local
  // read picks them up immediately without waiting for a manual re-open.
  useEffect(() => {
    const dimLevel = settings.backgroundPhotoDimLevel;
    const blurRadius = settings.backgroundPhotoBlurRadius;
    if (dimLevel === undefined && blurRadius === undefined) return;
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.getItem(STORAGE_KEY_BG_PHOTO)
          .then((raw) => {
            if (!raw) return;
            try {
              const parsed = JSON.parse(raw) as Record<string, unknown>;
              if (!parsed.uri) return;
              const updated = {
                ...parsed,
                ...(dimLevel !== undefined ? { dimLevel } : {}),
                ...(blurRadius !== undefined ? { blurRadius } : {}),
              };
              AsyncStorage.setItem(STORAGE_KEY_BG_PHOTO, JSON.stringify(updated)).catch(() => {});
            } catch {
              // ignore parse errors — leave existing payload untouched
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, [settings.backgroundPhotoDimLevel, settings.backgroundPhotoBlurRadius]);

  async function handleSetDefaultCardAction(action: CardAction) {
    setDefaultCardAction(action);
    updateSettings({ defaultCardAction: action });
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem(STORAGE_KEY_ACTION, action);
    } catch {
      // ignore write errors
    }
  }

  function handlePickDefaultCardAction() {
    const LABELS: Record<CardAction, string> = {
      share: "Share — opens your share sheet",
      save: "Save — saves to camera roll",
      copy: "Copy — copies to clipboard",
      both: "Both — saves & opens share sheet",
    };
    Alert.alert(
      "Default Card Action",
      "Choose what happens when you generate a progress card.",
      [
        { text: LABELS.share, onPress: () => handleSetDefaultCardAction("share") },
        { text: LABELS.save, onPress: () => handleSetDefaultCardAction("save") },
        { text: LABELS.copy, onPress: () => handleSetDefaultCardAction("copy") },
        { text: LABELS.both, onPress: () => handleSetDefaultCardAction("both") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function handleSetAutoTriggerDelay(value: string) {
    setAutoTriggerDelay(value);
    updateSettings({ autoTriggerDelay: value });
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      await AsyncStorage.setItem(STORAGE_KEY_AUTO_TRIGGER_DELAY, value);
    } catch {
      // ignore write errors
    }
  }

  function handlePickAutoTriggerDelay() {
    if (!hasCustomisedCountdown) {
      setHasCustomisedCountdown(true);
      import("@react-native-async-storage/async-storage")
        .then(({ default: AsyncStorage }) =>
          AsyncStorage.setItem(STORAGE_KEY_AUTO_TRIGGER_DELAY_CUSTOMISED, "1")
        )
        .catch(() => {});
    }
    Alert.alert(
      "Auto-generate Countdown",
      "How long to wait before the card generates automatically when you have a default action set?",
      [
        { text: "Off", onPress: () => handleSetAutoTriggerDelay("off") },
        { text: "1 second", onPress: () => handleSetAutoTriggerDelay("1") },
        { text: "3 seconds (default)", onPress: () => handleSetAutoTriggerDelay("3") },
        { text: "5 seconds", onPress: () => handleSetAutoTriggerDelay("5") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  function handlePhotoAccessPress() {
    if (cameraRollStatus === "granted") {
      Alert.alert("Photo Library Access", "Access is active. RAIMZEAL can save progress cards to your photo library.");
    } else if (cameraRollStatus === "restricted") {
      Alert.alert(
        "Access Restricted",
        "Photo library access has been restricted by a device or organisational policy. Contact your administrator to change this setting."
      );
    } else if (cameraRollStatus === "denied") {
      Linking.openSettings();
    } else {
      setShowPhotoRationaleModal(true);
    }
  }

  async function handlePhotoRationaleAllow() {
    setShowPhotoRationaleModal(false);
    const result = await requestCameraRollPermission();
    if (result === "denied") {
      showPermissionToast("Photo access blocked — tap to open Settings", "camera-outline");
    }
  }

  async function handlePhotoRationaleNotNow() {
    setShowPhotoRationaleModal(false);
    await markRationaleDismissed();
  }

  async function handleCameraAccessPress() {
    if (cameraPermission?.granted) {
      Alert.alert("Camera Access", "Camera access is active. RAIMZEAL can use your camera to scan food barcodes.");
    } else if (cameraPermission?.canAskAgain === false) {
      Linking.openSettings();
    } else {
      await requestCameraPermission();
    }
  }

  async function handleResetRationalePrompt() {
    try {
      await resetRationale();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Prompt Reset",
        "The next time you save a progress card, the photo access explanation will appear again."
      );
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Prompt Reset",
        "The photo access prompt will reappear on this device, but the change couldn't be saved to the cloud."
      );
    }
  }

  async function handleResetHints() {
    resetHints();
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.multiRemove([
        FILTER_HINT_STORAGE_KEY,
        REORDER_HINT_STORAGE_KEY,
        HISTORY_FILTER_HINT_STORAGE_KEY,
        PRESET_NUDGE_STORAGE_KEY,
        SWIPE_DELETE_HINT_STORAGE_KEY,
        HISTORY_SWIPE_DELETE_HINT_STORAGE_KEY,
        PRESET_LONG_PRESS_HINT_KEY,
        QUICK_FOOD_GRAMS_HINT_KEY,
        FAV_FOOD_GRAMS_HINT_KEY,
        RECENT_FOOD_GRAMS_HINT_KEY,
        PRESET_REORDER_HINT_KEY,
        INFO_BUTTON_TOOLTIP_KEY,
        FAV_RESET_DEFAULTS_HINT_KEY,
        RECENT_RESET_DEFAULTS_HINT_KEY,
        SCAN_SWIPE_HINT_KEY,
      ]);
    } catch {
      // ignore storage errors
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Hints Reset",
      "All one-time tips will reappear the next time you visit those sections."
    );
  }

  async function resetHintStorage(key: string) {
    undismissHint(key);
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }

  function handleResetSingleHint(key: string, label: string, description: string) {
    Alert.alert(
      `Reset "${label}"`,
      `${description} Tap Reset to show it again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          onPress: async () => {
            await resetHintStorage(key);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Hint Reset", `"${label}" will reappear the next time it's triggered.`);
          },
        },
      ]
    );
  }

  async function doClearEverything() {
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      // Remove all app data except Supabase auth session tokens and
      // the pending-cloud-wipe key (written below if we're offline).
      // sb-* keys hold the user's login session — keeping them means
      // the user stays signed in but all data is wiped, which is the
      // intended behavior for "fresh start".
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToRemove = allKeys.filter(
        (k) => !k.startsWith("sb-") && k !== PENDING_CLOUD_WIPE_KEY
      );
      await AsyncStorage.multiRemove(keysToRemove);
      // Reset in-memory state for every context.
      // clearAllData() resets FitnessContext state (including hints) WITHOUT
      // calling persist(), so no stale AsyncStorage.setItem can race against
      // the multiRemove above and recreate data on next launch.
      clearAllData();
      await setMacroGoals(DEFAULT_MACRO_GOALS);

      // Attempt to wipe cloud data when signed in.
      if (authUser?.id && isSupabaseConfigured) {
        try {
          await clearAllUserData(authUser.id);
          // Clear any leftover pending-wipe flag on success.
          await AsyncStorage.removeItem(PENDING_CLOUD_WIPE_KEY);
        } catch {
          // Device is offline or the request failed — store the user ID
          // so the cloud wipe is retried the next time the Profile screen
          // mounts while online.
          await AsyncStorage.setItem(PENDING_CLOUD_WIPE_KEY, authUser.id).catch(() => {});
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Data Cleared",
        "All app data has been reset. You can start fresh."
      );
    } catch {
      Alert.alert("Error", "Could not clear app data. Please try again.");
    }
  }

  async function handleClearAppData() {
    const isSignedIn = Boolean(authUser?.id) && isSupabaseConfigured;
    const cloudLine = isSignedIn
      ? " Your cloud-synced data — workouts, meals, measurements, AI history, personal records, favourite foods, and progress photos — will also be permanently deleted from the server."
      : "";

    let exportLine = "";
    try {
      const raw = await AsyncStorage.getItem(LAST_EXPORT_KEY);
      if (raw) {
        const exportTs = parseInt(raw, 10);
        const exportDate = new Date(exportTs);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (exportDate.toDateString() === today.toDateString()) {
          exportLine = " You exported your data earlier today.";
        } else if (exportDate.toDateString() === yesterday.toDateString()) {
          exportLine = " You exported your data yesterday.";
        } else {
          const month = exportDate.toLocaleString("default", { month: "long" });
          const day = exportDate.getDate();
          exportLine = ` You last exported your data on ${month} ${day}.`;
        }
      }
    } catch {
      // ignore — export line just stays empty
    }

    Alert.alert(
      "Clear All App Data",
      `This will permanently delete your filters, goals, history, and all other stored data.${cloudLine} This cannot be undone.${exportLine}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export First",
          onPress: () => {
            if (pdfLoading) return;
            setPendingClearAfterExport(true);
            handleExportPdf();
          },
        },
        {
          text: "Clear Everything",
          style: "destructive",
          onPress: doClearEverything,
        },
      ]
    );
  }

  async function loadMealDefaultsCount() {
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      const [gramsRaw, mealRaw, servingRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_USED_GRAMS_KEY),
        AsyncStorage.getItem(LAST_USED_MEAL_KEY),
        AsyncStorage.getItem(LAST_USED_SERVING_KEY),
      ]);
      const gramsMap: Record<string, number> = gramsRaw ? JSON.parse(gramsRaw) : {};
      const mealMap: Record<string, string> = mealRaw ? JSON.parse(mealRaw) : {};
      const servingMap: Record<string, number> = servingRaw ? JSON.parse(servingRaw) : {};
      const foodNames = new Set([
        ...Object.keys(gramsMap),
        ...Object.keys(mealMap),
        ...Object.keys(servingMap),
      ]);
      setMealDefaultsCount(foodNames.size);
    } catch {
      setMealDefaultsCount(null);
    }
  }

  useEffect(() => {
    loadMealDefaultsCount();
  }, []);

  async function handleClearMealDefaults() {
    if (mealDefaultsCount === 0) return;
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      const [gramsRaw, mealRaw, servingRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_USED_GRAMS_KEY),
        AsyncStorage.getItem(LAST_USED_MEAL_KEY),
        AsyncStorage.getItem(LAST_USED_SERVING_KEY),
      ]);
      const gramsMap: Record<string, number> = gramsRaw ? JSON.parse(gramsRaw) : {};
      const mealMap: Record<string, string> = mealRaw ? JSON.parse(mealRaw) : {};
      const servingMap: Record<string, number> = servingRaw ? JSON.parse(servingRaw) : {};
      const allNames = new Set([
        ...Object.keys(gramsMap),
        ...Object.keys(mealMap),
        ...Object.keys(servingMap),
      ]);
      const entries: MealDefaultEntry[] = [...allNames].map((name) => ({
        name,
        grams: gramsMap[name],
        meal: mealMap[name],
        serving: servingMap[name],
      }));
      setMealDefaultsEntries(entries);
      setShowMealDefaultsSheet(true);
    } catch {
      Alert.alert("Error", "Could not load saved defaults. Please try again.");
    }
  }

  async function handleClearOneDefault(foodName: string) {
    try {
      const { default: AsyncStorage } = await import(
        "@react-native-async-storage/async-storage"
      );
      const [gramsRaw, mealRaw, servingRaw] = await Promise.all([
        AsyncStorage.getItem(LAST_USED_GRAMS_KEY),
        AsyncStorage.getItem(LAST_USED_MEAL_KEY),
        AsyncStorage.getItem(LAST_USED_SERVING_KEY),
      ]);
      const gramsMap: Record<string, number> = gramsRaw ? JSON.parse(gramsRaw) : {};
      const mealMap: Record<string, string> = mealRaw ? JSON.parse(mealRaw) : {};
      const servingMap: Record<string, number> = servingRaw ? JSON.parse(servingRaw) : {};
      delete gramsMap[foodName];
      delete mealMap[foodName];
      delete servingMap[foodName];
      await Promise.all([
        AsyncStorage.setItem(LAST_USED_GRAMS_KEY, JSON.stringify(gramsMap)),
        AsyncStorage.setItem(LAST_USED_MEAL_KEY, JSON.stringify(mealMap)),
        AsyncStorage.setItem(LAST_USED_SERVING_KEY, JSON.stringify(servingMap)),
      ]);
      const updated = mealDefaultsEntries.filter((e) => e.name !== foodName);
      setMealDefaultsEntries(updated);
      setMealDefaultsCount(updated.length);
      if (updated.length === 0) setShowMealDefaultsSheet(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert("Error", "Could not clear that food's defaults. Please try again.");
    }
  }

  function handleClearAllDefaults() {
    Alert.alert(
      "Clear All Defaults",
      "This will reset the remembered grams, servings, and meal type for every food.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              const { default: AsyncStorage } = await import(
                "@react-native-async-storage/async-storage"
              );
              await Promise.all([
                AsyncStorage.removeItem(LAST_USED_GRAMS_KEY),
                AsyncStorage.removeItem(LAST_USED_MEAL_KEY),
                AsyncStorage.removeItem(LAST_USED_SERVING_KEY),
              ]);
              setMealDefaultsEntries([]);
              setMealDefaultsCount(0);
              setShowMealDefaultsSheet(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Error", "Could not clear defaults. Please try again.");
            }
          },
        },
      ]
    );
  }

  function handlePickUndoWindow() {
    setUndoWindowInput(String(settings.undoWindowSeconds ?? 3));
    setShowUndoWindowModal(true);
  }

  function handleConfirmUndoWindow() {
    const parsed = parseInt(undoWindowInput, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 30) {
      Alert.alert("Invalid Value", "Please enter a number between 1 and 30.");
      return;
    }
    updateSettings({ undoWindowSeconds: parsed });
    setShowUndoWindowModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handlePickReorderHintFrequency() {
    Alert.alert(
      "Reorder Hint Frequency",
      "How often should the 'hold to reorder favorites' reminder appear?",
      [
        { text: "Weekly", onPress: () => updateSettings({ reorderHintFrequency: "weekly" }) },
        { text: "Monthly (default)", onPress: () => updateSettings({ reorderHintFrequency: "monthly" }) },
        { text: "Never", onPress: () => updateSettings({ reorderHintFrequency: "never" }) },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function handleToggleRestoreBadge(value: boolean) {
    updateSettings({ showRestoreBadge: value });
    // Keep STORAGE_KEY_BADGE_DISMISSED in sync so CardCustomizationModal reads
    // the correct value from AsyncStorage (its local fallback).
    try {
      const AsyncStorage = (
        await import("@react-native-async-storage/async-storage")
      ).default;
      if (value) {
        await AsyncStorage.removeItem(STORAGE_KEY_BADGE_DISMISSED);
      } else {
        await AsyncStorage.setItem(STORAGE_KEY_BADGE_DISMISSED, "1");
      }
    } catch {
      // ignore write errors
    }
  }

  const cardRef = useRef<View>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const primaryGoal = user?.goals?.[0] ?? "improve_fitness";

  const STORAGE_KEY_STAT_TOGGLES_NUDGE_SEEN = "@raimzeal_stat_toggles_nudge_seen";

  function handleOpenCardModal() {
    setShowCustomizeModal(true);
    AsyncStorage.getItem(STORAGE_KEY_STAT_TOGGLES_NUDGE_SEEN).then((seen) => {
      if (seen) return;
      AsyncStorage.setItem(STORAGE_KEY_STAT_TOGGLES_NUDGE_SEEN, "1").catch(() => {});
      setTimeout(() => {
        cardModalRef.current?.highlightStatToggles();
      }, 500);
    }).catch(() => {});
  }

  async function handleGenerateCard({ visibleStats, customMessage, themeId, action, backgroundPhotoUri, backgroundPhotoCrop }: CardCustomizationResult): Promise<void> {
    setCardVisibleStats(visibleStats);
    setCardCustomMessage(customMessage);
    setCardThemeId(themeId);
    setCardBgPhotoUri(backgroundPhotoUri);
    setCardBgPhotoCrop(backgroundPhotoCrop);
    updateSettings({ cardThemeId: themeId, cardVisibleStats: visibleStats as unknown as Record<string, boolean> });

    if (action === "save" || action === "both") {
      setSaveLoading(true);
    }
    if (action === "share" || action === "both" || action === "copy") {
      setShareLoading(true);
    }

    // Brief glow flash in the selected theme color as a visual confirmation.
    // Stop any in-flight flash animation before starting a new one so a rapid
    // double-tap cannot leave a stale .start() callback that hides the new flash.
    const chosenTheme = CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];
    setFlashColor(chosenTheme.accent);
    setShowFlashOverlay(true);
    flashAnimRef.current?.stop();
    flashOpacity.setValue(0);
    const flashAnim = Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.28, duration: 130, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]);
    flashAnimRef.current = flashAnim;
    flashAnim.start(() => {
      flashAnimRef.current = null;
      setShowFlashOverlay(false);
    });

    // Wrap runAfterInteractions in a Promise so the modal can await the result
    // and show a confirmation only after the action resolves successfully.
    return new Promise<void>((resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          const permissionOpts = {
            cachedStatus: cameraRollStatus,
            onStatusChange: updateCameraRollStatus,
            requestPermission: requestCameraRollPermission,
          };
          if (action === "both") {
            const result: CaptureShareAndSaveResult = await captureShareAndSaveCard(cardRef, permissionOpts);
            if (result.saved) {
              resolve();
            } else {
              // Reject with a sentinel so the modal shows an inline error toast
              // with a tappable "Open Settings" link instead of a modal Alert.
              reject(new Error("PERMISSION_DENIED"));
            }
          } else if (action === "save") {
            const saved = await captureAndSaveCard(cardRef, permissionOpts);
            if (saved) {
              resolve();
            } else {
              // Reject with a sentinel — modal shows the inline "Open Settings" toast.
              reject(new Error("PERMISSION_DENIED"));
            }
          } else if (action === "copy") {
            await captureAndCopyCard(cardRef);
            resolve();
          } else {
            await captureAndShareCard(cardRef);
            resolve();
          }
        } catch (err) {
          // Preserve sentinel errors so the modal can show the correct message.
          // PERMISSION_RESTRICTED → managed-device policy message (no Settings CTA)
          // PERMISSION_DENIED    → "Open Settings" toast
          if (err instanceof Error && (err.message === "PERMISSION_RESTRICTED" || err.message === "PERMISSION_DENIED")) {
            reject(err);
          } else {
            const label =
              action === "save" ? "Couldn't save — check your permissions" :
              action === "both" ? "Couldn't save or share the card" :
              action === "copy" ? "Couldn't copy to clipboard" :
              "Couldn't open share sheet";
            // Reject with a descriptive message; the modal shows it as an inline
            // error toast. No Alert here — the toast is the primary feedback.
            reject(new Error(label));
          }
        } finally {
          setSaveLoading(false);
          setShareLoading(false);
        }
      });
    });
  }

  function handleExportPdf() {
    if (pdfLoading) return;
    import("@react-native-async-storage/async-storage").then(({ default: AsyncStorage }) => {
      Promise.all([
        AsyncStorage.getItem("@nutrition_history_date_range"),
        AsyncStorage.getItem("@nutrition_custom_date_range"),
      ]).then(([cv, customRaw]) => {
        setSavedHistoryDateRange(cv);
        let customRange: CustomDateRange | null = null;
        if (customRaw) {
          try {
            const parsed = JSON.parse(customRaw) as unknown;
            if (parsed && typeof parsed === "object" && "start" in parsed && "end" in parsed) {
              customRange = parsed as CustomDateRange;
            }
          } catch {}
        }
        setSavedCustomDateRange(customRange);
        const preselect: DateRangeOption =
          cv === "7d" || cv === "30d"
            ? cv
            : cv === "custom" && customRange
            ? "custom"
            : "all";
        setExportRangeSelection(preselect);
        setShowExportRangeModal(true);
      });
    });
  }

  async function runPdfExport(dateRange: DateRangeOption, customRange?: CustomDateRange) {
    setPdfLoading(true);
    try {
      const fitnessState = {
        user,
        workoutLogs,
        mealLogs,
        bodyMeasurements,
        waterIntake,
        personalRecords,
        streak,
        settings,
        favoriteFoods,
        oviaMessages,
      };
      await exportToPdf(fitnessState as Parameters<typeof exportToPdf>[0], macroGoals, dateRange, customRange);
      await AsyncStorage.setItem(LAST_EXPORT_KEY, String(Date.now())).catch(() => {});
    } catch {
      Alert.alert("Export Failed", "Something went wrong while generating the PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleDigestToggle(value: boolean) {
    if (!authUser?.email) return;
    setDigestLoading(true);
    const prev = digestSubscribed;
    setDigestSubscribed(value);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");
      const endpoint = value ? "/email/digest/subscribe" : "/email/digest/unsubscribe";
      const res = await fetch(`${getApiBase()}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(
          value
            ? { email: authUser.email, userName: user?.name ?? authUser.email }
            : { email: authUser.email }
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Request failed");
      }
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      await AsyncStorage.setItem(DIGEST_SUBSCRIBED_KEY, value ? "1" : "0");
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showPermissionToast(value ? "Subscribed to weekly digest ✓" : "Unsubscribed from digest");
    } catch (err) {
      setDigestSubscribed(prev);
      Alert.alert(
        value ? "Couldn't Subscribe" : "Couldn't Unsubscribe",
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setDigestLoading(false);
    }
  }

  async function handleLogout() {
    // Check for a pending cloud wipe BEFORE showing the sign-out confirmation.
    // If the user cleared their data while offline, the cloud records were never
    // deleted. Signing out now would leave those records in Supabase forever.
    const { default: AsyncStorage } = await import(
      "@react-native-async-storage/async-storage"
    );
    const pendingWipeUserId = await AsyncStorage.getItem(PENDING_CLOUD_WIPE_KEY).catch(() => null);
    const hasPendingWipe =
      pendingWipeUserId != null &&
      authUser?.id != null &&
      pendingWipeUserId === authUser.id;

    // Shared helper — runs the full sign-out sequence regardless of which
    // alert path led here. resetHints() must run first (needs the active
    // session to clear remote dismissedHints).
    async function doSignOut() {
      resetHints();
      try {
        await signOut();
      } catch {
        Alert.alert(
          "Sign Out Failed",
          "Could not sign out. Please check your connection and try again."
        );
        return;
      }
      resetState();
      if (!isSupabaseConfigured) {
        Alert.alert("Signed out", "You have been signed out.");
      }
    }

    if (hasPendingWipe) {
      // Warn the user that their cloud data has not been wiped yet and offer
      // a chance to retry before signing out.
      Alert.alert(
        "Cloud Data Wipe Pending",
        "You cleared your data while offline. Your health records haven't been deleted from the cloud yet — they'll remain in Supabase if you sign out now.\n\nWould you like to retry the wipe before signing out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Out Anyway",
            style: "destructive",
            onPress: doSignOut,
          },
          {
            text: "Retry & Sign Out",
            onPress: async () => {
              try {
                await clearAllUserData(authUser!.id);
                await AsyncStorage.removeItem(PENDING_CLOUD_WIPE_KEY);
              } catch {
                // Still offline or request failed — inform the user and let
                // them decide whether to sign out knowing data remains.
                Alert.alert(
                  "Still Offline",
                  "Your cloud data could not be wiped — you appear to be offline. Your health records will remain in Supabase until you sign in again and the wipe is retried.\n\nSign out anyway?",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Sign Out",
                      style: "destructive",
                      onPress: doSignOut,
                    },
                  ]
                );
                return;
              }
              await doSignOut();
            },
          },
        ]
      );
      return;
    }

    // No pending wipe — show the standard confirmation.
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: doSignOut,
        },
      ]
    );
  }

  // Compute card props (sort measurements by date so first=oldest, last=newest)
  const cardProps = useMemo(() => {
    const sortedMeasurements = [...bodyMeasurements].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const startWeight = sortedMeasurements[0]?.weight ?? user?.weight ?? 0;
    const latestWeight =
      sortedMeasurements[sortedMeasurements.length - 1]?.weight ?? user?.weight ?? 0;
    const weightDelta = startWeight > 0 ? +(startWeight - latestWeight).toFixed(1) : 0;
    return {
      userName: user?.name ?? "Champion",
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
  }, [
    bodyMeasurements,
    user?.name,
    user?.weight,
    user?.goals,
    streak,
    workoutLogs,
    settings.weightUnit,
    personalRecords,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Off-screen progress card for ViewShot capture */}
      <View style={[styles.offScreen, { pointerEvents: "none" }]}>
        <ShareProgressCard
          ref={cardRef}
          {...cardProps}
          visibleStats={cardVisibleStats}
          customMessage={cardCustomMessage}
          themeId={cardThemeId}
          backgroundPhotoUri={cardBgPhotoUri}
          backgroundPhotoCrop={cardBgPhotoCrop}
        />
      </View>

      {/* Photo library rationale modal — shown from Settings row */}
      <CameraRollRationaleModal
        visible={showPhotoRationaleModal}
        onAllow={handlePhotoRationaleAllow}
        onNotNow={handlePhotoRationaleNotNow}
      />

      {/* Card customization modal */}
      <CardCustomizationModal
        ref={cardModalRef}
        visible={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onGenerate={handleGenerateCard}
        generating={shareLoading || saveLoading}
        cardPreviewData={cardProps}
        onBadgeDismiss={() => updateSettings({ showRestoreBadge: false })}
        initialBadgeDismissed={!(settings.showRestoreBadge ?? true)}
        initialDefaultAction={settings.defaultCardAction !== undefined ? settings.defaultCardAction as CardAction : undefined}
        onDefaultActionChange={(val) => updateSettings({ defaultCardAction: val ?? undefined })}
        initialLongPressAndRun={settings.longPressAndRun}
        onLongPressAndRunChange={(val) => updateSettings({ longPressAndRun: val })}
        onAutoTriggerDelayChange={handleSetAutoTriggerDelay}
        hasCustomisedCountdown={hasCustomisedCountdown}
      />

      {/* Theme color flash confirmation — appears above everything when generating */}
      <Modal
        transparent
        animationType="none"
        visible={showFlashOverlay}
        statusBarTranslucent
      >
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: flashColor, opacity: flashOpacity },
          ]}
        />
      </Modal>

      {/* Undo window duration — custom numeric input modal */}
      <Modal
        transparent
        animationType="fade"
        visible={showUndoWindowModal}
        onRequestClose={() => setShowUndoWindowModal(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowUndoWindowModal(false)}
          style={styles.undoModalBackdrop}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.undoModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.undoModalTitle, { color: colors.foreground }]}>Undo Window Duration</Text>
            <Text style={[styles.undoModalSubtitle, { color: colors.mutedForeground }]}>
              How long (in seconds) should the undo option stay visible after deleting a meal? Enter a value from 1 to 30.
            </Text>
            <View style={[styles.undoInputRow, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <TextInput
                style={[styles.undoInput, { color: colors.foreground }]}
                value={undoWindowInput}
                onChangeText={(t) => setUndoWindowInput(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="done"
                onSubmitEditing={handleConfirmUndoWindow}
                autoFocus
                selectTextOnFocus
              />
              <Text style={[styles.undoInputUnit, { color: colors.mutedForeground }]}>seconds</Text>
            </View>
            <View style={styles.undoModalButtons}>
              <TouchableOpacity
                onPress={() => setShowUndoWindowModal(false)}
                style={[styles.undoModalBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.undoModalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmUndoWindow}
                style={[styles.undoModalBtn, styles.undoModalBtnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.undoModalBtnText, { color: "#fff" }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Per-food remembered defaults sheet */}
      <Modal
        transparent
        animationType="slide"
        visible={showMealDefaultsSheet}
        onRequestClose={() => setShowMealDefaultsSheet(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowMealDefaultsSheet(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        >
          <TouchableOpacity activeOpacity={1} style={[styles.defaultsSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.defaultsSheetHandle} />
            <Text style={[styles.defaultsSheetTitle, { color: colors.foreground }]}>Remembered Defaults</Text>
            <Text style={[styles.defaultsSheetSubtitle, { color: colors.mutedForeground }]}>
              Tap the trash icon to clear one food's saved grams, servings, and meal type.
            </Text>
            <FlatList
              data={mealDefaultsEntries}
              keyExtractor={(item) => item.name}
              style={{ maxHeight: 360 }}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
              renderItem={({ item }) => (
                <View style={styles.defaultsEntryRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[styles.defaultsEntryName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {item.grams !== undefined && (
                        <View style={[styles.defaultsChip, { backgroundColor: colors.accent + "20" }]}>
                          <Text style={[styles.defaultsChipText, { color: colors.accent }]}>{item.grams}g</Text>
                        </View>
                      )}
                      {item.serving !== undefined && item.serving !== 1 && (
                        <View style={[styles.defaultsChip, { backgroundColor: colors.primary + "20" }]}>
                          <Text style={[styles.defaultsChipText, { color: colors.primary }]}>×{item.serving} serving{item.serving !== 1 ? "s" : ""}</Text>
                        </View>
                      )}
                      {item.meal !== undefined && (
                        <View style={[styles.defaultsChip, { backgroundColor: colors.mutedForeground + "20" }]}>
                          <Text style={[styles.defaultsChipText, { color: colors.mutedForeground }]}>{item.meal}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleClearOneDefault(item.name)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.defaultsTrashBtn, { backgroundColor: colors.destructive + "15" }]}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              )}
            />
            <TouchableOpacity
              onPress={handleClearAllDefaults}
              style={[styles.defaultsClearAllBtn, { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "40" }]}
            >
              <Ionicons name="trash-outline" size={15} color={colors.destructive} />
              <Text style={[styles.defaultsClearAllText, { color: colors.destructive }]}>Clear all</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* PDF export date-range picker */}
      <Modal
        transparent
        animationType="fade"
        visible={showExportRangeModal}
        onRequestClose={() => {
          setShowExportRangeModal(false);
          if (pendingClearAfterExport) {
            setPendingClearAfterExport(false);
            handleClearAppData();
          }
        }}
        statusBarTranslucent
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setShowExportRangeModal(false);
            if (pendingClearAfterExport) {
              setPendingClearAfterExport(false);
              handleClearAppData();
            }
          }}
          style={styles.undoModalBackdrop}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.undoModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Text style={[styles.undoModalTitle, { color: colors.foreground }]}>Export Date Range</Text>
            <Text style={[styles.undoModalSubtitle, { color: colors.mutedForeground }]}>
              Choose the period for your PDF report.
            </Text>
            {(
              [
                { value: "7d", label: "Last 7 Days" },
                { value: "30d", label: "Last 30 Days" },
                { value: "90d", label: "Last 90 Days" },
                { value: "all", label: "All Time" },
                ...(savedCustomDateRange
                  ? [{ value: "custom" as DateRangeOption, label: formatExportCustomLabel(savedCustomDateRange.start, savedCustomDateRange.end) }]
                  : []),
              ] as { value: DateRangeOption; label: string }[]
            ).map((opt) => {
              const isSelected = exportRangeSelection === opt.value;
              const isCurrentView =
                (opt.value === "7d" && savedHistoryDateRange === "7d") ||
                (opt.value === "30d" && savedHistoryDateRange === "30d") ||
                (opt.value === "custom" && savedHistoryDateRange === "custom");
              return (
                <TouchableOpacity
                  key={opt.value}
                  activeOpacity={0.7}
                  onPress={() => setExportRangeSelection(opt.value)}
                  style={[
                    styles.exportRangeOption,
                    {
                      borderColor: isSelected ? colors.primary : colors.border,
                      backgroundColor: isSelected ? colors.primary + "12" : colors.background,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.exportRangeRadio,
                      {
                        borderColor: isSelected ? colors.primary : colors.mutedForeground,
                        backgroundColor: isSelected ? colors.primary : "transparent",
                      },
                    ]}
                  />
                  <Text style={[styles.exportRangeLabel, { color: colors.foreground }]}>
                    {opt.label}
                  </Text>
                  {isCurrentView && (
                    <Text style={[styles.exportRangeCurrentTag, { color: colors.primary, borderColor: colors.primary + "40", backgroundColor: colors.primary + "12" }]}>
                      current view
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={styles.undoModalButtons}>
              <TouchableOpacity
                onPress={() => {
                  setShowExportRangeModal(false);
                  if (pendingClearAfterExport) {
                    setPendingClearAfterExport(false);
                    handleClearAppData();
                  }
                }}
                style={[styles.undoModalBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.undoModalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowExportRangeModal(false);
                  const wasPending = pendingClearAfterExport;
                  if (wasPending) setPendingClearAfterExport(false);
                  const customRange =
                    exportRangeSelection === "custom" && savedCustomDateRange
                      ? savedCustomDateRange
                      : undefined;
                  runPdfExport(exportRangeSelection, customRange).then(() => {
                    if (wasPending) handleClearAppData();
                  });
                }}
                style={[styles.undoModalBtn, styles.undoModalBtnPrimary, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.undoModalBtnText, { color: "#fff" }]}>Export</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Profile</Text>
      </View>

      <ScrollView
        ref={profileScrollRef}
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
              {user?.name ?? "Champion"}
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

          {/* Profile completion nudge */}
          {(!user?.height || !user?.weight || !user?.goals?.length) && (
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => router.push("/edit-profile")}
            >
              <GlassCard style={[styles.nudgeCard, { borderColor: colors.warning + "55" }]}>
                <View style={styles.nudgeRow}>
                  <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
                  <View style={styles.nudgeText}>
                    <Text style={[styles.nudgeTitle, { color: colors.foreground }]}>
                      Complete your profile
                    </Text>
                    <Text style={[styles.nudgeSubtitle, { color: colors.mutedForeground }]}>
                      Add height, weight & goals for personalised Ovia AI recommendations
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </View>
              </GlassCard>
            </TouchableOpacity>
          )}

          {/* Settings */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Settings</Text>
          <View onLayout={(e) => { settingsCardYRef.current = e.nativeEvent.layout.y; }}>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="nutrition-outline"
              label="Daily Macro Goals"
              sublabel="Calories, protein, carbs & fat"
              color={colors.secondary}
              onPress={() => router.push("/macro-goals")}
            />
            <SettingPickerRow
              icon="layers-outline"
              label="Default card action"
              sublabel="What happens when you tap Generate"
              value={
                defaultCardAction === "share" ? "Share" :
                defaultCardAction === "save" ? "Save" :
                defaultCardAction === "copy" ? "Copy" :
                defaultCardAction === "both" ? "Both" :
                "Not set"
              }
              color={colors.accent}
              onPress={handlePickDefaultCardAction}
            />
            <Animated.View
              onLayout={(e) => { countdownRowYRef.current = e.nativeEvent.layout.y; }}
              style={{
                backgroundColor: countdownHighlightAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(99,179,237,0)", "rgba(99,179,237,0.22)"],
                }),
                borderRadius: 10,
              }}
            >
              <SettingPickerRow
                icon="hourglass-outline"
                label="Auto-generate countdown"
                sublabel="How long before the card auto-creates"
                value={autoTriggerDelay === "off" ? "Off" : `${autoTriggerDelay}s`}
                color={colors.accent}
                onPress={handlePickAutoTriggerDelay}
              />
            </Animated.View>
            <SettingPickerRow
              icon="timer-outline"
              label="Undo window duration"
              sublabel="Time to reverse a meal deletion"
              value={`${settings.undoWindowSeconds ?? 3}s`}
              color={colors.secondary}
              onPress={handlePickUndoWindow}
            />
            <SettingPickerRow
              icon="refresh-outline"
              label="Reorder hint frequency"
              sublabel="'Hold to reorder favorites' reminder"
              value={
                (settings.reorderHintFrequency ?? "monthly") === "never"
                  ? "Never"
                  : (settings.reorderHintFrequency ?? "monthly") === "weekly"
                  ? "Weekly"
                  : "Monthly"
              }
              color={colors.accent}
              onPress={handlePickReorderHintFrequency}
            />
            <SettingToggleRow
              icon="scale-outline"
              label="Default to per-100g view"
              sublabel="Show nutrition per 100g on search results by default"
              color={colors.secondary}
              value={defaultPer100g}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDefaultPer100g(v);
              }}
            />
            <SettingPickerRow
              icon="images-outline"
              label="Photo Library Access"
              sublabel={
                cameraRollStatus === "granted"
                  ? "Tap to confirm — needed to save progress cards"
                  : cameraRollStatus === "restricted"
                  ? "Restricted by device policy — contact your admin"
                  : cameraRollStatus === "denied"
                  ? "Permanently blocked — tap to open Settings"
                  : "Tap to enable saving cards to your photo library"
              }
              sublabelColor={
                cameraRollStatus === "granted"
                  ? colors.mutedForeground
                  : colors.warning
              }
              value={
                cameraRollStatus === "granted"
                  ? "Active"
                  : cameraRollStatus === "restricted"
                  ? "Restricted"
                  : cameraRollStatus === "denied"
                  ? "Open Settings"
                  : "Not granted"
              }
              color={
                cameraRollStatus === "granted"
                  ? colors.secondary
                  : colors.warning
              }
              onPress={handlePhotoAccessPress}
            />
            {cameraRollStatus === "denied" && (
              <View style={[styles.deniedInfoRow, { borderTopColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                <Text style={[styles.deniedInfoText, { color: colors.mutedForeground }]}>
                  Access was permanently denied — the reset option is unavailable. Open Settings above to re-enable it.
                </Text>
              </View>
            )}
            {cameraRollStatus === "restricted" && (
              <View style={[styles.deniedInfoRow, { borderTopColor: colors.border }]}>
                <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                <Text style={[styles.deniedInfoText, { color: colors.mutedForeground }]}>
                  This restriction is enforced by your organisation or device management policy and cannot be changed from Settings.
                </Text>
              </View>
            )}
            {hasSeenRationale && cameraRollStatus === "undetermined" && (
              <ActionRow
                icon="refresh-outline"
                label="Reset photo access prompt"
                sublabel="Re-show the explanation on next save attempt"
                color={colors.accent}
                onPress={handleResetRationalePrompt}
              />
            )}
            <SettingPickerRow
              icon="camera-outline"
              label="Camera Access"
              sublabel={
                cameraPermission?.granted
                  ? "Camera is active — used for barcode scanning"
                  : cameraPermission?.canAskAgain === false
                  ? "Permanently blocked — tap to open Settings"
                  : "Tap to enable the camera for barcode scanning"
              }
              sublabelColor={
                cameraPermission?.granted
                  ? colors.mutedForeground
                  : colors.warning
              }
              value={
                cameraPermission?.granted
                  ? "Active"
                  : cameraPermission?.canAskAgain === false
                  ? "Open Settings"
                  : "Not granted"
              }
              color={
                cameraPermission?.granted
                  ? colors.secondary
                  : colors.warning
              }
              onPress={handleCameraAccessPress}
            />
            <ActionRow
              icon="bulb-outline"
              label="Reset all hints"
              sublabel="Re-show every one-time tip across the app"
              color={colors.accent}
              onPress={handleResetHints}
            />
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setHintsExpanded((v) => !v)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 13,
                paddingHorizontal: 16,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: colors.accent + "22",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons name="list-outline" size={17} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>
                  Reset individual hints
                </Text>
                <Text style={{ fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
                  {hintsExpanded ? "Tap a hint below to reset it" : "Expand to reset a specific hint"}
                </Text>
              </View>
              <Ionicons
                name={hintsExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            {hintsExpanded && (
              <>
                {(
                  [
                    { key: FILTER_HINT_STORAGE_KEY, label: "Filter tip", desc: "This tip appears the first time you open the meal filter." },
                    { key: REORDER_HINT_STORAGE_KEY, label: "Favorites reorder reminder", desc: "This reminder nudges you to drag-and-drop your favourite foods." },
                    { key: HISTORY_FILTER_HINT_STORAGE_KEY, label: "History filter tip", desc: "This tip appears the first time you open the history filter." },
                    { key: PRESET_NUDGE_STORAGE_KEY, label: "Preset nudge", desc: "This nudge suggests creating a meal preset after repeated logging." },
                    { key: SWIPE_DELETE_HINT_STORAGE_KEY, label: "Swipe-to-delete tip", desc: "This tip demonstrates swiping to delete a food entry." },
                    { key: HISTORY_SWIPE_DELETE_HINT_STORAGE_KEY, label: "History swipe-to-delete tip", desc: "This tip demonstrates swiping to delete a history entry." },
                    { key: PRESET_LONG_PRESS_HINT_KEY, label: "Preset long-press hint", desc: "This hint shows that long-pressing a preset lets you edit it." },
                    { key: QUICK_FOOD_GRAMS_HINT_KEY, label: "Quick food grams hint", desc: "This hint explains the grams field for quick-add foods." },
                    { key: FAV_FOOD_GRAMS_HINT_KEY, label: "Favourite food grams hint", desc: "This hint explains the grams field for favourite foods." },
                    { key: RECENT_FOOD_GRAMS_HINT_KEY, label: "Recent food grams hint", desc: "This hint explains the grams field for recent foods." },
                    { key: PRESET_REORDER_HINT_KEY, label: "Preset reorder hint", desc: "This hint appears when you enter preset reorder mode." },
                    { key: INFO_BUTTON_TOOLTIP_KEY, label: "Info button tooltip", desc: "This tooltip explains what the info button shows." },
                    { key: FAV_RESET_DEFAULTS_HINT_KEY, label: "Favourite reset-defaults hint", desc: "This hint explains the reset-to-defaults option for favourite foods." },
                    { key: RECENT_RESET_DEFAULTS_HINT_KEY, label: "Recent reset-defaults hint", desc: "This hint explains the reset-to-defaults option for recent foods." },
                    { key: SCAN_SWIPE_HINT_KEY, label: "Barcode scan swipe hint", desc: "This hint shows that you can swipe between results on the scanner." },
                  ] as { key: string; label: string; desc: string }[]
                ).map(({ key, label, desc }) => (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.7}
                    onPress={() => handleResetSingleHint(key, label, desc)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 11,
                      paddingHorizontal: 16,
                      paddingLeft: 60,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                      backgroundColor: colors.card + "88",
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: colors.foreground }}>{label}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: colors.accent, fontWeight: "600" }}>Reset</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
            <ActionRow
              icon="refresh-circle-outline"
              label="Clear remembered meal defaults"
              sublabel={
                mealDefaultsCount === null
                  ? "Reset saved grams & meal type for all foods"
                  : mealDefaultsCount === 0
                  ? "No saved defaults"
                  : `${mealDefaultsCount} ${mealDefaultsCount === 1 ? "food has" : "foods have"} saved grams or meal type`
              }
              color={colors.warning}
              onPress={handleClearMealDefaults}
            />
            {settings.showRestoreBadge === false && (
              <SettingToggleRow
                icon="eye-outline"
                label="Show restore badge"
                sublabel="Re-show the 'Restored from last time' indicator"
                color={colors.primary}
                value={false}
                onValueChange={handleToggleRestoreBadge}
              />
            )}
            <ActionRow
              icon="trash-outline"
              label="Clear all app data"
              sublabel="Wipe filters, goals, history & preferences"
              color={colors.destructive}
              onPress={handleClearAppData}
            />
            <View style={styles.actionRow}>
              <View style={[styles.actionIconWrap, { backgroundColor: "#10b98120" }]}>
                <Ionicons name="cloud-done-outline" size={18} color="#10b981" />
              </View>
              <Text style={[styles.actionLabel, { color: colors.foreground, flex: 1 }]}>Last synced</Text>
              <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                {formatRelativeTime(lastSyncedAt)}
              </Text>
            </View>
          </GlassCard>
          </View>

          {/* Tools & Wellness */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Tools & Wellness</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="calculator-outline"
              label="BMR & 1RM Calculators"
              sublabel="Calorie targets · Strength estimator"
              color="#3b82f6"
              onPress={() => router.push("/calculators")}
            />
            <ActionRow
              icon="checkmark-circle-outline"
              label="Habit Tracker"
              sublabel="Daily habits · 7-day streaks"
              color="#10b981"
              onPress={() => router.push("/habit-tracker")}
            />
            <ActionRow
              icon="leaf-outline"
              label="Breathing & Mindfulness"
              sublabel="Box · 4-7-8 · Equal · Quick calm"
              color="#8b5cf6"
              onPress={() => router.push("/breathing")}
            />
            <ActionRow
              icon="medkit-outline"
              label="Supplement Tracker"
              sublabel="Daily stack · 7-day compliance"
              color="#f59e0b"
              onPress={() => router.push("/supplements")}
            />
            <ActionRow
              icon="flower-outline"
              label="Mindfulness & Gratitude"
              sublabel="Daily journal · 5-min timer · Streak · Rise+"
              color="#a78bfa"
              onPress={() => router.push("/mindfulness")}
            />
            <ActionRow
              icon="bar-chart-outline"
              label="Weekly Wellness Report"
              sublabel="Workouts · Nutrition · Sleep · Readiness · Rise+"
              color="#10b981"
              onPress={() => router.push("/weekly-report")}
            />
            <ActionRow
              icon="flash-outline"
              label="Community Challenges"
              sublabel="Join · Track progress · 7 challenges"
              color="#ef4444"
              onPress={() => router.push("/challenges")}
              isLast
            />
          </GlassCard>

          {/* Women's Health */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Women's Health</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="flower-outline"
              label="Period Tracker"
              sublabel="Cycle · Symptoms · Fertile window · BBT"
              color="#ec4899"
              onPress={() => router.push("/period-tracker")}
            />
            <ActionRow
              icon="rose-outline"
              label="Women's Health Reminders"
              sublabel="Breast exam · Pap smear · Mammogram"
              color="#f43f5e"
              onPress={() => router.push("/womens-health-reminders")}
            />
            <ActionRow
              icon="analytics-outline"
              label="PCOS Tracker"
              sublabel="Daily symptoms · Pattern tracking · Rise+"
              color="#8b5cf6"
              onPress={() => router.push("/pcos-tracker")}
            />
            <ActionRow
              icon="sunny-outline"
              label="Menopause Tracker"
              sublabel="Hot flashes · Night sweats · Mood · Rise+"
              color="#f59e0b"
              onPress={() => router.push("/menopause-tracker")}
            />
            <ActionRow
              icon="rose-outline"
              label="Cycle-Phase Sync"
              sublabel="Workout & nutrition by cycle phase · Rise+"
              color="#ec4899"
              onPress={() => router.push("/cycle-sync")}
            />
            <ActionRow
              icon="heart-outline"
              label="Pregnancy Wellness"
              sublabel="Trimester guide · Safe exercise · Nutrition · Rise+"
              color="#f43f5e"
              onPress={() => router.push("/pregnancy-wellness")}
              isLast
            />
          </GlassCard>

          {/* Health */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Health</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="water-outline"
              label="Health Profile & Food Guide"
              sublabel={
                user?.bloodType || user?.genotype
                  ? `Blood ${user?.bloodType ?? "?"}${user?.rhFactor ?? ""} · Genotype ${user?.genotype ?? "?"}`
                  : "Set blood type, Rh factor & genotype"
              }
              color="#ef4444"
              onPress={() => router.push("/health-profile")}
            />
            <ActionRow
              icon="water"
              label="Hydration Tracker"
              sublabel="Daily goal · Streak · 14-day history"
              color="#3b82f6"
              onPress={() => router.push("/hydration")}
              isLast
            />
          </GlassCard>

          {/* Integrations */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Integrations</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="heart"
              label={Platform.OS === "ios" ? "Apple Health" : "Health Connect"}
              sublabel="Steps · Sleep · Heart rate · Weight"
              color={Platform.OS === "ios" ? "#ff3b30" : "#34a853"}
              onPress={() => router.push("/health-sync")}
              isLast
            />
          </GlassCard>

          {/* Training & Stats */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Training & Stats</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="trophy-outline"
              label="Achievements & Badges"
              sublabel="Milestones · Unlocked rewards"
              color="#eab308"
              onPress={() => router.push("/achievements")}
            />
            <ActionRow
              icon="stats-chart-outline"
              label="Workout Statistics"
              sublabel="Total time · PRs · Active days"
              color="#3b82f6"
              onPress={() => router.push("/workout-stats")}
            />
            <ActionRow
              icon="moon-outline"
              label="Sleep Tracker"
              sublabel="Duration · Quality · 7-day chart"
              color="#8b5cf6"
              onPress={() => router.push("/sleep-tracker")}
            />
            <ActionRow
              icon="happy-outline"
              label="Wellness Check-In"
              sublabel="Mood · Energy · Stress · Readiness score"
              color="#10b981"
              onPress={() => router.push("/wellness-checkin")}
            />
            <ActionRow
              icon="restaurant-outline"
              label="Recipe Book"
              sublabel="20 recipes · Tap to log macros"
              color="#10b981"
              onPress={() => router.push("/recipes")}
            />
            <ActionRow
              icon="barbell-outline"
              label="Adaptive Workout Suggestions"
              sublabel="Readiness-based daily plan · Reign+"
              color="#3b82f6"
              onPress={() => router.push("/adaptive-workout")}
            />
            <ActionRow
              icon="calendar-outline"
              label="Weekly Meal Plan"
              sublabel="7-day plan · Grocery list · Reign+"
              color="#C9A84C"
              onPress={() => router.push("/meal-plan")}
              isLast
            />
          </GlassCard>

          {/* Legacy Inner Circle — only shown to Legacy members */}
          {tier === "legacy" && (
            <>
              <Text style={[styles.sectionTitle, { color: "#fbbf24" }]}>Legacy Inner Circle</Text>
              <GlassCard style={[styles.actionsCard, { borderColor: "#fbbf2430" }]}>
                <ActionRow
                  icon="trophy"
                  label="Legacy Leaderboard"
                  sublabel="See how you rank among Legacy founders"
                  color="#fbbf24"
                  onPress={() => router.push("/legacy")}
                />
                <ActionRow
                  icon="document-text-outline"
                  label="Monthly Health Report"
                  sublabel="AI-generated personalised analysis"
                  color="#34d399"
                  onPress={() => router.push("/legacy")}
                />
                <ActionRow
                  icon="fitness-outline"
                  label="Personalised Coaching Plan"
                  sublabel="4-week AI plan built for your goals"
                  color="#a78bfa"
                  onPress={() => router.push("/legacy")}
                />
                <ActionRow
                  icon="people-outline"
                  label="Accountability Partner"
                  sublabel="Get matched with another Legacy member"
                  color="#60a5fa"
                  onPress={() => router.push("/legacy")}
                />
                <ActionRow
                  icon="ribbon-outline"
                  label="Founding Member Certificate"
                  sublabel="Your official Legacy founder recognition"
                  color="#fbbf24"
                  onPress={() => router.push("/legacy")}
                  isLast
                />
              </GlassCard>
            </>
          )}

          {/* Membership */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Membership</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="shield-checkmark-outline"
              label="Foundation — Free Forever"
              sublabel="Your current plan · All core features included"
              color="#2E8B57"
              onPress={() => router.push("/membership")}
            />
            <ActionRow
              icon="flash-outline"
              label="Rise — $9.99/mo · $99/yr"
              sublabel="Improved scans · Macros · Meal planning · Habit reminders"
              color="#60a5fa"
              onPress={() => router.push("/membership")}
            />
            <ActionRow
              icon="star-outline"
              label="Reign — $19.99/mo · $199/yr ⭐ Best Value"
              sublabel="Full AI coach · Cycle sync · Adaptive programs · Nutrition plans"
              color="#c084fc"
              onPress={() => router.push("/membership")}
            />
            <ActionRow
              icon="trophy-outline"
              label="Legacy — $49.99/mo · $499/yr"
              sublabel="Fertility tracking · Wearables · Predictive alerts · Priority support"
              color="#fbbf24"
              onPress={() => router.push("/membership")}
              isLast
            />
          </GlassCard>

          {/* Account actions */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="create-outline"
              label="Edit Profile"
              sublabel="Name, age, weight, height & goals"
              color={colors.primary}
              onPress={() => router.push("/edit-profile")}
            />
            <ActionRow
              icon="document-text-outline"
              label={pdfLoading ? "Generating PDF…" : "Export Data as PDF"}
              sublabel="Full report with goals, workouts & meals"
              color="#3b82f6"
              onPress={handleExportPdf}
              loading={pdfLoading}
            />
            <ActionRow
              icon={cameraRollStatus === "denied" ? "lock-closed-outline" : "share-social-outline"}
              label={
                cameraRollStatus === "denied"
                  ? "Enable in Settings to save"
                  : shareLoading || saveLoading
                  ? "Creating Card…"
                  : "Share / Save Progress Card"
              }
              color={cameraRollStatus === "denied" ? colors.warning : colors.accent}
              onPress={
                cameraRollStatus === "denied"
                  ? () => Linking.openSettings()
                  : handleOpenCardModal
              }
              loading={shareLoading || saveLoading}
              sublabel={cameraRollStatus === "denied" ? "Tap to open Settings" : "Customise and share your progress card"}
            />
            <ActionRow
              icon="notifications-outline"
              label="Reminders & Notifications"
              sublabel="Workout, nutrition & hydration alerts"
              color={colors.accent}
              onPress={() => router.push("/reminders")}
            />
            <SettingToggleRow
              icon="mail-outline"
              label="Weekly digest emails"
              sublabel="Saturday digest + Wednesday mid-week boost"
              color={colors.primary}
              value={digestSubscribed}
              onValueChange={handleDigestToggle}
              loading={digestLoading}
            />
            <ActionRow
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              sublabel="How we handle your personal data"
              color={colors.warning}
              onPress={() => router.push("/privacy")}
            />
            <ActionRow
              icon="document-text-outline"
              label="Terms of Service"
              sublabel="Rules governing use of RAIMZEAL"
              color={colors.mutedForeground}
              onPress={() => router.push("/terms")}
            />
            <ActionRow
              icon="help-circle-outline"
              label="Help & Support"
              sublabel="Email us at support@raimzeal.com"
              color={colors.mutedForeground}
              onPress={() =>
                Alert.alert("Support", "Email us at support@raimzeal.com")
              }
            />
            <ActionRow
              icon="log-out-outline"
              label="Sign Out"
              sublabel="Log out of your RAIMZEAL account"
              color={colors.destructive}
              onPress={handleLogout}
              isLast
            />
          </GlassCard>

          {/* App version / branding */}
          <Text style={[styles.version, { color: colors.mutedForeground }]}>
            RAIMZEAL v1.0.0
          </Text>
          <Text style={[styles.version, { color: colors.mutedForeground, marginTop: 2 }]}>
            Created and powered by ECONTEUR LLC
          </Text>
          <Text
            style={[styles.version, { color: colors.primary, marginTop: 1 }]}
            onPress={() => Linking.openURL('https://www.econteur.com')}
          >
            www.econteur.com
          </Text>
        </ScrollView>
      {permissionToastElement}
    </View>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

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

function SettingPickerRow({
  icon, label, sublabel, sublabelColor, value, color, onPress, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  sublabelColor?: string;
  value: string;
  color: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const colors = useColors();
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.actionRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: colors.foreground, flex: 0 }]}>{label}</Text>
        {sublabel ? (
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: sublabelColor ?? colors.mutedForeground, marginTop: 1 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.settingPickerValue, { color: colors.mutedForeground }]}>{value}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

function SettingToggleRow({
  icon, label, sublabel, color, value, onValueChange, isLast, loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  color: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
  loading?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.actionRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: colors.foreground, flex: 0 }]}>{label}</Text>
        {sublabel ? (
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={color} style={{ marginRight: 4 }} />
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: color + "80" }}
          thumbColor={value ? color : colors.mutedForeground}
        />
      )}
    </View>
  );
}

function ActionRow({
  icon, label, sublabel, color, onPress, loading, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
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
      <View style={{ flex: 1 }}>
        <Text style={[styles.actionLabel, { color: colors.foreground, flex: 0 }]}>{label}</Text>
        {sublabel ? (
          <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
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
  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  profileContent: { padding: 16, gap: 16 },
  avatarSection: { alignItems: "center", gap: 6, paddingVertical: 16 },
  avatarCircle: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  avatarInitial: { fontSize: 36, fontFamily: "SpaceGrotesk_700Bold" },
  profileName: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileGoal: { fontSize: 13, fontFamily: "Inter_400Regular" },
  profileStats: { flexDirection: "row", gap: 10 },
  profileStatItem: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 1, alignItems: "center", gap: 4 },
  profileStatValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  profileStatLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  infoCard: { padding: 0, overflow: "hidden" },
  nudgeCard: { padding: 12, borderWidth: 1, marginBottom: 4 },
  nudgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  nudgeText: { flex: 1 },
  nudgeTitle: { fontSize: 14, fontFamily: "SpaceGrotesk_700Bold", marginBottom: 2 },
  nudgeSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  infoLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  deniedInfoRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 10, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  deniedInfoText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  actionsCard: { padding: 0, overflow: "hidden" },
  actionRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  actionIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  settingPickerValue: { fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 4 },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  undoModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  undoModalCard: { width: "100%", maxWidth: 360, borderRadius: 20, borderWidth: 1, padding: 24, gap: 16 },
  undoModalTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  undoModalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  undoInputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  undoInput: { fontSize: 28, fontFamily: "Inter_700Bold", minWidth: 52, textAlign: "center" },
  undoInputUnit: { fontSize: 14, fontFamily: "Inter_400Regular" },
  undoModalButtons: { flexDirection: "row", gap: 10 },
  undoModalBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  undoModalBtnPrimary: { borderWidth: 0 },
  undoModalBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  exportRangeOption: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  exportRangeRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  exportRangeLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  exportRangeCurrentTag: { fontSize: 11, fontFamily: "Inter_500Medium", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  defaultsSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 32, gap: 12 },
  defaultsSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#88888866", alignSelf: "center", marginBottom: 8 },
  defaultsSheetTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  defaultsSheetSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginBottom: 4 },
  defaultsEntryRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12 },
  defaultsEntryName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  defaultsChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  defaultsChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  defaultsTrashBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  defaultsClearAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  defaultsClearAllText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
