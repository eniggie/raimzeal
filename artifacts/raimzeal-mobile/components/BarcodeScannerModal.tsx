import React, { useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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

const CACHE_PREFIX = "barcode_cache_v1:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const RECENT_SCANS_KEY = "barcode_recent_scans_v1";
const MAX_RECENT_SCANS = 20;

export interface RecentScan {
  barcode: string;
  food: ScannedFood;
  scannedAt: number;
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
    const filtered = scans.filter((s) => s.barcode !== barcode);
    const entry: RecentScan = { barcode, food, scannedAt: Date.now() };
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

export interface ScannedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingLabel?: string;
  nutrients100g?: { calories: number; protein: number; carbs: number; fat: number };
  unit?: "g" | "ml";
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
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
    );
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
  cachedAt?: number;
}

async function fetchFoodByBarcode(barcode: string): Promise<FetchResult | null> {
  const cached = await getCachedBarcode(barcode);
  if (cached) {
    await addToRecentScans(barcode, cached.food);
    return { food: cached.food, fromCache: true, cachedAt: cached.cachedAt };
  }

  const food = await fetchFromNetwork(barcode);
  if (!food) return null;

  await setCachedBarcode(barcode, food);
  await addToRecentScans(barcode, food);
  return { food, fromCache: false };
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
  onFoodFound: (food: ScannedFood) => void;
  onManualEntry: () => void;
}

type ActiveTab = "scan" | "recent";

