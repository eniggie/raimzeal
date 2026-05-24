import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  InteractionManager,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useMacroGoals } from "@/contexts/MacroGoalsContext";
import { exportToPdf, type DateRangeOption } from "@/lib/pdf";
import { CameraRollRationaleModal } from "@/components/CameraRollRationaleModal";
import { usePermissionToast } from "@/hooks/usePermissionToast";
import { GlassCard } from "@/components/GlassCard";
import { captureAndShareCard, captureAndSaveCard, captureShareAndSaveCard, captureAndCopyCard, CaptureShareAndSaveResult } from "@/lib/shareCard";
import { isSupabaseConfigured } from "@/lib/supabase";
import ShareProgressCard, { BackgroundPhotoCrop, CARD_THEMES, CardThemeId, CardVisibleStats, DEFAULT_THEME_ID, DEFAULT_VISIBLE_STATS } from "@/components/ShareProgressCard";
import CardCustomizationModal, { CardAction, CardCustomizationResult, STORAGE_KEY_ACTION, STORAGE_KEY_AUTO_TRIGGER_DELAY, STORAGE_KEY_BADGE_DISMISSED, STORAGE_KEY_LONGPRESS_AND_RUN, STORAGE_KEY_THEME } from "@/components/CardCustomizationModal";

const LAST_USED_GRAMS_KEY = "@nutrition_last_used_grams";
const LAST_USED_MEAL_KEY = "@nutrition_last_used_meal";

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
  } = useFitness();
  const { signOut } = useAuth();
  const { goals: macroGoals } = useMacroGoals();
  const {
    cameraRollStatus,
    hasSeenRationale,
    markRationaleDismissed,
    resetRationale,
    requestCameraRollPermission,
    updateCameraRollStatus,
  } = usePermissions();

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

  const [showUndoWindowModal, setShowUndoWindowModal] = useState(false);
  const [undoWindowInput, setUndoWindowInput] = useState("");

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState<string>(CARD_THEMES[0].accent);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);

  const profileScrollRef = useRef<ScrollView>(null);
  const settingsCardYRef = useRef<number>(0);
  const countdownRowYRef = useRef<number>(0);
  const { scrollTo } = useLocalSearchParams<{ scrollTo?: string }>();

  useEffect(() => {
    if (scrollTo !== "countdown") return;
    const timeout = setTimeout(() => {
      profileScrollRef.current?.scrollTo({
        y: settingsCardYRef.current + countdownRowYRef.current,
        animated: true,
      });
    }, 350);
    return () => clearTimeout(timeout);
  }, [scrollTo]);

  useEffect(() => {
    let cancelled = false;
    async function loadSavedPreferences() {
      try {
        const AsyncStorage = (
          await import("@react-native-async-storage/async-storage")
        ).default;
        const [savedTheme, savedAction, savedDelay] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_ACTION),
          AsyncStorage.getItem(STORAGE_KEY_AUTO_TRIGGER_DELAY),
        ]);
        if (!cancelled) {
          const isValidTheme = savedTheme && CARD_THEMES.some((t) => t.id === savedTheme);
          if (isValidTheme) setCardThemeId(savedTheme as CardThemeId);
          const validActions: CardAction[] = ["share", "save", "both", "copy"];
          if (savedAction && validActions.includes(savedAction as CardAction)) {
            setDefaultCardAction(savedAction as CardAction);
          }
          const validDelays = ["off", "2", "3", "5"];
          if (savedDelay && validDelays.includes(savedDelay)) {
            setAutoTriggerDelay(savedDelay);
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
    const validDelays = ["off", "2", "3", "5"];
    if (!validDelays.includes(settings.autoTriggerDelay)) return;
    setAutoTriggerDelay(settings.autoTriggerDelay);
    import("@react-native-async-storage/async-storage")
      .then(({ default: AsyncStorage }) => {
        AsyncStorage.setItem(
          STORAGE_KEY_AUTO_TRIGGER_DELAY,
          settings.autoTriggerDelay!
        ).catch(() => {});
      })
      .catch(() => {});
  }, [settings.autoTriggerDelay]);

  async function handleSetDefaultCardAction(action: CardAction) {
    setDefaultCardAction(action);
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
    Alert.alert(
      "Auto-generate Countdown",
      "How long to wait before the card generates automatically when you have a default action set?",
      [
        { text: "Off", onPress: () => handleSetAutoTriggerDelay("off") },
        { text: "2 seconds", onPress: () => handleSetAutoTriggerDelay("2") },
        { text: "3 seconds (default)", onPress: () => handleSetAutoTriggerDelay("3") },
        { text: "5 seconds", onPress: () => handleSetAutoTriggerDelay("5") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  function handlePhotoAccessPress() {
    if (cameraRollStatus === "granted") {
      Alert.alert("Photo Library Access", "Access is active. RAIMZEAL can save progress cards to your photo library.");
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
      showPermissionToast("Photo access blocked — tap to open Settings");
    }
  }

  async function handlePhotoRationaleNotNow() {
    setShowPhotoRationaleModal(false);
    await markRationaleDismissed();
  }

  async function handleResetRationalePrompt() {
    await resetRationale();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Prompt Reset",
      "The next time you save a progress card, the photo access explanation will appear again."
    );
  }

  function handleResetHints() {
    resetHints();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      "Hints Reset",
      "All one-time tips will reappear the next time you visit those sections."
    );
  }

  function handleClearMealDefaults() {
    Alert.alert(
      "Clear Remembered Defaults",
      "This will reset the remembered grams amount and meal type for every food. The next time you open a food, it will show the original defaults.",
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
              ]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert(
                "Defaults Cleared",
                "All remembered grams amounts and meal types have been reset."
              );
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

  function handleOpenCardModal() {
    setShowCustomizeModal(true);
  }

  async function handleGenerateCard({ visibleStats, customMessage, themeId, action, backgroundPhotoUri, backgroundPhotoCrop }: CardCustomizationResult): Promise<void> {
    setCardVisibleStats(visibleStats);
    setCardCustomMessage(customMessage);
    setCardThemeId(themeId);
    setCardBgPhotoUri(backgroundPhotoUri);
    setCardBgPhotoCrop(backgroundPhotoCrop);

    if (action === "save" || action === "both") {
      setSaveLoading(true);
    }
    if (action === "share" || action === "both" || action === "copy") {
      setShareLoading(true);
    }

    // Brief glow flash in the selected theme color as a visual confirmation
    const chosenTheme = CARD_THEMES.find((t) => t.id === themeId) ?? CARD_THEMES[0];
    setFlashColor(chosenTheme.accent);
    setShowFlashOverlay(true);
    flashOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(flashOpacity, { toValue: 0.28, duration: 130, useNativeDriver: true }),
      Animated.timing(flashOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
    ]).start(() => setShowFlashOverlay(false));

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
        } catch {
          const label =
            action === "save" ? "Couldn't save — check your permissions" :
            action === "both" ? "Couldn't save or share the card" :
            action === "copy" ? "Couldn't copy to clipboard" :
            "Couldn't open share sheet";
          // Reject with a descriptive message; the modal shows it as an inline
          // error toast. No Alert here — the toast is the primary feedback.
          reject(new Error(label));
        } finally {
          setSaveLoading(false);
          setShareLoading(false);
        }
      });
    });
  }

  function handleExportPdf() {
    if (pdfLoading) return;
    Alert.alert(
      "Choose Date Range",
      "Which period should the report cover?",
      [
        { text: "Last 7 Days", onPress: () => runPdfExport("7d") },
        { text: "Last 30 Days", onPress: () => runPdfExport("30d") },
        { text: "Last 90 Days", onPress: () => runPdfExport("90d") },
        { text: "All Time", onPress: () => runPdfExport("all") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  async function runPdfExport(dateRange: DateRangeOption) {
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
      await exportToPdf(fitnessState as Parameters<typeof exportToPdf>[0], macroGoals, dateRange);
    } catch {
      Alert.alert("Export Failed", "Something went wrong while generating the PDF. Please try again.");
    } finally {
      setPdfLoading(false);
    }
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
            // Sign out from Supabase FIRST — if it fails, local state stays intact
            // so the user is not left in a ghost session.
            try {
              await signOut();
            } catch {
              Alert.alert("Sign Out Failed", "Could not sign out. Please check your connection and try again.");
              return;
            }
            resetState();
            if (!isSupabaseConfigured) {
              Alert.alert("Signed out", "You have been signed out.");
            }
          },
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
        visible={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onGenerate={handleGenerateCard}
        generating={shareLoading || saveLoading}
        cardPreviewData={cardProps}
        onBadgeDismiss={() => updateSettings({ showRestoreBadge: false })}
        initialBadgeDismissed={!(settings.showRestoreBadge ?? true)}
        initialLongPressAndRun={settings.longPressAndRun}
        onLongPressAndRunChange={(val) => updateSettings({ longPressAndRun: val })}
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
            <View onLayout={(e) => { countdownRowYRef.current = e.nativeEvent.layout.y; }}>
              <SettingPickerRow
                icon="hourglass-outline"
                label="Auto-generate countdown"
                sublabel="How long before the card auto-creates"
                value={autoTriggerDelay === "off" ? "Off" : `${autoTriggerDelay}s`}
                color={colors.accent}
                onPress={handlePickAutoTriggerDelay}
              />
            </View>
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
            <SettingPickerRow
              icon="images-outline"
              label="Photo Library Access"
              sublabel={
                cameraRollStatus === "granted"
                  ? "Tap to confirm — needed to save progress cards"
                  : cameraRollStatus === "denied"
                  ? "Permanently blocked — tap to open Settings"
                  : "Tap to enable saving cards to your photo library"
              }
              sublabelColor={
                cameraRollStatus === "granted"
                  ? undefined
                  : colors.warning
              }
              value={
                cameraRollStatus === "granted"
                  ? "Active"
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
            {hasSeenRationale && cameraRollStatus === "undetermined" && (
              <ActionRow
                icon="refresh-outline"
                label="Reset photo access prompt"
                sublabel="Re-show the explanation on next save attempt"
                color={colors.accent}
                onPress={handleResetRationalePrompt}
              />
            )}
            <ActionRow
              icon="bulb-outline"
              label="Reset all hints"
              sublabel="Re-show one-time tips for filters and reordering"
              color={colors.accent}
              onPress={handleResetHints}
            />
            <ActionRow
              icon="refresh-circle-outline"
              label="Clear remembered meal defaults"
              sublabel="Reset saved grams & meal type for all foods"
              color={colors.warning}
              onPress={handleClearMealDefaults}
              isLast={settings.showRestoreBadge !== false}
            />
            {settings.showRestoreBadge === false && (
              <SettingToggleRow
                icon="refresh-circle-outline"
                label="Show restore badge"
                sublabel="Re-show the 'Restored from last time' indicator"
                color={colors.primary}
                value={false}
                onValueChange={handleToggleRestoreBadge}
                isLast
              />
            )}
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
              icon="restaurant-outline"
              label="Recipe Book"
              sublabel="20 recipes · Tap to log macros"
              color="#10b981"
              onPress={() => router.push("/recipes")}
              isLast
            />
          </GlassCard>

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
              label="Rise — $9.99/mo"
              sublabel="200 AI messages/day · Priority badge · Advanced analytics"
              color="#60a5fa"
              onPress={() => router.push("/membership")}
            />
            <ActionRow
              icon="star-outline"
              label="Reign — $19.99/mo"
              sublabel="500 AI messages/day · Meal plans · Body composition"
              color="#c084fc"
              onPress={() => router.push("/membership")}
            />
            <ActionRow
              icon="trophy-outline"
              label="Legacy — $49.99/mo"
              sublabel="Unlimited AI · 1-on-1 coaching · Founder badge"
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
              sublabel={cameraRollStatus === "denied" ? "Tap to open Settings" : undefined}
            />
            <ActionRow
              icon="notifications-outline"
              label="Reminders & Notifications"
              color={colors.accent}
              onPress={() => router.push("/reminders")}
            />
            <ActionRow
              icon="shield-checkmark-outline"
              label="Privacy Policy"
              color={colors.warning}
              onPress={() => router.push("/privacy")}
            />
            <ActionRow
              icon="document-text-outline"
              label="Terms of Service"
              color={colors.mutedForeground}
              onPress={() => router.push("/terms")}
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
  icon, label, sublabel, color, value, onValueChange, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  color: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  isLast?: boolean;
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
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: color + "80" }}
        thumbColor={value ? color : colors.mutedForeground}
      />
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
});
