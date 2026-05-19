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
import { GlassCard } from "@/components/GlassCard";
import { exportToPdf } from "@/lib/pdf";
import { captureAndShareCard, captureAndSaveCard, captureShareAndSaveCard, CaptureShareAndSaveResult } from "@/lib/shareCard";
import { isSupabaseConfigured } from "@/lib/supabase";
import ShareProgressCard, { CARD_THEMES, CardThemeId, CardVisibleStats, DEFAULT_THEME_ID, DEFAULT_VISIBLE_STATS } from "@/components/ShareProgressCard";
import CardCustomizationModal, { CardAction, CardCustomizationResult, STORAGE_KEY_ACTION, STORAGE_KEY_THEME } from "@/components/CardCustomizationModal";

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
  } = useFitness();
  const { signOut } = useAuth();
  const { cameraRollStatus, requestCameraRollPermission, updateCameraRollStatus } = usePermissions();

  const [exportLoading, setExportLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [cardVisibleStats, setCardVisibleStats] = useState<CardVisibleStats>({ ...DEFAULT_VISIBLE_STATS });
  const [cardCustomMessage, setCardCustomMessage] = useState("");
  const [cardThemeId, setCardThemeId] = useState<CardThemeId>(DEFAULT_THEME_ID);
  const [defaultCardAction, setDefaultCardAction] = useState<CardAction | null>(null);

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
        const [savedTheme, savedAction] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_THEME),
          AsyncStorage.getItem(STORAGE_KEY_ACTION),
        ]);
        if (!cancelled) {
          const isValidTheme = savedTheme && CARD_THEMES.some((t) => t.id === savedTheme);
          if (isValidTheme) setCardThemeId(savedTheme as CardThemeId);
          const validActions: CardAction[] = ["share", "save", "both"];
          if (savedAction && validActions.includes(savedAction as CardAction)) {
            setDefaultCardAction(savedAction as CardAction);
          }
        }
      } catch {
        // ignore read errors; defaults remain
      }
    }
    loadSavedPreferences();
    return () => { cancelled = true; };
  }, []);

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
      both: "Both — saves & opens share sheet",
    };
    Alert.alert(
      "Default Card Action",
      "Choose what happens when you generate a progress card.",
      [
        { text: LABELS.share, onPress: () => handleSetDefaultCardAction("share") },
        { text: LABELS.save, onPress: () => handleSetDefaultCardAction("save") },
        { text: LABELS.both, onPress: () => handleSetDefaultCardAction("both") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  }

  const cardRef = useRef<View>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const primaryGoal = user?.goals?.[0] ?? "improve_fitness";

  async function handleExportPdf() {
    setExportLoading(true);
    try {
      await exportToPdf({
        isOnboarded: true,
        isLoggedIn: true,
        user,
        workoutLogs,
        mealLogs,
        bodyMeasurements,
        waterIntake,
        streak,
        personalRecords,
        settings,
        oviaMessages,
        favoriteFoods,
      });
    } catch (e) {
      Alert.alert("Export failed", "Could not generate PDF. Please try again.");
    }
    setExportLoading(false);
  }

  function handleOpenCardModal() {
    setShowCustomizeModal(true);
  }

  async function handleGenerateCard({ visibleStats, customMessage, themeId, action }: CardCustomizationResult): Promise<void> {
    setCardVisibleStats(visibleStats);
    setCardCustomMessage(customMessage);
    setCardThemeId(themeId);

    if (action === "save" || action === "both") {
      setSaveLoading(true);
    }
    if (action === "share" || action === "both") {
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
              // Permission alert already shown inside helper
              reject(new Error("Could not save card"));
            }
          } else if (action === "save") {
            const saved = await captureAndSaveCard(cardRef, permissionOpts);
            if (saved) {
              resolve();
            } else {
              reject(new Error("Could not save card"));
            }
          } else {
            await captureAndShareCard(cardRef);
            resolve();
          }
        } catch {
          const label =
            action === "save" ? "Save failed" :
            action === "both" ? "Save or share failed" :
            "Share failed";
          Alert.alert(label, "Could not generate progress card. Please try again.");
          reject(new Error(label));
        } finally {
          setSaveLoading(false);
          setShareLoading(false);
        }
      });
    });
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
        />
      </View>

      {/* Card customization modal */}
      <CardCustomizationModal
        visible={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        onGenerate={handleGenerateCard}
        generating={shareLoading || saveLoading}
        cardPreviewData={cardProps}
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
            <SettingPickerRow
              icon="layers-outline"
              label="Default card action"
              value={
                defaultCardAction === "share" ? "Share" :
                defaultCardAction === "save" ? "Save" :
                defaultCardAction === "both" ? "Both" :
                "Not set"
              }
              color={colors.accent}
              onPress={handlePickDefaultCardAction}
              isLast
            />
          </GlassCard>

          {/* Membership */}
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Membership</Text>
          <GlassCard style={styles.actionsCard}>
            <ActionRow
              icon="diamond-outline"
              label="Upgrade Plan"
              sublabel="Foundation · Free forever"
              color={colors.secondary}
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
              icon="document-text-outline"
              label={exportLoading ? "Generating PDF…" : "Export Data as PDF"}
              color={colors.secondary}
              onPress={handleExportPdf}
              loading={exportLoading}
            />
            <ActionRow
              icon="notifications-outline"
              label="Reminders & Notifications"
              color={colors.accent}
              onPress={() => router.push("/reminders")}
            />
            <ActionRow
              icon="shield-checkmark-outline"
              label="Privacy & Security"
              color={colors.warning}
              onPress={() =>
                Alert.alert("Privacy", "Your data is stored securely and never shared.")
              }
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

          {/* App version */}
          <Text style={[styles.version, { color: colors.mutedForeground }]}>
            RAIMZEAL v1.0.0
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