export function BarcodeScannerModal({ visible, onClose, onFoodFound, onManualEntry }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cachedResult, setCachedResult] = useState<{ food: ScannedFood; barcode: string; cachedAt: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("scan");
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<RecentScan | null>(null);
  const [notFoundBanner, setNotFoundBanner] = useState(false);

  const loadRecentScans = useCallback(async () => {
    setRecentLoading(true);
    const data = await getRecentScans();
    setRecentScans(data);
    setRecentLoading(false);
  }, []);

  // Reset scanner state every time the modal opens so it's always ready
  useEffect(() => {
    if (visible) {
      setScanning(true);
      setLoading(false);
      setError(null);
      setCachedResult(null);
      setRefreshing(false);
      setRefreshFailed(false);
      setActiveTab("scan");
      setNotFoundBanner(false);
      loadRecentScans();
    }
  }, [visible, loadRecentScans]);

  // Reload recent scans when switching to the Recent tab
  useEffect(() => {
    if (activeTab === "recent") {
      loadRecentScans();
    }
  }, [activeTab, loadRecentScans]);

  const handleBarcodeScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (!scanning || loading) return;
      setScanning(false);
      setLoading(true);
      setError(null);

      const result = await fetchFoodByBarcode(data);
      setLoading(false);

      if (result) {
        if (result.fromCache) {
          setCachedResult({ food: result.food, barcode: data, cachedAt: result.cachedAt ?? Date.now() });
        } else {
          onFoodFound(result.food);
          onClose();
        }
      } else {
        setNotFoundBanner(true);
        setActiveTab("recent");
        loadRecentScans();
      }
    },
    [scanning, loading, onFoodFound, onClose, loadRecentScans]
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

  function handleUseCached() {
    if (!cachedResult) return;
    onFoodFound(cachedResult.food);
    onClose();
  }

  function handleRetry() {
    setError(null);
    setCachedResult(null);
    setRefreshFailed(false);
    setScanning(true);
    setActiveTab("scan");
  }

  function handleClose() {
    setScanning(true);
    setLoading(false);
    setError(null);
    setCachedResult(null);
    setRefreshing(false);
    setRefreshFailed(false);
    onClose();
  }

  function handleManualEntry() {
    setScanning(true);
    setLoading(false);
    setError(null);
    setCachedResult(null);
    setRefreshing(false);
    setRefreshFailed(false);
    onClose();
    onManualEntry();
  }

  function handleSelectRecent(food: ScannedFood) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFoodFound(food);
    handleClose();
  }

  async function handleRemoveRecent(barcode: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await removeRecentScan(barcode);
    setRecentScans((prev) => prev.filter((s) => s.barcode !== barcode));
  }

  function handleLongPressRecent(scan: RecentScan) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditTarget(scan);
  }

  async function handleSaveEdit(updated: ScannedFood) {
    if (!editTarget) return;
    await updateRecentScan(editTarget.barcode, updated);
    setRecentScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    setEditTarget(null);
  }

  async function handleSaveAndAdd(updated: ScannedFood) {
    if (!editTarget) return;
    await updateRecentScan(editTarget.barcode, updated);
    setRecentScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    setEditTarget(null);
    onFoodFound(updated);
    handleClose();
  }

  function handleSwitchTab(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === "scan") {
      setScanning(true);
      setError(null);
      setCachedResult(null);
      setNotFoundBanner(false);
    }
  }

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
            <Ionicons name="camera-outline" size={56} color={colors.mutedForeground} />
            <Text style={[styles.permTitle, { color: colors.foreground }]}>
              Camera access needed
            </Text>
            <Text style={[styles.permSubtitle, { color: colors.mutedForeground }]}>
              Allow camera access to scan food barcodes instantly.
            </Text>
            {permission.canAskAgain ? (
              <TouchableOpacity
                onPress={requestPermission}
                style={[styles.permBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>
                  Allow Camera
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={[styles.permDenied, { color: colors.mutedForeground }]}>
                Camera access was denied. Please enable it in Settings to use the scanner.
              </Text>
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
              onBarcodeScanned={scanning && activeTab === "scan" ? handleBarcodeScanned : undefined}
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
                </TouchableOpacity>
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
                        <Ionicons name="alert-circle-outline" size={20} color="#f87171" />
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
                        </View>
                        <Text style={styles.resultMacros}>
                          {cachedResult.food.calories} cal · {cachedResult.food.protein}g P · {cachedResult.food.carbs}g C · {cachedResult.food.fat}g F
                        </Text>
                        <View style={styles.cacheAgeRow}>
                          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.45)" />
                          <Text style={styles.cacheAgeText}>
                            {formatCacheAge(cachedResult.cachedAt)}
                          </Text>
                        </View>
                        {refreshFailed && (
                          <View style={styles.refreshFailedRow}>
                            <Ionicons name="cloud-offline-outline" size={13} color="#f87171" />
                            <Text style={styles.refreshFailedText}>
                              Couldn't refresh — showing saved data
                            </Text>
                          </View>
                        )}
                        <View style={styles.resultActions}>
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
                  {notFoundBanner && (
                    <View style={styles.notFoundBanner}>
                      <Ionicons name="alert-circle-outline" size={16} color="#fbbf24" />
                      <Text style={styles.notFoundBannerText}>
                        Not found — try a recent product instead
                      </Text>
                    </View>
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
                  ) : (
                    <ScrollView
                      style={styles.recentList}
                      contentContainerStyle={styles.recentListContent}
                      showsVerticalScrollIndicator={false}
                    >
                      <Text style={styles.recentHint}>
                        Tap to add · Long-press to edit
                      </Text>
                      {recentScans.map((scan) => (
                        <TouchableOpacity
                          key={scan.barcode}
                          onPress={() => handleSelectRecent(scan.food)}
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
                                {scan.food.calories} kcal
                              </Text>
                              <Text style={styles.recentItemDot}>·</Text>
                              <Text style={styles.recentItemMacros}>
                                P {scan.food.protein}g · C {scan.food.carbs}g · F {scan.food.fat}g
                              </Text>
                            </View>
                            <Text style={styles.recentItemDate}>
                              {formatScannedDate(scan.scannedAt)}
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => handleRemoveRecent(scan.barcode)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={styles.recentRemoveBtn}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={17}
                              color="rgba(255,255,255,0.4)"
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                      ))}
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
  resultMacros: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 26,
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
  recentItemDate: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  recentRemoveBtn: {
    padding: 4,
  },
});
