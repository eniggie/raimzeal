/**
 * RAIMZEAL Notification Service — Ovia AI daily reminders.
 *
 * Schedules recurring daily notifications covering: fasting, hydration,
 * nutrition, workouts, and sleep recovery.
 *
 * Every message carries the Ovia AI disclaimer and is science-backed.
 *
 * expo-notifications is loaded LAZILY (dynamic import) so that the module's
 * native side-effects (DevicePushTokenAutoRegistration / PushTokenManager)
 * do not run at app launch on iOS 26, where they trigger an uncatchable
 * NSException in the TurboModule void-return path (react-native#54859).
 */
import type * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert, Linking, Platform } from "react-native";

async function getNotifications() {
  return await import("expo-notifications");
}

/** Call once after the user has signed in — never at module load. */
export async function configureNotificationHandler() {
  if (Platform.OS === "web") return;
  const N = await getNotifications();
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

const STORAGE_KEY = "raimzeal_reminder_settings";

const DISCLAIMER =
  "\n\nOvia AI personal recommendation based on the latest health trends and research. Always consult your healthcare provider before making significant changes to your diet or lifestyle.";

export interface ReminderSettings {
  morningFast: boolean;
  morningWater: boolean;
  breakfast: boolean;
  lunch: boolean;
  hydration: boolean;
  preWorkout: boolean;
  dinner: boolean;
  fasting: boolean;
  sleep: boolean;
}

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  morningFast: false,
  morningWater: true,
  breakfast: true,
  lunch: true,
  hydration: true,
  preWorkout: false,
  dinner: true,
  fasting: false,
  sleep: true,
};

export interface ReminderMeta {
  label: string;
  timeLabel: string;
  description: string;
  icon: string;
  color: string;
}

export const REMINDER_META: Record<keyof ReminderSettings, ReminderMeta> = {
  morningFast: {
    label: "Fasting Morning Check-in",
    timeLabel: "5:00 AM",
    description:
      "A motivating check-in while you are fasted — helps you hold your fast and understand why it matters.",
    icon: "moon-outline",
    color: "#8B31C7",
  },
  morningWater: {
    label: "Warm Water Ritual",
    timeLabel: "6:30 AM",
    description:
      "The most powerful morning habit. Warm water on an empty stomach kickstarts digestion, flushes toxins, and activates metabolism.",
    icon: "water-outline",
    color: "#2E8B57",
  },
  breakfast: {
    label: "Protein-First Breakfast",
    timeLabel: "8:00 AM",
    description:
      "A reminder to eat a protein-rich breakfast that stabilises blood sugar and fuels muscle protein synthesis for the day.",
    icon: "sunny-outline",
    color: "#C9A84C",
  },
  lunch: {
    label: "Midday Nutrition",
    timeLabel: "12:30 PM",
    description:
      "Your midday macro check-in — stay on track with protein, complex carbs, and vegetables to power the afternoon.",
    icon: "restaurant-outline",
    color: "#2E8B57",
  },
  hydration: {
    label: "Hydration Alert",
    timeLabel: "2:00 PM",
    description:
      "Most people are dehydrated by afternoon. This reminder prevents the 3 PM energy crash and reduces false hunger.",
    icon: "water-outline",
    color: "#2E8B57",
  },
  preWorkout: {
    label: "Workout Reminder",
    timeLabel: "5:00 PM",
    description:
      "Late afternoon is peak performance time. This motivational push gets you into the gym at your body's strongest point.",
    icon: "barbell-outline",
    color: "#8B31C7",
  },
  dinner: {
    label: "Evening Meal Guidance",
    timeLabel: "7:00 PM",
    description:
      "Evening nutrition coaching — keep it lean, timed correctly to maximise overnight fat burning and sleep quality.",
    icon: "partly-sunny-outline",
    color: "#C9A84C",
  },
  fasting: {
    label: "Fasting Window Reminder",
    timeLabel: "9:00 PM",
    description:
      "A firm reminder that your fasting window is open. Only break it under direct medical instruction.",
    icon: "timer-outline",
    color: "#8B31C7",
  },
  sleep: {
    label: "Sleep & Recovery",
    timeLabel: "10:00 PM",
    description:
      "Wind-down guidance to protect sleep quality — the non-negotiable foundation of all physical and mental performance.",
    icon: "bed-outline",
    color: "#2E8B57",
  },
};

