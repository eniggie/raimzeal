import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import {
  DEFAULT_REMINDER_SETTINGS,
  REMINDER_META,
  ReminderSettings,
  loadReminderSettings,
  requestNotificationPermissions,
  saveReminderSettings,
  scheduleReminders,
  sendTestNotification,
} from "@/lib/notifications";

const REMINDER_ORDER: (keyof ReminderSettings)[] = [
  "morningFast",
  "morningWater",
  "breakfast",
  "lunch",
  "hydration",
  "preWorkout",
  "dinner",
  "fasting",
  "sleep",
];

export default function RemindersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [settings, setSettings] = useState<ReminderSettings>({
    ...DEFAULT_REMINDER_SETTINGS,
  });
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    loadReminderSettings().then(setSettings);
    if (Platform.OS !== "web") {
      import("expo-notifications").then((N) => {
        N.getPermissionsAsync().then(({ status }) =>
          setHasPermission(status === "granted")
        );
      });
    } else {
      setHasPermission(false);
    }
  }, []);

  useEffect(() => {
    const count = Object.values(settings).filter(Boolean).length;
    setActiveCount(count);
  }, [settings]);

  const handleToggle = useCallback(
    async (key: keyof ReminderSettings, value: boolean) => {
      if (value && !hasPermission) {
        const granted = await requestNotificationPermissions();
        setHasPermission(granted);
        if (!granted) {
          Alert.alert(
            "Notifications Disabled",
            "Please enable notifications for RAIMZEAL in your device Settings to receive Ovia AI reminders.",
            [{ text: "OK" }]
          );
          return;
        }
      }

      const next = { ...settings, [key]: value };
      setSettings(next);
      await saveReminderSettings(next);
      await scheduleReminders(next);
    },
    [settings, hasPermission]
  );

  const handleEnableAll = async () => {
    if (!hasPermission) {
      const granted = await requestNotificationPermissions();
      setHasPermission(granted);
      if (!granted) {
        Alert.alert(
          "Permission Needed",
          "Please enable notifications for RAIMZEAL in your device Settings.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    const next = Object.fromEntries(
      Object.keys(settings).map((k) => [k, true])
    ) as unknown as ReminderSettings;
    setSettings(next);
    setSaving(true);
    await saveReminderSettings(next);
    await scheduleReminders(next);
    setSaving(false);
  };

  const handleDisableAll = async () => {
    const next = Object.fromEntries(
      Object.keys(settings).map((k) => [k, false])
    ) as unknown as ReminderSettings;
    setSettings(next);
    await saveReminderSettings(next);
    await scheduleReminders(next);
  };

  const handleTest = async () => {
    if (!hasPermission) {
      const granted = await requestNotificationPermissions();
      setHasPermission(granted);
      if (!granted) return;
    }
    await sendTestNotification();
    Alert.alert(
      "Test Sent",
      "You will receive a test notification from Ovia AI in about 3 seconds.",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Ovia AI Reminders
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            {activeCount} of {REMINDER_ORDER.length} active
          </Text>
        </View>
        <TouchableOpacity onPress={handleTest} style={styles.testBtn}>
          <Text style={[styles.testBtnText, { color: colors.primary }]}>
            Test
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View
          style={[
            styles.heroBanner,
            { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" },
          ]}
        >
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + "25" }]}>
            <Ionicons name="notifications" size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>
              Daily Health Intelligence
            </Text>
            <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
              Ovia AI sends you science-backed, personalised reminders covering
              fasting, hydration, nutrition, training, and recovery — every
              single day.
            </Text>
          </View>
        </View>

        {/* Disclaimer */}
        <View
          style={[
            styles.disclaimer,
            { backgroundColor: colors.secondary + "12", borderColor: colors.secondary + "30" },
          ]}
        >
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.secondary}
            style={{ marginTop: 1 }}
          />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            All reminders represent Ovia AI's personal recommendations based on
            the latest health trends and research. Always follow your doctor's
            specific instructions, especially regarding fasting and medication.
          </Text>
        </View>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[
              styles.quickBtn,
              { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 },
            ]}
            onPress={handleEnableAll}
            disabled={saving}
          >
            <Text style={[styles.quickBtnText, { color: colors.primaryForeground }]}>
              Enable All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickBtn,
              { backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={handleDisableAll}
          >
            <Text style={[styles.quickBtnText, { color: colors.foreground }]}>
              Disable All
            </Text>
          </TouchableOpacity>
        </View>

        {/* Permission warning */}
        {hasPermission === false && Platform.OS !== "web" && (
          <View
            style={[
              styles.permWarning,
              { backgroundColor: colors.warning + "18", borderColor: colors.warning + "40" },
            ]}
          >
            <Ionicons name="warning-outline" size={16} color={colors.warning} />
            <Text style={[styles.permWarningText, { color: colors.mutedForeground }]}>
              Notification permission not granted. Toggle any reminder to request
              permission.
            </Text>
          </View>
        )}

        {/* Reminder rows */}
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          DAILY REMINDERS
        </Text>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {REMINDER_ORDER.map((key, idx) => {
            const meta = REMINDER_META[key];
            const isLast = idx === REMINDER_ORDER.length - 1;
            return (
              <View key={key}>
                <View style={styles.reminderRow}>
                  <View
                    style={[
                      styles.reminderIcon,
                      { backgroundColor: meta.color + "20" },
                    ]}
                  >
                    <Ionicons
                      name={meta.icon as keyof typeof Ionicons.glyphMap}
                      size={20}
                      color={meta.color}
                    />
                  </View>
                  <View style={styles.reminderInfo}>
                    <View style={styles.reminderTopRow}>
                      <Text
                        style={[styles.reminderLabel, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {meta.label}
                      </Text>
                      <Text
                        style={[styles.reminderTime, { color: colors.primary }]}
                      >
                        {meta.timeLabel}
                      </Text>
                    </View>
                    <Text
                      style={[styles.reminderDesc, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {meta.description}
                    </Text>
                  </View>
                  <Switch
                    value={settings[key]}
                    onValueChange={(v) => handleToggle(key, v)}
                    trackColor={{
                      false: colors.muted,
                      true: meta.color + "80",
                    }}
                    thumbColor={settings[key] ? meta.color : colors.mutedForeground}
                    ios_backgroundColor={colors.muted}
                  />
                </View>
                {!isLast && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                )}
              </View>
            );
          })}
        </View>

        {/* Fasting safety note */}
        <View
          style={[
            styles.fastingNote,
            { backgroundColor: colors.accent + "12", borderColor: colors.accent + "30" },
          ]}
        >
          <Ionicons name="heart-outline" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fastingNoteTitle, { color: colors.foreground }]}>
              Fasting Safety Notice
            </Text>
            <Text
              style={[styles.fastingNoteBody, { color: colors.mutedForeground }]}
            >
              The fasting reminders ("Fasting Morning Check-in" and "Fasting
              Window Reminder") are designed for intermittent fasting protocols.
              Always break your fast if you are taking medication that requires
              food, if you are diabetic, pregnant, or if your doctor has
              specifically instructed you to eat at a particular time. Your
              health comes before any fasting goal.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  testBtn: { padding: 8 },
  testBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 16 },
  heroBanner: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  heroBody: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  quickActions: { flexDirection: "row", gap: 10 },
  quickBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  permWarning: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  permWarningText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: -4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderInfo: { flex: 1, gap: 3 },
  reminderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reminderLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  reminderTime: { fontSize: 12, fontFamily: "Inter_500Medium" },
  reminderDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  divider: { height: 1, marginLeft: 66 },
  fastingNote: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  fastingNoteTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  fastingNoteBody: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
