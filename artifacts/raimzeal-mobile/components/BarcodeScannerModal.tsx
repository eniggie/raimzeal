import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Animated,
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScanEditSheet } from "@/components/ScanEditSheet";
import { usePer100gDefault } from "@/hooks/usePer100gDefault";
import {
  saveViewPreference,
  removeViewPreference,
  loadViewPreferenceMap,
} from "@/utils/viewPreference";

const CACHE_PREFIX = "barcode_cache_v1:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CORRECTIONS_PREFIX = "barcode_correction_v1:";

const RECENT_SCANS_KEY = "barcode_recent_scans_v1";
const RECENT_LAST_VIEWED_KEY = "barcode_recent_last_viewed_v1";
const MAX_RECENT_SCANS = 20;

export async function getRecentLastViewed(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_LAST_VIEWED_KEY);
    if (!raw) return 0;
    const ts = parseInt(raw, 10);
    return isNaN(ts) ? 0 : ts;
  } catch {
    return 0;
  }
}

export async function setRecentLastViewed(): Promise<void> {
  try {
    await AsyncStorage.setItem(RECENT_LAST_VIEWED_KEY, String(Date.now()));
  } catch {
    // Non-fatal
  }
}

export interface RecentScan {
  barcode: string;
  food: ScannedFood;
  scannedAt: number;
  scanCount: number;
}

interface CacheEntry {
  food: ScannedFood;
  cachedAt: number;
}

export async function getRecentScans(): Promise<RecentScan[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentScan[];
  } catch {
    return [];
  }
}

export async function removeRecentScan(barcode: string): Promise<void> {
  try {
    const scans = await getRecentScans();
    const next = scans.filter((s) => s.barcode !== barcode);
    await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal
  }
}

export async function clearAllRecentScans(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RECENT_SCANS_KEY);
  } catch {
    // Non-fatal
  }
}

export async function updateRecentScan(barcode: string, food: ScannedFood): Promise<void> {
  try {
    const scans = await getRecentScans();
    const next = scans.map((s) =>
      s.barcode === barcode ? { ...s, food } : s
    );
    await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(next));
    await setCachedBarcode(barcode, food);
  } catch {
    // Non-fatal
  }
}

async function addToRecentScans(barcode: string, food: ScannedFood): Promise<void> {
  try {
    const scans = await getRecentScans();
    const existing = scans.find((s) => s.barcode === barcode);
    const filtered = scans.filter((s) => s.barcode !== barcode);
    const entry: RecentScan = {
      barcode,
      food,
      scannedAt: Date.now(),
      scanCount: (existing?.scanCount ?? 0) + 1,
    };
    const next = [entry, ...filtered].slice(0, MAX_RECENT_SCANS);
    await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal
  }
}

async function getCachedBarcode(barcode: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + barcode);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(CACHE_PREFIX + barcode);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

async function setCachedBarcode(barcode: string, food: ScannedFood): Promise<void> {
  try {
    const entry: CacheEntry = { food, cachedAt: Date.now() };
    await AsyncStorage.setItem(CACHE_PREFIX + barcode, JSON.stringify(entry));
  } catch {
    // Non-fatal: cache write failure is ignored
  }
}

async function getCorrection(barcode: string): Promise<ScannedFood | null> {
  try {
    const raw = await AsyncStorage.getItem(CORRECTIONS_PREFIX + barcode);
    if (!raw) return null;
    return JSON.parse(raw) as ScannedFood;
  } catch {
    return null;
  }
}

async function saveCorrection(barcode: string, food: ScannedFood): Promise<void> {
  try {
    await AsyncStorage.setItem(CORRECTIONS_PREFIX + barcode, JSON.stringify(food));
  } catch {}
}

async function clearCorrection(barcode: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CORRECTIONS_PREFIX + barcode);
  } catch {}
}

export interface ScannedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingLabel?: string;
  nutrients100g?: { calories: number; protein: number; carbs: number; fat: number };
  unit?: "g" | "ml";
  servingDescription?: string;
}

interface OpenFoodFactsProduct {
  product_name?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal_serving"?: number;
    "energy-kcal"?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    proteins?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    carbohydrates?: number;
    fat_100g?: number;
    fat_serving?: number;
    fat?: number;
  };
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