interface NotificationConfig {
  id: string;
  title: string;
  body: string;
  hour: number;
  minute: number;
}

const CONFIGS: Record<keyof ReminderSettings, NotificationConfig> = {
  morningFast: {
    id: "ovia_morning_fast",
    title: "🌙 You Are Fasting — Stay Strong",
    body:
      "You are in a fasted state right now. Your body is burning stored fat, reducing inflammation, and activating deep cellular repair through autophagy. Do not break your fast unless your physician has prescribed medication that must be taken with food, or a healthcare provider has specifically advised you to eat at this time. Your body is doing exactly what it needs to do. Trust the process." +
      DISCLAIMER,
    hour: 5,
    minute: 0,
  },
  morningWater: {
    id: "ovia_morning_water",
    title: "💧 Warm Water First — Before Anything Else",
    body:
      "Before coffee, before your phone, before anything — drink a full glass of warm water. Your body has been without water for 7 to 8 hours. Warm water on an empty stomach activates digestion, stimulates the lymphatic system, flushes toxins through the kidneys, rehydrates your cells, and boosts metabolism. Add lemon for alkalising benefits. This single habit, done consistently, changes your body." +
      DISCLAIMER,
    hour: 6,
    minute: 30,
  },
  breakfast: {
    id: "ovia_breakfast",
    title: "🍳 Protein-First Breakfast Time",
    body:
      "Fuel your morning with protein first. Aim for 30 to 40 grams within 60 minutes of waking — this stimulates muscle protein synthesis, stabilises blood glucose, reduces cortisol, and keeps cravings controlled all day. Eggs, Greek yoghurt, cottage cheese, smoked salmon, or a quality whey shake. Whatever fits your plan — make it protein-rich, make it intentional." +
      DISCLAIMER,
    hour: 8,
    minute: 0,
  },
  lunch: {
    id: "ovia_lunch",
    title: "🥗 Midday Nutrition Check-in",
    body:
      "Your midday meal is where consistency is built. Combine lean protein, complex carbohydrates, and colourful vegetables. Chicken and rice. Salmon and sweet potato. Lentils and quinoa. This meal sustains your energy through the afternoon, hits your macro targets, and keeps your metabolism running efficiently. Champions do not skip this." +
      DISCLAIMER,
    hour: 12,
    minute: 30,
  },
  hydration: {
    id: "ovia_hydration",
    title: "💧 Afternoon Hydration Alert",
    body:
      "Stop and drink 400 to 500ml of water right now. Studies show that 75% of people are chronically dehydrated by mid-afternoon. Dehydration reduces cognitive performance by up to 12%, creates false hunger signals that cause unnecessary eating, and significantly slows fat metabolism. Water is the most powerful, most underrated supplement you have. Drink it now." +
      DISCLAIMER,
    hour: 14,
    minute: 0,
  },
  preWorkout: {
    id: "ovia_pre_workout",
    title: "💪 Time to Train — Your Body is Ready",
    body:
      "Late afternoon is scientifically your peak performance window. Core body temperature is elevated, muscle strength is 10 to 20% higher than morning, reaction time is faster, and your body's natural energy is at its daily high. You do not need motivation — you need to move. 45 minutes of focused, intentional training will compound into the results you are working for. Get it done." +
      DISCLAIMER,
    hour: 17,
    minute: 0,
  },
  dinner: {
    id: "ovia_dinner",
    title: "🥩 Evening Meal — Lean and Timed Right",
    body:
      "Dinner time. Insulin sensitivity drops significantly in the evening, so minimise simple carbohydrates and starchy foods. Prioritise lean protein — chicken, fish, turkey, eggs, or legumes — with non-starchy vegetables and a small amount of healthy fat. Eating a few hours before sleep helps your body rest and recover overnight." +
      DISCLAIMER,
    hour: 19,
    minute: 0,
  },
  fasting: {
    id: "ovia_fasting",
    title: "🌙 Your Fasting Window is Now Open",
    body:
      "Your eating window is closed. This is the most powerful metabolic reset available to you. Over the next hours, your body will shift fully to fat oxidation, reduce systemic inflammation, clear damaged cells through autophagy, reset ghrelin and leptin balance, and restore insulin sensitivity. Do NOT eat anything now. The only exception is if your doctor has prescribed medication that specifically requires food. Your discipline tonight is tomorrow's transformation." +
      DISCLAIMER,
    hour: 21,
    minute: 0,
  },
  sleep: {
    id: "ovia_sleep",
    title: "😴 Recovery Time — This is Non-Negotiable",
    body:
      "Sleep is where the real work happens. During deep sleep your body recovers and repairs muscle worked during training, consolidates memory, and detoxifies the brain. Aim for 7 to 9 hours. Dim your lights now. Lower your room temperature to 18 to 20 degrees. Put the phone down. Your performance, your body composition, and your mental health tomorrow are all built tonight." +
      DISCLAIMER,
    hour: 22,
    minute: 0,
  },
};

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const N = await getNotifications();
  const { status: existing, canAskAgain } = await N.getPermissionsAsync();
  if (existing === "granted") return true;

  // Permanently denied — the OS won't show a prompt; send the user to Settings instead.
  if (!canAskAgain) {
    Linking.openSettings();
    return false;
  }

  // Show a rationale before the OS prompt to improve grant rates.
  const consented = await new Promise<boolean>((resolve) => {
    Alert.alert(
      "Enable Notifications",
      "RAIMZEAL sends daily health tips, workout reminders, hydration nudges, and sleep coaching from Ovia AI. You can turn these off any time in Settings.",
      [
        { text: "Not Now", style: "cancel", onPress: () => resolve(false) },
        { text: "Enable", onPress: () => resolve(true) },
      ]
    );
  });
  if (!consented) return false;

  const { status } = await N.requestPermissionsAsync();
  return status === "granted";
}

