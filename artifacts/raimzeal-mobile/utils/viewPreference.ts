import AsyncStorage from "@react-native-async-storage/async-storage";

export const LAST_USED_VIEW_KEY = "@nutrition_last_used_view_v2";

export async function saveViewPreference(barcode: string, per100g: boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USED_VIEW_KEY);
    let viewMap: Record<string, boolean> = {};
    try { viewMap = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
    viewMap[barcode] = per100g;
    await AsyncStorage.setItem(LAST_USED_VIEW_KEY, JSON.stringify(viewMap));
  } catch {
    // Non-fatal
  }
}

export async function removeViewPreference(barcode: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USED_VIEW_KEY);
    let viewMap: Record<string, boolean> = {};
    try { viewMap = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
    delete viewMap[barcode];
    await AsyncStorage.setItem(LAST_USED_VIEW_KEY, JSON.stringify(viewMap));
  } catch {
    // Non-fatal
  }
}

export async function loadViewPreferenceMap(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USED_VIEW_KEY);
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
  } catch {
    return {};
  }
}
