import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import type { QuickFood } from "@/contexts/FitnessContext";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_QUICK_FOODS = 8;
const ITEM_HEIGHT = 68;
const SPRING = { damping: 22, stiffness: 220, mass: 0.8 };

// ─── OFFs parsing ────────────────────────────────────────────────────────────

interface OFFProduct {
  product_name?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal_serving"?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    fat_100g?: number;
    fat_serving?: number;
  };
}

function parseOFF(p: OFFProduct): QuickFood | null {
  const name = p.product_name?.trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  const hasServingNutrient =
    n["energy-kcal_serving"] !== undefined ||
    n.proteins_serving !== undefined ||
    n.carbohydrates_serving !== undefined ||
    n.fat_serving !== undefined;
  const useServing = !!(p.serving_size?.trim() && hasServingNutrient);
  const servingLabel = useServing ? p.serving_size?.trim() : undefined;
  const calories = Math.round(
    useServing
      ? (n["energy-kcal_serving"] ?? n["energy-kcal_100g"] ?? 0)
      : (n["energy-kcal_100g"] ?? 0)
  );
  const protein =
    Math.round((useServing
      ? (n.proteins_serving ?? n.proteins_100g ?? 0)
      : (n.proteins_100g ?? 0)) * 10) / 10;
  const carbs =
    Math.round((useServing
      ? (n.carbohydrates_serving ?? n.carbohydrates_100g ?? 0)
      : (n.carbohydrates_100g ?? 0)) * 10) / 10;
  const fat =
    Math.round((useServing
      ? (n.fat_serving ?? n.fat_100g ?? 0)
      : (n.fat_100g ?? 0)) * 10) / 10;
  const has100g =
    n["energy-kcal_100g"] !== undefined ||
    n.proteins_100g !== undefined ||
    n.carbohydrates_100g !== undefined ||
    n.fat_100g !== undefined;
  const nutrients100g = has100g
    ? {
        calories: Math.round(n["energy-kcal_100g"] ?? 0),
        protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
        carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
        fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      }
    : undefined;
  return { name, calories, protein, carbs, fat, mealType: "snack", servingLabel, nutrients100g };
}

// ─── Draggable item ───────────────────────────────────────────────────────────

interface DragItemProps {
  food: QuickFood;
  indexRef: React.MutableRefObject<number>;
  listRef: React.MutableRefObject<QuickFood[]>;
  itemHeightRef: React.MutableRefObject<number>;
  isActive: boolean;
  isHover: boolean;
  isPending: boolean;
  displacement: number;
  onDragStart: (i: number) => void;
  onHover: (i: number) => void;
  onDrop: (from: number, to: number) => void;
  onRemove: (i: number) => void;
  colors: ReturnType<typeof useColors>;
}

