import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import {
  getRecentScans,
  removeRecentScan,
  updateRecentScan,
  clearAllRecentScans,
  RecentScan,
  ScannedFood,
} from "@/components/BarcodeScannerModal";
import { ScanEditSheet } from "@/components/ScanEditSheet";

const LAST_USED_VIEW_KEY = "@nutrition_last_used_view_v2";
const SWIPE_HINT_KEY = "@scan_swipe_hint_v1";

async function saveViewPreference(barcode: string, per100g: boolean): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_USED_VIEW_KEY);
    let viewMap: Record<string, boolean> = {};
    try { viewMap = raw ? JSON.parse(raw) : {}; } catch { /* ignore */ }
    if (per100g) {
      viewMap[barcode] = true;
    } else {
      delete viewMap[barcode];
    }
    await AsyncStorage.setItem(LAST_USED_VIEW_KEY, JSON.stringify(viewMap));
  } catch {
    // Non-fatal
  }
}

async function removeViewPreference(barcode: string): Promise<void> {
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

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: ScannedFood) => void;
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

interface ScanRowProps {
  scan: RecentScan;
  showing100g: boolean;
  canToggle: boolean;
  colors: ReturnType<typeof useColors>;
  onSelect: () => void;
  onLongPress: () => void;
  onRemove: () => void;
  onToggle100g: () => void;
  runHintAnimation?: boolean;
}

