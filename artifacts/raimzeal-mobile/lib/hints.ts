import AsyncStorage from "@react-native-async-storage/async-storage";

export const FILTER_HINT_STORAGE_KEY = "@nutrition_filter_hint_dismissed";
export const REORDER_HINT_STORAGE_KEY = "@nutrition_reorder_hint_dismissed";
export const HISTORY_FILTER_HINT_STORAGE_KEY =
  "@nutrition_history_filter_hint_dismissed";

const ALL_HINT_KEYS = [
  FILTER_HINT_STORAGE_KEY,
  REORDER_HINT_STORAGE_KEY,
  HISTORY_FILTER_HINT_STORAGE_KEY,
];

export async function resetAllHints(): Promise<void> {
  await AsyncStorage.multiRemove(ALL_HINT_KEYS);
}