export async function loadReminderSettings(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_REMINDER_SETTINGS };
    return {
      ...DEFAULT_REMINDER_SETTINGS,
      ...(JSON.parse(raw) as Partial<ReminderSettings>),
    };
  } catch {
    return { ...DEFAULT_REMINDER_SETTINGS };
  }
}

export async function saveReminderSettings(
  settings: ReminderSettings
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export async function scheduleReminders(
  settings: ReminderSettings
): Promise<number> {
  if (Platform.OS === "web") return 0;
  const N = await getNotifications();
  await N.cancelAllScheduledNotificationsAsync();
  let count = 0;
  for (const [key, enabled] of Object.entries(settings) as [
    keyof ReminderSettings,
    boolean,
  ][]) {
    if (!enabled) continue;
    const config = CONFIGS[key];
    try {
      await N.scheduleNotificationAsync({
        identifier: config.id,
        content: {
          title: config.title,
          body: config.body,
          sound: true,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour: config.hour,
          minute: config.minute,
        } as Notifications.DailyTriggerInput,
      });
      count++;
    } catch {
      // Skip unsupported triggers
    }
  }

  // cancelAllScheduledNotificationsAsync() above also wiped the Smart Water
  // interval reminders (they aren't part of ReminderSettings/CONFIGS). Re-schedule
  // them here so enabling any daily reminder — or a cold start — never silently
  // stops the water reminders the user still has switched on.
  try {
    const waterConfig = await loadWaterReminderConfig();
    if (waterConfig.enabled) {
      count += await scheduleWaterIntervalReminders(waterConfig);
    }
  } catch {
    // Non-fatal — daily reminders were still scheduled above.
  }

  return count;
}

export async function sendTestNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  const N = await getNotifications();
  await N.scheduleNotificationAsync({
    content: {
      title: "✅ Ovia AI Reminders Active",
      body: "Your personalised daily reminders are set up and working. Ovia AI will guide you every day across nutrition, hydration, fasting, training, and recovery.",
      sound: true,
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      repeats: false,
    } as Notifications.TimeIntervalTriggerInput,
  });
}