function ScanRow({
  scan,
  showing100g,
  canToggle,
  colors,
  onSelect,
  onLongPress,
  onRemove,
  onToggle100g,
  runHintAnimation,
}: ScanRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  useEffect(() => {
    if (!runHintAnimation) return;
    const timer = setTimeout(() => {
      swipeableRef.current?.openRight();
      const closeTimer = setTimeout(() => {
        swipeableRef.current?.close();
      }, 600);
      return () => clearTimeout(closeTimer);
    }, 500);
    return () => clearTimeout(timer);
  }, [runHintAnimation]);

  const displayCalories = showing100g
    ? scan.food.nutrients100g!.calories
    : scan.food.calories;
  const displayProtein = showing100g
    ? scan.food.nutrients100g!.protein
    : scan.food.protein;
  const displayCarbs = showing100g
    ? scan.food.nutrients100g!.carbs
    : scan.food.carbs;
  const displayFat = showing100g
    ? scan.food.nutrients100g!.fat
    : scan.food.fat;
  const pillLabel = showing100g
    ? "per 100g"
    : scan.food.servingLabel
    ? `per ${scan.food.servingLabel}`
    : "per 100g";

  function renderRightActions(
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.7],
      extrapolate: "clamp",
    });

    return (
      <TouchableOpacity
        style={styles.deleteAction}
        activeOpacity={0.8}
        onPress={() => {
          swipeableRef.current?.close();
          onRemove();
        }}
      >
        <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      onSwipeableOpen={() => Haptics.selectionAsync()}
      containerStyle={styles.swipeContainer}
      childrenContainerStyle={[
        styles.item,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        onPress={onSelect}
        onLongPress={onLongPress}
        delayLongPress={400}
        activeOpacity={0.75}
        style={styles.itemInner}
      >
        <View
          style={[
            styles.iconBox,
            { backgroundColor: colors.primary + "18" },
          ]}
        >
          <Ionicons
            name="barcode-outline"
            size={20}
            color={colors.primary}
          />
        </View>
        <View style={styles.itemInfo}>
          <Text
            style={[styles.itemName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {scan.food.name}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={[styles.itemCal, { color: colors.primary }]}>
              {displayCalories} kcal
            </Text>
            <Text style={[styles.itemDot, { color: colors.mutedForeground }]}>
              ·
            </Text>
            <Text
              style={[styles.itemMacros, { color: colors.mutedForeground }]}
            >
              P {displayProtein}g · C {displayCarbs}g · F {displayFat}g
            </Text>
          </View>
          {!showing100g && scan.food.servingLabel ? (
            <Text
              style={[styles.servingNote, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              1 serving = {scan.food.servingLabel}
            </Text>
          ) : null}
          <View style={styles.itemBottom}>
            <TouchableOpacity
              activeOpacity={canToggle ? 0.7 : 1}
              onPress={
                canToggle
                  ? (e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onToggle100g();
                    }
                  : undefined
              }
              style={[
                styles.servingPill,
                { backgroundColor: colors.primary + "18" },
                canToggle && { paddingRight: 6 },
              ]}
            >
              <Text
                style={[styles.servingPillText, { color: colors.primary }]}
              >
                {pillLabel}
              </Text>
              {canToggle && (
                <Ionicons
                  name="swap-horizontal-outline"
                  size={11}
                  color={colors.primary}
                  style={{ marginLeft: 3 }}
                />
              )}
            </TouchableOpacity>
            <Text
              style={[styles.itemDate, { color: colors.mutedForeground }]}
            >
              {formatScannedDate(scan.scannedAt)}
            </Text>
          </View>
        </View>
        <View style={styles.itemActions}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onLongPress();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionBtn}
          >
            <Ionicons
              name="pencil-outline"
              size={17}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.actionBtn}
          >
            <Ionicons
              name="trash-outline"
              size={17}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

interface PendingDelete {
  scan: RecentScan;
  originalIndex: number;
  timer: ReturnType<typeof setTimeout>;
}

const UNDO_DURATION_MS = 3000;

export function RecentlyScannedModal({ visible, onClose, onFoodFound }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState<RecentScan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<RecentScan | null>(null);
  const [per100gScans, setPer100gScans] = useState<Set<string>>(new Set());
  const [runSwipeHint, setRunSwipeHint] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);

  // Commit any pending delete when the component unmounts
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timer);
        commitDelete(pendingDeleteRef.current.scan.barcode);
        pendingDeleteRef.current = null;
      }
    };
  }, []);

  const loadScans = useCallback(async () => {
    setLoading(true);
    setRunSwipeHint(false);
    const [data, viewRaw, hintRaw] = await Promise.all([
      getRecentScans(),
      AsyncStorage.getItem(LAST_USED_VIEW_KEY).catch(() => null),
      AsyncStorage.getItem(SWIPE_HINT_KEY).catch(() => null),
    ]);
    setScans(data);

    let viewMap: Record<string, boolean> = {};
    try { viewMap = viewRaw ? JSON.parse(viewRaw) : {}; } catch { /* ignore */ }
    const restoredPer100g = new Set<string>();
    for (const scan of data) {
      const canToggle = !!(scan.food.servingLabel && scan.food.nutrients100g);
      if (canToggle && viewMap[scan.barcode] === true) {
        restoredPer100g.add(scan.barcode);
      }
    }
    setPer100gScans(restoredPer100g);

    if (!hintRaw && data.length > 0) {
      setRunSwipeHint(true);
      AsyncStorage.setItem(SWIPE_HINT_KEY, "1").catch(() => {});
    }

    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (visible) {
      loadScans();
    } else {
      setPer100gScans(new Set());
    }
  }, [visible, loadScans]);

  function commitDelete(barcode: string) {
    removeRecentScan(barcode).catch(() => {});
    removeViewPreference(barcode).catch(() => {});
  }

  function handleRemove(barcode: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // If there's already a pending delete, commit it immediately before starting a new one
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      commitDelete(pendingDeleteRef.current.scan.barcode);
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }

    // Find the item and its position before removing from state
    const originalIndex = scans.findIndex((s) => s.barcode === barcode);
    const scan = scans[originalIndex];
    if (!scan) return;

    // Optimistically remove from the visible list
    setScans((prev) => prev.filter((s) => s.barcode !== barcode));

    // Start the commit timer — deletion only lands in storage after the undo window
    const timer = setTimeout(() => {
      commitDelete(barcode);
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }, UNDO_DURATION_MS);

    const pd: PendingDelete = { scan, originalIndex, timer };
    pendingDeleteRef.current = pd;
    setPendingDelete(pd);
  }

  function handleUndo() {
    if (!pendingDeleteRef.current) return;
    const { scan, originalIndex, timer } = pendingDeleteRef.current;
    clearTimeout(timer);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScans((prev) => {
      // Guard: skip if the item is somehow already in the list (e.g. after a reload)
      if (prev.some((s) => s.barcode === scan.barcode)) return prev;
      const next = [...prev];
      const insertAt = Math.min(originalIndex, next.length);
      next.splice(insertAt, 0, scan);
      return next;
    });
  }

  function handleSelect(scan: RecentScan, showing100g: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (showing100g && scan.food.nutrients100g) {
      onFoodFound({
        ...scan.food,
        calories: scan.food.nutrients100g.calories,
        protein: scan.food.nutrients100g.protein,
        carbs: scan.food.nutrients100g.carbs,
        fat: scan.food.nutrients100g.fat,
        servingLabel: undefined,
      });
    } else {
      onFoodFound(scan.food);
    }
    handleClose();
  }

  function handleLongPress(scan: RecentScan) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditTarget(scan);
  }

  async function handleSaveEdit(updated: ScannedFood) {
    if (!editTarget) return;
    await updateRecentScan(editTarget.barcode, updated);
    setScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    setEditTarget(null);
  }

  async function handleSaveAndAdd(updated: ScannedFood) {
    if (!editTarget) return;
    await updateRecentScan(editTarget.barcode, updated);
    setScans((prev) =>
      prev.map((s) =>
        s.barcode === editTarget.barcode ? { ...s, food: updated } : s
      )
    );
    onFoodFound(updated);
  }

  function handleClearAll() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // Commit any pending delete before clearing all
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      commitDelete(pendingDeleteRef.current.scan.barcode);
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }
    Alert.alert(
      "Clear all scans?",
      "This will remove all recently scanned products. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            await Promise.all([
              clearAllRecentScans(),
              AsyncStorage.removeItem(LAST_USED_VIEW_KEY),
            ]);
            setScans([]);
            setPer100gScans(new Set());
          },
        },
      ]
    );
  }

  function handleClose() {
    // Commit any pending delete when closing the sheet
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      commitDelete(pendingDeleteRef.current.scan.barcode);
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons
                name="time-outline"
                size={20}
                color={colors.primary}
              />
              <Text style={[styles.title, { color: colors.foreground }]}>
                Recently Scanned
              </Text>
              {scans.length > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: colors.primary + "1A" },
                  ]}
                >
                  <Text
                    style={[styles.countBadgeText, { color: colors.primary }]}
                  >
                    {scans.length}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.headerRight}>
              {scans.length > 0 && (
                <TouchableOpacity
                  onPress={handleClearAll}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearAllBtn}
                >
                  <Text
                    style={[
                      styles.clearAllText,
                      { color: colors.destructive ?? "#ef4444" },
                    ]}
                  >
                    Clear all
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          <ScanEditSheet
            visible={editTarget !== null}
            food={editTarget?.food ?? null}
            onSave={handleSaveEdit}
            onSaveAndAdd={handleSaveAndAdd}
            onClose={() => setEditTarget(null)}
          />

          {/* Content */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : scans.length === 0 ? (
            <View style={styles.center}>
              <Ionicons
                name="barcode-outline"
                size={48}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                No recent scans
              </Text>
              <Text
                style={[styles.emptySub, { color: colors.mutedForeground }]}
              >
                Products you scan will appear here so you can quickly add them
                again.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Tap to add · Pencil to edit
              </Text>
              {scans.map((scan, index) => {
                const canToggle = !!(
                  scan.food.servingLabel && scan.food.nutrients100g
                );
                const showing100g = canToggle && per100gScans.has(scan.barcode);

                return (
                  <ScanRow
                    key={scan.barcode}
                    scan={scan}
                    showing100g={showing100g}
                    canToggle={canToggle}
                    colors={colors}
                    onSelect={() => handleSelect(scan, showing100g)}
                    onLongPress={() => handleLongPress(scan)}
                    onRemove={() => handleRemove(scan.barcode)}
                    runHintAnimation={index === 0 && runSwipeHint}
                    onToggle100g={() =>
                      setPer100gScans((prev) => {
                        const next = new Set(prev);
                        const nowPer100g = !next.has(scan.barcode);
                        if (nowPer100g) next.add(scan.barcode);
                        else next.delete(scan.barcode);
                        saveViewPreference(scan.barcode, nowPer100g);
                        return next;
                      })
                    }
                  />
                );
              })}
            </ScrollView>
          )}

          {/* Undo toast */}
          {pendingDelete !== null && (
            <View
              style={[
                styles.undoToast,
                { backgroundColor: colors.foreground },
              ]}
            >
              <Text
                style={[
                  styles.undoToastText,
                  { color: colors.background },
                ]}
                numberOfLines={1}
              >
                Scan removed
              </Text>
              <TouchableOpacity
                onPress={handleUndo}
                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                style={styles.undoBtn}
              >
                <Text
                  style={[styles.undoBtnText, { color: colors.primary }]}
                >
                  Undo
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
    minHeight: 260,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  clearAllBtn: {
    paddingVertical: 2,
  },
  clearAllText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  swipeContainer: {
    borderRadius: 12,
    overflow: "hidden",
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
  },
  itemInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  deleteAction: {
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 3,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  itemCal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  itemDot: {
    fontSize: 13,
  },
  itemMacros: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  itemBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 1,
  },
  itemDate: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  servingNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  servingPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  servingPillText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
  undoToast: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  undoToastText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  undoBtn: {
    marginLeft: 12,
  },
  undoBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