function DragItem({
  food,
  indexRef,
  listRef,
  itemHeightRef,
  isActive,
  isHover,
  isPending,
  displacement,
  onDragStart,
  onHover,
  onDrop,
  onRemove,
  colors,
}: DragItemProps) {
  const dragY = useSharedValue(0);
  const dispY = useSharedValue(0);
  const currentDy = useRef(0);

  useEffect(() => {
    dispY.value = withSpring(displacement, SPRING);
  }, [displacement]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value + dispY.value }],
  }));

  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragY.value = 0;
        currentDy.current = 0;
        onDragStartRef.current(indexRef.current);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
      onPanResponderMove: (_, { dy }) => {
        dragY.value = dy;
        currentDy.current = dy;
        const slotH = itemHeightRef.current > 0 ? itemHeightRef.current : ITEM_HEIGHT;
        const to = Math.max(
          0,
          Math.min(listRef.current.length - 1, indexRef.current + Math.round(dy / slotH))
        );
        onHoverRef.current(to);
      },
      onPanResponderRelease: () => {
        const slotH = itemHeightRef.current > 0 ? itemHeightRef.current : ITEM_HEIGHT;
        const to = Math.max(
          0,
          Math.min(
            listRef.current.length - 1,
            indexRef.current + Math.round(currentDy.current / slotH)
          )
        );
        dragY.value = withSpring(0, SPRING);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onDropRef.current(indexRef.current, to);
      },
      onPanResponderTerminate: () => {
        dragY.value = withSpring(0, SPRING);
        onHoverRef.current(-1);
      },
    })
  ).current;

  const destructiveColor = colors.destructive ?? "#ef4444";

  return (
    <Reanimated.View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && itemHeightRef.current !== h) itemHeightRef.current = h;
      }}
      style={[
        styles.item,
        {
          backgroundColor: isPending ? destructiveColor + "18" : colors.card,
          borderColor: isPending
            ? destructiveColor + "99"
            : isActive
            ? colors.primary + "99"
            : isHover
            ? colors.primary + "55"
            : colors.border,
          zIndex: isActive ? 100 : 1,
          elevation: isActive ? 8 : 0,
          shadowColor: "#000",
          shadowOpacity: isActive ? 0.18 : 0,
          shadowRadius: isActive ? 8 : 0,
          shadowOffset: { width: 0, height: 4 },
          opacity: isActive ? 0.93 : 1,
        },
        animatedStyle,
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        <Ionicons name="reorder-three-outline" size={22} color={colors.mutedForeground} />
      </View>
      <View
        style={[
          styles.itemIcon,
          { backgroundColor: isPending ? destructiveColor + "25" : colors.primary + "20" },
        ]}
      >
        <Ionicons
          name={isPending ? "trash-outline" : "restaurant-outline"}
          size={15}
          color={isPending ? destructiveColor : colors.primary}
        />
      </View>
      <View style={styles.itemInfo}>
        <Text
          style={[styles.itemName, { color: isPending ? destructiveColor : colors.foreground }]}
          numberOfLines={1}
        >
          {food.name}
        </Text>
        {isPending ? (
          <Text style={[styles.itemMacros, { color: destructiveColor }]}>
            Tap again to remove
          </Text>
        ) : (
          <Text style={[styles.itemMacros, { color: colors.mutedForeground }]}>
            P {food.protein}g · C {food.carbs}g · F {food.fat}g
          </Text>
        )}
      </View>
      <Text style={[styles.itemCal, { color: isPending ? destructiveColor : colors.primary }]}>
        {food.calories}
      </Text>
      <Pressable
        onPress={() => onRemove(indexRef.current)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.removeBtn}
      >
        <Ionicons
          name={isPending ? "close-circle" : "close-circle-outline"}
          size={19}
          color={destructiveColor}
        />
      </Pressable>
    </Reanimated.View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface QuickFoodsEditorSheetProps {
  visible: boolean;
  onClose: () => void;
  quickFoods: QuickFood[];
  onUpdate: (foods: QuickFood[]) => void;
}

export function QuickFoodsEditorSheet({
  visible,
  onClose,
  quickFoods,
  onUpdate,
}: QuickFoodsEditorSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [localFoods, setLocalFoods] = useState<QuickFood[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [pendingRemoveIdx, setPendingRemoveIdx] = useState(-1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<QuickFood[]>([]);
  const [searching, setSearching] = useState(false);
  const [maxToast, setMaxToast] = useState(false);

  const listRef = useRef<QuickFood[]>([]);
  const itemHeightRef = useRef(ITEM_HEIGHT);
  const indexRefsRef = useRef<Array<{ current: number }>>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setLocalFoods([...quickFoods]);
      setSearchQuery("");
      setSearchResults([]);
      setActiveIdx(-1);
      setHoverIdx(-1);
      setPendingRemoveIdx(-1);
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    listRef.current = localFoods;
  }, [localFoods]);

  // Keep indexRefs array in sync with list length
  if (indexRefsRef.current.length < localFoods.length) {
    while (indexRefsRef.current.length < localFoods.length) {
      indexRefsRef.current.push({ current: indexRefsRef.current.length });
    }
  }
  for (let i = 0; i < localFoods.length; i++) {
    if (indexRefsRef.current[i]) indexRefsRef.current[i].current = i;
  }

  function getDisplacement(i: number): number {
    if (activeIdx === -1 || hoverIdx === -1) return 0;
    if (i === activeIdx) return 0;
    const h = itemHeightRef.current > 0 ? itemHeightRef.current : ITEM_HEIGHT;
    if (activeIdx < hoverIdx && i > activeIdx && i <= hoverIdx) return -h;
    if (activeIdx > hoverIdx && i < activeIdx && i >= hoverIdx) return h;
    return 0;
  }

  const handleDragStart = useCallback((i: number) => {
    setActiveIdx(i);
    setHoverIdx(i);
  }, []);

  const handleHover = useCallback((i: number) => {
    setHoverIdx(i);
  }, []);

  const handleDrop = useCallback((from: number, to: number) => {
    setActiveIdx(-1);
    setHoverIdx(-1);
    if (from !== to) {
      // Cancel any pending remove when the list is reordered
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      setPendingRemoveIdx(-1);
    }
    if (from === to) return;
    setLocalFoods((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
    if (Platform.OS !== "web") Haptics.selectionAsync();
  }, []);

  const handleRemove = useCallback((i: number) => {
    if (pendingRemoveIdx === i) {
      // Second tap — confirm removal with heavy haptic
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      setPendingRemoveIdx(-1);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      setLocalFoods((prev) => prev.filter((_, idx) => idx !== i));
    } else {
      // First tap — enter pending state with medium haptic
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setPendingRemoveIdx(i);
      pendingTimerRef.current = setTimeout(() => {
        setPendingRemoveIdx(-1);
        pendingTimerRef.current = null;
      }, 1500);
    }
  }, [pendingRemoveIdx]);

  const showMaxToast = useCallback(() => {
    setMaxToast(true);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    setTimeout(() => setMaxToast(false), 2500);
  }, []);

  const handleAdd = useCallback(
    (food: QuickFood) => {
      if (localFoods.length >= MAX_QUICK_FOODS) {
        showMaxToast();
        return;
      }
      if (localFoods.some((f) => f.name === food.name)) return;
      if (Platform.OS !== "web") Haptics.selectionAsync();
      setLocalFoods((prev) => {
        if (prev.length >= MAX_QUICK_FOODS) return prev;
        if (prev.some((f) => f.name === food.name)) return prev;
        return [...prev, food];
      });
    },
    [localFoods, showMaxToast]
  );

  // Debounced OFFs search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10`;
        const res = await fetch(url);
        const json = (await res.json()) as { products?: OFFProduct[] };
        const parsed = (json.products ?? [])
          .map(parseOFF)
          .filter((x): x is QuickFood => x !== null);
        setSearchResults(parsed.slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  function handleDone() {
    onUpdate(localFoods);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleDone}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleDone} />
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
          <View style={[styles.handleBar, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Edit Quick-Add
            </Text>
            <TouchableOpacity
              onPress={handleDone}
              activeOpacity={0.8}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground ?? "#fff" }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {/* Current foods section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  CURRENT
                </Text>
                <Text
                  style={[
                    styles.sectionCount,
                    {
                      color:
                        localFoods.length >= MAX_QUICK_FOODS
                          ? colors.destructive ?? "#ef4444"
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {localFoods.length}/{MAX_QUICK_FOODS}
                </Text>
              </View>

              {localFoods.length === 0 ? (
                <View style={[styles.emptyState, { borderColor: colors.border }]}>
                  <Ionicons
                    name="fast-food-outline"
                    size={28}
                    color={colors.mutedForeground}
                  />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    No quick foods — search below to add some
                  </Text>
                </View>
              ) : (
                <View>
                  {localFoods.map((food, i) => (
                    <DragItem
                      key={`${food.name}-${i}`}
                      food={food}
                      indexRef={indexRefsRef.current[i]}
                      listRef={listRef}
                      itemHeightRef={itemHeightRef}
                      isActive={activeIdx === i}
                      isHover={hoverIdx === i && activeIdx !== i}
                      isPending={pendingRemoveIdx === i}
                      displacement={getDisplacement(i)}
                      onDragStart={handleDragStart}
                      onHover={handleHover}
                      onDrop={handleDrop}
                      onRemove={handleRemove}
                      colors={colors}
                    />
                  ))}
                </View>
              )}
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Add section */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                ADD FOODS
              </Text>

              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Ionicons name="search-outline" size={15} color={colors.mutedForeground} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search OpenFoodFacts…"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.searchInput, { color: colors.foreground }]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searching ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : searchQuery.length > 0 ? (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={15} color={colors.mutedForeground} />
                  </Pressable>
                ) : null}
              </View>

              {searchResults.length > 0 && (
                <View
                  style={[styles.resultsList, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  {searchResults.map((result, i) => {
                    const alreadyAdded = localFoods.some((f) => f.name === result.name);
                    const atMax = localFoods.length >= MAX_QUICK_FOODS && !alreadyAdded;
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          if (alreadyAdded) return;
                          handleAdd(result);
                        }}
                        activeOpacity={alreadyAdded ? 1 : 0.7}
                        style={[
                          styles.resultRow,
                          { borderBottomColor: colors.border },
                          i === searchResults.length - 1 && styles.resultRowLast,
                          alreadyAdded && { opacity: 0.5 },
                        ]}
                      >
                        <View style={styles.resultInfo}>
                          <Text
                            style={[styles.resultName, { color: colors.foreground }]}
                            numberOfLines={1}
                          >
                            {result.name}
                          </Text>
                          <Text style={[styles.resultMacros, { color: colors.mutedForeground }]}>
                            P {result.protein}g · C {result.carbs}g · F {result.fat}g
                            {result.servingLabel ? `  ·  per ${result.servingLabel}` : ""}
                          </Text>
                        </View>
                        <Text style={[styles.resultCal, { color: colors.primary }]}>
                          {result.calories}
                        </Text>
                        <View style={styles.resultAction}>
                          {alreadyAdded ? (
                            <Ionicons name="checkmark-circle" size={19} color="#10b981" />
                          ) : (
                            <Ionicons
                              name="add-circle-outline"
                              size={19}
                              color={atMax ? colors.mutedForeground : colors.primary}
                            />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {!searching && searchQuery.trim().length > 0 && searchResults.length === 0 && (
                <Text style={[styles.noResults, { color: colors.mutedForeground }]}>
                  No results found
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Max-foods toast */}
          {maxToast && (
            <View
              style={[
                styles.maxToast,
                {
                  backgroundColor: colors.card,
                  borderColor: (colors.destructive ?? "#ef4444") + "55",
                },
              ]}
            >
              <Ionicons
                name="add-circle-outline"
                size={15}
                color={colors.destructive ?? "#ef4444"}
              />
              <Text
                style={[styles.maxToastText, { color: colors.destructive ?? "#ef4444" }]}
              >
                Maximum {MAX_QUICK_FOODS} foods reached
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    minHeight: 300,
    paddingTop: 8,
    overflow: "hidden",
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
  },
  doneBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  emptyState: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 220,
  },
  // Drag item
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
    minHeight: ITEM_HEIGHT,
    gap: 10,
    paddingRight: 10,
  },
  dragHandle: {
    width: 44,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  itemIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
  },
  itemMacros: {
    fontSize: 11,
  },
  itemCal: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 36,
    textAlign: "right",
  },
  removeBtn: {
    padding: 4,
  },
  // Search
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  resultsList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 13,
    fontWeight: "600",
  },
  resultMacros: {
    fontSize: 11,
  },
  resultCal: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 34,
    textAlign: "right",
  },
  resultAction: {
    width: 24,
    alignItems: "center",
  },
  noResults: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  // Max toast
  maxToast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  maxToastText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
