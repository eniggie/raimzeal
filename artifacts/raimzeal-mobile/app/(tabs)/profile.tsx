import React, { useEffect, useRef, useState } from "react";
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
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/contexts/PermissionsContext";
import { useMacroGoals } from "@/contexts/MacroGoalsContext";
import { exportToPdf } from "@/lib/pdf";
import { CameraRollRationaleModal } from "@/components/CameraRollRationaleModal";
import { GlassCard } from "@/components/GlassCard";
import { captureAndShareCard, captureAndSaveCard, captureShareAndSaveCard, captureAndCopyCard, CaptureShareAndSaveResult } from "@/lib/shareCard";
import { isSupabaseConfigured } from "@/lib/supabase";
import ShareProgressCard, { BackgroundPhotoCrop, CARD_THEMES, CardThemeId, CardVisibleStats, DEFAULT_THEME_ID, DEFAULT_VISIBLE_STATS } from "@/components/ShareProgressCard";
import CardCustomizationModal, { CardAction, CardCustomizationResult, STORAGE_KEY_ACTION, STORAGE_KEY_AUTO_TRIGGER_DELAY, STORAGE_KEY_BADGE_DISMISSED, STORAGE_KEY_THEME } from "@/components/CardCustomizationModal";

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

  const flashOpacity = useRef(new Animated.Value(0)).current;
  const [flashColor, setFlashColor] = useState<string>(CARD_THEMES[0].accent);
  const [showFlashOverlay, setShowFlashOverlay] = useState(false);

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
      Alert.alert(
        "Access Denied",
        "Photo library access was denied. You can enable it in Settings.",
        [
          { text: "Open Settings", onPress: () => Linking.openSettings() },
          { text: "Cancel", style: "cancel" },
        ]
      );
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

  function handlePickUndoWindow() {
    Alert.alert(
      "Undo Window Duration",
      "How long should the undo option stay visible after deleting a meal?",
      [
        { text: "3 seconds", onPress: () => updateSettings({ undoWindowSeconds: 3 }) },
        { text: "5 seconds", onPress: () => updateSettings({ undoWindowSeconds: 5 }) },
        { text: "10 seconds", onPress: () => updateSettings({ undoWindowSeconds: 10 }) },
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

  async function handleExportPdf() {
    if (pdfLoading) return;
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
      await exportToPdf(fitnessState as Parameters<typeof exportToPdf>[0], macroGoals);
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

          {/* Settings */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Settings</Text>
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
            <SettingPickerRow
              icon="hourglass-outline"
              label="Auto-generate countdown"
              value={autoTriggerDelay === "off" ? "Off" : `${autoTriggerDelay}s`}
              color={colors.accent}
              onPress={handlePickAutoTriggerDelay}
            />
            <SettingPickerRow
              icon="timer-outline"
              label="Undo window duration"
              value={`${settings.undoWindowSeconds ?? 3}s`}
              color={colors.secondary}
              onPress={handlePickUndoWindow}
            />
            <SettingPickerRow
              icon="images-outline"
              label="Photo Library Access"
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
            {hasSeenRationale && cameraRollStatus === "undetermined" && (
              <ActionRow
                icon="refresh-outline"
                label="Reset photo access prompt"
                sublabel="Re-show the explanation on next save attempt"
                color={colors.accent}
                onPress={handleResetRationalePrompt}
              />
            )}
            <SettingToggleRow
              icon="refresh-circle-outline"
              label="Show restore badge"
              sublabel="'Restored from last time' indicator"
              color={colors.primary}
              value={settings.showRestoreBadge ?? true}
              onValueChange={handleToggleRestoreBadge}
              isLast
            />
          </GlassCard>

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
              icon="star-outline"
              label="RAIMZEAL · Free Forever"
              sublabel="All features included, no subscription"
              color="#2E8B57"
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
  icon, label, value, color, onPress, isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
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
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
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
  settingPickerValue: { fontSize: 13, fontFamily: "Inter_400Regular", marginRight: 4 },
  version: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
});
