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
import { useSwipeHint } from "@/hooks/useSwipeHint";
import { SCAN_SWIPE_HINT_KEY } from "@/lib/hints";
import {
  getRecentScans,
  removeRecentScan,
  updateRecentScan,
  clearAllRecentScans,
  setRecentLastViewed,
  RecentScan,
  ScannedFood,
} from "@/components/BarcodeScannerModal";
import { ScanEditSheet } from "@/components/ScanEditSheet";
import { usePer100gDefault } from "@/hooks/usePer100gDefault";
import {
  LAST_USED_VIEW_KEY,
  saveViewPreference,
  removeViewPreference,
  loadViewPreferenceMap,
} from "@/utils/viewPreference";

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: ScannedFood, per100g?: boolean) => void;
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
  onUseMacroTotal?: (correctedCalories: number) => void;
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
  onUseMacroTotal,
  runHintAnimation,
}: ScanRowProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const isHintOpenRef = useRef(false);

  useEffect(() => {
    if (!runHintAnimation) return;
    const timer = setTimeout(() => {
      isHintOpenRef.current = true;
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
      onSwipeableOpen={() => {
        if (isHintOpenRef.current) { isHintOpenRef.current = false; return; }
        Haptics.selectionAsync();
      }}
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
          {(() => {
            const macroKcal = Math.round(
              displayProtein * 4 + displayCarbs * 4 + displayFat * 9
            );
            const hasAnyMacro =
              displayProtein > 0 || displayCarbs > 0 || displayFat > 0;
            const mismatch =
              hasAnyMacro &&
              displayCalories > 0 &&
              Math.abs(macroKcal - displayCalories) / displayCalories > 0.2;
            if (!hasAnyMacro) return null;
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: "Inter_400Regular",
                    color: mismatch ? "#f59e0b" : colors.mutedForeground,
                  }}
                >
                  {`~${macroKcal} kcal from macros`}
                  {mismatch ? "  ⚠" : ""}
                </Text>
                {mismatch && onUseMacroTotal && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onUseMacroTotal(macroKcal);
                    }}
                    style={{
                      backgroundColor: "#f59e0b22",
                      borderRadius: 6,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderWidth: 1,
                      borderColor: "#f59e0b66",
                    }}
                  >
                    <Text
                      style={{
                        color: "#f59e0b",
                        fontSize: 11,
                        fontFamily: "Inter_600SemiBold",
                      }}
                    >
                      Use macro total
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })()}
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

interface PendingClearAll {
  scans: RecentScan[];
  per100gScans: Set<string>;
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
  const [defaultPer100g] = usePer100gDefault();
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteRef = useRef<PendingDelete | null>(null);
  const [pendingClearAll, setPendingClearAll] = useState<PendingClearAll | null>(null);
  const pendingClearAllRef = useRef<PendingClearAll | null>(null);
  const [selectToast, setSelectToast] = useState(false);
  const [selectToastLabel, setSelectToastLabel] = useState("");
  const selectToastOpacity = useRef(new Animated.Value(0)).current;
  const selectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoProgress = useRef(new Animated.Value(1)).current;
  const undoProgressAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  function startUndoProgress() {
    undoProgressAnimRef.current?.stop();
    undoProgress.setValue(1);
    undoProgressAnimRef.current = Animated.timing(undoProgress, {
      toValue: 0,
      duration: UNDO_DURATION_MS,
      useNativeDriver: false,
    });
    undoProgressAnimRef.current.start();
  }

  // Commit any pending delete/clear when the component unmounts
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timer);
        commitDelete(pendingDeleteRef.current.scan.barcode);
        pendingDeleteRef.current = null;
      }
      if (pendingClearAllRef.current) {
        clearTimeout(pendingClearAllRef.current.timer);
        commitClearAll();
        pendingClearAllRef.current = null;
      }
    };
  }, []);

  const loadScans = useCallback(async () => {
    setLoading(true);
    const [data, viewMap] = await Promise.all([
      getRecentScans(),
      loadViewPreferenceMap(),
    ]);
    setScans(data);

    const restoredPer100g = new Set<string>();
    for (const scan of data) {
      const canToggle = !!(scan.food.servingLabel && scan.food.nutrients100g);
      if (!canToggle) continue;
      const saved = viewMap[scan.barcode];
      const showPer100g = saved !== undefined ? saved : defaultPer100g;
      if (showPer100g) {
        restoredPer100g.add(scan.barcode);
      }
    }
    setPer100gScans(restoredPer100g);

    setLoading(false);
  }, [defaultPer100g]);

  React.useEffect(() => {
    if (visible) {
      setRecentLastViewed();
      loadScans();
    } else {
      setPer100gScans(new Set());
    }
  }, [visible, loadScans]);

  const runSwipeHint = useSwipeHint(SCAN_SWIPE_HINT_KEY, scans.length > 0);

  function commitDelete(barcode: string) {
    removeRecentScan(barcode).catch(() => {});
    removeViewPreference(barcode).catch(() => {});
  }

  function commitClearAll() {
    Promise.all([
      clearAllRecentScans(),
      AsyncStorage.removeItem(LAST_USED_VIEW_KEY),
      AsyncStorage.removeItem(SCAN_SWIPE_HINT_KEY),
    ]).catch(() => {});
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
    startUndoProgress();
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

  function showSelectToast(label: string) {
    if (selectToastTimerRef.current) clearTimeout(selectToastTimerRef.current);
    setSelectToastLabel(label);
    setSelectToast(true);
    selectToastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(selectToastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1300),
      Animated.timing(selectToastOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setSelectToast(false));
    selectToastTimerRef.current = setTimeout(() => setSelectToast(false), 2000);
  }

  function handleSelect(scan: RecentScan, showing100g: boolean) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onFoodFound(scan.food, showing100g);
    showSelectToast(`${scan.food.name} added · ${scan.food.calories} kcal`);
    setTimeout(() => handleClose(), 1800);
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
    // Commit any pending single delete before clearing all
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      commitDelete(pendingDeleteRef.current.scan.barcode);
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }
    Alert.alert(
      "Clear all scans?",
      "This will remove all recently scanned products.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            // Snapshot current state so we can restore it on undo
            const savedScans = scans;
            const savedPer100g = per100gScans;

            // Optimistically clear the UI
            setScans([]);
            setPer100gScans(new Set());

            // Commit to storage only after the undo window expires
            const timer = setTimeout(() => {
              commitClearAll();
              pendingClearAllRef.current = null;
              setPendingClearAll(null);
            }, UNDO_DURATION_MS);

            const pca: PendingClearAll = { scans: savedScans, per100gScans: savedPer100g, timer };
            pendingClearAllRef.current = pca;
            setPendingClearAll(pca);
            startUndoProgress();
          },
        },
      ]
    );
  }

  function handleScrollBeginDrag() {
    if (!pendingDeleteRef.current) return;
    const { timer } = pendingDeleteRef.current;
    clearTimeout(timer);
    commitDelete(pendingDeleteRef.current.scan.barcode);
    pendingDeleteRef.current = null;
    setPendingDelete(null);
    undoProgressAnimRef.current?.stop();
  }

  function handleUndoClearAll() {
    if (!pendingClearAllRef.current) return;
    const { scans: savedScans, per100gScans: savedPer100g, timer } = pendingClearAllRef.current;
    clearTimeout(timer);
    pendingClearAllRef.current = null;
    setPendingClearAll(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setScans(savedScans);
    setPer100gScans(savedPer100g);
  }

  function handleClose() {
    // Commit any pending delete when closing the sheet
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current.timer);
      commitDelete(pendingDeleteRef.current.scan.barcode);
      pendingDeleteRef.current = null;
      setPendingDelete(null);
    }
    // Commit any pending clear-all when closing the sheet
    if (pendingClearAllRef.current) {
      clearTimeout(pendingClearAllRef.current.timer);
      commitClearAll();
      pendingClearAllRef.current = null;
      setPendingClearAll(null);
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
          {/* Green pill confirmation toast (direct-select path) */}
          {selectToast && (
            <Animated.View
              style={[styles.selectToast, { opacity: selectToastOpacity }]}
              pointerEvents="none"
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.selectToastText} numberOfLines={1}>{selectToastLabel}</Text>
            </Animated.View>
          )}
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
              onScrollBeginDrag={handleScrollBeginDrag}
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
                    onUseMacroTotal={(correctedCals) => {
                      const updatedFood: typeof scan.food = showing100g && scan.food.nutrients100g
                        ? {
                            ...scan.food,
                            nutrients100g: {
                              ...scan.food.nutrients100g,
                              calories: correctedCals,
                            },
                          }
                        : { ...scan.food, calories: correctedCals };
                      onFoodFound(updatedFood, showing100g);
                      handleClose();
                    }}
                    onToggle100g={() => {
                      const nowPer100g = !per100gScans.has(scan.barcode);
                      setPer100gScans((prev) => {
                        const next = new Set(prev);
                        if (nowPer100g) next.add(scan.barcode);
                        else next.delete(scan.barcode);
                        return next;
                      });
                      saveViewPreference(scan.barcode, nowPer100g);
                    }}
                  />
                );
              })}
            </ScrollView>
          )}

          {/* Undo toast */}
          {(pendingDelete !== null || pendingClearAll !== null) && (
            <View
              style={[
                styles.undoToast,
                { backgroundColor: colors.foreground },
              ]}
            >
              <View style={styles.undoToastRow}>
                <Text
                  style={[
                    styles.undoToastText,
                    { color: colors.background },
                  ]}
                  numberOfLines={1}
                >
                  {pendingClearAll !== null
                    ? `Cleared ${pendingClearAll.scans.length} scan${pendingClearAll.scans.length === 1 ? "" : "s"}`
                    : "Scan removed"}
                </Text>
                <TouchableOpacity
                  onPress={pendingClearAll !== null ? handleUndoClearAll : handleUndo}
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
              <Animated.View
                style={[
                  styles.undoProgressBar,
                  {
                    backgroundColor: colors.primary,
                    width: undoProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
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
  selectToast: {
    position: "absolute",
    top: 52,
    alignSelf: "center",
    maxWidth: "88%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  selectToastText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  undoToast: {
    overflow: "hidden",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 12,
  },
  undoToastRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  undoProgressBar: {
    height: 3,
  },
});