async function fetchFromNetwork(barcode: string): Promise<ScannedFood | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let res: Response;
    try {
      // v2 API: faster response with targeted field selection, better data quality
      res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,serving_size,serving_quantity,nutriments`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "RAIMZEAL/1.0 (contact@raimzeal.app)",
          },
        }
      );
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return null;
    const data: OpenFoodFactsResponse = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const n = p.nutriments ?? {};
    const name = p.product_name?.trim();
    if (!name) return null;

    const servingSize = p.serving_size?.trim();
    const hasAnyServingNutrient =
      n["energy-kcal_serving"] !== undefined ||
      n.proteins_serving !== undefined ||
      n.carbohydrates_serving !== undefined ||
      n.fat_serving !== undefined;
    const useServingNutrients = !!(servingSize && hasAnyServingNutrient);
    const useServingQuantity = !!(servingSize && p.serving_quantity && !hasAnyServingNutrient);
    const servingLabel = useServingNutrients || useServingQuantity ? servingSize : undefined;
    const sqFactor = p.serving_quantity ? p.serving_quantity / 100 : 1;

    const calories = useServingNutrients
      ? Math.round(n["energy-kcal_serving"] ?? n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0)
      : useServingQuantity
      ? Math.round((n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0) * sqFactor)
      : Math.round(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0);
    const protein = useServingNutrients
      ? Math.round((n.proteins_serving ?? n.proteins_100g ?? n.proteins ?? 0) * 10) / 10
      : useServingQuantity
      ? Math.round((n.proteins_100g ?? n.proteins ?? 0) * sqFactor * 10) / 10
      : Math.round((n.proteins_100g ?? n.proteins ?? 0) * 10) / 10;
    const carbs = useServingNutrients
      ? Math.round((n.carbohydrates_serving ?? n.carbohydrates_100g ?? n.carbohydrates ?? 0) * 10) / 10
      : useServingQuantity
      ? Math.round((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * sqFactor * 10) / 10
      : Math.round((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * 10) / 10;
    const fat = useServingNutrients
      ? Math.round((n.fat_serving ?? n.fat_100g ?? n.fat ?? 0) * 10) / 10
      : useServingQuantity
      ? Math.round((n.fat_100g ?? n.fat ?? 0) * sqFactor * 10) / 10
      : Math.round((n.fat_100g ?? n.fat ?? 0) * 10) / 10;

    const has100g =
      n["energy-kcal_100g"] !== undefined ||
      n.proteins_100g !== undefined ||
      n.carbohydrates_100g !== undefined ||
      n.fat_100g !== undefined;
    const nutrients100g =
      (useServingNutrients || useServingQuantity) && has100g
        ? {
            calories: Math.round(n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0),
            protein: Math.round((n.proteins_100g ?? n.proteins ?? 0) * 10) / 10,
            carbs: Math.round((n.carbohydrates_100g ?? n.carbohydrates ?? 0) * 10) / 10,
            fat: Math.round((n.fat_100g ?? n.fat ?? 0) * 10) / 10,
          }
        : undefined;

    const unit: "g" | "ml" = /\bml\b/i.test(servingSize ?? "") ? "ml" : "g";

    return { name, calories, protein, carbs, fat, servingLabel, nutrients100g, unit };
  } catch {
    return null;
  }
}

interface FetchResult {
  food: ScannedFood;
  fromCache: boolean;
  fromCorrection?: boolean;
  cachedAt?: number;
}

async function fetchFoodByBarcode(barcode: string): Promise<FetchResult | null> {
  const [correction, cached] = await Promise.all([
    getCorrection(barcode),
    getCachedBarcode(barcode),
  ]);
  if (cached) {
    const food = correction ?? cached.food;
    await addToRecentScans(barcode, food);
    return { food, fromCache: true, fromCorrection: !!correction, cachedAt: cached.cachedAt };
  }

  const networkFood = await fetchFromNetwork(barcode);
  if (!networkFood) return null;

  await setCachedBarcode(barcode, networkFood);
  const food = correction ?? networkFood;
  await addToRecentScans(barcode, food);
  return { food, fromCache: false, fromCorrection: !!correction };
}

function formatCacheAge(cachedAt: number): string {
  const diffMs = Date.now() - cachedAt;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Saved just now";
  if (diffMins < 60) return `Saved ${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `Saved ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays === 1) return "Saved yesterday";
  return `Saved ${diffDays} days ago`;
}

function formatScannedDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: ScannedFood, per100g?: boolean) => void;
  onManualEntry: () => void;
}

type ActiveTab = "scan" | "recent";
type SortOrder = "recent" | "most-used";
type MacroFilter = "under200cal" | "highProtein" | "lowFat" | "lowCarb";

const MACRO_FILTERS: { id: MacroFilter; label: string; test: (food: ScannedFood) => boolean }[] = [
  { id: "under200cal", label: "Under 200 kcal", test: (f) => f.calories < 200 },
  { id: "highProtein",  label: "High Protein",   test: (f) => f.protein >= 15 },
  { id: "lowFat",       label: "Low Fat",         test: (f) => f.fat <= 5 },
  { id: "lowCarb",      label: "Low Carb",        test: (f) => f.carbs <= 10 },
];

export function BarcodeScannerModal({ visible, onClose, onFoodFound, onManualEntry }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [defaultPer100g] = usePer100gDefault();
  // useRef lock — immune to stale closures and React Compiler optimisations.
  // State-based guards (scanning/loading) had a race window where the closure
  // captured old values, allowing multiple concurrent network calls.
  const scanLock = useRef(false);
  // Ref-based tab tracker — immune to stale closures inside handleBarcodeScanned.
  // We always pass a function to CameraView so the native ML Kit scanner is never
  // torn down and re-created when the user switches between Scan / Recent tabs.
  // (expo-camera 17.x on Android can silently fail to re-enable scanning when
  // onBarcodeScanned transitions from undefined → function.)
  const activeTabRef = useRef<ActiveTab>("scan");
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedResult, setCachedResult] = useState<{ food: ScannedFood; barcode: string; cachedAt: number; fromCorrection?: boolean } | null>(null);
  const [servingMultiplier, setServingMultiplier] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("scan");
  // Keep the ref in sync so handleBarcodeScanned always sees the current tab
  // without needing activeTab in its dependency array (which would create a
  // new function reference on every tab change and risk re-triggering the
  // native scanner setup).
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [per100gScans, setPer100gScans] = useState<Set<string>>(new Set());
  const [resultPer100g, setResultPer100g] = useState(false);
  const [editTarget, setEditTarget] = useState<RecentScan | null>(null);
  const [notFoundBannerVisible, setNotFoundBannerVisible] = useState(false);
  const notFoundOpacity = useRef(new Animated.Value(0)).current;
  const [searchQuery, setSearchQuery] = useState("");
  const [hasNewScans, setHasNewScans] = useState(false);
  const recentTabPulse = useRef(new Animated.Value(1)).current;
  // Increments on every successful cached scan so the animation fires for
  // each scan — not just the first — even when hasNewScans is already true.
  const [newScanTrigger, setNewScanTrigger] = useState(0);
  const [activeFilter, setActiveFilter] = useState<MacroFilter | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [correctedBarcodes, setCorrectedBarcodes] = useState<Set<string>>(new Set());
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (newScanTrigger === 0) return;
    recentTabPulse.stopAnimation();
    recentTabPulse.setValue(1);
    Animated.sequence([
      Animated.timing(recentTabPulse, { toValue: 1.18, duration: 160, useNativeDriver: true }),
      Animated.timing(recentTabPulse, { toValue: 0.94, duration: 110, useNativeDriver: true }),
      Animated.timing(recentTabPulse, { toValue: 1.08, duration: 90,  useNativeDriver: true }),
      Animated.timing(recentTabPulse, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start();
  }, [newScanTrigger, recentTabPulse]);

  const showNotFoundBanner = useCallback(() => {
    notFoundOpacity.stopAnimation();
    setNotFoundBannerVisible(true);
    Animated.timing(notFoundOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [notFoundOpacity]);

  const hideNotFoundBanner = useCallback(() => {
    notFoundOpacity.stopAnimation();
    Animated.timing(notFoundOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setNotFoundBannerVisible(false);
    });
  }, [notFoundOpacity]);

  const loadRecentScans = useCallback(async (markViewed = false) => {
    setRecentLoading(true);
    const [data, lastViewed, viewMap] = await Promise.all([
      getRecentScans(),
      getRecentLastViewed(),
      loadViewPreferenceMap(),
    ]);
    setRecentScans(data);

    const restoredPer100g = new Set<string>();
    for (const scan of data) {
      const canToggle = !!(scan.food.servingLabel && scan.food.nutrients100g);
      if (!canToggle) continue;
      const saved = viewMap[scan.barcode];
      const showPer100g = saved !== undefined ? saved : defaultPer100g;
      if (showPer100g) restoredPer100g.add(scan.barcode);
    }
    setPer100gScans(restoredPer100g);

    const correctionChecks = await Promise.all(
      data.map((s) => getCorrection(s.barcode).then((c) => (c ? s.barcode : null)))
    );
    setCorrectedBarcodes(new Set<string>(correctionChecks.filter((b): b is string => b !== null)));

    if (markViewed) {
      await setRecentLastViewed();
      setHasNewScans(false);
    } else {
      const newest = data[0]?.scannedAt ?? 0;
      setHasNewScans(newest > lastViewed);
    }
    setRecentLoading(false);
  }, [defaultPer100g]);

  // Reset scanner state every time the modal opens so it's always ready
  useEffect(() => {
    if (visible) {
      scanLock.current = false;
      setScanning(true);
      setLoading(false);
      setError(null);
      setCachedResult(null);
      setRefreshing(false);
      setRefreshFailed(false);
      setActiveTab("scan");
      notFoundOpacity.setValue(0);
      setNotFoundBannerVisible(false);
      setSearchQuery("");
      setActiveFilter(null);
      setHasNewScans(false);
      setNewScanTrigger(0);
      setPer100gScans(new Set());
      setCorrectedBarcodes(new Set());
      loadRecentScans();
    }
  }, [visible, loadRecentScans]);

  // Reload recent scans when switching to the Recent tab
  useEffect(() => {
    if (activeTab === "recent") {
      loadRecentScans(true);
    }
  }, [activeTab, loadRecentScans]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      // Guard: only process while on the Scan tab. Use the ref (not the state
      // closure) so this check is always current even when the callback was
      // memoised before the tab switched.
      if (activeTabRef.current !== "scan") return;
      // Use a ref-based lock so this guard is never stale, even when React
      // Compiler memoises the callback or the component re-renders rapidly.
      if (scanLock.current) return;
      scanLock.current = true;

      setScanning(false);
      setLoading(true);
      setError(null);
      hideNotFoundBanner();

      const result = await fetchFoodByBarcode(data);
      setLoading(false);

      if (result) {
        if (result.fromCache) {
          setCachedResult({ food: result.food, barcode: data, cachedAt: result.cachedAt ?? Date.now(), fromCorrection: result.fromCorrection });
          setHasNewScans(true);
          setNewScanTrigger((c) => c + 1);
          loadRecentScans();
        } else {
          onFoodFound(result.food);
          onClose();
        }
      } else {
        showNotFoundBanner();
        setActiveTab("recent");
        loadRecentScans();
      }
      // Lock is intentionally NOT released here — the user must tap
      // "Scan Again" / switch tabs to re-arm the scanner.
    },
    [scanLock, onFoodFound, onClose, loadRecentScans, showNotFoundBanner, hideNotFoundBanner]
  );

  async function handleRefresh() {
    if (!cachedResult) return;
    setRefreshing(true);
    setRefreshFailed(false);
    const food = await fetchFromNetwork(cachedResult.barcode);
    setRefreshing(false);
    if (food) {
      await setCachedBarcode(cachedResult.barcode, food);
      onFoodFound(food);
      onClose();
    } else {
      setRefreshFailed(true);
    }
  }

  // Reset multiplier whenever a new scan result arrives
  useEffect(() => {
    setServingMultiplier(1);
  }, [cachedResult]);

  function scaledFood(food: ScannedFood, multiplier: number): ScannedFood {
    return {
      ...food,
      calories: Math.round(food.calories * multiplier),
      protein: Math.round(food.protein * multiplier * 10) / 10,
      carbs: Math.round(food.carbs * multiplier * 10) / 10,
      fat: Math.round(food.fat * multiplier * 10) / 10,
    };
  }

  // Clear the auto-close timer on unmount to prevent state updates after removal
  useEffect(() => {
    return () => {
      if (autoCloseTimer.current) {
        clearTimeout(autoCloseTimer.current);
        autoCloseTimer.current = null;
      }
    };
  }, []);

  // Reset success banner whenever a new scan result appears
  useEffect(() => {
    setAddedSuccess(false);
    if (autoCloseTimer.current) {
      clearTimeout(autoCloseTimer.current);
      autoCloseTimer.current = null;
    }
  }, [cachedResult]);

  // Restore the last-used serving/100g view preference for the scanned product
  useEffect(() => {
    if (!cachedResult) {
      setResultPer100g(false);
      return;
    }
    loadViewPreferenceMap().then((map) => {
      const saved = map[cachedResult.barcode];
      setResultPer100g(saved !== undefined ? saved : defaultPer100g);
    });
  }, [cachedResult, defaultPer100g]);

  function handleResultTogglePer100g() {
    if (!cachedResult) return;
    const newVal = !resultPer100g;
    setResultPer100g(newVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    saveViewPreference(cachedResult.barcode, newVal);
  }

  function handleUseCached() {
    if (!cachedResult) return;
    const canToggle = !!(cachedResult.food.nutrients100g && cachedResult.food.servingLabel);
    const baseFood = (canToggle && resultPer100g)
      ? { ...cachedResult.food, ...cachedResult.food.nutrients100g! }
      : cachedResult.food;
    onFoodFound(scaledFood(baseFood, servingMultiplier), canToggle && resultPer100g);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAddedSuccess(true);
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => {
      autoCloseTimer.current = null;
      handleClose();
    }, 1500);
  }

  function handleAddAgain() {
    if (!cachedResult) return;
    const canToggle = !!(cachedResult.food.nutrients100g && cachedResult.food.servingLabel);
    const baseFood = (canToggle && resultPer100g)
      ? { ...cachedResult.food, ...cachedResult.food.nutrients100g! }
      : cachedResult.food;
    onFoodFound(scaledFood(baseFood, servingMultiplier), canToggle && resultPer100g);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    autoCloseTimer.current = setTimeout(() => {
      autoCloseTimer.current = null;
      handleClose();
    }, 1500);
  }

  function handleStepMultiplier(delta: number) {
    setServingMultiplier((prev) => {
      const next = Math.round((prev + delta) * 10) / 10;
      if (next < 0.5) return prev;
      if (next > 10) return prev;
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleRetry() {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    setAddedSuccess(false);
    scanLock.current = false;
    setError(null);
    setCachedResult(null);
    setRefreshFailed(false);
    setScanning(true);
    setActiveTab("scan");
  }

  function handleClose() {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    setAddedSuccess(false);
    scanLock.current = false;
    setScanning(true);
    setLoading(false);
    setError(null);
    setCachedResult(null);
    setRefreshing(false);
    setRefreshFailed(false);
    onClose();
  }

  function handleManualEntry() {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    setAddedSuccess(false);
    scanLock.current = false;
    setScanning(true);
    setLoading(false);
    setError(null);
    setCachedResult(null);
    setRefreshing(false);
    setRefreshFailed(false);
    onClose();
    onManualEntry();
  }

  function handleSelectRecent(scan: RecentScan) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const showing100g = per100gScans.has(scan.barcode);
    const canToggle = !!(scan.food.servingLabel && scan.food.nutrients100g);
    if (canToggle && showing100g && scan.food.nutrients100g) {
      onFoodFound({
        ...scan.food,
        calories: scan.food.nutrients100g.calories,
        protein: scan.food.nutrients100g.protein,
        carbs: scan.food.nutrients100g.carbs,
        fat: scan.food.nutrients100g.fat,
      }, true);
    } else {
      onFoodFound(scan.food, canToggle ? false : undefined);
    }
    handleClose();
  }

  async function handleRemoveRecent(barcode: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeRecentScan(barcode);
    await removeViewPreference(barcode);
    await clearCorrection(barcode);
    setRecentScans((prev) => prev.filter((s) => s.barcode !== barcode));
    setPer100gScans((prev) => {
      const next = new Set(prev);
      next.delete(barcode);
      return next;
    });
    setCorrectedBarcodes((prev) => {
      const next = new Set(prev);
      next.delete(barcode);
      return next;
    });
  }

  function handleTogglePer100g(barcode: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nowPer100g = !per100gScans.has(barcode);
    setPer100gScans((prev) => {
      const next = new Set(prev);
      if (nowPer100g) next.add(barcode);
      else next.delete(barcode);
      return next;
    });
    saveViewPreference(barcode, nowPer100g);
  }

  function handleLongPressRecent(scan: RecentScan) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditTarget(scan);
  }

  async function handleSaveEdit(updated: ScannedFood) {
    if (!editTarget) return;
    await saveCorrection(editTarget.barcode, updated);
    setCorrectedBarcodes((prev) => { const n = new Set(prev); n.add(editTarget.barcode); return n; });
    await updateRecentScan(editTarget.barcode, updated);
    setRecentScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    setCachedResult((prev) =>
      prev && prev.barcode === editTarget.barcode ? { ...prev, food: updated, fromCorrection: true } : prev
    );
    setEditTarget(null);
  }

  async function handleSaveAndAdd(updated: ScannedFood) {
    if (!editTarget) return;
    await saveCorrection(editTarget.barcode, updated);
    setCorrectedBarcodes((prev) => { const n = new Set(prev); n.add(editTarget.barcode); return n; });
    await updateRecentScan(editTarget.barcode, updated);
    setRecentScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    setCachedResult((prev) =>
      prev && prev.barcode === editTarget.barcode ? { ...prev, food: updated, fromCorrection: true } : prev
    );
    onFoodFound(updated);
  }

  function handleSwitchTab(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === "scan") {
      scanLock.current = false;
      setScanning(true);
      setError(null);
      setCachedResult(null);
      hideNotFoundBanner();
      setSearchQuery("");
      setActiveFilter(null);
    }
  }

  const filterDef = activeFilter ? MACRO_FILTERS.find((f) => f.id === activeFilter) : null;
  const filteredScans = recentScans.filter((s) => {
    if (searchQuery.trim() && !s.food.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterDef && !filterDef.test(s.food)) return false;
    return true;
  });
  const sortedScans =
    sortOrder === "most-used"
      ? [...filteredScans].sort((a, b) => (b.scanCount ?? 0) - (a.scanCount ?? 0))
      : filteredScans;

  if (Platform.OS === "web") {
    return (
      <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
        <View style={styles.overlayCenter}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.webUnsupported}>
              <Ionicons name="camera-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.webTitle, { color: colors.foreground }]}>
                Camera not available on web
              </Text>
              <Text style={[styles.webSubtitle, { color: colors.mutedForeground }]}>
                Use the mobile app to scan barcodes.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleManualEntry}
              style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.closeBtnText, { color: colors.primaryForeground }]}>
                Enter Manually
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.cancelLink}>
              <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.fullscreen, { backgroundColor: "#000" }]}>
        {/* Permission not yet loaded */}
        {!permission && (
          <View style={styles.centeredContent}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        )}

        {/* Permission denied */}
        {permission && !permission.granted && (
          <View style={[styles.centeredContent, { backgroundColor: colors.background }]}>
            <Ionicons
              name={permission.canAskAgain ? "camera-outline" : "alert-circle-outline"}
              size={56}
              color={permission.canAskAgain ? colors.mutedForeground : colors.warning}
            />
            <Text style={[styles.permTitle, { color: colors.foreground }]}>
              {permission.canAskAgain ? "Camera access needed" : "Camera blocked"}
            </Text>
            <Text style={[styles.permSubtitle, { color: colors.mutedForeground }]}>
              {permission.canAskAgain
                ? "Allow camera access to scan food barcodes instantly."
                : "RAIMZEAL can\u2019t open the camera. Enable Camera access in your device Settings to scan barcodes."}
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity
                onPress={requestPermission}
                style={[styles.permBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>
                  Grant Access
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.permWarningCard, { backgroundColor: colors.warning + "22", borderColor: colors.warning + "55" }]}>
                <Ionicons name="information-circle-outline" size={20} color={colors.warning} />
                <Text style={[styles.permWarningText, { color: colors.warning }]}>
                  Camera access was permanently denied. Tap below to open Settings and re-enable it.
                </Text>
                <TouchableOpacity
                  onPress={() => { Linking.openSettings().catch(() => {}); }}
                  style={[styles.permBtn, { backgroundColor: colors.warning, marginTop: 0, width: "100%" }]}
                >
                  <Text style={[styles.permBtnText, { color: "#0D0D0D" }]}>
                    Open Settings
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={handleManualEntry} style={[styles.permBtn, { backgroundColor: colors.muted, marginTop: 0 }]}>
              <Text style={[styles.permBtnText, { color: colors.foreground }]}>
                Enter Food Manually
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClose} style={styles.cancelLink}>
              <Text style={[styles.cancelLinkText, { color: colors.mutedForeground }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Camera + scanning UI */}
        {permission && permission.granted && (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: [
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "qr",
                  "code128",
                  "code39",
                  "code93",
                  "itf14",
                  "codabar",
                  "pdf417",
                  "aztec",
                  "datamatrix",
                ],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />

            {/* Overlay */}
            <View style={[styles.overlay, { pointerEvents: "box-none" }]}>
              {/* Top bar */}
              <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity onPress={handleClose} style={styles.closeIcon}>
                  <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.topBarTitle}>
                  {activeTab === "scan" ? "Scan Barcode" : "Recent"}
                </Text>
                <View style={{ width: 44 }} />
              </View>

              {/* Tab switcher */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  onPress={() => handleSwitchTab("scan")}
                  style={[styles.tab, activeTab === "scan" && styles.tabActive]}
                >
                  <Ionicons
                    name="barcode-outline"
                    size={15}
                    color={activeTab === "scan" ? "#09090b" : "rgba(255,255,255,0.7)"}
                  />
                  <Text style={[styles.tabText, activeTab === "scan" && styles.tabTextActive]}>
                    Scan
                  </Text>
                </TouchableOpacity>
                <Animated.View style={{ transform: [{ scale: recentTabPulse }] }}>
                  <TouchableOpacity
                    onPress={() => handleSwitchTab("recent")}
                    style={[styles.tab, activeTab === "recent" && styles.tabActive]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={15}
                      color={activeTab === "recent" ? "#09090b" : "rgba(255,255,255,0.7)"}
                    />
                    <Text style={[styles.tabText, activeTab === "recent" && styles.tabTextActive]}>
                      {recentScans.length > 0 ? `Recent · ${recentScans.length}` : "Recent"}
                    </Text>
                    {hasNewScans && activeTab !== "recent" && (
                      <View style={styles.newScanDot} />
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </View>

              {/* Scan tab content */}
              {activeTab === "scan" && (
                <>
                  {/* Scan frame */}
                  <View style={[styles.scanFrameWrapper, { pointerEvents: "none" }]}>
                    <View style={styles.scanFrame}>
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />
                    </View>
                    <Text style={styles.scanHint}>
                      Point at a food product barcode
                    </Text>
                  </View>

                  {/* Bottom status */}
                  <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
                    {loading && (
                      <View style={styles.statusPill}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.statusText}>Looking up product…</Text>
                      </View>
                    )}
                    {!loading && !error && !cachedResult && scanning && (
                      <View style={styles.statusPill}>
                        <View style={styles.scanDot} />
                        <Text style={styles.statusText}>Ready to scan</Text>
                      </View>
                    )}
                    {error && (
                      <View style={styles.errorCard}>
                        <Ionicons name="barcode-outline" size={20} color="#f87171" />
                        <Text style={styles.errorText}>{error}</Text>
                        <View style={styles.errorActions}>
                          <TouchableOpacity onPress={handleRetry} style={styles.retryBtn}>
                            <Text style={styles.retryText}>Scan Again</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleManualEntry} style={styles.manualBtn}>
                            <Text style={styles.manualText}>Enter Manually</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {cachedResult && (
                      <View style={styles.resultCard}>
                        <View style={styles.resultHeader}>
                          <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
                          <Text style={styles.resultName} numberOfLines={1}>
                            {cachedResult.food.name}
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setEditTarget({ barcode: cachedResult.barcode, food: cachedResult.food, scannedAt: cachedResult.cachedAt, scanCount: 0 });
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.resultEditBtn}
                          >
                            <Ionicons name="pencil-outline" size={15} color="rgba(255,255,255,0.6)" />
                          </TouchableOpacity>
                        </View>
                        {(() => {
                          const canResultToggle = !!(cachedResult.food.nutrients100g && cachedResult.food.servingLabel);
                          const showPer100g = canResultToggle && resultPer100g;
                          const baseFood = showPer100g ? { ...cachedResult.food, ...cachedResult.food.nutrients100g! } : cachedResult.food;
                          const s = scaledFood(baseFood, servingMultiplier);
                          return (
                            <>
                              <Text style={styles.resultMacros}>
                                {s.calories} cal · {s.protein}g P · {s.carbs}g C · {s.fat}g F
                              </Text>
                              {canResultToggle ? (
                                <TouchableOpacity
                                  onPress={handleResultTogglePer100g}
                                  style={styles.resultViewPill}
                                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                  activeOpacity={0.7}
                                >
                                  <Text style={styles.resultViewPillText}>
                                    {resultPer100g ? "per 100g" : "per serving"}
                                  </Text>
                                  <Ionicons name="swap-horizontal" size={10} color="rgba(255,255,255,0.5)" style={{ marginLeft: 3 }} />
                                </TouchableOpacity>
                              ) : null}
                              {!showPer100g && cachedResult.food.servingLabel ? (
                                <Text style={styles.resultServingNote} numberOfLines={1}>
                                  1 serving = {cachedResult.food.servingLabel}
                                </Text>
                              ) : null}
                            </>
                          );
                        })()}
                        <View style={styles.servingStepperRow}>
                          <Text style={styles.servingStepperLabel}>Servings</Text>
                          <View style={styles.servingStepper}>
                            <TouchableOpacity
                              onPress={() => handleStepMultiplier(-0.5)}
                              style={[styles.stepperBtn, servingMultiplier <= 0.5 && styles.stepperBtnDisabled]}
                              disabled={servingMultiplier <= 0.5}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="remove" size={16} color="#fff" />
                            </TouchableOpacity>
                            <Text style={styles.stepperValue}>
                              {servingMultiplier}×
                            </Text>
                            <TouchableOpacity
                              onPress={() => handleStepMultiplier(0.5)}
                              style={[styles.stepperBtn, servingMultiplier >= 10 && styles.stepperBtnDisabled]}
                              disabled={servingMultiplier >= 10}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <Ionicons name="add" size={16} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.cacheAgeRow}>
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.45)" />
                          <Text style={styles.cacheAgeText}>
                            {formatCacheAge(cachedResult.cachedAt)}
                          </Text>
                        </View>
                        {cachedResult.fromCorrection && (
                          <View style={styles.correctionRow}>
                            <Ionicons name="create-outline" size={12} color="rgba(163,230,53,0.85)" />
                            <Text style={styles.correctionText}>Your corrections applied</Text>
                          </View>
                        )}
                        {refreshFailed && (
                          <View style={styles.refreshFailedRow}>
                            <Ionicons name="cloud-offline-outline" size={13} color="#f87171" />
                            <Text style={styles.refreshFailedText}>
                              Couldn't refresh — showing saved data
                            </Text>
                          </View>
                        )}
                        <View style={styles.resultActions}>
                          {addedSuccess ? (
                            <>
                              <View style={styles.addedConfirm}>
                                <Ionicons name="checkmark-circle" size={17} color="#a3e635" />
                                <Text style={styles.addedConfirmText}>Added!</Text>
                              </View>
                              <TouchableOpacity
                                onPress={handleAddAgain}
                                style={styles.addAgainBtn}
                              >
                                <Ionicons name="add" size={14} color="#09090b" />
                                <Text style={styles.addAgainBtnText}>Add again</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <>
                              <TouchableOpacity
                                onPress={handleUseCached}
                                style={styles.useBtn}
                                disabled={refreshing}
                              >
                                <Text style={styles.useBtnText}>Add Food</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={handleRefresh}
                                style={[styles.refreshBtn, refreshing && styles.refreshBtnDisabled]}
                                disabled={refreshing}
                              >
                                {refreshing ? (
                                  <ActivityIndicator color="#fff" size="small" style={{ width: 14, height: 14 }} />
                                ) : (
                                  <Ionicons name="refresh" size={14} color="#fff" />
                                )}
                                <Text style={styles.refreshBtnText}>
                                  {refreshing ? "Updating…" : "Refresh"}
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                        <TouchableOpacity onPress={handleRetry} style={styles.scanAgainLink}>
                          <Text style={styles.scanAgainText}>Scan a different product</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* Recent tab content */}
              {activeTab === "recent" && (
                <View style={[styles.recentPanel, { paddingBottom: insets.bottom + 16 }]}>
                  {notFoundBannerVisible && (
                    <Animated.View style={[styles.notFoundBanner, { opacity: notFoundOpacity }]}>
                      <Ionicons name="search-outline" size={16} color="#fbbf24" />
                      <Text style={styles.notFoundBannerText}>
                        Not found — try a recent product instead
                      </Text>
                    </Animated.View>
                  )}
                  {!recentLoading && recentScans.length > 0 && (
                    <>
                      <View style={styles.searchBarRow}>
                        <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search recent scans…"
                          placeholderTextColor="rgba(255,255,255,0.4)"
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          returnKeyType="search"
                          clearButtonMode="while-editing"
                          autoCorrect={false}
                          autoCapitalize="none"
                        />
                        {searchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.5)" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.filterChipScroll}
                        contentContainerStyle={styles.filterChipScrollContent}
                        keyboardShouldPersistTaps="handled"
                      >
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSortOrder("recent");
                          }}
                          style={[styles.sortChip, sortOrder === "recent" && styles.sortChipActive]}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={sortOrder === "recent" ? "#09090b" : "rgba(255,255,255,0.75)"}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.sortChipText, sortOrder === "recent" && styles.sortChipTextActive]}>
                            Recent
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSortOrder("most-used");
                          }}
                          style={[styles.sortChip, sortOrder === "most-used" && styles.sortChipActive]}
                          activeOpacity={0.75}
                        >
                          <Ionicons
                            name="flame-outline"
                            size={12}
                            color={sortOrder === "most-used" ? "#09090b" : "rgba(255,255,255,0.75)"}
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[styles.sortChipText, sortOrder === "most-used" && styles.sortChipTextActive]}>
                            Most Used
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.filterChipDivider} />
                        {MACRO_FILTERS.map((f) => {
                          const isActive = activeFilter === f.id;
                          return (
                            <TouchableOpacity
                              key={f.id}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setActiveFilter(isActive ? null : f.id);
                              }}
                              style={[styles.filterChip, isActive && styles.filterChipActive]}
                              activeOpacity={0.75}
                            >
                              {isActive && (
                                <Ionicons name="checkmark" size={12} color="#09090b" style={{ marginRight: 2 }} />
                              )}
                              <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                                {f.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </>
                  )}
                  {recentLoading ? (
                    <View style={styles.recentCenter}>
                      <ActivityIndicator color="#fff" size="large" />
                    </View>
                  ) : recentScans.length === 0 ? (
                    <View style={styles.recentCenter}>
                      <Ionicons name="barcode-outline" size={48} color="rgba(255,255,255,0.35)" />
                      <Text style={styles.recentEmptyTitle}>No recent scans</Text>
                      <Text style={styles.recentEmptySub}>
                        Products you scan will appear here so you can quickly re-add them.
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleSwitchTab("scan")}
                        style={styles.recentScanNowBtn}
                      >
                        <Ionicons name="barcode-outline" size={16} color="#09090b" />
                        <Text style={styles.recentScanNowText}>Scan a Product</Text>
                      </TouchableOpacity>
                    </View>
                  ) : sortedScans.length === 0 ? (
                    <View style={styles.recentCenter}>
                      <Ionicons name="search-outline" size={40} color="rgba(255,255,255,0.35)" />
                      <Text style={styles.recentEmptyTitle}>No results</Text>
                      <Text style={styles.recentEmptySub}>
                        {activeFilter && searchQuery.trim()
                          ? `No scans match "${searchQuery}" with the active filter.`
                          : activeFilter
                          ? "No scans match that filter. Try a different one."
                          : `No scans match "${searchQuery}". Try a different name.`}
                      </Text>
                      {(activeFilter || searchQuery.trim()) && (
                        <TouchableOpacity
                          onPress={() => { setSearchQuery(""); setActiveFilter(null); }}
                          style={styles.filterClearBtn}
                        >
                          <Text style={styles.filterClearBtnText}>Clear filters</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <ScrollView
                      style={styles.recentList}
                      contentContainerStyle={styles.recentListContent}
                      showsVerticalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                    >
                      <Text style={styles.recentHint}>
                        Tap to add · Pencil to edit
                      </Text>
                      {sortedScans.map((scan) => {
                        const canToggle = !!(scan.food.servingLabel && scan.food.nutrients100g);
                        const showing100g = canToggle && per100gScans.has(scan.barcode);
                        const displayCalories = showing100g ? scan.food.nutrients100g!.calories : scan.food.calories;
                        const displayProtein = showing100g ? scan.food.nutrients100g!.protein : scan.food.protein;
                        const displayCarbs = showing100g ? scan.food.nutrients100g!.carbs : scan.food.carbs;
                        const displayFat = showing100g ? scan.food.nutrients100g!.fat : scan.food.fat;
                        const pillLabel = showing100g
                          ? "per 100g"
                          : scan.food.servingLabel
                          ? `per ${scan.food.servingLabel}`
                          : "per 100g";
                        return (
                          <TouchableOpacity
                            key={scan.barcode}
                            onPress={() => handleSelectRecent(scan)}
                            onLongPress={() => handleLongPressRecent(scan)}
                            delayLongPress={400}
                            activeOpacity={0.75}
                            style={styles.recentItem}
                          >
                            <View style={styles.recentIconBox}>
                              <Ionicons name="barcode-outline" size={20} color="#fff" />
                            </View>
                            <View style={styles.recentItemInfo}>
                              <Text style={styles.recentItemName} numberOfLines={1}>
                                {scan.food.name}
                              </Text>
                              <View style={styles.recentItemMeta}>
                                <Text style={styles.recentItemCal}>
                                  {displayCalories} kcal
                                </Text>
                                <Text style={styles.recentItemDot}>·</Text>
                                <Text style={styles.recentItemMacros}>
                                  P {displayProtein}g · C {displayCarbs}g · F {displayFat}g
                                </Text>
                              </View>
                              {!showing100g && scan.food.servingLabel ? (
                                <Text style={styles.recentItemServingNote} numberOfLines={1}>
                                  1 serving = {scan.food.servingLabel}
                                </Text>
                              ) : null}
                              <View style={styles.recentItemBottom}>
                                <TouchableOpacity
                                  activeOpacity={canToggle ? 0.7 : 1}
                                  onPress={canToggle ? (e) => { e.stopPropagation(); handleTogglePer100g(scan.barcode); } : undefined}
                                  style={[styles.recentItemServingPill, canToggle && styles.recentItemServingPillToggleable]}
                                >
                                  <Text style={styles.recentItemServingPillText}>
                                    {pillLabel}
                                  </Text>
                                  {canToggle && (
                                    <Ionicons name="swap-horizontal-outline" size={10} color="rgba(255,255,255,0.55)" style={{ marginLeft: 3 }} />
                                  )}
                                </TouchableOpacity>
                                <Text style={styles.recentItemDate}>
                                  {formatScannedDate(scan.scannedAt)}
                                </Text>
                                {correctedBarcodes.has(scan.barcode) && (
                                  <View style={styles.correctionPill}>
                                    <Ionicons name="create-outline" size={9} color="rgba(163,230,53,0.9)" />
                                    <Text style={styles.correctionPillText}>Edited</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                            <View style={styles.recentItemActions}>
                              <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleLongPressRecent(scan);
                                }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.recentActionBtn}
                              >
                                <Ionicons
                                  name="pencil-outline"
                                  size={17}
                                  color="rgba(255,255,255,0.4)"
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => handleRemoveRecent(scan.barcode)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.recentActionBtn}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={17}
                                  color="rgba(255,255,255,0.4)"
                                />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </View>

      <ScanEditSheet
        visible={editTarget !== null}
        food={editTarget?.food ?? null}
        onSave={handleSaveEdit}
        onSaveAndAdd={handleSaveAndAdd}
        onClose={() => setEditTarget(null)}
      />
    </Modal>
  );
}

const CORNER_SIZE = 24;
const CORNER_THICKNESS = 3;
const CORNER_COLOR = "#fff";

const styles = StyleSheet.create({
  fullscreen: { flex: 1 },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: "#000000aa",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  topBarTitle: {
    color: "#fff",
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  closeIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    padding: 3,
    gap: 2,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 17,
  },
  tabActive: {
    backgroundColor: "#fff",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.7)",
  },
  tabTextActive: {
    color: "#09090b",
  },
  scanFrameWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  scanFrame: {
    width: 260,
    height: 180,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 4,
  },
  scanHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  bottomBar: {
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingTop: 16,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4ade80",
  },
  statusText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  errorCard: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    color: "#09090b",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  manualBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  manualText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  resultCard: {
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 14,
    padding: 16,
    gap: 6,
    width: "100%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultName: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  resultEditBtn: {
    padding: 2,
  },
  resultMacros: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 26,
  },
  resultServingNote: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginLeft: 26,
    marginTop: 1,
  },
  resultViewPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 26,
    marginTop: 3,
  },
  resultViewPillText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  servingStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginLeft: 26,
    marginTop: 6,
  },
  servingStepperLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  servingStepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  stepperBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnDisabled: {
    opacity: 0.3,
  },
  stepperValue: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    minWidth: 36,
    textAlign: "center",
    paddingVertical: 6,
  },
  resultActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  useBtn: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  useBtnText: {
    color: "#09090b",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  addedConfirm: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(163,230,53,0.12)",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(163,230,53,0.35)",
  },
  addedConfirmText: {
    color: "#a3e635",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  addAgainBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  addAgainBtnText: {
    color: "#09090b",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  refreshBtnDisabled: {
    opacity: 0.6,
  },
  refreshBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  scanAgainLink: {
    alignSelf: "center",
    paddingVertical: 4,
    marginTop: 2,
  },
  scanAgainText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  cacheAgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 26,
    marginTop: 2,
  },
  cacheAgeText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  refreshFailedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 26,
    marginTop: 2,
  },
  refreshFailedText: {
    color: "#f87171",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  permTitle: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  permSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  permBtn: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    alignItems: "center",
  },
  permBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  permDenied: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 8,
  },
  permWarningCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
    gap: 8,
    alignItems: "center",
    width: "100%",
  },
  permWarningText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  cancelLink: { marginTop: 8, padding: 8 },
  cancelLinkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  card: {
    margin: 24,
    borderRadius: 20,
    padding: 24,
    gap: 16,
    alignSelf: "center",
    width: "90%",
  },
  webUnsupported: { alignItems: "center", gap: 12 },
  webTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  webSubtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  closeBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  notFoundBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(251,191,36,0.15)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(251,191,36,0.25)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  notFoundBannerText: {
    color: "#fbbf24",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  // Recent tab styles
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  recentPanel: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  recentCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  recentEmptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  recentEmptySub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  recentScanNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  recentScanNowText: {
    color: "#09090b",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  recentList: {
    flex: 1,
  },
  recentListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 10,
  },
  recentHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  recentIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  recentItemInfo: {
    flex: 1,
    gap: 2,
  },
  recentItemName: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  recentItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  recentItemCal: {
    color: "#a3e635",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  recentItemDot: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
  },
  recentItemMacros: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  recentItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  recentItemServingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  recentItemServingPillToggleable: {
    paddingRight: 4,
  },
  recentItemServingPillText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  recentItemServingNote: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  recentItemDate: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  recentItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recentActionBtn: {
    padding: 4,
  },
  newScanDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#a3e635",
    marginLeft: 2,
    alignSelf: "center",
  },
  filterChipScroll: {
    flexShrink: 0,
  },
  filterChipScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  sortChipActive: {
    backgroundColor: "#fff",
    borderColor: "#fff",
  },
  sortChipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  sortChipTextActive: {
    color: "#09090b",
  },
  filterChipDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginHorizontal: 2,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  filterChipActive: {
    backgroundColor: "#a3e635",
    borderColor: "#a3e635",
  },
  filterChipText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  filterChipTextActive: {
    color: "#09090b",
  },
  filterClearBtn: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterClearBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  correctionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  correctionText: {
    color: "rgba(163,230,53,0.85)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  correctionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(163,230,53,0.12)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  correctionPillText: {
    color: "rgba(163,230,53,0.9)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
});