export async function getActiveReminderCount(): Promise<number> {
  if (Platform.OS === "web") return 0;
  const N = await getNotifications();
  const scheduled = await N.getAllScheduledNotificationsAsync();
  return scheduled.filter((n) => n.identifier.startsWith("ovia_")).length;
}

// ─── Smart Water Reminders ────────────────────────────────────────────────────

const WATER_REMINDER_KEY = "raimzeal_water_reminder_config";
const WATER_NOTIF_PREFIX = "water_interval_";

export interface WaterReminderConfig {
  enabled: boolean;
  intervalHours: 1 | 2 | 3;
  startHour: number;
  endHour: number;
}

export const DEFAULT_WATER_REMINDER_CONFIG: WaterReminderConfig = {
  enabled: false,
  intervalHours: 2,
  startHour: 8,
  endHour: 20,
};

export async function loadWaterReminderConfig(): Promise<WaterReminderConfig> {
  try {
    const raw = await AsyncStorage.getItem(WATER_REMINDER_KEY);
    if (!raw) return { ...DEFAULT_WATER_REMINDER_CONFIG };
    return { ...DEFAULT_WATER_REMINDER_CONFIG, ...(JSON.parse(raw) as Partial<WaterReminderConfig>) };
  } catch {
    return { ...DEFAULT_WATER_REMINDER_CONFIG };
  }
}

export async function saveWaterReminderConfig(config: WaterReminderConfig): Promise<void> {
  await AsyncStorage.setItem(WATER_REMINDER_KEY, JSON.stringify(config));
}

const WATER_MESSAGES = [
  { title: "💧 Hydration Check", body: "Time to drink a glass of water. Staying hydrated keeps energy levels high and reduces false hunger." },
  { title: "💧 Water Break", body: "Sip some water now. Your muscles, brain, and metabolism all depend on consistent hydration throughout the day." },
  { title: "💧 Stay Hydrated", body: "Pause and drink a full glass of water. Consistent hydration is one of the simplest habits with the biggest returns." },
  { title: "💧 Drink Up", body: "Another hydration reminder. Most people are dehydrated by afternoon — you're staying ahead of the curve." },
  { title: "💧 Water First", body: "A glass of water before your next meal reduces calorie intake and improves digestion. Drink it now." },
];

export async function scheduleWaterIntervalReminders(config: WaterReminderConfig): Promise<number> {
  if (Platform.OS === "web") return 0;
  const N = await getNotifications();

  // Cancel existing water reminders first
  const all = await N.getAllScheduledNotificationsAsync();
  for (const n of all) {
    if (n.identifier.startsWith(WATER_NOTIF_PREFIX)) {
      await N.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  if (!config.enabled) return 0;

  let count = 0;
  let msgIdx = 0;
  for (let hour = config.startHour; hour <= config.endHour; hour += config.intervalHours) {
    const msg = WATER_MESSAGES[msgIdx % WATER_MESSAGES.length];
    msgIdx++;
    try {
      await N.scheduleNotificationAsync({
        identifier: `${WATER_NOTIF_PREFIX}${hour}`,
        content: { title: msg.title, body: msg.body, sound: true },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        } as Notifications.DailyTriggerInput,
      });
      count++;
    } catch {
      // skip
    }
  }
  return count;
}
