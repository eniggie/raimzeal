import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from "react-native-reanimated";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  FILTER_HINT_STORAGE_KEY,
  REORDER_HINT_STORAGE_KEY,
  HISTORY_FILTER_HINT_STORAGE_KEY,
  PRESET_NUDGE_STORAGE_KEY,
  SWIPE_DELETE_HINT_STORAGE_KEY,
  HISTORY_SWIPE_DELETE_HINT_STORAGE_KEY,
  PRESET_LONG_PRESS_HINT_KEY,
  QUICK_FOOD_GRAMS_HINT_KEY,
  FAV_FOOD_GRAMS_HINT_KEY,
  RECENT_FOOD_GRAMS_HINT_KEY,
  PRESET_REORDER_HINT_KEY,
  INFO_BUTTON_TOOLTIP_KEY,
  FAV_RESET_DEFAULTS_HINT_KEY,
  RECENT_RESET_DEFAULTS_HINT_KEY,
} from "@/lib/hints";

import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { usePer100gDefault } from "@/hooks/usePer100gDefault";
import { useSwipeHint } from "@/hooks/useSwipeHint";
import { useToggleFavorite } from "@/hooks/useToggleFavorite";
import { useFitness, MealLog, FavoriteFood, type QuickFood } from "@/contexts/FitnessContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchUserPreferences, upsertUserPreferences } from "@/lib/db";
import { useMacroGoals, MacroGoals } from "@/contexts/MacroGoalsContext";
import { GlassCard } from "@/components/GlassCard";
import { ProgressRing } from "@/components/ProgressRing";
import { BarcodeScannerModal, ScannedFood, getRecentScans, getRecentLastViewed } from "@/components/BarcodeScannerModal";
import { RecentlyScannedModal } from "@/components/RecentlyScannedModal";
import { CalorieTrendChart } from "@/components/CalorieTrendChart";
import { MacroRing } from "@/components/MacroRing";
import { QuickFoodsEditorSheet } from "@/components/QuickFoodsEditorSheet";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useSyncIndicator } from "@/hooks/useSyncIndicator";

const DEBOUNCE_MS = 500;
const PAGE_SIZE = 20;

type MealType = MealLog["mealType"];

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "#f59f0a",
  lunch: "#C9A84C",
  dinner: "#8B31C7",
  snack: "#21c45d",
};

const QUICK_FOODS: Omit<MealLog, "id" | "date">[] = [
  { name: "Protein Shake", calories: 180, protein: 25, carbs: 10, fat: 4, mealType: "breakfast",
    servingLabel: "1 scoop (35g)", nutrients100g: { calories: 514, protein: 71, carbs: 29, fat: 11 } },
  { name: "Chicken Breast (150g)", calories: 248, protein: 46, carbs: 0, fat: 5, mealType: "lunch",
    servingLabel: "1 serving (150g)", nutrients100g: { calories: 165, protein: 31, carbs: 0, fat: 3 } },
  { name: "Brown Rice (1 cup)", calories: 215, protein: 5, carbs: 45, fat: 2, mealType: "lunch",
    servingLabel: "1 cup (195g)", nutrients100g: { calories: 110, protein: 3, carbs: 23, fat: 1 } },
  { name: "Greek Yogurt", calories: 130, protein: 17, carbs: 8, fat: 3, mealType: "snack",
    servingLabel: "1 container (170g)", nutrients100g: { calories: 76, protein: 10, carbs: 5, fat: 2 } },
  { name: "Banana", calories: 89, protein: 1, carbs: 23, fat: 0, mealType: "snack",
    servingLabel: "1 medium (118g)", nutrients100g: { calories: 75, protein: 1, carbs: 20, fat: 0 } },
  { name: "Almonds (30g)", calories: 174, protein: 6, carbs: 6, fat: 15, mealType: "snack",
    servingLabel: "1 oz (30g)", nutrients100g: { calories: 580, protein: 20, carbs: 20, fat: 50 } },
  { name: "Oatmeal (1 cup)", calories: 147, protein: 5, carbs: 27, fat: 3, mealType: "breakfast",
    servingLabel: "1 cup cooked (240g)", nutrients100g: { calories: 61, protein: 2, carbs: 11, fat: 1 } },
  { name: "Salmon Fillet (150g)", calories: 312, protein: 43, carbs: 0, fat: 15, mealType: "dinner",
    servingLabel: "1 fillet (150g)", nutrients100g: { calories: 208, protein: 29, carbs: 0, fat: 10 } },
];

const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

type NumericFoodKey = "calories" | "protein" | "carbs" | "fat";

interface NutritionFilterDef {
  key: string;
  label: string;
  icon: IoniconsName;
  defaultThreshold: number;
  unit: string;
  direction: "gte" | "lte";
  nutrient: NumericFoodKey;
}

interface NutritionFilter {
  key: string;
  label: string;
  chipLabel: string;
  icon: IoniconsName;
  test: (item: ScannedFood) => boolean;
}

const FILTER_DEFS: NutritionFilterDef[] = [
  {
    key: "high_protein",
    label: "High Protein",
    icon: "barbell-outline",
    defaultThreshold: 15,
    unit: "g",
    direction: "gte",
    nutrient: "protein",
  },
  {
    key: "low_calorie",
    label: "Low Calorie",
    icon: "flame-outline",
    defaultThreshold: 150,
    unit: "kcal",
    direction: "lte",
    nutrient: "calories",
  },
  {
    key: "low_fat",
    label: "Low Fat",
    icon: "water-outline",
    defaultThreshold: 5,
    unit: "g",
    direction: "lte",
    nutrient: "fat",
  },
  {
    key: "low_carb",
    label: "Low Carb",
    icon: "leaf-outline",
    defaultThreshold: 10,
    unit: "g",
    direction: "lte",
    nutrient: "carbs",
  },
];

const THRESHOLDS_STORAGE_KEY = "@nutrition_filter_thresholds";
const ACTIVE_FILTERS_STORAGE_KEY = "@nutrition_active_filters";
const CUSTOM_PRESETS_STORAGE_KEY = "@nutrition_custom_filter_presets";
const LAST_USED_GRAMS_KEY = "@nutrition_last_used_grams";
const EDIT_PER100G_PREF_KEY = "@nutrition_edit_per100g_pref";
const LAST_USED_MEAL_KEY = "@nutrition_last_used_meal";
const LAST_USED_VIEW_KEY = "@nutrition_last_used_view";
const LAST_USED_SERVING_KEY = "@nutrition_last_used_serving";
const HISTORY_DATE_RANGE_KEY = "@nutrition_history_date_range";
const CUSTOM_DATE_RANGE_KEY = "@nutrition_custom_date_range";
const HISTORY_MEAL_FILTER_KEY = "@nutrition_history_meal_filter";
const TREND_METRIC_STORAGE_KEY = "@nutrition_trend_metric";
const HIGHLIGHTED_DATE_STORAGE_KEY = "@nutrition_highlighted_date";
const JUMP_TO_HISTORY_KEY = "@nutrition_jump_to_history";
const MANUAL_MACROS_KEY = "@nutrition_manual_macros";
const JUMP_TO_MACRO_KEY = "@nutrition_jump_to_macro";

interface CustomFilterPreset {
  id: string;
  name: string;
  filterKeys: string[];
}

type FilterThresholds = Record<string, number>;

function getDefaultThresholds(): FilterThresholds {
  const defaults: FilterThresholds = {};
  for (const def of FILTER_DEFS) {
    defaults[def.key] = def.defaultThreshold;
  }
  return defaults;
}

function buildFilters(thresholds: FilterThresholds): NutritionFilter[] {
  return FILTER_DEFS.map((def) => {
    const threshold = thresholds[def.key] ?? def.defaultThreshold;
    const symbol = def.direction === "gte" ? "≥" : "≤";
    return {
      key: def.key,
      label: def.label,
      chipLabel: `${def.label} ${symbol}${threshold}${def.unit}`,
      icon: def.icon,
      test: (item: ScannedFood) => {
        const val: number = item[def.nutrient];
        return def.direction === "gte" ? val >= threshold : val <= threshold;
      },
    };
  });
}

interface ManualForm {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const EMPTY_MANUAL: ManualForm = { name: "", calories: "", protein: "", carbs: "", fat: "" };

interface OFFProduct {
  product_name?: string;
  serving_size?: string;
  serving_quantity?: number;
  serving_quantity_unit?: string;
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

interface OFFSearchResponse {
  products?: OFFProduct[];
}

function parseOFFProduct(p: OFFProduct): ScannedFood | null {
  const name = p.product_name?.trim();
  if (!name) return null;
  const n = p.nutriments ?? {};

  const servingSize = p.serving_size?.trim();
  const hasAnyServingNutrient =
    n["energy-kcal_serving"] !== undefined ||
    n.proteins_serving !== undefined ||
    n.carbohydrates_serving !== undefined ||
    n.fat_serving !== undefined;
  const useServingNutrients = !!(servingSize && hasAnyServingNutrient);
  const useServingQuantity = !!(servingSize && p.serving_quantity && !hasAnyServingNutrient);
  const isGramBased = p.serving_quantity
    ? p.serving_quantity_unit
      ? p.serving_quantity_unit.toLowerCase() === "g"
      : /(?:^|\s|\()\d+(?:\.\d+)?\s*g(?:\)|$|\s|,)/i.test(p.serving_size ?? "")
    : false;
  const gramLabel = isGramBased ? `${p.serving_quantity}g` : undefined;
  const servingLabel = useServingNutrients || useServingQuantity ? (gramLabel ?? servingSize) : undefined;
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
}

type QuickItem = Omit<MealLog, "id" | "date"> & { _kind: "quick" };
type SearchItem = ScannedFood & { _kind: "search" };
type FoodListItem = QuickItem | SearchItem;

// QUICK_LIST is kept as a fallback constant only; the rendered list uses quickFoods from context
const QUICK_LIST_DEFAULT: FoodListItem[] = QUICK_FOODS.map((f) => ({ ...f, _kind: "quick" }));

const DRAG_FAV_ITEM_HEIGHT = 80;
const DRAG_PRESET_ITEM_HEIGHT = 58;

const SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8 };

interface DraggableFavItemProps {
  food: FavoriteFood;
  indexRef: React.MutableRefObject<number>;
  listRef: React.MutableRefObject<FavoriteFood[]>;
  itemHeightRef: React.MutableRefObject<number>;
  isActive: boolean;
  isHover: boolean;
  displacement: number;
  onDragStart: (index: number) => void;
  onHover: (index: number) => void;
  onDrop: (from: number, to: number) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}

function DraggableFavItem({
  food,
  indexRef,
  listRef,
  itemHeightRef,
  isActive,
  isHover,
  displacement,
  onDragStart,
  onHover,
  onDrop,
  colors,
}: DraggableFavItemProps) {
  const dragY = useSharedValue(0);
  const dispY = useSharedValue(0);
  const currentDy = useRef(0);

  useEffect(() => {
    dispY.value = withSpring(displacement, SPRING_CONFIG);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, { dy }) => {
        dragY.value = dy;
        currentDy.current = dy;
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_FAV_ITEM_HEIGHT;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(dy / slotHeight)));
        onHoverRef.current(to);
      },
      onPanResponderRelease: () => {
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_FAV_ITEM_HEIGHT;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(currentDy.current / slotHeight)));
        dragY.value = withSpring(0, SPRING_CONFIG);
        onDropRef.current(from, to);
      },
      onPanResponderTerminate: () => {
        dragY.value = withSpring(0, SPRING_CONFIG);
        onHoverRef.current(-1);
      },
    })
  ).current;

  return (
    <Reanimated.View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && itemHeightRef.current !== h) {
          itemHeightRef.current = h;
        }
      }}
      style={[
        styles.foodCard,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? "#f59f0a99" : isHover ? "#f59f0a55" : "#f59f0a40",
          zIndex: isActive ? 100 : 1,
          elevation: isActive ? 8 : 0,
          shadowColor: "#000",
          shadowOpacity: isActive ? 0.18 : 0,
          shadowRadius: isActive ? 8 : 0,
          shadowOffset: { width: 0, height: 4 },
          opacity: isActive ? 0.92 : 1,
        },
        animatedStyle,
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        <Ionicons name="reorder-three-outline" size={24} color={colors.mutedForeground} />
      </View>
      <View style={[styles.foodIcon, { backgroundColor: "#f59f0a20" }]}>
        <Ionicons name="star" size={18} color="#f59f0a" />
      </View>
      <View style={styles.foodInfo}>
        <Text style={[styles.foodName, { color: colors.foreground }]} numberOfLines={1}>
          {food.name}
        </Text>
        <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
          P {food.protein}g · C {food.carbs}g · F {food.fat}g
        </Text>
        <View style={[styles.servingPill, { backgroundColor: colors.primary + "18" }]}>
          <Text style={[styles.servingPillText, { color: colors.primary }]}>
            {food.servingLabel ? `per ${food.servingLabel}` : "per serving"}
          </Text>
        </View>
      </View>
      <Text style={[styles.foodCal, { color: colors.primary }]}>{food.calories}</Text>
    </Reanimated.View>
  );
}

interface DraggablePresetItemProps {
  preset: CustomFilterPreset;
  indexRef: React.MutableRefObject<number>;
  listRef: React.MutableRefObject<CustomFilterPreset[]>;
  itemHeightRef: React.MutableRefObject<number>;
  isActive: boolean;
  isHover: boolean;
  displacement: number;
  onDragStart: (index: number) => void;
  onHover: (index: number) => void;
  onDrop: (from: number, to: number) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}

function DraggablePresetItem({
  preset,
  indexRef,
  listRef,
  itemHeightRef,
  isActive,
  isHover,
  displacement,
  onDragStart,
  onHover,
  onDrop,
  colors,
}: DraggablePresetItemProps) {
  const dragY = useSharedValue(0);
  const dispY = useSharedValue(0);
  const currentDy = useRef(0);

  useEffect(() => {
    dispY.value = withSpring(displacement, SPRING_CONFIG);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, { dy }) => {
        dragY.value = dy;
        currentDy.current = dy;
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_PRESET_ITEM_HEIGHT;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(dy / slotHeight)));
        onHoverRef.current(to);
      },
      onPanResponderRelease: () => {
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_PRESET_ITEM_HEIGHT;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(currentDy.current / slotHeight)));
        dragY.value = withSpring(0, SPRING_CONFIG);
        onDropRef.current(from, to);
      },
      onPanResponderTerminate: () => {
        dragY.value = withSpring(0, SPRING_CONFIG);
        onHoverRef.current(-1);
      },
    })
  ).current;

  return (
    <Reanimated.View
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && itemHeightRef.current !== h) {
          itemHeightRef.current = h;
        }
      }}
      style={[
        styles.presetDragItem,
        {
          backgroundColor: colors.card,
          borderColor: isActive
            ? colors.secondary + "99"
            : isHover
            ? colors.secondary + "55"
            : colors.secondary + "30",
          zIndex: isActive ? 100 : 1,
          elevation: isActive ? 8 : 0,
          shadowColor: "#000",
          shadowOpacity: isActive ? 0.18 : 0,
          shadowRadius: isActive ? 8 : 0,
          shadowOffset: { width: 0, height: 4 },
          opacity: isActive ? 0.92 : 1,
        },
        animatedStyle,
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        <Ionicons name="reorder-three-outline" size={24} color={colors.mutedForeground} />
      </View>
      <View style={[styles.foodIcon, { backgroundColor: colors.secondary + "20" }]}>
        <Ionicons name="bookmark" size={16} color={colors.secondary} />
      </View>
      <View style={styles.foodInfo}>
        <Text style={[styles.foodName, { color: colors.foreground }]} numberOfLines={1}>
          {preset.name}
        </Text>
        <Text style={[styles.foodMacros, { color: colors.mutedForeground }]} numberOfLines={1}>
          {preset.filterKeys.join(" · ")}
        </Text>
      </View>
    </Reanimated.View>
  );
}

interface HorizontalDraggablePresetChipProps {
  preset: CustomFilterPreset;
  indexRef: React.MutableRefObject<number>;
  listRef: React.MutableRefObject<CustomFilterPreset[]>;
  avgChipWidthRef: React.MutableRefObject<number>;
  isActive: boolean;
  isHover: boolean;
  displacement: number;
  onDragStart: (index: number) => void;
  onHover: (index: number) => void;
  onDrop: (from: number, to: number) => void;
  onDelete: (id: string) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}

function HorizontalDraggablePresetChip({
  preset,
  indexRef,
  listRef,
  avgChipWidthRef,
  isActive,
  isHover,
  displacement,
  onDragStart,
  onHover,
  onDrop,
  onDelete,
  colors,
}: HorizontalDraggablePresetChipProps) {
  const dragX = useSharedValue(0);
  const dispX = useSharedValue(0);
  const currentDx = useRef(0);

  useEffect(() => {
    dispX.value = withSpring(displacement, SPRING_CONFIG);
  }, [displacement]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value + dispX.value }],
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
        dragX.value = 0;
        currentDx.current = 0;
        onDragStartRef.current(indexRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, { dx }) => {
        dragX.value = dx;
        currentDx.current = dx;
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotWidth = avgChipWidthRef.current > 0 ? avgChipWidthRef.current : 80;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(dx / slotWidth)));
        onHoverRef.current(to);
      },
      onPanResponderRelease: () => {
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotWidth = avgChipWidthRef.current > 0 ? avgChipWidthRef.current : 80;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(currentDx.current / slotWidth)));
        dragX.value = withSpring(0, SPRING_CONFIG);
        onDropRef.current(from, to);
      },
      onPanResponderTerminate: () => {
        dragX.value = withSpring(0, SPRING_CONFIG);
        onHoverRef.current(-1);
      },
    })
  ).current;

  return (
    <Reanimated.View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) avgChipWidthRef.current = w;
      }}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          borderRadius: 20,
          borderWidth: 1,
          maxWidth: 200,
          marginRight: 6,
          backgroundColor: isActive
            ? colors.secondary + "35"
            : isHover
            ? colors.secondary + "25"
            : colors.secondary + "18",
          borderColor: isActive
            ? colors.secondary + "cc"
            : isHover
            ? colors.secondary + "88"
            : colors.secondary + "55",
          zIndex: isActive ? 100 : 1,
          elevation: isActive ? 8 : 0,
          shadowColor: "#000",
          shadowOpacity: isActive ? 0.18 : 0,
          shadowRadius: isActive ? 6 : 0,
          shadowOffset: { width: 0, height: 3 },
          opacity: isActive ? 0.92 : 1,
          overflow: "hidden",
        },
        animatedStyle,
      ]}
    >
      {/* Draggable region — panHandlers here so the × button is outside the gesture zone */}
      <View style={styles.presetChipInner} {...panResponder.panHandlers}>
        <Ionicons name="reorder-two-outline" size={11} color={colors.secondary + "88"} />
        <Ionicons name="bookmark" size={12} color={colors.secondary} />
        <Text style={[styles.presetChipText, { color: colors.secondary }]} numberOfLines={1}>
          {preset.name}
        </Text>
      </View>
      {/* Delete button — outside panHandlers so tapping it never starts a drag */}
      <TouchableOpacity
        onPress={() => onDelete(preset.id)}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
        style={styles.presetDeleteBtn}
      >
        <Ionicons name="close" size={13} color={colors.secondary + "cc"} />
      </TouchableOpacity>
    </Reanimated.View>
  );
}

function formatRecentDate(dateStr: string): string {
  const now = new Date();
  const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr === localDateStr) return "Today";
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const logMidnight = new Date(dateStr + "T00:00:00");
  const diffDays = Math.floor((todayMidnight.getTime() - logMidnight.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1) return `${diffDays} days ago`;
  return dateStr;
}

function formatCustomRangeLabel(start: string, end: string): string {
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (start === end) return `${MONTHS[s.getMonth()]} ${s.getDate()}`;
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()}\u2013${e.getDate()}`;
  }
  return `${MONTHS[s.getMonth()]} ${s.getDate()} \u2013 ${MONTHS[e.getMonth()]} ${e.getDate()}`;
}

interface CalendarPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  markedDates: Set<string>;
  onRangeSelect: (start: string, end: string) => void;
  initialStart?: string | null;
  initialEnd?: string | null;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}

function CalendarPickerSheet({
  visible,
  onClose,
  markedDates,
  onRangeSelect,
  initialStart,
  initialEnd,
  colors,
}: CalendarPickerSheetProps) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = Math.floor((screenWidth - 32) / 7);

  const [viewYear, setViewYear] = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());
  const [pendingStart, setPendingStart] = React.useState<string | null>(null);
  const [pendingEnd, setPendingEnd] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (visible) {
      const base = initialStart ? new Date(initialStart + "T12:00:00") : new Date();
      setViewYear(base.getFullYear());
      setViewMonth(base.getMonth());
      setPendingStart(initialStart ?? null);
      setPendingEnd(initialEnd ?? null);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth >= today.getMonth())) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function handleDayPress(ds: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!pendingStart || pendingEnd !== null) {
      setPendingStart(ds);
      setPendingEnd(null);
    } else if (ds <= pendingStart) {
      setPendingStart(ds);
      setPendingEnd(null);
    } else {
      setPendingEnd(ds);
    }
  }

  function handleApply() {
    if (!pendingStart) return;
    const end = pendingEnd ?? pendingStart;
    onRangeSelect(pendingStart, end);
    onClose();
  }

  function padZ(n: number) { return n.toString().padStart(2, "0"); }
  function dayStr(d: number) { return `${viewYear}-${padZ(viewMonth + 1)}-${padZ(d)}`; }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const monthLabel = `${MONTHS[viewMonth]} ${viewYear}`;
  const canGoNext = !(viewYear === today.getFullYear() && viewMonth === today.getMonth());

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={calStyles.overlay}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[calStyles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[calStyles.handle, { backgroundColor: colors.border }]} />

          <View style={calStyles.monthNav}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="chevron-back" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={[calStyles.monthLabel, { color: colors.foreground }]}>{monthLabel}</Text>
            <TouchableOpacity
              onPress={nextMonth}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{ opacity: canGoNext ? 1 : 0.25 }}
            >
              <Ionicons name="chevron-forward" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={calStyles.dowRow}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
              <Text key={d} style={[calStyles.dowText, { color: colors.mutedForeground, width: cellSize }]}>{d}</Text>
            ))}
          </View>

          <View style={calStyles.grid}>
            {cells.map((cell, idx) => {
              if (cell === null) return <View key={`e${idx}`} style={{ width: cellSize, height: cellSize }} />;
              const ds = dayStr(cell);
              const isFuture = ds > todayStr;
              const isStart = pendingStart === ds;
              const isEnd = pendingEnd === ds;
              const isInRange = !!(pendingStart && pendingEnd && ds > pendingStart && ds < pendingEnd);
              const isSelected = isStart || isEnd;
              const isToday = ds === todayStr;
              const hasLog = markedDates.has(ds);
              return (
                <TouchableOpacity
                  key={ds}
                  style={[
                    calStyles.cell,
                    { width: cellSize, height: cellSize },
                    isSelected && { backgroundColor: colors.primary, borderRadius: 8 },
                    isInRange && { backgroundColor: colors.primary + "28" },
                    isToday && !isSelected && { borderRadius: 8, borderWidth: 1, borderColor: colors.primary + "80" },
                  ]}
                  onPress={() => !isFuture && handleDayPress(ds)}
                  activeOpacity={isFuture ? 1 : 0.75}
                  disabled={isFuture}
                >
                  <Text style={[
                    calStyles.dayNum,
                    { color: isFuture ? colors.border : colors.foreground },
                    isSelected && { color: colors.primaryForeground },
                    isToday && !isSelected && { color: colors.primary },
                  ]}>
                    {cell}
                  </Text>
                  {hasLog && (
                    <View style={[calStyles.logDot, {
                      backgroundColor: isSelected ? colors.primaryForeground + "aa" : colors.primary,
                    }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[calStyles.hint, { color: colors.mutedForeground }]}>
            {!pendingStart
              ? "Tap a day to select, or pick two days for a range"
              : !pendingEnd
              ? "Now tap the end date for your range"
              : `Selected: ${formatCustomRangeLabel(pendingStart, pendingEnd)}`}
          </Text>

          <View style={calStyles.actionRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[calStyles.btn, calStyles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[calStyles.btnText, { color: colors.mutedForeground }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleApply}
              disabled={!pendingStart}
              style={[calStyles.btn, calStyles.applyBtn, {
                backgroundColor: pendingStart ? colors.primary : colors.muted,
                opacity: pendingStart ? 1 : 0.5,
              }]}
            >
              <Text style={[calStyles.btnText, {
                color: pendingStart ? colors.primaryForeground : colors.mutedForeground,
              }]}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const calStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, paddingHorizontal: 16, paddingBottom: 32, paddingTop: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, marginBottom: 10 },
  monthLabel: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  dowRow: { flexDirection: "row", marginBottom: 2 },
  dowText: { textAlign: "center", fontSize: 11, fontFamily: "Inter_500Medium", paddingVertical: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { alignItems: "center", justifyContent: "center" },
  dayNum: { fontSize: 14, fontFamily: "Inter_400Regular" },
  logDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 14, marginBottom: 16 },
  actionRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
  cancelBtn: { borderWidth: 1 },
  applyBtn: {},
  btnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});

function AnimatedCountdown({ value, style }: { value: number; style?: object }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      scale.value = withSequence(
        withTiming(1.4, { duration: 80 }),
        withSpring(1, { damping: 6, stiffness: 300 })
      );
      opacity.value = withSequence(
        withTiming(0.4, { duration: 60 }),
        withTiming(1, { duration: 120 })
      );
    }
  }, [value]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Reanimated.Text style={[style, animatedStyle]}>{value}</Reanimated.Text>
  );
}

/**
 * Aggregate multiple independent sync callbacks into one finishSync call.
 * Waits for all `count` callbacks to fire; calls `finishSync(false)` if any
 * one of them reported failure, `finishSync(true)` only if all succeeded.
 * This prevents a later success from masking an earlier failure.
 */
function makeCombinedSyncCallback(
  count: number,
  finishSync: (ok: boolean) => void
): (ok: boolean) => void {
  let pending = count;
  let anyFailed = false;
  return (ok: boolean) => {
    if (!ok) anyFailed = true;
    if (--pending === 0) finishSync(!anyFailed);
  };
}

export default function NutritionScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getTodayMeals, getTodayMacros, addMealLog, removeMealLog, removeMealLogsByName, mealLogs, favoriteFoods, reorderFavoriteFoods, settings, dismissHint, isHintDismissed, getHintDismissedAt, quickFoods, updateQuickFoods, dataResetCount, user, dismissedHints } = useFitness();
  const { goals: macroGoals, setGoals: setMacroGoals } = useMacroGoals();
  const { syncStatus, startSync, finishSync } = useSyncIndicator();
  const CALORIE_GOAL = macroGoals.calories;
  const PROTEIN_GOAL = macroGoals.protein;
  const CARBS_GOAL = macroGoals.carbs;
  const FAT_GOAL = macroGoals.fat;

  function handleToggleFavorite(food: FavoriteFood) {
    const willStar = toggleFavoriteWithToast(food);
    if (willStar) {
      setHighlightedFavorite(food.name);
      highlightAnim.setValue(1);
      pendingScrollFavoriteRef.current = food.name;
      if (starScrollTimerRef.current) clearTimeout(starScrollTimerRef.current);
      starScrollTimerRef.current = setTimeout(() => {
        starScrollTimerRef.current = null;
        const cardY = favoriteCardYsRef.current[food.name];
        if (cardY != null) {
          pendingScrollFavoriteRef.current = null;
          flatListRef.current?.scrollToOffset({ offset: cardY, animated: true });
        }
        // else: card is new — onLayout will fire and handle the scroll
      }, 80);
      Animated.timing(highlightAnim, {
        toValue: 0,
        duration: 1400,
        delay: 400,
        useNativeDriver: false,
      }).start(() => setHighlightedFavorite(null));
    } else {
      delete favoriteCardYsRef.current[food.name];
    }
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const todayMeals = getTodayMeals();
  const { calories, protein, carbs, fat } = getTodayMacros();

  const [recentlyStarredNames, setRecentlyStarredNames] = useState<Set<string>>(new Set());
  const recentlyStarredTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [recentlyUnstarredNames, setRecentlyUnstarredNames] = useState<Set<string>>(new Set());
  const recentlyUnstarredTimersRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  React.useEffect(() => {
    const starredTimers = recentlyStarredTimersRef;
    const unstarredTimers = recentlyUnstarredTimersRef;
    return () => {
      Object.values(starredTimers.current).forEach(clearTimeout);
      Object.values(unstarredTimers.current).forEach(clearTimeout);
    };
  }, []);

  const recentFoods = React.useMemo(() => {
    const favoriteNames = new Set(favoriteFoods.map((f) => f.name));
    const seen = new Set<string>();
    const result: (Omit<MealLog, "id" | "date"> & { lastEaten: string })[] = [];
    const sortedLogs = [...mealLogs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    for (const log of sortedLogs) {
      if (!seen.has(log.name) && (!favoriteNames.has(log.name) || recentlyStarredNames.has(log.name)) && !recentlyUnstarredNames.has(log.name)) {
        seen.add(log.name);
        result.push({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType, lastEaten: log.date, ...(log.amountGrams !== undefined ? { amountGrams: log.amountGrams } : {}), ...(log.nutrients100g ? { nutrients100g: log.nutrients100g } : {}), ...(log.servingLabel ? { servingLabel: log.servingLabel } : {}) });
      }
      if (result.length >= 20) break;
    }
    return result;
  }, [mealLogs, favoriteFoods, recentlyStarredNames, recentlyUnstarredNames]);

  const historyDays = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const byDate: Record<string, MealLog[]> = {};
    for (const log of mealLogs) {
      if (log.date === today) continue;
      if (!byDate[log.date]) byDate[log.date] = [];
      byDate[log.date].push(log);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, logs]) => {
        const totals = logs.reduce(
          (acc, m) => ({
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        return { date, logs, totals };
      });
  }, [mealLogs]);

  const markedDates = React.useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const s = new Set<string>();
    for (const log of mealLogs) {
      if (log.date !== today) s.add(log.date);
    }
    return s;
  }, [mealLogs]);

  type HistoryDateRange = "7d" | "30d" | "all" | "custom";
  type HistoryMealFilter = MealType | "all";

  const [historyDateRange, setHistoryDateRange] = useState<HistoryDateRange>("all");
  const [historyMealFilter, setHistoryMealFilter] = useState<HistoryMealFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string } | null>(null);
  const [calendarSheetVisible, setCalendarSheetVisible] = useState(false);
  const [macroAlert, setMacroAlert] = useState<{ cal: number; prot: number; carb: number; fat: number } | null>(null);
  const macroAlertTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [macroDrillDown, setMacroDrillDown] = useState<{
    label: string;
    macro: "protein" | "carbs" | "fat";
    goal: number;
    color: string;
    badge: "low" | "over";
    avgValue: number;
    outOfRangeDays: { date: string; value: number }[];
    inRangeDays: { date: string; value: number }[];
  } | null>(null);

  function openMacroDrillDown(
    macro: "protein" | "carbs" | "fat",
    label: string,
    goal: number,
    color: string,
    avg: number,
  ) {
    const ratio = goal > 0 ? avg / goal : 1;
    const badge: "low" | "over" = ratio < 0.8 ? "low" : "over";
    const outOfRange: { date: string; value: number }[] = [];
    const inRange: { date: string; value: number }[] = [];
    for (const { date, totals } of filteredHistoryDays) {
      const val = Math.round(totals[macro]);
      const r = goal > 0 ? val / goal : 1;
      const isOut = badge === "low" ? r < 0.8 : r > 1.1;
      if (isOut) {
        outOfRange.push({ date, value: val });
      } else {
        inRange.push({ date, value: val });
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMacroDrillDown({ label, macro, goal, color, badge, avgValue: avg, outOfRangeDays: outOfRange, inRangeDays: inRange });
  }

  const filteredHistoryDays = React.useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const cutoff =
      historyDateRange === "7d"
        ? todayStart.getTime() - 6 * 86400000
        : historyDateRange === "30d"
        ? todayStart.getTime() - 29 * 86400000
        : null;

    return historyDays
      .filter(({ date }) => {
        if (historyDateRange === "custom" && customDateRange) {
          return date >= customDateRange.start && date <= customDateRange.end;
        }
        if (!cutoff) return true;
        return new Date(date + "T12:00:00").getTime() >= cutoff;
      })
      .map(({ date, logs, totals }) => {
        const filteredLogs =
          historyMealFilter === "all"
            ? logs
            : logs.filter((m) => m.mealType === historyMealFilter);
        const filteredTotals = filteredLogs.reduce(
          (acc, m) => ({
            calories: acc.calories + m.calories,
            protein: acc.protein + m.protein,
            carbs: acc.carbs + m.carbs,
            fat: acc.fat + m.fat,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
        return { date, logs: filteredLogs, totals: filteredTotals };
      })
      .filter(({ logs }) => logs.length > 0);
  }, [historyDays, historyDateRange, historyMealFilter, customDateRange]);

  const firstTodayLogId = React.useMemo(() => {
    for (const meal of MEALS) {
      const logs = todayMeals.filter((m) => m.mealType === meal);
      if (logs.length > 0) return logs[0].id;
    }
    return null;
  }, [todayMeals]);

  const firstHistoryLogId = React.useMemo(() => {
    for (const { logs } of filteredHistoryDays) {
      for (const meal of MEALS) {
        const entries = logs.filter((m) => m.mealType === meal);
        if (entries.length > 0) return entries[0].id;
      }
    }
    return null;
  }, [filteredHistoryDays]);

  const weeklyAvgSummary = React.useMemo(() => {
    const count = filteredHistoryDays.length;
    if (count === 0) return null;
    const sum = filteredHistoryDays.reduce(
      (acc, { totals }) => ({
        calories: acc.calories + totals.calories,
        protein: acc.protein + totals.protein,
        carbs: acc.carbs + totals.carbs,
        fat: acc.fat + totals.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    return {
      days: count,
      avgCalories: Math.round(sum.calories / count),
      avgProtein: Math.round(sum.protein / count),
      avgCarbs: Math.round(sum.carbs / count),
      avgFat: Math.round(sum.fat / count),
    };
  }, [filteredHistoryDays]);

  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);
  const [highlightedMacro, setHighlightedMacro] = useState<"calories" | "protein" | "carbs" | "fat" | null>(null);
  const highlightClearTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(HIGHLIGHTED_DATE_STORAGE_KEY).then((val) => {
      if (val) setHighlightedDate(val);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (highlightedDate) {
      AsyncStorage.setItem(HIGHLIGHTED_DATE_STORAGE_KEY, highlightedDate).catch(() => {});
    } else {
      AsyncStorage.removeItem(HIGHLIGHTED_DATE_STORAGE_KEY).catch(() => {});
    }
  }, [highlightedDate]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(JUMP_TO_HISTORY_KEY)
        .then((flag) => {
          if (flag !== "1") return;
          return AsyncStorage.removeItem(JUMP_TO_HISTORY_KEY).then(() =>
            AsyncStorage.getItem(HIGHLIGHTED_DATE_STORAGE_KEY)
          ).then((val) => {
            if (val) {
              setHighlightedDate(val);
              setActiveTab("history");
              setTimeout(() => {
                scrollToDateCard(val);
              }, 300);
            }
          });
        })
        .catch(() => {});

      AsyncStorage.getItem(JUMP_TO_MACRO_KEY)
        .then((macro) => {
          if (!macro) return;
          return AsyncStorage.removeItem(JUMP_TO_MACRO_KEY).then(() => {
            if (macro === "calories" || macro === "protein" || macro === "carbs" || macro === "fat") {
              setHighlightedMacro(macro);
              setActiveTab("today");
              const timer = setTimeout(() => setHighlightedMacro(null), 2500);
              return () => clearTimeout(timer);
            }
          });
        })
        .catch(() => {});
    }, [])
  );

  type TrendMetric = "calories" | "protein" | "carbs" | "fat";

  const [trendMetric, setTrendMetric] = useState<TrendMetric>("calories");
  const trendPillPulse = useRef(new Animated.Value(1)).current;
  const trendMetricMounted = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(TREND_METRIC_STORAGE_KEY).then((val) => {
      if (val === "calories" || val === "protein" || val === "carbs" || val === "fat") {
        setTrendMetric(val);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(TREND_METRIC_STORAGE_KEY, trendMetric).catch(() => {});
    if (!trendMetricMounted.current) {
      trendMetricMounted.current = true;
      return;
    }
    trendPillPulse.setValue(1);
    Animated.sequence([
      Animated.timing(trendPillPulse, { toValue: 1.18, duration: 90, useNativeDriver: true }),
      Animated.timing(trendPillPulse, { toValue: 0.93, duration: 70, useNativeDriver: true }),
      Animated.timing(trendPillPulse, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  }, [trendMetric]);

  const trendChartDays = React.useMemo(() => {
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    // No day cap — all days are passed to the chart so the user can scroll
    // through their full history. The chart expands horizontally when barCount > 14.
    const source =
      historyDateRange === "all"
        ? historyDays.slice().reverse()
        : filteredHistoryDays.slice().reverse();
    // ≤7 bars: "Jan 5" (readable with wide bars)
    // 8–14 bars: "Mon" (day names, non-repeating within one week)
    // >14 bars: "Jan 5" (scrollable — day names would repeat across weeks)
    const useShortDate = source.length <= 7 || source.length > 14;
    return source.map(({ date, totals }) => {
      const d = new Date(date + "T12:00:00");
      const label = useShortDate
        ? `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`
        : DAY_LABELS[d.getDay()];
      return {
        date,
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
        label,
      };
    });
  }, [historyDays, filteredHistoryDays, historyDateRange]);

  const trendChartTotalDays = React.useMemo(
    () => (historyDateRange === "all" ? historyDays.length : filteredHistoryDays.length),
    [historyDateRange, historyDays.length, filteredHistoryDays.length]
  );

  useEffect(() => {
    // Wait until the underlying history data has loaded before validating.
    // Once historyDays is non-empty we know data has settled; after that,
    // absence from trendChartDays (even an empty chart) means the date is stale.
    if (!highlightedDate || historyDays.length === 0) {
      if (highlightClearTimeoutRef.current) {
        clearTimeout(highlightClearTimeoutRef.current);
        highlightClearTimeoutRef.current = null;
      }
      return;
    }
    const found = trendChartDays.some((d) => d.date === highlightedDate);
    if (found) {
      // Date is valid again (e.g. user changed range back) — cancel any pending clear.
      if (highlightClearTimeoutRef.current) {
        clearTimeout(highlightClearTimeoutRef.current);
        highlightClearTimeoutRef.current = null;
      }
    } else {
      // Date is outside the visible range. Delay clearing state so the chart's ghost
      // bar and pill fade-out animations have time to complete (180 ms) before the
      // parent state is nulled. The timeout is cancelled if the date re-appears or
      // the component unmounts.
      if (highlightClearTimeoutRef.current) clearTimeout(highlightClearTimeoutRef.current);
      highlightClearTimeoutRef.current = setTimeout(() => {
        setHighlightedDate(null);
        highlightClearTimeoutRef.current = null;
      }, 200);
    }
    return () => {
      if (highlightClearTimeoutRef.current) {
        clearTimeout(highlightClearTimeoutRef.current);
        highlightClearTimeoutRef.current = null;
      }
    };
  }, [trendChartDays, highlightedDate, historyDays.length]);

  const chartDisplayDays = React.useMemo(
    () =>
      trendChartDays.map((day) => ({
        date: day.date,
        value: day[trendMetric],
        label: day.label,
      })),
    [trendChartDays, trendMetric]
  );

  const highlightedDateMealBreakdown = React.useMemo(() => {
    if (!highlightedDate) return [];
    const ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
    const totals: Partial<Record<MealType, number>> = {};
    for (const log of mealLogs) {
      if (log.date !== highlightedDate) continue;
      totals[log.mealType] = (totals[log.mealType] ?? 0) + log[trendMetric];
    }
    return ORDER.filter((mt) => totals[mt] !== undefined).map((mt) => ({
      mealType: mt,
      value: Math.round(totals[mt]!),
    }));
  }, [highlightedDate, mealLogs, trendMetric]);

  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showRecentScans, setShowRecentScans] = useState(false);
  const [recentScanCount, setRecentScanCount] = useState(0);
  const prevScanCountRef = useRef(0);
  const hasHydratedScanCountRef = useRef(false);
  const badgeScaleAnim = useSharedValue(1);
  const badgeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScaleAnim.value }],
  }));
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMacrosPrefilledFor, setManualMacrosPrefilledFor] = useState<string | null>(null);
  const [showMacroDefaultsSheet, setShowMacroDefaultsSheet] = useState(false);
  const [macroDefaultsEntries, setMacroDefaultsEntries] = useState<{ name: string; calories: string; protein: string; carbs: string; fat: string }[]>([]);
  const [showQuickEditor, setShowQuickEditor] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Omit<MealLog, "id" | "date"> | null>(null);
  const [selectedFoodServingLabel, setSelectedFoodServingLabel] = useState<string | undefined>(undefined);
  const [selectedFoodIsApiResult, setSelectedFoodIsApiResult] = useState(false);
  const [selectedFoodNutrients100g, setSelectedFoodNutrients100g] = useState<{ calories: number; protein: number; carbs: number; fat: number } | undefined>(undefined);
  const [selectedFoodUnit, setSelectedFoodUnit] = useState<"g" | "ml">("g");
  const [modalShowPer100g, setModalShowPer100g] = useState(false);
  const [servings, setServings] = useState(1);
  const [servingsText, setServingsText] = useState("1");
  const [grams, setGrams] = useState("100");
  const [gramsPreFillHint, setGramsPreFillHint] = useState<string | null>(null);
  const [servingsPreFillHint, setServingsPreFillHint] = useState(false);
  const [macrosFromMemory, setMacrosFromMemory] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<MealType>("lunch");
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);
  // true while calories has been auto-filled from macros (not typed by the user)
  const manualCaloriesAutoFilled = useRef(false);
  const [showManualBreakdown, setShowManualBreakdown] = useState(false);
  const [manualMeal, setManualMeal] = useState<MealType>("snack");
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [per100gItems, setPer100gItems] = useState<Set<string>>(new Set());
  const [quickPer100gMap, setQuickPer100gMap] = useState<Record<string, boolean>>({});
  const [recentFoodsPer100g, setRecentFoodsPer100g] = useState<Set<string>>(new Set());
  const [recentFoodsExpanded, setRecentFoodsExpanded] = useState(false);
  const [defaultPer100g, setDefaultPer100g] = usePer100gDefault();
  const [previewSheetFood, setPreviewSheetFood] = useState<SearchItem | null>(null);
  const previewMacroScale  = useRef({ protein: new Animated.Value(1), carbs: new Animated.Value(1), fat: new Animated.Value(1) }).current;
  const previewMacroOpacity = useRef({ protein: new Animated.Value(1), carbs: new Animated.Value(1), fat: new Animated.Value(1) }).current;
  const highlightPreviewMacro = (macro: "protein" | "carbs" | "fat") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const scale   = previewMacroScale[macro];
    const opacity = previewMacroOpacity[macro];
    scale.setValue(1);
    opacity.setValue(1);
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 10 }),
        Animated.timing(opacity, { toValue: 0.65, duration: 120, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const [filterThresholds, setFilterThresholds] = useState<FilterThresholds>(getDefaultThresholds);
  const filterThresholdsRef = useRef<FilterThresholds>(filterThresholds);
  filterThresholdsRef.current = filterThresholds;
  const activeFiltersRef = useRef<Set<string>>(activeFilters);
  activeFiltersRef.current = activeFilters;
  const macroGoalsRef = useRef<MacroGoals>(macroGoals);
  macroGoalsRef.current = macroGoals;
  const [thresholdEditKey, setThresholdEditKey] = useState<string | null>(null);
  const [thresholdEditValue, setThresholdEditValue] = useState<string>("");

  const [isReordering, setIsReordering] = useState(false);
  const [reorderItems, setReorderItems] = useState<FavoriteFood[]>([]);
  const reorderItemsRef = useRef<FavoriteFood[]>([]);
  const [activeReorderIdx, setActiveReorderIdx] = useState(-1);
  const [hoverReorderIdx, setHoverReorderIdx] = useState(-1);
  const indexRefsRef = useRef<React.MutableRefObject<number>[]>([]);
  const itemHeightRef = useRef(DRAG_FAV_ITEM_HEIGHT);
  const lastUsedMealMapRef = useRef<Record<string, string>>({});
  const lastUsedGramsMapRef = useRef<Record<string, string>>({});
  const lastUsedServingsMapRef = useRef<Record<string, number>>({});

  const [undoMeal, setUndoMeal] = useState<MealLog | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerStartRef = useRef<number>(0);
  const undoTotalDurationMsRef = useRef<number>(0);
  const undoAnim = useRef(new Animated.Value(0)).current;
  const undoProgressAnim = useRef(new Animated.Value(1)).current;

  const [restoredLabel, setRestoredLabel] = useState<string | null>(null);
  const restoredAnim = useRef(new Animated.Value(0)).current;
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [logTodayName, setLogTodayName] = useState<string | null>(null);
  const logTodayAnim = useRef(new Animated.Value(0)).current;
  const logTodayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLoggedToastRef = useRef(false);

  const { toggleFavoriteWithToast, isFavorite, starToastElement } = useToggleFavorite({
    bottomOffset: undoMeal !== null ? insets.bottom + 72 : insets.bottom + 16,
  });

  const [presetSavedMessage, setPresetSavedMessage] = useState<string | null>(null);
  const presetSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetSavedAnim = useRef(new Animated.Value(0)).current;

  const [filterSyncToastVisible, setFilterSyncToastVisible] = useState(false);
  const filterSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterSyncAnim = useRef(new Animated.Value(0)).current;

  const [goalsSyncToastVisible, setGoalsSyncToastVisible] = useState(false);
  const goalsSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goalsSyncAnim = useRef(new Animated.Value(0)).current;

  const [per100gToastMessage, setPer100gToastMessage] = useState<string | null>(null);
  const per100gToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const per100gToastAnim = useRef(new Animated.Value(0)).current;

  const [savedMealToastMessage, setSavedMealToastMessage] = useState<string | null>(null);
  const savedMealToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedMealToastAnim = useRef(new Animated.Value(0)).current;

  const [deletedPreset, setDeletedPreset] = useState<CustomFilterPreset | null>(null);
  const presetUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetUndoCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [presetUndoCountdown, setPresetUndoCountdown] = useState(0);
  const presetUndoTimerStartRef = useRef<number>(0);
  const presetUndoTotalDurationMsRef = useRef<number>(0);
  const presetUndoAnim = useRef(new Animated.Value(0)).current;
  const presetUndoProgressAnim = useRef(new Animated.Value(1)).current;

  const [renamedPreset, setRenamedPreset] = useState<{ old: CustomFilterPreset; newName: string } | null>(null);
  const presetRenameUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetRenameUndoCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [presetRenameUndoCountdown, setPresetRenameUndoCountdown] = useState(0);
  const presetRenameUndoTimerStartRef = useRef<number>(0);
  const presetRenameUndoTotalDurationMsRef = useRef<number>(0);
  const presetRenameUndoAnim = useRef(new Animated.Value(0)).current;
  const presetRenameUndoProgressAnim = useRef(new Animated.Value(1)).current;
  const presetDeleteOffsetAnim = useRef(new Animated.Value(0)).current;
  const presetRenameOffsetAnim = useRef(new Animated.Value(0)).current;
  const keyboardHeightAnim = useRef(new Animated.Value(0)).current;

  const [customPresets, setCustomPresets] = useState<CustomFilterPreset[]>([]);
  const customPresetsRef = useRef<CustomFilterPreset[]>(customPresets);
  customPresetsRef.current = customPresets;
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");

  const [editingPreset, setEditingPreset] = useState<CustomFilterPreset | null>(null);
  const [editPresetName, setEditPresetName] = useState("");

  const [isReorderingPresets, setIsReorderingPresets] = useState(false);
  const [reorderPresetsItems, setReorderPresetsItems] = useState<CustomFilterPreset[]>([]);
  const reorderPresetsRef = useRef<CustomFilterPreset[]>([]);
  const [activeReorderPresetIdx, setActiveReorderPresetIdx] = useState(-1);
  const [hoverReorderPresetIdx, setHoverReorderPresetIdx] = useState(-1);
  const indexRefsPresetRef = useRef<React.MutableRefObject<number>[]>([]);
  const presetItemHeightRef = useRef(DRAG_PRESET_ITEM_HEIGHT);
  const avgPresetChipWidthRef = useRef(80);

  const [filterSummaryVisible, setFilterSummaryVisible] = useState(false);
  const filterSummaryFadeAnim = useRef(new Animated.Value(0)).current;
  const filterSummarySlideAnim = useRef(new Animated.Value(-6)).current;
  const filterSummaryScaleAnim = useRef(new Animated.Value(1)).current;
  const [previewFilterKey, setPreviewFilterKey] = useState<string | null>(null);

  const [filterHintVisible, setFilterHintVisible] = useState(false);
  const filterHintFadeAnim = useRef(new Animated.Value(0)).current;
  const filterHintShownRef = useRef(false);
  const filterHintDismissedRef = useRef(false);
  const filterHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipReplayTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [reorderHintVisible, setReorderHintVisible] = useState(false);
  const reorderHintFadeAnim = useRef(new Animated.Value(0)).current;
  const reorderHintShownRef = useRef(false);
  const reorderHintDismissedRef = useRef(false);
  const reorderHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [quickGramsHintVisible, setQuickGramsHintVisible] = useState(false);
  const quickGramsHintFadeAnim = useRef(new Animated.Value(0)).current;
  const quickGramsHintShownRef = useRef(false);

  const [favGramsHintVisible, setFavGramsHintVisible] = useState(false);
  const favGramsHintFadeAnim = useRef(new Animated.Value(0)).current;
  const favGramsHintShownRef = useRef(false);

  const [recentGramsHintVisible, setRecentGramsHintVisible] = useState(false);
  const recentGramsHintFadeAnim = useRef(new Animated.Value(0)).current;
  const recentGramsHintShownRef = useRef(false);

  const [favResetDefaultsHintVisible, setFavResetDefaultsHintVisible] = useState(false);
  const favResetDefaultsHintFadeAnim = useRef(new Animated.Value(0)).current;
  const favResetDefaultsHintShownRef = useRef(false);
  const favResetDefaultsHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recentResetDefaultsHintVisible, setRecentResetDefaultsHintVisible] = useState(false);
  const recentResetDefaultsHintFadeAnim = useRef(new Animated.Value(0)).current;
  const recentResetDefaultsHintShownRef = useRef(false);
  const recentResetDefaultsHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [resultCountVisible, setResultCountVisible] = useState(false);
  const resultCountFadeAnim = useRef(new Animated.Value(0)).current;

  const [historyFilterHintVisible, setHistoryFilterHintVisible] = useState(false);
  const historyFilterHintFadeAnim = useRef(new Animated.Value(0)).current;
  const historyResetFadeAnim = useRef(new Animated.Value(0)).current;
  const historyResetSlideAnim = useRef(new Animated.Value(16)).current;
  const todayResetFadeAnim = useRef(new Animated.Value(0)).current;
  const todayResetSlideAnim = useRef(new Animated.Value(16)).current;
  const todayClearFadeAnim = useRef(new Animated.Value(0)).current;
  const todayClearSlideAnim = useRef(new Animated.Value(16)).current;
  const todaySaveFadeAnim = useRef(new Animated.Value(0)).current;
  const todaySaveSlideAnim = useRef(new Animated.Value(16)).current;
  const searchLoadingDimAnim = useRef(new Animated.Value(1)).current;
  const historyDividerFadeAnim = useRef(new Animated.Value(0)).current;
  const historyDividerSlideAnim = useRef(new Animated.Value(-8)).current;
  const historyChipDividerFadeAnim = useRef(new Animated.Value(0)).current;
  const historyFilterHintShownRef = useRef(false);
  const historyFilterHintDismissedRef = useRef(false);
  const historyFilterHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyFilterScrollRef = useRef<ScrollView>(null);
  const HISTORY_CHIP_COUNT = 8;
  const historyChipHighlightAnims = useRef(
    Array.from({ length: HISTORY_CHIP_COUNT }, () => new Animated.Value(0))
  ).current;
  const chipScaleAnims = useRef<Record<string, Animated.Value>>({});
  const chipGlowAnims = useRef<Record<string, Animated.Value>>({});
  const presetChipScaleAnims = useRef<Record<string, Animated.Value>>({});
  const presetChipGlowAnims = useRef<Record<string, Animated.Value>>({});
  const prevActivePresetIdRef = useRef<string | null>(null);

  const historyChipFadeAnims = useRef(
    Array.from({ length: HISTORY_CHIP_COUNT }, () => new Animated.Value(0))
  ).current;
  const historyChipSlideAnims = useRef(
    Array.from({ length: HISTORY_CHIP_COUNT }, () => new Animated.Value(18))
  ).current;

  const [presetNudgeVisible, setPresetNudgeVisible] = useState(false);
  const presetNudgeFadeAnim = useRef(new Animated.Value(0)).current;
  const presetNudgeShownRef = useRef(false);
  const presetNudgeDismissedRef = useRef(false);

  const [presetLongPressHintVisible, setPresetLongPressHintVisible] = useState(false);
  const presetLongPressHintFadeAnim = useRef(new Animated.Value(0)).current;
  const presetLongPressHintShownRef = useRef(false);
  const presetLongPressHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presetHintPendingRef = useRef(false);

  const [presetReorderHintVisible, setPresetReorderHintVisible] = useState(false);
  const presetReorderHintFadeAnim = useRef(new Animated.Value(0)).current;
  const presetReorderHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevDismissedHintsLenRef = useRef<number | null>(null);

  const [infoTooltipVisible, setInfoTooltipVisible] = useState(false);
  const infoTooltipFadeAnim = useRef(new Animated.Value(0)).current;
  const infoTooltipShownRef = useRef(false);
  const infoTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dayBreakdownDate, setDayBreakdownDate] = useState<string | null>(null);
  const [breakdownReAddCount, setBreakdownReAddCount] = useState(0);
  const [breakdownHighlightMacro, setBreakdownHighlightMacro] = useState<"protein" | "carbs" | "fat" | null>(null);
  const [breakdownBarTooltipMeal, setBreakdownBarTooltipMeal] = useState<string | null>(null);
  const breakdownHighlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const favoritesYRef = useRef<number>(0);
  const favoriteCardYsRef = useRef<Record<string, number>>({});
  const pendingScrollFavoriteRef = useRef<string | null>(null);
  const selectedFoodSourceRef = useRef<"quick" | "fav" | "recent" | null>(null);
  const [highlightedFavorite, setHighlightedFavorite] = useState<string | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList<FoodListItem>>(null);
  const starScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyCardYsRef = useRef<Record<string, number>>({});
  const trendChartYRef = useRef<number>(0);
  const historyFilterBarYRef = useRef<number>(0);
  const [historyFilterPanelOpen, setHistoryFilterPanelOpen] = useState(false);
  const { height: windowHeight } = useWindowDimensions();
  const scrollYRef = useRef<number>(0);
  const seenDatesRef = useRef<Set<string>>(new Set());
  const [, setSeenDatesTick] = useState(0);

  const refreshRecentScanCount = useCallback(async () => {
    try {
      const [scans, lastViewed] = await Promise.all([
        getRecentScans(),
        getRecentLastViewed(),
      ]);
      const newCount = scans.filter((s) => s.scannedAt > lastViewed).length;
      if (!hasHydratedScanCountRef.current) {
        hasHydratedScanCountRef.current = true;
        prevScanCountRef.current = newCount;
      }
      setRecentScanCount(newCount);
    } catch {
      // Non-fatal
    }
  }, []);

  useEffect(() => {
    refreshRecentScanCount();
  }, [refreshRecentScanCount]);

  useEffect(() => {
    if (recentScanCount > prevScanCountRef.current) {
      badgeScaleAnim.value = withSequence(
        withSpring(1.4, { damping: 4, stiffness: 300 }),
        withSpring(1, { damping: 10, stiffness: 200 })
      );
    }
    prevScanCountRef.current = recentScanCount;
  }, [recentScanCount]);

  useEffect(() => {
    Animated.timing(searchLoadingDimAnim, {
      toValue: searchLoading ? 0.5 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [searchLoading]);

  // Reset filter/history UI state whenever the user clears all app data.
  // dataResetCount increments once per clear; skip count === 0 (initial mount).
  const prevResetCountRef = useRef(dataResetCount);
  useEffect(() => {
    if (dataResetCount === 0 || dataResetCount === prevResetCountRef.current) return;
    prevResetCountRef.current = dataResetCount;
    const defaults = getDefaultThresholds();
    setActiveFilters(new Set());
    setFilterThresholds(defaults);
    AsyncStorage.removeItem(THRESHOLDS_STORAGE_KEY).catch(() => {});
    setCustomPresets([]);
    setHistoryDateRange("all");
    setHistoryMealFilter("all");
    setCustomDateRange(null);
    setTrendMetric("calories");
    setHighlightedDate(null);
    setActiveTab("today");
    setHistoryFilterPanelOpen(false);
    setRecentScanCount(0);
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        upsertUserPreferences(session.user.id, {
          activeFilters: [],
          customPresets: [],
          filterThresholds: defaults,
        }).catch(() => {});
      });
    }
  }, [dataResetCount]);

  // Detect when any preset chip transitions from active → inactive and play
  // a spring-down animation on it, regardless of what caused the filter change.
  useEffect(() => {
    const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
    let currentActivePresetId: string | null = null;
    for (const p of customPresets) {
      const pKeys = p.filterKeys.filter((k) => validKeys.has(k));
      if (
        pKeys.length > 0 &&
        pKeys.length === activeFilters.size &&
        pKeys.every((k) => activeFilters.has(k))
      ) {
        currentActivePresetId = p.id;
        break;
      }
    }
    const prevId = prevActivePresetIdRef.current;
    if (prevId && prevId !== currentActivePresetId) {
      if (!presetChipScaleAnims.current[prevId]) {
        presetChipScaleAnims.current[prevId] = new Animated.Value(1);
      }
      const deactAnim = presetChipScaleAnims.current[prevId];
      Animated.sequence([
        Animated.spring(deactAnim, {
          toValue: 0.88,
          speed: 40,
          bounciness: 4,
          useNativeDriver: true,
        }),
        Animated.spring(deactAnim, {
          toValue: 1,
          speed: 30,
          bounciness: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevActivePresetIdRef.current = currentActivePresetId;
  }, [activeFilters, customPresets]);

  const markDateSeen = useCallback((date: string) => {
    if (!seenDatesRef.current.has(date)) {
      seenDatesRef.current.add(date);
      setSeenDatesTick((t) => t + 1);
    }
  }, []);

  const checkHistoryVisibility = useCallback(
    (scrollY: number) => {
      const entries = Object.entries(historyCardYsRef.current);
      // Short-circuit: nothing recorded yet, or all cards already seen.
      if (entries.length === 0 || seenDatesRef.current.size >= entries.length) return;

      const viewportBottom = scrollY + windowHeight;
      let changed = false;
      for (const [date, cardY] of entries) {
        if (!seenDatesRef.current.has(date) && cardY < viewportBottom) {
          seenDatesRef.current.add(date);
          changed = true;
        }
      }
      if (changed) setSeenDatesTick((t) => t + 1);
    },
    [windowHeight],
  );

  const handleFlatListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      scrollYRef.current = y;
      if (activeTab === "history") {
        checkHistoryVisibility(y);
      }
    },
    [activeTab, checkHistoryVisibility],
  );

  function dismissFilterHint() {
    if (filterHintTimerRef.current) {
      clearTimeout(filterHintTimerRef.current);
      filterHintTimerRef.current = null;
    }
    filterHintDismissedRef.current = true;
    Animated.timing(filterHintFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setFilterHintVisible(false));
    dismissHint(FILTER_HINT_STORAGE_KEY);
  }

  function extendFilterHint() {
    if (filterHintVisible && !filterHintDismissedRef.current) {
      if (filterHintTimerRef.current) {
        clearTimeout(filterHintTimerRef.current);
      }
      filterHintTimerRef.current = setTimeout(() => {
        filterHintTimerRef.current = null;
        Animated.timing(filterHintFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setFilterHintVisible(false);
          dismissHint(FILTER_HINT_STORAGE_KEY);
        });
      }, 4000);
    }
  }

  function dismissReorderHint() {
    if (reorderHintTimerRef.current) {
      clearTimeout(reorderHintTimerRef.current);
      reorderHintTimerRef.current = null;
    }
    reorderHintDismissedRef.current = true;
    Animated.timing(reorderHintFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setReorderHintVisible(false));
    dismissHint(REORDER_HINT_STORAGE_KEY, Date.now());
  }

  function dismissQuickGramsHint() {
    Animated.timing(quickGramsHintFadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setQuickGramsHintVisible(false));
    dismissHint(QUICK_FOOD_GRAMS_HINT_KEY);
  }

  function dismissFavGramsHint() {
    Animated.timing(favGramsHintFadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setFavGramsHintVisible(false));
    dismissHint(FAV_FOOD_GRAMS_HINT_KEY);
  }

  function dismissRecentGramsHint() {
    Animated.timing(recentGramsHintFadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setRecentGramsHintVisible(false));
    dismissHint(RECENT_FOOD_GRAMS_HINT_KEY);
  }

  function dismissFavResetDefaultsHint() {
    if (favResetDefaultsHintTimerRef.current) {
      clearTimeout(favResetDefaultsHintTimerRef.current);
      favResetDefaultsHintTimerRef.current = null;
    }
    Animated.timing(favResetDefaultsHintFadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setFavResetDefaultsHintVisible(false));
    dismissHint(FAV_RESET_DEFAULTS_HINT_KEY);
  }

  function dismissRecentResetDefaultsHint() {
    if (recentResetDefaultsHintTimerRef.current) {
      clearTimeout(recentResetDefaultsHintTimerRef.current);
      recentResetDefaultsHintTimerRef.current = null;
    }
    Animated.timing(recentResetDefaultsHintFadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setRecentResetDefaultsHintVisible(false));
    dismissHint(RECENT_RESET_DEFAULTS_HINT_KEY);
  }

  function reloadQuickPer100gMap() {
    AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
      try {
        const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
        const result: Record<string, boolean> = {};
        for (const food of quickFoods) {
          if (!food.nutrients100g || !food.servingLabel) continue;
          const entry = map[food.name];
          if (entry !== null && typeof entry === "object") {
            result[food.name] = entry.per100g;
          } else if (typeof entry === "boolean") {
            result[food.name] = entry;
          }
        }
        setQuickPer100gMap(result);
      } catch {}
    }).catch(() => {});
  }

  function dismissHistoryFilterHint() {
    if (historyFilterHintTimerRef.current) {
      clearTimeout(historyFilterHintTimerRef.current);
      historyFilterHintTimerRef.current = null;
    }
    historyFilterHintDismissedRef.current = true;
    Animated.timing(historyFilterHintFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setHistoryFilterHintVisible(false));
    dismissHint(HISTORY_FILTER_HINT_STORAGE_KEY);
  }

  function dismissPresetNudge() {
    presetNudgeDismissedRef.current = true;
    Animated.timing(presetNudgeFadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setPresetNudgeVisible(false));
    dismissHint(PRESET_NUDGE_STORAGE_KEY);
  }

  function showTipAgain() {
    if (customPresets.length === 0) {
      presetNudgeFadeAnim.setValue(0);
      setPresetNudgeVisible(true);
      Animated.timing(presetNudgeFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      if (activeFilters.size > 0) {
        if (tipReplayTransitionTimerRef.current) {
          clearTimeout(tipReplayTransitionTimerRef.current);
        }
        tipReplayTransitionTimerRef.current = setTimeout(() => {
          tipReplayTransitionTimerRef.current = null;
          Animated.timing(presetNudgeFadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setPresetNudgeVisible(false);
            filterHintFadeAnim.setValue(0);
            setFilterHintVisible(true);
            Animated.timing(filterHintFadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
            if (filterHintTimerRef.current) {
              clearTimeout(filterHintTimerRef.current);
            }
            filterHintTimerRef.current = setTimeout(() => {
              filterHintTimerRef.current = null;
              Animated.timing(filterHintFadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }).start(() => setFilterHintVisible(false));
            }, 3000);
          });
        }, 3000);
      }
    } else {
      presetLongPressHintFadeAnim.setValue(0);
      setPresetLongPressHintVisible(true);
      Animated.timing(presetLongPressHintFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (presetLongPressHintTimerRef.current) {
        clearTimeout(presetLongPressHintTimerRef.current);
      }
      presetLongPressHintTimerRef.current = setTimeout(dismissPresetLongPressHint, 4000);
    }
  }

  function dismissPresetLongPressHint() {
    if (presetLongPressHintTimerRef.current) {
      clearTimeout(presetLongPressHintTimerRef.current);
      presetLongPressHintTimerRef.current = null;
    }
    Animated.timing(presetLongPressHintFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setPresetLongPressHintVisible(false));
    dismissHint(PRESET_LONG_PRESS_HINT_KEY);
  }

  function dismissPresetReorderHint() {
    if (presetReorderHintTimerRef.current) {
      clearTimeout(presetReorderHintTimerRef.current);
      presetReorderHintTimerRef.current = null;
    }
    Animated.timing(presetReorderHintFadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setPresetReorderHintVisible(false));
    dismissHint(PRESET_REORDER_HINT_KEY);
  }

  function handleHistoryFilterHintPress() {
    flatListRef.current?.scrollToOffset({ offset: historyFilterBarYRef.current, animated: true });
    historyFilterScrollRef.current?.scrollTo({ x: 0, animated: true });
    const SCROLL_SETTLE_MS = 350;
    const STAGGER_MS = 60;
    const PER_CHIP_DURATION = 200 + 300 + 400;
    const HINT_FADE_DURATION = 300;
    const totalAnimMs = (HISTORY_CHIP_COUNT - 1) * STAGGER_MS + PER_CHIP_DURATION;
    const dismissDelayMs = SCROLL_SETTLE_MS + totalAnimMs - HINT_FADE_DURATION;
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      historyChipHighlightAnims.forEach((anim, i) => {
        anim.setValue(0);
        Animated.sequence([
          Animated.delay(i * STAGGER_MS),
          Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }),
          Animated.delay(300),
          Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ]).start();
      });
    }, SCROLL_SETTLE_MS);
    setTimeout(dismissHistoryFilterHint, dismissDelayMs);
  }

  useEffect(() => {
    if (favoriteFoods.length < 2) return;
    if (reorderHintShownRef.current) return;
    if (reorderHintDismissedRef.current) return;
    const frequency = settings.reorderHintFrequency ?? "monthly";
    if (frequency === "never") {
      reorderHintDismissedRef.current = true;
      return;
    }
    reorderHintShownRef.current = true;
    const windowMs =
      frequency === "weekly"
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;
    const dismissedAt = getHintDismissedAt(REORDER_HINT_STORAGE_KEY);
    if (dismissedAt !== null) {
      if (Date.now() - dismissedAt < windowMs) {
        reorderHintDismissedRef.current = true;
        return;
      }
      reorderHintShownRef.current = false;
    }
    if (reorderHintDismissedRef.current) return;
    setReorderHintVisible(true);
    Animated.timing(reorderHintFadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
    reorderHintTimerRef.current = setTimeout(() => {
      dismissReorderHint();
    }, 4000);
  }, [favoriteFoods.length, settings.reorderHintFrequency]);

  useEffect(() => {
    return () => {
      if (filterHintTimerRef.current) clearTimeout(filterHintTimerRef.current);
      if (tipReplayTransitionTimerRef.current) clearTimeout(tipReplayTransitionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (reorderHintTimerRef.current) clearTimeout(reorderHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (savedMealToastTimerRef.current) clearTimeout(savedMealToastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const duration = Platform.OS === "ios" ? 250 : 150;
    const showSub = Keyboard.addListener(showEvent, (e) => {
      Animated.timing(keyboardHeightAnim, {
        toValue: e.endCoordinates.height,
        duration,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(keyboardHeightAnim, {
        toValue: 0,
        duration,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeightAnim]);

  useEffect(() => {
    AsyncStorage.getItem(LAST_USED_MEAL_KEY)
      .then((raw) => {
        if (raw) lastUsedMealMapRef.current = JSON.parse(raw) as Record<string, string>;
      })
      .catch(() => {});
    AsyncStorage.getItem(LAST_USED_GRAMS_KEY)
      .then((raw) => {
        if (raw) lastUsedGramsMapRef.current = JSON.parse(raw) as Record<string, string>;
      })
      .catch(() => {});
    AsyncStorage.getItem(LAST_USED_SERVING_KEY)
      .then((raw) => {
        if (raw) lastUsedServingsMapRef.current = JSON.parse(raw) as Record<string, number>;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (recentFoods.length === 0) return;
    AsyncStorage.getItem(LAST_USED_VIEW_KEY)
      .then((raw) => {
        if (!raw) return;
        let map: Record<string, boolean> = {};
        try { map = JSON.parse(raw); } catch { return; }
        const initial = new Set<string>();
        for (const food of recentFoods) {
          if (food.nutrients100g && food.servingLabel && map[food.name] === true) {
            initial.add(food.name);
          }
        }
        setRecentFoodsPer100g(initial);
      })
      .catch(() => {});
  }, [recentFoods]);

  useEffect(() => {
    reloadQuickPer100gMap();
  }, [quickFoods]);

  useEffect(() => {
    if (quickGramsHintShownRef.current) return;
    quickGramsHintShownRef.current = true;
    if (isHintDismissed(QUICK_FOOD_GRAMS_HINT_KEY)) return;
    quickGramsHintFadeAnim.setValue(0);
    setQuickGramsHintVisible(true);
    Animated.timing(quickGramsHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (favGramsHintShownRef.current) return;
    favGramsHintShownRef.current = true;
    if (isHintDismissed(FAV_FOOD_GRAMS_HINT_KEY)) return;
    favGramsHintFadeAnim.setValue(0);
    setFavGramsHintVisible(true);
    Animated.timing(favGramsHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (recentGramsHintShownRef.current) return;
    recentGramsHintShownRef.current = true;
    if (isHintDismissed(RECENT_FOOD_GRAMS_HINT_KEY)) return;
    recentGramsHintFadeAnim.setValue(0);
    setRecentGramsHintVisible(true);
    Animated.timing(recentGramsHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (favoriteFoods.length === 0) return;
    if (favResetDefaultsHintShownRef.current) return;
    favResetDefaultsHintShownRef.current = true;
    if (isHintDismissed(FAV_RESET_DEFAULTS_HINT_KEY)) return;
    favResetDefaultsHintFadeAnim.setValue(0);
    setFavResetDefaultsHintVisible(true);
    Animated.timing(favResetDefaultsHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    favResetDefaultsHintTimerRef.current = setTimeout(() => {
      dismissFavResetDefaultsHint();
    }, 4000);
    return () => {
      if (favResetDefaultsHintTimerRef.current) clearTimeout(favResetDefaultsHintTimerRef.current);
    };
  }, [favoriteFoods.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (recentFoods.length === 0) return;
    if (recentResetDefaultsHintShownRef.current) return;
    recentResetDefaultsHintShownRef.current = true;
    if (isHintDismissed(RECENT_RESET_DEFAULTS_HINT_KEY)) return;
    recentResetDefaultsHintFadeAnim.setValue(0);
    setRecentResetDefaultsHintVisible(true);
    Animated.timing(recentResetDefaultsHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    recentResetDefaultsHintTimerRef.current = setTimeout(() => {
      dismissRecentResetDefaultsHint();
    }, 4000);
    return () => {
      if (recentResetDefaultsHintTimerRef.current) clearTimeout(recentResetDefaultsHintTimerRef.current);
    };
  }, [recentFoods.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (historyFilterHintTimerRef.current) clearTimeout(historyFilterHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!historyFilterPanelOpen) return;
    historyChipFadeAnims.forEach((anim) => anim.setValue(0));
    historyChipSlideAnims.forEach((anim) => anim.setValue(18));
    historyChipDividerFadeAnim.setValue(0);
    // Date-range chips (indices 0–2) stagger in first
    Animated.stagger(
      35,
      [0, 1, 2].map((i) =>
        Animated.parallel([
          Animated.timing(historyChipFadeAnims[i], {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }),
          Animated.spring(historyChipSlideAnims[i], {
            toValue: 0,
            useNativeDriver: true,
            tension: 160,
            friction: 14,
          }),
        ])
      )
    ).start();
    // Divider fades in after the first chips appear
    Animated.sequence([
      Animated.delay(90),
      Animated.timing(historyChipDividerFadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    // Meal-type chips (indices 3–7) start after the divider is visible
    Animated.sequence([
      Animated.delay(130),
      Animated.stagger(
        35,
        [3, 4, 5, 6, 7].map((i) =>
          Animated.parallel([
            Animated.timing(historyChipFadeAnims[i], {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.spring(historyChipSlideAnims[i], {
              toValue: 0,
              useNativeDriver: true,
              tension: 160,
              friction: 14,
            }),
          ])
        )
      ),
    ]).start();
  }, [historyFilterPanelOpen]);

  useEffect(() => {
    if (activeTab !== "history") return;
    if (historyFilterHintShownRef.current) return;
    historyFilterHintShownRef.current = true;
    if (isHintDismissed(HISTORY_FILTER_HINT_STORAGE_KEY)) return;
    if (historyFilterHintDismissedRef.current) return;
    historyFilterHintFadeAnim.setValue(0);
    setHistoryFilterHintVisible(true);
    Animated.timing(historyFilterHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    historyFilterHintTimerRef.current = setTimeout(() => {
      historyFilterHintTimerRef.current = null;
      Animated.timing(historyFilterHintFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setHistoryFilterHintVisible(false);
        dismissHint(HISTORY_FILTER_HINT_STORAGE_KEY);
      });
    }, 4000);
  }, [activeTab]);

  useEffect(() => {
    const isNonDefault = historyDateRange !== "all" || historyMealFilter !== "all";
    if (isNonDefault) {
      historyResetSlideAnim.setValue(16);
      historyDividerSlideAnim.setValue(-8);
      Animated.parallel([
        Animated.timing(historyDividerFadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(historyDividerSlideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
        Animated.sequence([
          Animated.delay(50),
          Animated.parallel([
            Animated.timing(historyResetFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.spring(historyResetSlideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
          ]),
        ]),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(historyDividerFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(historyDividerSlideAnim, { toValue: -8, duration: 180, useNativeDriver: true }),
        Animated.timing(historyResetFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(historyResetSlideAnim, { toValue: 16, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [historyDateRange, historyMealFilter]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (starScrollTimerRef.current) clearTimeout(starScrollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (per100gToastTimerRef.current) {
        clearTimeout(per100gToastTimerRef.current);
        per100gToastTimerRef.current = null;
      }
    };
  }, []);

  function dismissPresetSavedToast(forReplacement = false) {
    presetSavedAnim.stopAnimation();
    Animated.timing(presetSavedAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setPresetSavedMessage(null);
    });
    if (presetSavedTimerRef.current) {
      clearTimeout(presetSavedTimerRef.current);
      presetSavedTimerRef.current = null;
    }
  }

  function showPresetSavedToast(name: string, message?: string) {
    dismissPresetSavedToast(true);
    setPresetSavedMessage(message ?? `Preset "${name}" saved`);
    presetSavedAnim.setValue(0);
    Animated.spring(presetSavedAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    presetSavedTimerRef.current = setTimeout(() => {
      dismissPresetSavedToast();
    }, 2000);
  }

  function dismissFilterSyncToast(forReplacement = false) {
    filterSyncAnim.stopAnimation();
    Animated.timing(filterSyncAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setFilterSyncToastVisible(false);
    });
    if (filterSyncTimerRef.current) {
      clearTimeout(filterSyncTimerRef.current);
      filterSyncTimerRef.current = null;
    }
  }

  function showFilterSyncToast() {
    dismissFilterSyncToast(true);
    setFilterSyncToastVisible(true);
    filterSyncAnim.setValue(0);
    Animated.spring(filterSyncAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    filterSyncTimerRef.current = setTimeout(() => {
      dismissFilterSyncToast();
    }, 2000);
  }

  function dismissGoalsSyncToast(forReplacement = false) {
    goalsSyncAnim.stopAnimation();
    Animated.timing(goalsSyncAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setGoalsSyncToastVisible(false);
    });
    if (goalsSyncTimerRef.current) {
      clearTimeout(goalsSyncTimerRef.current);
      goalsSyncTimerRef.current = null;
    }
  }

  function showGoalsSyncToast() {
    dismissGoalsSyncToast(true);
    setGoalsSyncToastVisible(true);
    goalsSyncAnim.setValue(0);
    Animated.spring(goalsSyncAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    goalsSyncTimerRef.current = setTimeout(() => {
      dismissGoalsSyncToast();
    }, 2000);
  }

  function dismissPer100gToast(forReplacement = false) {
    per100gToastAnim.stopAnimation();
    Animated.timing(per100gToastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setPer100gToastMessage(null);
    });
    if (per100gToastTimerRef.current) {
      clearTimeout(per100gToastTimerRef.current);
      per100gToastTimerRef.current = null;
    }
  }

  function showPer100gToast(message: string) {
    dismissPer100gToast(true);
    setPer100gToastMessage(message);
    per100gToastAnim.setValue(0);
    Animated.spring(per100gToastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    per100gToastTimerRef.current = setTimeout(() => {
      dismissPer100gToast();
    }, 2000);
  }

  function showPresetDeletedToast(preset: CustomFilterPreset) {
    dismissPresetUndoToast(true);
    if (presetUndoTimerRef.current) clearTimeout(presetUndoTimerRef.current);
    if (presetUndoCountdownIntervalRef.current) clearInterval(presetUndoCountdownIntervalRef.current);
    const durationSec = settings.undoWindowSeconds ?? 3;
    const durationMs = durationSec * 1000;
    setDeletedPreset(preset);
    setPresetUndoCountdown(durationSec);
    presetDeleteOffsetAnim.setValue(0);
    if (renamedPreset !== null) {
      Animated.timing(presetRenameOffsetAnim, { toValue: 64, duration: 180, useNativeDriver: false }).start();
    } else {
      presetRenameOffsetAnim.setValue(0);
    }
    presetUndoAnim.setValue(0);
    presetUndoProgressAnim.setValue(1);
    presetUndoTimerStartRef.current = Date.now();
    presetUndoTotalDurationMsRef.current = durationMs;
    Animated.spring(presetUndoAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    Animated.timing(presetUndoProgressAnim, { toValue: 0, duration: durationMs, useNativeDriver: false }).start();
    presetUndoCountdownIntervalRef.current = setInterval(() => {
      setPresetUndoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    presetUndoTimerRef.current = setTimeout(() => {
      dismissPresetUndoToast();
    }, durationMs);
  }

  function handlePresetUndoPressIn() {
    if (!presetUndoTimerRef.current && !presetUndoCountdownIntervalRef.current) return;
    const elapsed = Date.now() - presetUndoTimerStartRef.current;
    const remaining = Math.max(0, presetUndoTotalDurationMsRef.current - elapsed);
    presetUndoTotalDurationMsRef.current = remaining;
    if (presetUndoTimerRef.current) { clearTimeout(presetUndoTimerRef.current); presetUndoTimerRef.current = null; }
    if (presetUndoCountdownIntervalRef.current) { clearInterval(presetUndoCountdownIntervalRef.current); presetUndoCountdownIntervalRef.current = null; }
    presetUndoProgressAnim.stopAnimation();
  }

  function handlePresetUndoPressOut() {
    const remaining = presetUndoTotalDurationMsRef.current;
    if (remaining <= 0 || deletedPreset === null) return;
    presetUndoTimerStartRef.current = Date.now();
    presetUndoProgressAnim.stopAnimation(() => {
      Animated.timing(presetUndoProgressAnim, { toValue: 0, duration: remaining, useNativeDriver: false }).start();
    });
    presetUndoCountdownIntervalRef.current = setInterval(() => {
      setPresetUndoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    presetUndoTimerRef.current = setTimeout(() => {
      dismissPresetUndoToast();
    }, remaining);
  }

  function dismissPresetUndoToast(forReplacement = false) {
    presetUndoProgressAnim.stopAnimation();
    Animated.timing(presetUndoAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) {
        setDeletedPreset(null);
        presetDeleteOffsetAnim.setValue(0);
        Animated.timing(presetRenameOffsetAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
      }
    });
    if (presetUndoTimerRef.current) {
      clearTimeout(presetUndoTimerRef.current);
      presetUndoTimerRef.current = null;
    }
    if (presetUndoCountdownIntervalRef.current) {
      clearInterval(presetUndoCountdownIntervalRef.current);
      presetUndoCountdownIntervalRef.current = null;
    }
  }

  function handleUndoPresetDelete() {
    if (!deletedPreset) return;
    const restored = deletedPreset;
    dismissPresetUndoToast();
    const next = [...customPresets, restored];
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function dismissPresetRenameUndoToast(forReplacement = false) {
    presetRenameUndoProgressAnim.stopAnimation();
    Animated.timing(presetRenameUndoAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) {
        setRenamedPreset(null);
        presetRenameOffsetAnim.setValue(0);
        Animated.timing(presetDeleteOffsetAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start();
      }
    });
    if (presetRenameUndoTimerRef.current) {
      clearTimeout(presetRenameUndoTimerRef.current);
      presetRenameUndoTimerRef.current = null;
    }
    if (presetRenameUndoCountdownIntervalRef.current) {
      clearInterval(presetRenameUndoCountdownIntervalRef.current);
      presetRenameUndoCountdownIntervalRef.current = null;
    }
  }

  function showPresetRenamedToast(oldPreset: CustomFilterPreset, newName: string) {
    dismissPresetRenameUndoToast(true);
    if (presetRenameUndoTimerRef.current) clearTimeout(presetRenameUndoTimerRef.current);
    if (presetRenameUndoCountdownIntervalRef.current) clearInterval(presetRenameUndoCountdownIntervalRef.current);
    const durationSec = settings.undoWindowSeconds ?? 3;
    const durationMs = durationSec * 1000;
    setRenamedPreset({ old: oldPreset, newName });
    setPresetRenameUndoCountdown(durationSec);
    presetRenameOffsetAnim.setValue(0);
    if (deletedPreset !== null) {
      Animated.timing(presetDeleteOffsetAnim, { toValue: 64, duration: 180, useNativeDriver: false }).start();
    } else {
      presetDeleteOffsetAnim.setValue(0);
    }
    presetRenameUndoAnim.setValue(0);
    presetRenameUndoProgressAnim.setValue(1);
    presetRenameUndoTimerStartRef.current = Date.now();
    presetRenameUndoTotalDurationMsRef.current = durationMs;
    Animated.spring(presetRenameUndoAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    Animated.timing(presetRenameUndoProgressAnim, { toValue: 0, duration: durationMs, useNativeDriver: false }).start();
    presetRenameUndoCountdownIntervalRef.current = setInterval(() => {
      setPresetRenameUndoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    presetRenameUndoTimerRef.current = setTimeout(() => {
      dismissPresetRenameUndoToast();
    }, durationMs);
  }

  function handlePresetRenameUndoPressIn() {
    if (!presetRenameUndoTimerRef.current && !presetRenameUndoCountdownIntervalRef.current) return;
    const elapsed = Date.now() - presetRenameUndoTimerStartRef.current;
    const remaining = Math.max(0, presetRenameUndoTotalDurationMsRef.current - elapsed);
    presetRenameUndoTotalDurationMsRef.current = remaining;
    if (presetRenameUndoTimerRef.current) { clearTimeout(presetRenameUndoTimerRef.current); presetRenameUndoTimerRef.current = null; }
    if (presetRenameUndoCountdownIntervalRef.current) { clearInterval(presetRenameUndoCountdownIntervalRef.current); presetRenameUndoCountdownIntervalRef.current = null; }
    presetRenameUndoProgressAnim.stopAnimation();
  }

  function handlePresetRenameUndoPressOut() {
    const remaining = presetRenameUndoTotalDurationMsRef.current;
    if (remaining <= 0 || renamedPreset === null) return;
    presetRenameUndoTimerStartRef.current = Date.now();
    presetRenameUndoProgressAnim.stopAnimation(() => {
      Animated.timing(presetRenameUndoProgressAnim, { toValue: 0, duration: remaining, useNativeDriver: false }).start();
    });
    presetRenameUndoCountdownIntervalRef.current = setInterval(() => {
      setPresetRenameUndoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    presetRenameUndoTimerRef.current = setTimeout(() => {
      dismissPresetRenameUndoToast();
    }, remaining);
  }

  function handleUndoPresetRename() {
    if (!renamedPreset) return;
    const { old: oldPreset } = renamedPreset;
    dismissPresetRenameUndoToast();
    const next = customPresets.map((p) =>
      p.id === oldPreset.id ? { ...p, name: oldPreset.name } : p
    );
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function showUndoToast(meal: MealLog) {
    dismissUndoToast(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    if (undoCountdownIntervalRef.current) clearInterval(undoCountdownIntervalRef.current);
    const durationSec = settings.undoWindowSeconds ?? 3;
    const durationMs = durationSec * 1000;
    setUndoMeal(meal);
    setUndoCountdown(durationSec);
    undoProgressAnim.setValue(1);
    undoTimerStartRef.current = Date.now();
    undoTotalDurationMsRef.current = durationMs;
    Animated.spring(undoAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    Animated.timing(undoProgressAnim, { toValue: 0, duration: durationMs, useNativeDriver: false }).start();
    undoCountdownIntervalRef.current = setInterval(() => {
      setUndoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    undoTimerRef.current = setTimeout(() => {
      dismissUndoToast();
    }, durationMs);
  }

  function handleUndoPressIn() {
    if (!undoTimerRef.current && !undoCountdownIntervalRef.current) return;
    const elapsed = Date.now() - undoTimerStartRef.current;
    const remaining = Math.max(0, undoTotalDurationMsRef.current - elapsed);
    undoTotalDurationMsRef.current = remaining;
    if (undoTimerRef.current) { clearTimeout(undoTimerRef.current); undoTimerRef.current = null; }
    if (undoCountdownIntervalRef.current) { clearInterval(undoCountdownIntervalRef.current); undoCountdownIntervalRef.current = null; }
    undoProgressAnim.stopAnimation();
  }

  function handleUndoPressOut() {
    const remaining = undoTotalDurationMsRef.current;
    if (remaining <= 0 || undoMeal === null) return;
    undoTimerStartRef.current = Date.now();
    undoProgressAnim.stopAnimation((currentValue) => {
      Animated.timing(undoProgressAnim, { toValue: 0, duration: remaining, useNativeDriver: false }).start();
    });
    undoCountdownIntervalRef.current = setInterval(() => {
      setUndoCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    undoTimerRef.current = setTimeout(() => {
      dismissUndoToast();
    }, remaining);
  }

  function dismissUndoToast(forReplacement = false) {
    undoProgressAnim.stopAnimation();
    Animated.timing(undoAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setUndoMeal(null);
    });
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    if (undoCountdownIntervalRef.current) {
      clearInterval(undoCountdownIntervalRef.current);
      undoCountdownIntervalRef.current = null;
    }
  }

  function dismissRestoredToast(forReplacement = false) {
    restoredAnim.stopAnimation();
    Animated.timing(restoredAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setRestoredLabel(null);
    });
    if (restoredTimerRef.current) {
      clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = null;
    }
  }

  function showRestoredToast(dateStr: string) {
    dismissRestoredToast(true);
    const d = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = "today";
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = "yesterday";
    } else {
      label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    setRestoredLabel(label);
    restoredAnim.setValue(0);
    Animated.spring(restoredAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    restoredTimerRef.current = setTimeout(() => {
      dismissRestoredToast();
    }, 2500);
  }

  function handleUndoDelete() {
    if (!undoMeal) return;
    const dateStr = undoMeal.date;
    dismissUndoToast();
    startSync();
    addMealLog(undoMeal, finishSync);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showRestoredToast(dateStr);
  }

  function handleMealSaved(label: string) {
    if (savedMealToastTimerRef.current) clearTimeout(savedMealToastTimerRef.current);
    setSavedMealToastMessage(label);
    savedMealToastAnim.setValue(0);
    Animated.spring(savedMealToastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    savedMealToastTimerRef.current = setTimeout(() => {
      Animated.timing(savedMealToastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        setSavedMealToastMessage(null);
      });
      savedMealToastTimerRef.current = null;
    }, 2000);
  }

  function handleMealDelete(meal: MealLog) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const sameNameCount = mealLogs.filter((m) => m.name === meal.name && m.id !== meal.id).length;
    if (sameNameCount === 0) {
      startSync();
      removeMealLog(meal.id, finishSync);
      showUndoToast(meal);
      return;
    }
    Alert.alert(
      "Delete meal entry?",
      `There are ${sameNameCount} other entr${sameNameCount === 1 ? "y" : "ies"} named "${meal.name}" across your history. Delete all of them too?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Only this one",
          onPress: () => { startSync(); removeMealLog(meal.id, finishSync); showUndoToast(meal); },
        },
        {
          text: `Delete all ${sameNameCount + 1}`,
          style: "destructive",
          onPress: () => { startSync(); removeMealLogsByName(meal.name, finishSync); },
        },
      ]
    );
  }

  function handleLogToday(log: MealLog) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const today = new Date().toISOString().split("T")[0];
    startSync();
    addMealLog({
      id: Date.now().toString(),
      date: today,
      name: log.name,
      calories: log.calories,
      protein: log.protein,
      carbs: log.carbs,
      fat: log.fat,
      mealType: log.mealType,
      amountGrams: log.amountGrams,
      nutrients100g: log.nutrients100g,
      sourceMealLogId: log.sourceMealLogId ?? log.id,
    }, finishSync);
    showLogTodayToast(log.name);
  }

  function dismissLogTodayToast(forReplacement = false) {
    logTodayAnim.stopAnimation();
    Animated.timing(logTodayAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      if (!forReplacement) setLogTodayName(null);
    });
    if (logTodayTimerRef.current) {
      clearTimeout(logTodayTimerRef.current);
      logTodayTimerRef.current = null;
    }
  }

  function showLogTodayToast(name: string) {
    dismissLogTodayToast(true);
    setLogTodayName(name);
    logTodayAnim.setValue(0);
    Animated.spring(logTodayAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    logTodayTimerRef.current = setTimeout(() => {
      dismissLogTodayToast();
    }, 2500);
  }

  useEffect(() => {
    AsyncStorage.getItem(THRESHOLDS_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const validated: FilterThresholds = {};
          for (const def of FILTER_DEFS) {
            const v = (parsed as Record<string, unknown>)[def.key];
            if (typeof v === "number" && isFinite(v) && v >= 0) {
              validated[def.key] = Math.round(v);
            }
          }
          setFilterThresholds((prev) => ({ ...prev, ...validated }));
        }
      } catch {
      }
    });
  }, []);

  const filtersHydratedRef = useRef(false);
  const cloudSyncReadyRef = useRef(false);
  const historyFiltersHydratedRef = useRef(false);
  const suppressRemoteRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyingRemoteRef = useRef(false);
  const draggingThresholdKeyRef = useRef<string | null>(null);
  const queuedThresholdUpdatesRef = useRef<FilterThresholds>({});

  useEffect(() => {
    const VALID_DATE_RANGES = new Set(["all", "7d", "30d", "custom"]);
    const VALID_MEAL_FILTERS = new Set<string>(["all", ...MEALS]);
    Promise.all([
      AsyncStorage.getItem(HISTORY_DATE_RANGE_KEY),
      AsyncStorage.getItem(HISTORY_MEAL_FILTER_KEY),
      AsyncStorage.getItem(CUSTOM_DATE_RANGE_KEY),
    ]).then(([dateRaw, mealRaw, customRaw]) => {
      // Parse the saved custom date range first so we can use it as a guard below.
      let parsedCustom: { start: string; end: string } | null = null;
      if (customRaw) {
        try {
          const parsed = JSON.parse(customRaw) as unknown;
          if (
            parsed &&
            typeof parsed === "object" &&
            "start" in parsed &&
            "end" in parsed &&
            typeof (parsed as Record<string, unknown>).start === "string" &&
            typeof (parsed as Record<string, unknown>).end === "string"
          ) {
            parsedCustom = parsed as { start: string; end: string };
          }
        } catch {}
      }

      // Restore the custom date range if it was successfully parsed.
      if (parsedCustom) {
        setCustomDateRange(parsedCustom);
      }

      // Restore the selected range.  If the stored range is "custom" but the
      // date object couldn't be recovered, fall back to "all" so the filter
      // never shows as "custom" with an empty date range.
      const resolvedRange =
        dateRaw === "custom" && !parsedCustom ? "all" : dateRaw;
      if (resolvedRange && VALID_DATE_RANGES.has(resolvedRange)) {
        setHistoryDateRange(resolvedRange as HistoryDateRange);
      }

      if (mealRaw && VALID_MEAL_FILTERS.has(mealRaw)) {
        setHistoryMealFilter(mealRaw as HistoryMealFilter);
      }
    }).catch(() => {}).finally(() => {
      historyFiltersHydratedRef.current = true;
    });
  }, []);

  useEffect(() => {
    if (!historyFiltersHydratedRef.current) return;
    if (historyDateRange === "all") {
      AsyncStorage.removeItem(HISTORY_DATE_RANGE_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(HISTORY_DATE_RANGE_KEY, historyDateRange).catch(() => {});
    }
  }, [historyDateRange]);

  useEffect(() => {
    if (!historyFiltersHydratedRef.current) return;
    if (customDateRange) {
      AsyncStorage.setItem(CUSTOM_DATE_RANGE_KEY, JSON.stringify(customDateRange)).catch(() => {});
    } else {
      AsyncStorage.removeItem(CUSTOM_DATE_RANGE_KEY).catch(() => {});
    }
  }, [customDateRange]);

  useEffect(() => {
    if (!historyFiltersHydratedRef.current) return;
    if (historyMealFilter === "all") {
      AsyncStorage.removeItem(HISTORY_MEAL_FILTER_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(HISTORY_MEAL_FILTER_KEY, historyMealFilter).catch(() => {});
    }
  }, [historyMealFilter]);

  useEffect(() => {
    AsyncStorage.getItem(ACTIVE_FILTERS_STORAGE_KEY).then((raw) => {
      try {
        if (raw) {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
            const restored = (parsed as unknown[]).filter(
              (k): k is string => typeof k === "string" && validKeys.has(k)
            );
            if (restored.length > 0) {
              setActiveFilters(new Set(restored));
            }
          }
        }
      } catch {
      } finally {
        filtersHydratedRef.current = true;
      }
    });
  }, []);

  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    if (activeFilters.size === 0) {
      AsyncStorage.removeItem(ACTIVE_FILTERS_STORAGE_KEY).catch(() => {});
    } else {
      AsyncStorage.setItem(
        ACTIVE_FILTERS_STORAGE_KEY,
        JSON.stringify(Array.from(activeFilters))
      ).catch(() => {});
    }
  }, [activeFilters]);

  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_PRESETS_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const valid = (parsed as unknown[]).filter(
            (p): p is CustomFilterPreset =>
              p !== null &&
              typeof p === "object" &&
              typeof (p as CustomFilterPreset).id === "string" &&
              typeof (p as CustomFilterPreset).name === "string" &&
              Array.isArray((p as CustomFilterPreset).filterKeys)
          );
          setCustomPresets(valid);
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      cloudSyncReadyRef.current = true;
      return;
    }
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!session?.user) return;
        const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
        return fetchUserPreferences(session.user.id).then((prefs) => {
          if (!prefs) return;
          if (prefs.activeFilters !== undefined) {
            const restored = prefs.activeFilters.filter(
              (k): k is string => typeof k === "string" && validKeys.has(k)
            );
            setActiveFilters(new Set(restored));
          }
          if (prefs.customPresets !== undefined) {
            const valid = prefs.customPresets.filter(
              (p) =>
                p !== null &&
                typeof p === "object" &&
                typeof p.id === "string" &&
                typeof p.name === "string" &&
                Array.isArray(p.filterKeys)
            );
            setCustomPresets(valid);
          }
          if (prefs.filterThresholds !== undefined && typeof prefs.filterThresholds === "object") {
            const validated: FilterThresholds = {};
            for (const def of FILTER_DEFS) {
              const v = (prefs.filterThresholds as Record<string, unknown>)[def.key];
              if (typeof v === "number" && isFinite(v) && v >= 0) {
                validated[def.key] = Math.round(v);
              }
            }
            setFilterThresholds((prev) => ({ ...prev, ...validated }));
          }
          if (prefs.macroGoals !== undefined && typeof prefs.macroGoals === "object") {
            const g = prefs.macroGoals as Record<string, unknown>;
            const cal = g["calories"], pro = g["protein"], car = g["carbs"], fa = g["fat"];
            if (
              typeof cal === "number" && cal > 0 &&
              typeof pro === "number" && pro > 0 &&
              typeof car === "number" && car > 0 &&
              typeof fa === "number" && fa > 0
            ) {
              setMacroGoals({ calories: Math.round(cal), protein: Math.round(pro), carbs: Math.round(car), fat: Math.round(fa) });
            }
          }
        });
      })
      .catch(() => {})
      .finally(() => {
        cloudSyncReadyRef.current = true;
      });
  }, []);

  useEffect(() => {
    if (!filtersHydratedRef.current || !cloudSyncReadyRef.current) return;
    if (!isSupabaseConfigured) return;
    if (applyingRemoteRef.current) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressRemoteRef.current = true;
      suppressTimerRef.current = setTimeout(() => {
        suppressRemoteRef.current = false;
      }, 3000);
      upsertUserPreferences(session.user.id, {
        activeFilters: Array.from(activeFilters),
        customPresets,
        filterThresholds,
        macroGoals,
      }).catch(() => {});
    });
  }, [activeFilters, customPresets, filterThresholds, macroGoals]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const userId = session.user.id;
      channel = supabase
        .channel(`profiles_prefs:${userId}`)
        .on(
          "postgres_changes" as Parameters<ReturnType<typeof supabase.channel>["on"]>[0],
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            if (suppressRemoteRef.current) return;
            const prefs = payload.new["preferences"];
            if (!prefs || typeof prefs !== "object") return;
            const p = prefs as Record<string, unknown>;
            const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
            applyingRemoteRef.current = true;
            // activeFilters and customPresets are applied immediately even when a
            // threshold modal is open. The modal is a separate overlay focused on a
            // single number input; filter chip and preset changes from another device
            // don't conflict with that UI and are safe to land right away.
            // shouldShowToast is accumulated across all three branches so a single
            // remote update that touches multiple fields only fires the toast once.
            let shouldShowToast = false;
            if (Array.isArray(p["activeFilters"])) {
              const restored = (p["activeFilters"] as unknown[]).filter(
                (k): k is string => typeof k === "string" && validKeys.has(k)
              );
              const currentFilters = activeFiltersRef.current;
              const hasFilterChanges =
                restored.length !== currentFilters.size ||
                restored.some((k) => !currentFilters.has(k));
              setActiveFilters(new Set(restored));
              if (hasFilterChanges) shouldShowToast = true;
            }
            if (Array.isArray(p["customPresets"])) {
              const valid = (p["customPresets"] as unknown[]).filter(
                (item): item is CustomFilterPreset =>
                  item !== null &&
                  typeof item === "object" &&
                  typeof (item as CustomFilterPreset).id === "string" &&
                  typeof (item as CustomFilterPreset).name === "string" &&
                  Array.isArray((item as CustomFilterPreset).filterKeys)
              );
              const currentPresets = customPresetsRef.current;
              const hasPresetChanges =
                valid.length !== currentPresets.length ||
                valid.some(
                  (vp, i) =>
                    vp.id !== currentPresets[i]?.id ||
                    vp.name !== currentPresets[i]?.name ||
                    JSON.stringify(vp.filterKeys) !== JSON.stringify(currentPresets[i]?.filterKeys)
                );
              setCustomPresets(valid);
              if (hasPresetChanges) shouldShowToast = true;
            }
            if (p["filterThresholds"] && typeof p["filterThresholds"] === "object") {
              const validated: FilterThresholds = {};
              const queued: FilterThresholds = {};
              // While ANY threshold modal is open (draggingThresholdKeyRef !== null),
              // defer ALL incoming threshold values — not just the key being edited.
              // This prevents mid-edit jumps when the remote device updates a different
              // threshold at the same time. Deferred values are flushed in
              // closeThresholdEdit() once the user dismisses the modal.
              const anyModalOpen = draggingThresholdKeyRef.current !== null;
              for (const def of FILTER_DEFS) {
                const v = (p["filterThresholds"] as Record<string, unknown>)[def.key];
                if (typeof v === "number" && isFinite(v) && v >= 0) {
                  const rounded = Math.round(v);
                  if (anyModalOpen) {
                    queued[def.key] = rounded;
                  } else {
                    validated[def.key] = rounded;
                  }
                }
              }
              if (Object.keys(queued).length > 0) {
                queuedThresholdUpdatesRef.current = { ...queuedThresholdUpdatesRef.current, ...queued };
              }
              if (Object.keys(validated).length > 0) {
                const current = filterThresholdsRef.current;
                const hasChanges = Object.keys(validated).some(
                  (k) => validated[k] !== current[k]
                );
                setFilterThresholds((prev) => ({ ...prev, ...validated }));
                if (hasChanges) shouldShowToast = true;
              }
            }
            if (shouldShowToast) showFilterSyncToast();
            if (p["macroGoals"] && typeof p["macroGoals"] === "object") {
              const g = p["macroGoals"] as Record<string, unknown>;
              const cal = g["calories"], pro = g["protein"], car = g["carbs"], fa = g["fat"];
              if (
                typeof cal === "number" && cal > 0 &&
                typeof pro === "number" && pro > 0 &&
                typeof car === "number" && car > 0 &&
                typeof fa === "number" && fa > 0
              ) {
                const incoming: MacroGoals = {
                  calories: Math.round(cal),
                  protein: Math.round(pro),
                  carbs: Math.round(car),
                  fat: Math.round(fa),
                };
                const cur = macroGoalsRef.current;
                if (
                  incoming.calories !== cur.calories ||
                  incoming.protein !== cur.protein ||
                  incoming.carbs !== cur.carbs ||
                  incoming.fat !== cur.fat
                ) {
                  setMacroGoals(incoming);
                  showGoalsSyncToast();
                }
              }
            }
            setTimeout(() => { applyingRemoteRef.current = false; }, 0);
          }
        )
        .subscribe();
    });
    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
      if (suppressTimerRef.current) {
        clearTimeout(suppressTimerRef.current);
      }
      if (filterSyncTimerRef.current) {
        clearTimeout(filterSyncTimerRef.current);
        filterSyncTimerRef.current = null;
      }
    };
  }, []);

  function saveCustomPreset() {
    const name = savePresetName.trim();
    if (!name || activeFilters.size === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const preset: CustomFilterPreset = {
      id: Date.now().toString(),
      name,
      filterKeys: Array.from(activeFilters),
    };
    const next = [...customPresets, preset];
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    setShowSavePresetModal(false);
    setSavePresetName("");
    showPresetSavedToast(name);
    if (presetNudgeVisible) dismissPresetNudge();
  }

  function deleteCustomPreset(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const preset = customPresets.find((p) => p.id === id);
    const next = customPresets.filter((p) => p.id !== id);
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    if (preset) showPresetDeletedToast(preset);
  }

  function applyPreset(preset: CustomFilterPreset) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!presetChipScaleAnims.current[preset.id]) {
      presetChipScaleAnims.current[preset.id] = new Animated.Value(1);
    }
    if (!presetChipGlowAnims.current[preset.id]) {
      presetChipGlowAnims.current[preset.id] = new Animated.Value(0);
    }
    const scaleAnim = presetChipScaleAnims.current[preset.id];
    const glowAnim = presetChipGlowAnims.current[preset.id];
    scaleAnim.setValue(1);
    glowAnim.setValue(0);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        speed: 40,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        speed: 30,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
    const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
    const keys = preset.filterKeys.filter((k) => validKeys.has(k));
    setActiveFilters(new Set(keys));
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }

  function openSavePresetModal() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissFilterHint();
    setSavePresetName("");
    setShowSavePresetModal(true);
  }

  function openEditPresetModal(preset: CustomFilterPreset) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditPresetName(preset.name);
    setEditingPreset(preset);
  }

  function confirmRenamePreset() {
    if (!editingPreset) return;
    const name = editPresetName.trim();
    if (!name) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const oldPreset = editingPreset;
    const next = customPresets.map((p) =>
      p.id === editingPreset.id ? { ...p, name } : p
    );
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    setEditingPreset(null);
    showPresetRenamedToast(oldPreset, name);
  }

  function computePresetDisplacement(idx: number, active: number, hover: number): number {
    if (active === -1 || hover === -1 || idx === active) return 0;
    const slotWidth = avgPresetChipWidthRef.current > 0 ? avgPresetChipWidthRef.current : 80;
    if (active < hover) {
      if (idx > active && idx <= hover) return -slotWidth;
    } else if (active > hover) {
      if (idx >= hover && idx < active) return slotWidth;
    }
    return 0;
  }

  function enterPresetReorderMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const items = [...customPresets];
    reorderPresetsRef.current = items;
    while (indexRefsPresetRef.current.length < items.length) {
      indexRefsPresetRef.current.push({ current: indexRefsPresetRef.current.length });
    }
    items.forEach((_, i) => {
      indexRefsPresetRef.current[i].current = i;
    });
    setReorderPresetsItems(items);
    setActiveReorderPresetIdx(-1);
    setHoverReorderPresetIdx(-1);
    setIsReorderingPresets(true);
    if (!isHintDismissed(PRESET_REORDER_HINT_KEY)) {
      presetReorderHintFadeAnim.setValue(0);
      setPresetReorderHintVisible(true);
      Animated.timing(presetReorderHintFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (presetReorderHintTimerRef.current) {
        clearTimeout(presetReorderHintTimerRef.current);
      }
      presetReorderHintTimerRef.current = setTimeout(dismissPresetReorderHint, 3000);
    }
  }

  function exitPresetReorderMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCustomPresets(reorderPresetsRef.current);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(reorderPresetsRef.current)).catch(() => {});
    setIsReorderingPresets(false);
    setActiveReorderPresetIdx(-1);
    setHoverReorderPresetIdx(-1);
  }

  function deletePresetInReorderMode(id: string) {
    const preset = reorderPresetsRef.current.find((p) => p.id === id);
    const next = reorderPresetsRef.current.filter((p) => p.id !== id);
    reorderPresetsRef.current = next;
    next.forEach((_, i) => {
      if (indexRefsPresetRef.current[i]) indexRefsPresetRef.current[i].current = i;
    });
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    setReorderPresetsItems([...next]);
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    setActiveReorderPresetIdx(-1);
    setHoverReorderPresetIdx(-1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (preset) showPresetDeletedToast(preset);
  }

  function handlePresetReorderDrop(from: number, to: number) {
    setActiveReorderPresetIdx(-1);
    setHoverReorderPresetIdx(-1);
    if (from === to) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const next = [...reorderPresetsRef.current];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    next.forEach((_, i) => {
      if (indexRefsPresetRef.current[i]) indexRefsPresetRef.current[i].current = i;
    });
    reorderPresetsRef.current = next;
    setReorderPresetsItems([...next]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  const nutritionFilters = React.useMemo(() => buildFilters(filterThresholds), [filterThresholds]);

  function openThresholdEdit(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (filterHintTimerRef.current) {
      clearTimeout(filterHintTimerRef.current);
      filterHintTimerRef.current = null;
    }
    const def = FILTER_DEFS.find((d) => d.key === key);
    const current = filterThresholds[key] ?? def?.defaultThreshold ?? 0;
    draggingThresholdKeyRef.current = key;
    queuedThresholdUpdatesRef.current = {};
    setThresholdEditKey(key);
    setThresholdEditValue(String(current));
  }

  function closeThresholdEdit() {
    extendFilterHint();
    draggingThresholdKeyRef.current = null;
    const queued = queuedThresholdUpdatesRef.current;
    queuedThresholdUpdatesRef.current = {};
    if (Object.keys(queued).length > 0) {
      setFilterThresholds((prev) => ({ ...prev, ...queued }));
      showFilterSyncToast();
    }
    setThresholdEditKey(null);
  }

  function saveThreshold() {
    if (!thresholdEditKey) return;
    const parsed = parseInt(thresholdEditValue, 10);
    if (isNaN(parsed) || parsed < 0) return;
    const next = { ...filterThresholds, [thresholdEditKey]: parsed };
    setFilterThresholds(next);
    AsyncStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    closeThresholdEdit();
  }

  function adjustThreshold(delta: number) {
    const parsed = parseInt(thresholdEditValue, 10) || 0;
    const next = Math.max(0, parsed + delta);
    setThresholdEditValue(String(next));
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();

    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    if (!trimmed) {
      setSearchResults([]);
      setSearchDone(false);
      setSearchLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSearchLoading(true);

    try {
      const params = new URLSearchParams({
        search_terms: trimmed,
        json: "1",
        page_size: PAGE_SIZE.toString(),
        fields: "product_name,nutriments,serving_size,serving_quantity",
      });
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
        { signal: controller.signal }
      );
      if (!res.ok) throw new Error("fetch failed");
      const data: OFFSearchResponse = await res.json();
      const items: FoodListItem[] = [];
      for (const p of data.products ?? []) {
        const food = parseOFFProduct(p);
        if (food) items.push({ ...food, _kind: "search" });
      }
      setSearchResults(items);
      setSearchDone(true);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setSearchResults([]);
      setSearchDone(true);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(searchQuery), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, runSearch]);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (presetReorderHintTimerRef.current) {
        clearTimeout(presetReorderHintTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!defaultPer100g) return;
    setPer100gItems((prev) => {
      const next = new Set(prev);
      for (const item of searchResults) {
        if (item._kind === "search") {
          const canToggle = !!(item.servingLabel && item.nutrients100g);
          if (canToggle) {
            const itemKey = `${item.name}:${item.servingLabel ?? ""}:${item.calories}`;
            next.add(itemKey);
          }
        }
      }
      return next;
    });
  }, [searchResults, defaultPer100g]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredSearchResults: FoodListItem[] =
    isSearching && activeFilters.size > 0
      ? searchResults.filter((item) =>
          nutritionFilters.filter((f) => activeFilters.has(f.key)).every((f) =>
            f.test(item)
          )
        )
      : searchResults;

  const filterResultCounts = React.useMemo<Record<string, number>>(() => {
    if (!isSearching || searchLoading) return {};
    const counts: Record<string, number> = {};
    const activeFilterFns = nutritionFilters.filter((f) => activeFilters.has(f.key));
    for (const filter of nutritionFilters) {
      if (activeFilters.has(filter.key)) continue;
      counts[filter.key] = searchResults.filter((item) =>
        activeFilterFns.every((f) => f.test(item)) && filter.test(item)
      ).length;
    }
    return counts;
  }, [isSearching, searchLoading, searchResults, nutritionFilters, activeFilters]);

  const quickList = React.useMemo<FoodListItem[]>(
    () => quickFoods.map((f) => ({ ...f, _kind: "quick" as const })),
    [quickFoods]
  );
  const listData: FoodListItem[] = isSearching ? filteredSearchResults : quickList;

  useEffect(() => {
    if (activeTab !== "today" || !isSearching) return;
    if (filterHintShownRef.current) return;
    filterHintShownRef.current = true;
    if (isHintDismissed(FILTER_HINT_STORAGE_KEY)) return;
    if (filterHintDismissedRef.current) return;
    filterHintFadeAnim.setValue(0);
    setFilterHintVisible(true);
    Animated.timing(filterHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    filterHintTimerRef.current = setTimeout(() => {
      filterHintTimerRef.current = null;
      Animated.timing(filterHintFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setFilterHintVisible(false);
        dismissHint(FILTER_HINT_STORAGE_KEY);
      });
    }, 4000);
  }, [activeTab, isSearching]);

  useEffect(() => {
    if (activeTab !== "today" || !isSearching) return;
    if (infoTooltipShownRef.current) return;
    infoTooltipShownRef.current = true;
    if (isHintDismissed(INFO_BUTTON_TOOLTIP_KEY)) return;
    dismissHint(INFO_BUTTON_TOOLTIP_KEY);
    infoTooltipFadeAnim.setValue(0);
    setInfoTooltipVisible(true);
    Animated.timing(infoTooltipFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    infoTooltipTimerRef.current = setTimeout(() => {
      infoTooltipTimerRef.current = null;
      Animated.timing(infoTooltipFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setInfoTooltipVisible(false);
      });
    }, 2000);
    return () => {
      if (infoTooltipTimerRef.current) {
        clearTimeout(infoTooltipTimerRef.current);
        infoTooltipTimerRef.current = null;
      }
    };
  }, [activeTab, isSearching]);

  useEffect(() => {
    if (activeTab !== "today" || !isSearching) return;
    if (customPresets.length > 0) return;
    if (presetNudgeShownRef.current) return;
    presetNudgeShownRef.current = true;
    if (isHintDismissed(PRESET_NUDGE_STORAGE_KEY)) return;
    if (presetNudgeDismissedRef.current) return;
    presetNudgeFadeAnim.setValue(0);
    setPresetNudgeVisible(true);
    Animated.timing(presetNudgeFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeTab, isSearching, customPresets.length]);

  useEffect(() => {
    if (customPresets.length === 0) return;
    if (presetLongPressHintShownRef.current) return;
    presetLongPressHintShownRef.current = true;
    if (isHintDismissed(PRESET_LONG_PRESS_HINT_KEY)) return;
    presetLongPressHintFadeAnim.setValue(0);
    setPresetLongPressHintVisible(true);
    Animated.timing(presetLongPressHintFadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    presetLongPressHintTimerRef.current = setTimeout(dismissPresetLongPressHint, 4000);
  }, [customPresets.length]);

  useEffect(() => {
    const prev = prevDismissedHintsLenRef.current;
    prevDismissedHintsLenRef.current = dismissedHints.length;
    if (prev === null || prev === 0) return;
    if (dismissedHints.length === 0) {
      presetLongPressHintShownRef.current = false;
      presetHintPendingRef.current = true;
    }
  }, [dismissedHints]);

  useFocusEffect(
    useCallback(() => {
      if (!presetHintPendingRef.current) return;
      if (customPresets.length === 0) return;
      if (isHintDismissed(PRESET_LONG_PRESS_HINT_KEY)) return;
      presetHintPendingRef.current = false;
      presetLongPressHintShownRef.current = true;
      presetLongPressHintFadeAnim.setValue(0);
      setPresetLongPressHintVisible(true);
      Animated.timing(presetLongPressHintFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      if (presetLongPressHintTimerRef.current) {
        clearTimeout(presetLongPressHintTimerRef.current);
      }
      presetLongPressHintTimerRef.current = setTimeout(dismissPresetLongPressHint, 4000);
    }, [customPresets.length, isHintDismissed])
  );

  const shouldShowFilterSummary =
    activeTab === "today" && isSearching && searchDone &&
    (activeFilters.size >= 2 || (activeFilters.size >= 1 && previewFilterKey !== null));

  useEffect(() => {
    if (shouldShowFilterSummary) {
      filterSummaryFadeAnim.setValue(0);
      filterSummarySlideAnim.setValue(-6);
      setFilterSummaryVisible(true);
      Animated.parallel([
        Animated.timing(filterSummaryFadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(filterSummarySlideAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(filterSummaryFadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(filterSummarySlideAnim, {
          toValue: -6,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setFilterSummaryVisible(false);
      });
    }
  }, [shouldShowFilterSummary]);

  useEffect(() => {
    const isFiltered = historyDateRange !== "all" || historyMealFilter !== "all";
    if (isFiltered) {
      setResultCountVisible(true);
      Animated.timing(resultCountFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(resultCountFadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setResultCountVisible(false);
      });
    }
  }, [historyDateRange, historyMealFilter]);

  const prevFilterSummaryCountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!shouldShowFilterSummary || searchLoading) return;
    const count = filteredSearchResults.length;
    if (prevFilterSummaryCountRef.current !== null && prevFilterSummaryCountRef.current !== count) {
      filterSummaryScaleAnim.setValue(1);
      Animated.sequence([
        Animated.timing(filterSummaryScaleAnim, {
          toValue: 1.18,
          duration: 110,
          useNativeDriver: true,
        }),
        Animated.timing(filterSummaryScaleAnim, {
          toValue: 1,
          duration: 110,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevFilterSummaryCountRef.current = count;
  }, [filteredSearchResults.length, shouldShowFilterSummary, searchLoading]);

  function toggleFilter(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!chipScaleAnims.current[key]) {
      chipScaleAnims.current[key] = new Animated.Value(1);
    }
    if (!chipGlowAnims.current[key]) {
      chipGlowAnims.current[key] = new Animated.Value(0);
    }
    const scaleAnim = chipScaleAnims.current[key];
    const glowAnim = chipGlowAnims.current[key];
    scaleAnim.setValue(1);
    glowAnim.setValue(0);
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.15,
        speed: 40,
        bounciness: 6,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        speed: 30,
        bounciness: 8,
        useNativeDriver: true,
      }),
    ]).start();
    Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
    if (filterHintVisible && !filterHintDismissedRef.current) {
      if (filterHintTimerRef.current) {
        clearTimeout(filterHintTimerRef.current);
      }
      filterHintTimerRef.current = setTimeout(() => {
        filterHintTimerRef.current = null;
        Animated.timing(filterHintFadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setFilterHintVisible(false);
          dismissHint(FILTER_HINT_STORAGE_KEY);
        });
      }, 4000);
    }
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function clearFilters() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
    for (const p of customPresets) {
      const pKeys = p.filterKeys.filter((k) => validKeys.has(k));
      if (
        pKeys.length > 0 &&
        pKeys.length === activeFilters.size &&
        pKeys.every((k) => activeFilters.has(k))
      ) {
        if (!presetChipScaleAnims.current[p.id]) {
          presetChipScaleAnims.current[p.id] = new Animated.Value(1);
        }
        const anim = presetChipScaleAnims.current[p.id];
        Animated.sequence([
          Animated.spring(anim, { toValue: 0.88, speed: 40, bounciness: 4, useNativeDriver: true }),
          Animated.spring(anim, { toValue: 1, speed: 30, bounciness: 6, useNativeDriver: true }),
        ]).start();
        break;
      }
    }
    setActiveFilters(new Set());
  }

  const hasCustomThresholds = React.useMemo(() => {
    return FILTER_DEFS.some((def) => filterThresholds[def.key] !== def.defaultThreshold);
  }, [filterThresholds]);

  useEffect(() => {
    if (hasCustomThresholds) {
      todayResetSlideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(todayResetFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(todayResetSlideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(todayResetFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(todayResetSlideAnim, { toValue: 16, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [hasCustomThresholds]);

  useEffect(() => {
    if (activeFilters.size > 0) {
      todayClearSlideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(todayClearFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(todayClearSlideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(todayClearFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(todayClearSlideAnim, { toValue: 16, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [activeFilters.size]);

  useEffect(() => {
    if (activeFilters.size >= 1) {
      todaySaveSlideAnim.setValue(16);
      Animated.parallel([
        Animated.timing(todaySaveFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(todaySaveSlideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 10 }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(todaySaveFadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(todaySaveSlideAnim, { toValue: 16, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [activeFilters.size]);

  function resetAllThresholds() {
    Alert.alert(
      "Reset All Thresholds to Default?",
      "This will restore all thresholds to their default values.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const defaults = getDefaultThresholds();
            setFilterThresholds(defaults);
            AsyncStorage.removeItem(THRESHOLDS_STORAGE_KEY).catch(() => {});
            if (isSupabaseConfigured) {
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session?.user) return;
                upsertUserPreferences(session.user.id, {
                  activeFilters: Array.from(activeFilters),
                  customPresets,
                  filterThresholds: defaults,
                }).catch(() => {});
              });
            }
          },
        },
      ]
    );
  }

  function openMacroDefaultsSheet() {
    AsyncStorage.getItem(MANUAL_MACROS_KEY)
      .then((raw) => {
        const map: Record<string, { calories: string; protein: string; carbs: string; fat: string }> =
          raw ? JSON.parse(raw) : {};
        const entries = Object.entries(map).map(([name, vals]) => ({ name, ...vals }));
        setMacroDefaultsEntries(entries);
        setShowMacroDefaultsSheet(true);
      })
      .catch(() => {
        setMacroDefaultsEntries([]);
        setShowMacroDefaultsSheet(true);
      });
  }

  function deleteMacroDefault(foodName: string) {
    setMacroDefaultsEntries((prev) => prev.filter((e) => e.name !== foodName));
    AsyncStorage.getItem(MANUAL_MACROS_KEY)
      .then((raw) => {
        const map: Record<string, { calories: string; protein: string; carbs: string; fat: string }> =
          raw ? JSON.parse(raw) : {};
        delete map[foodName];
        return AsyncStorage.setItem(MANUAL_MACROS_KEY, JSON.stringify(map));
      })
      .catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function clearAllMacroDefaults() {
    Alert.alert(
      "Clear All Saved Macros",
      "Remove all remembered macro values? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMacroDefaultsEntries([]);
            AsyncStorage.setItem(MANUAL_MACROS_KEY, JSON.stringify({})).catch(() => {});
          },
        },
      ]
    );
  }

  function handleResetFoodDefaults(foodName: string) {
    Alert.alert(
      "Reset Defaults",
      `Clear the remembered gram amount, meal, and view preference for "${foodName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            delete lastUsedMealMapRef.current[foodName];
            delete lastUsedGramsMapRef.current[foodName];
            delete lastUsedServingsMapRef.current[foodName];
            AsyncStorage.getItem(LAST_USED_GRAMS_KEY)
              .then((raw) => {
                const map: Record<string, number> = raw ? JSON.parse(raw) : {};
                delete map[foodName];
                return AsyncStorage.setItem(LAST_USED_GRAMS_KEY, JSON.stringify(map));
              })
              .catch(() => {});
            AsyncStorage.getItem(LAST_USED_MEAL_KEY)
              .then((raw) => {
                const map: Record<string, string> = raw ? JSON.parse(raw) : {};
                delete map[foodName];
                return AsyncStorage.setItem(LAST_USED_MEAL_KEY, JSON.stringify(map));
              })
              .catch(() => {});
            AsyncStorage.getItem(LAST_USED_SERVING_KEY)
              .then((raw) => {
                const map: Record<string, number> = raw ? JSON.parse(raw) : {};
                delete map[foodName];
                return AsyncStorage.setItem(LAST_USED_SERVING_KEY, JSON.stringify(map));
              })
              .catch(() => {});
            AsyncStorage.getItem(LAST_USED_VIEW_KEY)
              .then((raw) => {
                const map: Record<string, string> = raw ? JSON.parse(raw) : {};
                delete map[foodName];
                return AsyncStorage.setItem(LAST_USED_VIEW_KEY, JSON.stringify(map));
              })
              .catch(() => {});
            AsyncStorage.getItem(EDIT_PER100G_PREF_KEY)
              .then((raw) => {
                const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                delete map[foodName];
                return AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
              })
              .catch(() => {});
            showPresetSavedToast(`Defaults cleared for "${foodName}"`);
          },
        },
      ]
    );
  }

  function resetSingleThreshold() {
    if (!thresholdEditKey) return;
    const def = FILTER_DEFS.find((d) => d.key === thresholdEditKey);
    if (!def) return;
    Alert.alert(
      `Reset ${def.label} to Default?`,
      `This will restore the ${def.label} threshold to its default value.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            const next = { ...filterThresholds, [thresholdEditKey]: def.defaultThreshold };
            setFilterThresholds(next);
            AsyncStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (isSupabaseConfigured) {
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (!session?.user) return;
                upsertUserPreferences(session.user.id, {
                  activeFilters: Array.from(activeFilters),
                  customPresets,
                  filterThresholds: next,
                }).catch(() => {});
              });
            }
            closeThresholdEdit();
          },
        },
      ]
    );
  }

  function computeDisplacement(idx: number, active: number, hover: number): number {
    if (active === -1 || hover === -1 || idx === active) return 0;
    const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_FAV_ITEM_HEIGHT;
    if (active < hover) {
      if (idx > active && idx <= hover) return -slotHeight;
    } else if (active > hover) {
      if (idx >= hover && idx < active) return slotHeight;
    }
    return 0;
  }

  function enterReorderMode() {
    dismissReorderHint();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const items = [...favoriteFoods];
    reorderItemsRef.current = items;
    while (indexRefsRef.current.length < items.length) {
      indexRefsRef.current.push({ current: indexRefsRef.current.length });
    }
    items.forEach((_, i) => {
      indexRefsRef.current[i].current = i;
    });
    setReorderItems(items);
    setActiveReorderIdx(-1);
    setHoverReorderIdx(-1);
    setIsReordering(true);
  }

  function exitReorderMode() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsReordering(false);
    setActiveReorderIdx(-1);
    setHoverReorderIdx(-1);
  }

  function handleReorderDrop(from: number, to: number) {
    setActiveReorderIdx(-1);
    setHoverReorderIdx(-1);
    if (from === to) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    const next = [...reorderItemsRef.current];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    next.forEach((_, i) => {
      if (indexRefsRef.current[i]) indexRefsRef.current[i].current = i;
    });
    reorderItemsRef.current = next;
    setReorderItems(next);
    reorderFavoriteFoods(next);
    favoriteCardYsRef.current = {};
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleBreakdownSegmentTap(macro: "protein" | "carbs" | "fat") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (breakdownHighlightTimer.current) clearTimeout(breakdownHighlightTimer.current);
    setBreakdownHighlightMacro(macro);
    breakdownHighlightTimer.current = setTimeout(() => setBreakdownHighlightMacro(null), 1500);
  }

  async function handleAddFood(food: Omit<MealLog, "id" | "date">, opts?: { forceServings?: number; forceMealType?: MealType; showLoggedToast?: boolean; source?: "quick" | "fav" | "recent" }) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    selectedFoodSourceRef.current = opts?.source ?? null;

    const gramMatch = food.servingLabel?.match(/^(\d+(?:\.\d+)?)g$/i) ?? null;
    if (gramMatch) {
      const gramValue = parseFloat(gramMatch[1]);
      const rememberedGrams = lastUsedGramsMapRef.current[food.name];
      const parsedRemembered = rememberedGrams ? parseFloat(rememberedGrams) : NaN;
      const defaultGrams = Number.isFinite(parsedRemembered) && parsedRemembered > 0 ? parsedRemembered : gramValue;
      const scale = gramValue > 0 ? 100 / gramValue : 1;
      const per100gFood = {
        ...food,
        calories: Math.round(food.calories * scale),
        protein: Math.round(food.protein * scale * 10) / 10,
        carbs: Math.round(food.carbs * scale * 10) / 10,
        fat: Math.round(food.fat * scale * 10) / 10,
      };
      setSelectedFood(per100gFood);
      setSelectedFoodIsApiResult(true);
      setSelectedFoodServingLabel(undefined);
      setSelectedFoodNutrients100g(undefined);
      setSelectedFoodUnit("g");
      setModalShowPer100g(false);
      setGrams(String(defaultGrams));
      setGramsPreFillHint(String(defaultGrams));
    } else if (food.nutrients100g && food.servingLabel) {
      setSelectedFood(food);
      setSelectedFoodServingLabel(food.servingLabel);
      setSelectedFoodIsApiResult(false);
      setSelectedFoodNutrients100g(food.nutrients100g);
      setSelectedFoodUnit("g");
      setGrams("100");
      setGramsPreFillHint(null);

      let restoredPer100g = false;
      try {
        const raw = await AsyncStorage.getItem(EDIT_PER100G_PREF_KEY);
        if (raw) {
          const map: Record<string, { per100g: boolean; grams: number } | boolean> = JSON.parse(raw);
          const entry = map[food.name];
          if (entry !== null && typeof entry === "object") {
            restoredPer100g = entry.per100g;
          } else if (typeof entry === "boolean") {
            restoredPer100g = entry;
          }
        }
      } catch {
        // ignore
      }
      setModalShowPer100g(restoredPer100g);
    } else {
      let foodWithMacros = food;
      try {
        const raw = await AsyncStorage.getItem(MANUAL_MACROS_KEY);
        if (raw) {
          const map: Record<string, { calories: string; protein: string; carbs: string; fat: string }> =
            JSON.parse(raw);
          const saved = map[food.name];
          if (saved) {
            const cal = parseFloat(saved.calories);
            const pro = parseFloat(saved.protein);
            const crb = parseFloat(saved.carbs);
            const fat = parseFloat(saved.fat);
            const resolvedCal = Number.isFinite(cal) ? cal : food.calories;
            const resolvedPro = Number.isFinite(pro) ? pro : food.protein;
            const resolvedCrb = Number.isFinite(crb) ? crb : food.carbs;
            const resolvedFat = Number.isFinite(fat) ? fat : food.fat;
            const differs =
              resolvedCal !== food.calories ||
              resolvedPro !== food.protein ||
              resolvedCrb !== food.carbs ||
              resolvedFat !== food.fat;
            foodWithMacros = {
              ...food,
              calories: resolvedCal,
              protein: resolvedPro,
              carbs: resolvedCrb,
              fat: resolvedFat,
            };
            if (differs) setMacrosFromMemory(true);
          }
        }
      } catch {
        // ignore
      }
      setSelectedFood(foodWithMacros);
      setSelectedFoodServingLabel(undefined);
      setSelectedFoodIsApiResult(false);
      setSelectedFoodNutrients100g(undefined);
      setModalShowPer100g(false);
      setGrams("100");
      setGramsPreFillHint(null);
      setServingsPreFillHint(false);
    }

    const storedMeal = lastUsedMealMapRef.current[food.name] as MealType | undefined;
    setSelectedMeal(opts?.forceMealType ?? storedMeal ?? food.mealType);

    let restoredServings = 1;
    let servingsFromStorage = false;
    try {
      const raw = await AsyncStorage.getItem(LAST_USED_SERVING_KEY);
      if (raw) {
        const map: Record<string, number> = JSON.parse(raw);
        if (map[food.name] != null) {
          restoredServings = map[food.name];
          servingsFromStorage = true;
        }
      }
    } catch {
      // ignore
    }
    const finalServings = opts?.forceServings ?? restoredServings;
    setServings(finalServings);
    setServingsText(String(finalServings));
    setServingsPreFillHint(opts?.forceServings == null && servingsFromStorage);

    pendingLoggedToastRef.current = opts?.showLoggedToast ?? false;

    setShowModal(true);
  }

  async function handleScannedFood(food: ScannedFood, forceGrams?: string, per100gHint?: boolean) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const lastMeal: MealLog["mealType"] =
      (lastUsedMealMapRef.current[food.name] as MealLog["mealType"] | undefined) ?? "snack";
    setSelectedMeal(lastMeal);
    setSelectedFood({ ...food, mealType: "snack" });
    setSelectedFoodServingLabel(food.servingLabel);
    setSelectedFoodIsApiResult(true);
    setSelectedFoodNutrients100g(food.nutrients100g);
    setSelectedFoodUnit(food.unit ?? "g");

    let restoredServings = 1;
    let servingsFromStorage = false;
    if (food.servingLabel) {
      const remembered = lastUsedServingsMapRef.current[food.name];
      if (remembered != null) {
        restoredServings = remembered;
        servingsFromStorage = true;
      }
    }
    setServings(restoredServings);
    setServingsText(String(restoredServings));
    setServingsPreFillHint(servingsFromStorage);

    let lastGrams = forceGrams ?? "100";
    let isRemembered = false;
    if (!forceGrams && !food.servingLabel) {
      const remembered = lastUsedGramsMapRef.current[food.name];
      if (remembered) {
        lastGrams = remembered;
        isRemembered = true;
      }
    }
    setGrams(lastGrams);
    setGramsPreFillHint(isRemembered ? lastGrams : null);

    let restoredPer100g = false;
    if (food.servingLabel && food.nutrients100g) {
      if (per100gHint !== undefined) {
        restoredPer100g = per100gHint;
      } else {
        try {
          const raw = await AsyncStorage.getItem(EDIT_PER100G_PREF_KEY);
          if (raw) {
            const map: Record<string, { per100g: boolean; grams: number } | boolean> = JSON.parse(raw);
            const entry = map[food.name];
            if (entry !== null && typeof entry === "object") {
              restoredPer100g = entry.per100g;
            } else if (typeof entry === "boolean") {
              restoredPer100g = entry;
            }
          }
        } catch {
          // ignore
        }
      }
    }
    setModalShowPer100g(restoredPer100g);

    setShowModal(true);
  }

  function handleManualEntry() {
    setManualForm(EMPTY_MANUAL);
    manualCaloriesAutoFilled.current = false;
    setShowManualBreakdown(false);
    setManualMeal("snack");
    setManualMacrosPrefilledFor(null);
    setShowManualEntry(true);
  }

  function handleConfirmLog() {
    if (!selectedFood) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { name } = selectedFood;
    const isGramsMode = (selectedFoodIsApiResult && !selectedFoodServingLabel) || modalShowPer100g;
    const parsedGrams = parseFloat(grams) || 0;
    const factor = isGramsMode ? parsedGrams / 100 : servings;
    const base = modalShowPer100g && selectedFoodNutrients100g ? selectedFoodNutrients100g : selectedFood;
    const { calories, protein, carbs, fat } = base;
    const canToggleServing = !!(selectedFoodServingLabel && selectedFoodNutrients100g);
    const meal: MealLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      name,
      calories: Math.round(calories * factor),
      protein: Math.round(protein * factor * 10) / 10,
      carbs: Math.round(carbs * factor * 10) / 10,
      fat: Math.round(fat * factor * 10) / 10,
      mealType: selectedMeal,
      ...(isGramsMode && parsedGrams > 0 ? { amountGrams: parsedGrams } : {}),
      ...(canToggleServing ? {
        nutrients100g: selectedFoodNutrients100g!,
        servingLabel: selectedFoodServingLabel,
      } : {}),
    };
    startSync();
    addMealLog(meal, finishSync);

    if (pendingLoggedToastRef.current) {
      pendingLoggedToastRef.current = false;
      showLogTodayToast(meal.name);
    }

    // Smart Macro Remaining Alert
    const remCal = Math.round(CALORIE_GOAL - (calories + meal.calories));
    const remProt = Math.round((PROTEIN_GOAL - (protein + meal.protein)) * 10) / 10;
    const remCarb = Math.round((CARBS_GOAL - (carbs + meal.carbs)) * 10) / 10;
    const remFat = Math.round((FAT_GOAL - (fat + meal.fat)) * 10) / 10;
    setMacroAlert({ cal: remCal, prot: remProt, carb: remCarb, fat: remFat });
    if (macroAlertTimer.current) clearTimeout(macroAlertTimer.current);
    macroAlertTimer.current = setTimeout(() => setMacroAlert(null), 5000);

    if (isGramsMode && parsedGrams > 0) {
      lastUsedGramsMapRef.current[name] = grams;
      AsyncStorage.getItem(LAST_USED_GRAMS_KEY)
        .then((raw) => {
          const map: Record<string, string> = raw ? JSON.parse(raw) : {};
          map[name] = grams;
          return AsyncStorage.setItem(LAST_USED_GRAMS_KEY, JSON.stringify(map));
        })
        .catch(() => {});

      if (selectedFoodSourceRef.current === "quick") {
        dismissQuickGramsHint();
      } else if (selectedFoodSourceRef.current === "fav") {
        dismissFavGramsHint();
      } else if (selectedFoodSourceRef.current === "recent") {
        dismissRecentGramsHint();
      }
    }

    lastUsedMealMapRef.current[name] = selectedMeal;
    AsyncStorage.getItem(LAST_USED_MEAL_KEY)
      .then((raw) => {
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        map[name] = selectedMeal;
        return AsyncStorage.setItem(LAST_USED_MEAL_KEY, JSON.stringify(map));
      })
      .catch(() => {});

    if (!isGramsMode) {
      lastUsedServingsMapRef.current[name] = servings;
      AsyncStorage.getItem(LAST_USED_SERVING_KEY)
        .then((raw) => {
          const map: Record<string, number> = raw ? JSON.parse(raw) : {};
          map[name] = servings;
          return AsyncStorage.setItem(LAST_USED_SERVING_KEY, JSON.stringify(map));
        })
        .catch(() => {});
    }

    if (canToggleServing) {
      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY)
        .then((raw) => {
          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
          map[name] = { per100g: modalShowPer100g, grams: 0 };
          return AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
        })
        .catch(() => {});
    }

    selectedFoodSourceRef.current = null;
    reloadQuickPer100gMap();
    setShowModal(false);
    setGramsPreFillHint(null);
    setModalShowPer100g(false);
    setSelectedFoodNutrients100g(undefined);
    setMacrosFromMemory(false);
  }

  function handleConfirmManual() {
    const name = manualForm.name.trim();
    if (!name) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const meal: MealLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      name,
      calories: parseInt(manualForm.calories, 10) || 0,
      protein: parseFloat(manualForm.protein) || 0,
      carbs: parseFloat(manualForm.carbs) || 0,
      fat: parseFloat(manualForm.fat) || 0,
      mealType: manualMeal,
    };
    startSync();
    addMealLog(meal, finishSync);

    lastUsedMealMapRef.current[name] = manualMeal;
    AsyncStorage.getItem(LAST_USED_MEAL_KEY)
      .then((raw) => {
        const map: Record<string, string> = raw ? JSON.parse(raw) : {};
        map[name] = manualMeal;
        return AsyncStorage.setItem(LAST_USED_MEAL_KEY, JSON.stringify(map));
      })
      .catch(() => {});

    AsyncStorage.getItem(MANUAL_MACROS_KEY)
      .then((raw) => {
        const map: Record<string, { calories: string; protein: string; carbs: string; fat: string }> =
          raw ? JSON.parse(raw) : {};
        map[name] = {
          calories: manualForm.calories,
          protein: manualForm.protein,
          carbs: manualForm.carbs,
          fat: manualForm.fat,
        };
        return AsyncStorage.setItem(MANUAL_MACROS_KEY, JSON.stringify(map));
      })
      .catch(() => {});

    setShowManualEntry(false);
  }

  function scrollToDateCard(date: string) {
    const cardY = historyCardYsRef.current[date];
    if (cardY != null) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: cardY, animated: true });
      }, 50);
    }
  }

  function handleChartBarPress(date: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHighlightedDate((prev) => {
      if (prev === date) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: trendChartYRef.current, animated: true });
        }, 50);
        return null;
      }
      scrollToDateCard(date);
      return date;
    });
  }

  function handleChartPillPress(date: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scrollToDateCard(date);
  }

  function handleClearHighlight() {
    setHighlightedDate(null);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={activeTab === "today" ? listData : []}
        keyExtractor={(item, i) => `${item._kind}-${item.name}-${i}`}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleFlatListScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={() => (
          <View style={{ gap: 16 }}>
            <View style={[styles.header, { paddingTop: topPad + 16 }]}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Nutrition
              </Text>
              <View style={styles.headerActions}>
                <View style={[styles.tabSwitcher, { backgroundColor: colors.muted }]}>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab("today");
                      setHistoryFilterPanelOpen(false);
                    }}
                    style={[
                      styles.tabBtn,
                      activeTab === "today" && { backgroundColor: colors.card },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        {
                          color: activeTab === "today" ? colors.foreground : colors.mutedForeground,
                          fontFamily: activeTab === "today" ? "Inter_600SemiBold" : "Inter_400Regular",
                        },
                      ]}
                    >
                      Today
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setActiveTab("history");
                      setHistoryFilterPanelOpen(true);
                    }}
                    style={[
                      styles.tabBtn,
                      activeTab === "history" && { backgroundColor: colors.card },
                    ]}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        {
                          color: activeTab === "history" ? colors.foreground : colors.mutedForeground,
                          fontFamily: activeTab === "history" ? "Inter_600SemiBold" : "Inter_400Regular",
                        },
                      ]}
                    >
                      History
                    </Text>
                  </TouchableOpacity>
                </View>
                {activeTab === "today" && (
                  <View style={styles.scanBtnGroup}>
                    <View style={styles.recentBtnWrapper}>
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setRecentScanCount(0);
                          setShowRecentScans(true);
                        }}
                        style={[styles.recentBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                        activeOpacity={0.85}
                      >
                        <Ionicons name="time-outline" size={17} color={colors.mutedForeground} />
                      </TouchableOpacity>
                      {recentScanCount > 0 && (
                        <Reanimated.View style={[styles.recentBtnBadge, { backgroundColor: colors.primary }, badgeAnimatedStyle]}>
                          <Text style={styles.recentBtnBadgeText}>
                            {recentScanCount > 99 ? "99+" : recentScanCount}
                          </Text>
                        </Reanimated.View>
                      )}
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowScanner(true);
                      }}
                      style={[styles.scanBtn, { backgroundColor: colors.primary }]}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="barcode-outline" size={18} color={colors.primaryForeground} />
                      <Text style={[styles.scanBtnText, { color: colors.primaryForeground }]}>
                        Scan
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Search bar — only on Today tab */}
            {activeTab === "today" && <View
              style={[
                styles.searchBar,
                { backgroundColor: colors.muted, borderColor: isSearching ? colors.primary : colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={17} color={isSearching ? colors.primary : colors.mutedForeground} />
              <TextInput
                ref={searchInputRef}
                placeholder="Search food by name…"
                placeholderTextColor={colors.mutedForeground}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: colors.foreground }]}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (debounceRef.current) clearTimeout(debounceRef.current);
                  runSearch(searchQuery);
                }}
                clearButtonMode="while-editing"
              />
              {searchLoading && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {isSearching && !searchLoading && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setSearchDone(false);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>}

            {/* Per-100g default indicator pill — only on Today tab */}
            {activeTab === "today" && (
              <TouchableOpacity
                onPress={() => {
                  const next = !defaultPer100g;
                  setDefaultPer100g(next);
                  showPer100gToast(next ? "Default switched to per 100g" : "Default switched to per serving");
                }}
                activeOpacity={0.75}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                style={styles.per100gPill}
              >
                <View
                  style={[
                    styles.per100gPillInner,
                    {
                      backgroundColor: defaultPer100g ? colors.primary + "18" : colors.muted,
                      borderColor: defaultPer100g ? colors.primary + "40" : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="scale-outline"
                    size={11}
                    color={defaultPer100g ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.per100gPillText,
                      { color: defaultPer100g ? colors.primary : colors.mutedForeground },
                    ]}
                  >
                    {defaultPer100g ? "per 100g" : "per serving"}
                  </Text>
                  <Ionicons
                    name="swap-horizontal-outline"
                    size={10}
                    color={defaultPer100g ? colors.primary : colors.mutedForeground}
                    style={{ opacity: 0.7 }}
                  />
                </View>
              </TouchableOpacity>
            )}

            {/* Filter chips — shown while searching on Today tab */}
            {activeTab === "today" && isSearching && (
              <View style={{ gap: 8 }}>
                {/* Custom preset chips row */}
                {customPresets.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <View style={styles.presetChipsHeader}>
                      <Text style={[styles.presetChipsLabel, { color: colors.mutedForeground }]}>
                        Saved Presets
                      </Text>
                      {isReorderingPresets ? (
                        <TouchableOpacity
                          onPress={exitPresetReorderMode}
                          style={[styles.reorderDoneBtn, { backgroundColor: colors.secondary }]}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.reorderDoneText, { color: colors.primaryForeground }]}>
                            Done
                          </Text>
                        </TouchableOpacity>
                      ) : customPresets.length >= 2 ? (
                        <TouchableOpacity
                          onPress={enterPresetReorderMode}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.reorderHint, { color: colors.mutedForeground }]}>
                            Reorder
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {presetLongPressHintVisible && !isReorderingPresets && (
                      <Animated.Text
                        style={[styles.presetLongPressHintText, { color: colors.mutedForeground, opacity: presetLongPressHintFadeAnim }]}
                      >
                        Hold a chip to edit or delete it
                      </Animated.Text>
                    )}

                    {isReorderingPresets && presetReorderHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.secondary + "40",
                            opacity: presetReorderHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="swap-horizontal-outline" size={14} color={colors.secondary} />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Drag chips left or right to reorder
                        </Text>
                        <TouchableOpacity
                          onPress={dismissPresetReorderHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}

                    {customPresets.length > 0 && !isReorderingPresets && (
                      <View
                        pointerEvents="none"
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          if (w > 0) avgPresetChipWidthRef.current = w;
                        }}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          flexDirection: "row",
                          alignItems: "center",
                          borderRadius: 20,
                          borderWidth: 1,
                          maxWidth: 200,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 10, paddingRight: 6, paddingVertical: 7 }}>
                          <Ionicons name="reorder-two-outline" size={11} color="transparent" />
                          <Ionicons name="bookmark" size={12} color="transparent" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold" }} numberOfLines={1}>
                            {customPresets[0].name}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 7 }}>
                          <Ionicons name="close" size={13} color="transparent" />
                        </View>
                      </View>
                    )}

                    {isReorderingPresets ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        scrollEnabled={false}
                        contentContainerStyle={[styles.filterScroll, { paddingVertical: 4 }]}
                      >
                        {reorderPresetsItems.map((preset, idx) => (
                          <HorizontalDraggablePresetChip
                            key={`preset-drag-${preset.id}`}
                            preset={preset}
                            indexRef={indexRefsPresetRef.current[idx] ?? { current: idx }}
                            listRef={reorderPresetsRef}
                            avgChipWidthRef={avgPresetChipWidthRef}
                            isActive={idx === activeReorderPresetIdx}
                            isHover={idx === hoverReorderPresetIdx && idx !== activeReorderPresetIdx}
                            displacement={computePresetDisplacement(idx, activeReorderPresetIdx, hoverReorderPresetIdx)}
                            onDragStart={(i) => { setActiveReorderPresetIdx(i); setHoverReorderPresetIdx(i); }}
                            onHover={setHoverReorderPresetIdx}
                            onDrop={handlePresetReorderDrop}
                            onDelete={deletePresetInReorderMode}
                            colors={colors}
                          />
                        ))}
                      </ScrollView>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.filterScroll, { paddingVertical: 2 }]}
                      >
                        {customPresets.map((preset) => {
                          if (!presetChipScaleAnims.current[preset.id]) {
                            presetChipScaleAnims.current[preset.id] = new Animated.Value(1);
                          }
                          if (!presetChipGlowAnims.current[preset.id]) {
                            presetChipGlowAnims.current[preset.id] = new Animated.Value(0);
                          }
                          const presetScale = presetChipScaleAnims.current[preset.id];
                          const presetGlow = presetChipGlowAnims.current[preset.id];
                          return (
                          <Animated.View
                            key={preset.id}
                            style={[
                              styles.presetChip,
                              { backgroundColor: colors.secondary + "18", borderColor: colors.secondary + "55", overflow: "hidden" },
                              { transform: [{ scale: presetScale }] },
                            ]}
                          >
                            <Animated.View
                              pointerEvents="none"
                              style={{
                                position: "absolute",
                                top: 0, left: 0, right: 0, bottom: 0,
                                borderRadius: 20,
                                backgroundColor: colors.secondary + "60",
                                opacity: presetGlow,
                              }}
                            />
                            <TouchableOpacity
                              onPress={() => applyPreset(preset)}
                              onLongPress={() => openEditPresetModal(preset)}
                              delayLongPress={500}
                              activeOpacity={0.75}
                              style={styles.presetChipInner}
                            >
                              <Ionicons name="bookmark" size={12} color={colors.secondary} />
                              <Text
                                style={[styles.presetChipText, { color: colors.secondary }]}
                                numberOfLines={1}
                              >
                                {preset.name}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => deleteCustomPreset(preset.id)}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                              style={styles.presetDeleteBtn}
                            >
                              <Ionicons name="close" size={13} color={colors.secondary + "cc"} />
                            </TouchableOpacity>
                          </Animated.View>
                          );
                        })}
                      </ScrollView>
                    )}
                  </View>
                )}

                <View style={styles.filterRow}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScroll}
                  >
                    {nutritionFilters.map((filter) => {
                      const active = activeFilters.has(filter.key);
                      const countForFilter = filterResultCounts[filter.key];
                      const isZeroCount = !active && countForFilter !== undefined && countForFilter === 0;
                      const filterDef = FILTER_DEFS.find((d) => d.key === filter.key);
                      const isNonDefault = filterDef != null &&
                        (filterThresholds[filter.key] ?? filterDef.defaultThreshold) !== filterDef.defaultThreshold;
                      if (!chipScaleAnims.current[filter.key]) {
                        chipScaleAnims.current[filter.key] = new Animated.Value(1);
                      }
                      if (!chipGlowAnims.current[filter.key]) {
                        chipGlowAnims.current[filter.key] = new Animated.Value(0);
                      }
                      const chipScale = chipScaleAnims.current[filter.key];
                      const chipGlow = chipGlowAnims.current[filter.key];
                      return (
                        <Animated.View
                          key={filter.key}
                          style={{ transform: [{ scale: chipScale }], opacity: isZeroCount ? 1 : searchLoadingDimAnim }}
                        >
                        <TouchableOpacity
                          key={filter.key}
                          onPress={() => {
                            setPreviewFilterKey(null);
                            if (!isZeroCount) toggleFilter(filter.key);
                          }}
                          onPressIn={() => {
                            if (!active && !isZeroCount && activeFilters.size >= 1) {
                              setPreviewFilterKey(filter.key);
                            }
                          }}
                          onPressOut={() => {
                            if (previewFilterKey === filter.key) setPreviewFilterKey(null);
                          }}
                          onLongPress={() => {
                            setPreviewFilterKey(null);
                            if (active && activeFilters.size >= 1) {
                              openSavePresetModal();
                            } else {
                              openThresholdEdit(filter.key);
                            }
                          }}
                          delayLongPress={400}
                          activeOpacity={isZeroCount ? 1 : 0.75}
                          style={[
                            styles.filterChip,
                            {
                              backgroundColor: active
                                ? colors.primary
                                : colors.muted,
                              borderColor: active
                                ? colors.primary
                                : isZeroCount
                                ? colors.border + "60"
                                : colors.border,
                              opacity: isZeroCount ? 0.5 : 1,
                              overflow: "hidden",
                            },
                          ]}
                        >
                          <Animated.View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              top: 0, left: 0, right: 0, bottom: 0,
                              borderRadius: 20,
                              backgroundColor: active
                                ? colors.primaryForeground + "60"
                                : colors.primary + "55",
                              opacity: chipGlow,
                            }}
                          />
                          <Ionicons
                            name={filter.icon}
                            size={13}
                            color={active ? colors.primaryForeground : colors.mutedForeground}
                          />
                          <Text
                            style={[
                              styles.filterChipText,
                              {
                                color: active
                                  ? colors.primaryForeground
                                  : colors.mutedForeground,
                                fontFamily: active
                                  ? "Inter_600SemiBold"
                                  : "Inter_400Regular",
                              },
                            ]}
                          >
                            {filter.chipLabel}
                          </Text>
                          {isNonDefault && (
                            <View
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 3,
                                backgroundColor: active
                                  ? colors.primaryForeground + "aa"
                                  : colors.secondary,
                                marginLeft: 2,
                                alignSelf: "center",
                              }}
                            />
                          )}
                          {!active && countForFilter !== undefined && (
                            <View
                              style={[
                                styles.filterCountBadge,
                                isZeroCount
                                  ? { backgroundColor: colors.warning + "22", borderColor: colors.warning + "55" }
                                  : { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" },
                              ]}
                            >
                              <Text style={[styles.filterCountText, { color: isZeroCount ? colors.warning : colors.primary }]}>
                                {isZeroCount ? "–" : countForFilter}
                              </Text>
                            </View>
                          )}
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              openThresholdEdit(filter.key);
                            }}
                            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          >
                            <Ionicons
                              name="settings-outline"
                              size={11}
                              color={active ? colors.primaryForeground + "99" : colors.mutedForeground + "80"}
                              style={{ marginLeft: 1 }}
                            />
                          </TouchableOpacity>
                        </TouchableOpacity>
                        </Animated.View>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.filterActions}>
                    {activeTab === "today" && isSearching && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        {infoTooltipVisible && (
                          <Animated.View
                            style={{
                              opacity: infoTooltipFadeAnim,
                              backgroundColor: colors.card,
                              borderWidth: 1,
                              borderColor: colors.border + "80",
                              borderRadius: 8,
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
                              Tap to replay the tip
                            </Text>
                          </Animated.View>
                        )}
                        <TouchableOpacity
                          onPress={showTipAgain}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{ opacity: 0.55 }}
                        >
                          <Ionicons name="information-circle-outline" size={17} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <Animated.View
                      style={{
                        opacity: Animated.multiply(todaySaveFadeAnim, searchLoadingDimAnim),
                        transform: [{ translateX: todaySaveSlideAnim }],
                      }}
                      pointerEvents={activeFilters.size >= 1 ? "auto" : "none"}
                    >
                      <TouchableOpacity
                        onPress={openSavePresetModal}
                        style={[
                          styles.filterClearBtn,
                          { borderColor: colors.secondary + "66", backgroundColor: colors.secondary + "12" },
                        ]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="bookmark-outline" size={13} color={colors.secondary} />
                        <Text style={[styles.filterClearText, { color: colors.secondary, fontFamily: "Inter_600SemiBold" }]}>
                          Save
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                    <Animated.View
                      style={{
                        opacity: Animated.multiply(todayResetFadeAnim, searchLoadingDimAnim),
                        transform: [{ translateX: todayResetSlideAnim }],
                      }}
                      pointerEvents={hasCustomThresholds ? "auto" : "none"}
                    >
                      <TouchableOpacity
                        onPress={resetAllThresholds}
                        style={[
                          styles.filterClearBtn,
                          { borderColor: colors.primary + "66", backgroundColor: colors.primary + "12" },
                        ]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="refresh-outline" size={13} color={colors.primary} />
                        <Text style={[styles.filterClearText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                          Reset all
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                    <Animated.View
                      style={{
                        opacity: Animated.multiply(todayClearFadeAnim, searchLoadingDimAnim),
                        transform: [{ translateX: todayClearSlideAnim }],
                      }}
                      pointerEvents={activeFilters.size > 0 ? "auto" : "none"}
                    >
                      <TouchableOpacity
                        onPress={clearFilters}
                        style={[
                          styles.filterClearBtn,
                          { borderColor: colors.border },
                        ]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="close" size={13} color={colors.mutedForeground} />
                        <Text style={[styles.filterClearText, { color: colors.mutedForeground }]}>
                          Clear
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>
              </View>
            )}

            {/* Combined filter summary — shown below chips when 2+ filters are active */}
            {filterSummaryVisible && (
              <Animated.View
                style={{
                  opacity: filterSummaryFadeAnim,
                  transform: [{ translateY: filterSummarySlideAnim }],
                }}
              >
                <Animated.Text
                  style={[
                    styles.filterCombinedSummary,
                    {
                      color: previewFilterKey ? colors.secondary : colors.primary,
                      transform: [{ scale: filterSummaryScaleAnim }],
                      opacity: searchLoadingDimAnim.interpolate({ inputRange: [0.5, 1], outputRange: [0.45, 1] }),
                    },
                  ]}
                >
                  {(() => {
                    if (previewFilterKey) {
                      const previewCount = filterResultCounts[previewFilterKey] ?? 0;
                      const activeLabels = nutritionFilters
                        .filter((f) => activeFilters.has(f.key))
                        .map((f) => f.label);
                      const previewLabel = nutritionFilters.find((f) => f.key === previewFilterKey)?.label ?? "";
                      const allLabels = [...activeLabels, previewLabel];
                      const labelText =
                        allLabels.length === 2
                          ? `${allLabels[0]} + ${allLabels[1]}`
                          : `all ${allLabels.length} filters`;
                      return `${previewCount} ${previewCount === 1 ? "result" : "results"} would match ${labelText}`;
                    }
                    const count = searchLoading
                      ? (prevFilterSummaryCountRef.current ?? 0)
                      : filteredSearchResults.length;
                    const labels = nutritionFilters
                      .filter((f) => activeFilters.has(f.key))
                      .map((f) => f.label);
                    const labelText =
                      labels.length === 2
                        ? `${labels[0]} + ${labels[1]}`
                        : `all ${labels.length} filters`;
                    return `${count} ${count === 1 ? "result" : "results"} match ${labelText}`;
                  })()}
                </Animated.Text>
              </Animated.View>
            )}

            {/* Long-press hint — shown once below filter chips */}
            {activeTab === "today" && isSearching && filterHintVisible && (
              <Animated.View style={{ opacity: filterHintFadeAnim }}>
                <Text style={[styles.filterHintText, { color: colors.mutedForeground }]}>
                  Long-press an active chip to save as preset · long-press an inactive chip to adjust its threshold
                </Text>
              </Animated.View>
            )}

            {/* Preset discovery nudge — shown once when user has no presets */}
            {activeTab === "today" && isSearching && presetNudgeVisible && customPresets.length === 0 && (
              <Animated.View
                style={[
                  styles.presetNudgeRow,
                  { opacity: presetNudgeFadeAnim, backgroundColor: colors.secondary + "14", borderColor: colors.secondary + "40" },
                ]}
              >
                <Ionicons name="bookmark-outline" size={13} color={colors.secondary} style={{ marginTop: 1 }} />
                <Text style={[styles.presetNudgeText, { color: colors.mutedForeground }]}>
                  Activate a filter, then tap{" "}
                  <Text style={{ color: colors.secondary, fontFamily: "Inter_600SemiBold" }}>Save</Text>
                  {" "}to build a reusable preset
                </Text>
                <TouchableOpacity
                  onPress={dismissPresetNudge}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={14} color={colors.mutedForeground + "aa"} />
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Search empty state */}
            {activeTab === "today" && isSearching && searchDone && !searchLoading && filteredSearchResults.length === 0 && (
              <View style={styles.searchEmpty}>
                <Ionicons
                  name={activeFilters.size > 0 ? "options-outline" : "search-outline"}
                  size={36}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.searchEmptyText, { color: colors.mutedForeground }]}>
                  {activeFilters.size > 0 && searchResults.length > 0
                    ? `No results match your filters`
                    : `No results for "${searchQuery.trim()}"`}
                </Text>
                {activeFilters.size > 0 && searchResults.length > 0 && (
                  <TouchableOpacity
                    onPress={clearFilters}
                    style={[styles.filterClearBtn, { borderColor: colors.primary, marginTop: 4 }]}
                  >
                    <Ionicons name="close" size={13} color={colors.primary} />
                    <Text style={[styles.filterClearText, { color: colors.primary }]}>
                      Clear filters
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Normal content — only shown when not searching on Today tab */}
            {activeTab === "today" && !isSearching && (
              <>
                {/* Macro Summary */}
                <GlassCard style={styles.macroCard}>
                  <View style={styles.macroCardHeader}>
                    <Text style={[styles.macroCardTitle, { color: colors.foreground }]}>Today's Macros</Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push("/macro-goals");
                      }}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      style={[styles.editGoalsBtn, { backgroundColor: colors.muted }]}
                    >
                      <Ionicons name="pencil-outline" size={13} color={colors.mutedForeground} />
                      <Text style={[styles.editGoalsText, { color: colors.mutedForeground }]}>Edit goals</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.macroRow}>
                    <Animated.View
                      style={[
                        {
                          borderRadius: 999,
                          padding: 4,
                          borderWidth: 2,
                          borderColor: highlightedMacro === "calories"
                            ? colors.primary
                            : "transparent",
                          shadowColor: colors.primary,
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: highlightedMacro === "calories" ? 0.5 : 0,
                          shadowRadius: highlightedMacro === "calories" ? 10 : 0,
                        },
                      ]}
                    >
                      <ProgressRing
                        progress={calories / CALORIE_GOAL}
                        size={90}
                        strokeWidth={8}
                        color={colors.primary}
                        label={calories.toString()}
                        sublabel="kcal"
                      />
                    </Animated.View>
                    <View style={styles.macros}>
                      <MacroBar
                        label="Protein"
                        value={Math.round(protein)}
                        goal={PROTEIN_GOAL}
                        color={colors.secondary}
                        isHighlighted={highlightedMacro === "protein"}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push("/macro-goals?focus=protein");
                        }}
                      />
                      <MacroBar
                        label="Carbs"
                        value={Math.round(carbs)}
                        goal={CARBS_GOAL}
                        color={colors.warning}
                        isHighlighted={highlightedMacro === "carbs"}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push("/macro-goals?focus=carbs");
                        }}
                      />
                      <MacroBar
                        label="Fat"
                        value={Math.round(fat)}
                        goal={FAT_GOAL}
                        color={colors.accent}
                        isHighlighted={highlightedMacro === "fat"}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          router.push("/macro-goals?focus=fat");
                        }}
                      />
                    </View>
                  </View>
                </GlassCard>

                {/* Today's logged meals by type */}
                {MEALS.map((meal) => {
                  const mealLogs = todayMeals.filter((m) => m.mealType === meal);
                  if (mealLogs.length === 0) return null;
                  const mealCal = mealLogs.reduce((s, m) => s + m.calories, 0);
                  const mealColor = MEAL_COLORS[meal];
                  return (
                    <View key={meal} style={styles.mealSection}>
                      <View style={styles.mealHeader}>
                        <View style={[styles.mealDot, { backgroundColor: mealColor }]} />
                        <Text style={[styles.mealTitle, { color: colors.foreground }]}>
                          {meal.charAt(0).toUpperCase() + meal.slice(1)}
                        </Text>
                        <Text style={[styles.mealCal, { color: colors.mutedForeground }]}>
                          {mealCal} kcal
                        </Text>
                      </View>
                      {mealLogs.map((log) => (
                        <NutritionRow
                          key={log.id}
                          log={log}
                          isFirst={log.id === firstTodayLogId}
                          onDelete={handleMealDelete}
                          onSaved={handleMealSaved}
                          onToggleStar={() =>
                            handleToggleFavorite({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType, servingLabel: log.amountGrams ? `${log.amountGrams}g` : undefined })
                          }
                        />
                      ))}
                    </View>
                  );
                })}

                {favoriteFoods.length > 0 && (
                  <>
                    <View
                      style={styles.sectionHeaderRow}
                      onLayout={(e) => { favoritesYRef.current = e.nativeEvent.layout.y; }}
                    >
                      <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
                        Favorites
                      </Text>
                      {isReordering ? (
                        <TouchableOpacity
                          onPress={exitReorderMode}
                          style={[styles.reorderDoneBtn, { backgroundColor: colors.primary }]}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.reorderDoneText, { color: colors.primaryForeground }]}>
                            Done
                          </Text>
                        </TouchableOpacity>
                      ) : favoriteFoods.length > 1 ? (
                        <TouchableOpacity
                          onPress={enterReorderMode}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.reorderHint, { color: colors.mutedForeground }]}>
                            Reorder
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {!isReordering && reorderHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: "#f59f0a40",
                            opacity: reorderHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="hand-left-outline" size={14} color="#f59f0a" />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Long-press a card to reorder
                        </Text>
                        <TouchableOpacity
                          onPress={dismissReorderHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {!isReordering && favGramsHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.primary + "40",
                            opacity: favGramsHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="scale-outline" size={14} color={colors.primary} />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Tap a food to enter grams and scale macros
                        </Text>
                        <TouchableOpacity
                          onPress={dismissFavGramsHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {!isReordering && favResetDefaultsHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.primary + "40",
                            opacity: favResetDefaultsHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Hold a card to reset its remembered defaults
                        </Text>
                        <TouchableOpacity
                          onPress={dismissFavResetDefaultsHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {isReordering ? (
                      reorderItems.map((food, idx) => (
                        <DraggableFavItem
                          key={`drag-${food.name}`}
                          food={food}
                          indexRef={indexRefsRef.current[idx] ?? { current: idx }}
                          listRef={reorderItemsRef}
                          itemHeightRef={itemHeightRef}
                          isActive={idx === activeReorderIdx}
                          isHover={idx === hoverReorderIdx && idx !== activeReorderIdx}
                          displacement={computeDisplacement(idx, activeReorderIdx, hoverReorderIdx)}
                          onDragStart={(i) => { setActiveReorderIdx(i); setHoverReorderIdx(i); }}
                          onHover={setHoverReorderIdx}
                          onDrop={handleReorderDrop}
                          colors={colors}
                        />
                      ))
                    ) : (
                      favoriteFoods.map((food, idx) => {
                        const isHighlighted = highlightedFavorite === food.name;
                        const highlightBg = isHighlighted
                          ? highlightAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: ["transparent", "#f59f0a30"],
                            })
                          : "transparent";
                        return (
                          <Animated.View
                            key={`fav-${food.name}-${idx}`}
                            style={[
                              styles.favHighlightWrapper,
                              { backgroundColor: highlightBg, borderRadius: 14 },
                            ]}
                            onLayout={(e) => {
                              const y = e.nativeEvent.layout.y;
                              favoriteCardYsRef.current[food.name] = y;
                              if (pendingScrollFavoriteRef.current === food.name) {
                                pendingScrollFavoriteRef.current = null;
                                flatListRef.current?.scrollToOffset({ offset: y, animated: true });
                              }
                            }}
                          >
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() => handleAddFood(food, { source: "fav" })}
                              onLongPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                setPreviewSheetFood({
                                  name: food.name,
                                  calories: food.calories,
                                  protein: food.protein,
                                  carbs: food.carbs,
                                  fat: food.fat,
                                  servingLabel: food.servingLabel,
                                  nutrients100g: food.nutrients100g,
                                  _kind: "search",
                                });
                              }}
                              delayLongPress={500}
                              onLayout={(e) => {
                                const h = e.nativeEvent.layout.height;
                                if (h > 0 && itemHeightRef.current !== h) {
                                  itemHeightRef.current = h;
                                }
                              }}
                              style={[
                                styles.foodCard,
                                { backgroundColor: colors.card, borderColor: "#f59f0a40" },
                              ]}
                            >
                              <View style={[styles.foodIcon, { backgroundColor: "#f59f0a20" }]}>
                                <Ionicons name="star" size={18} color="#f59f0a" />
                              </View>
                              <View style={styles.foodInfo}>
                                <Text style={[styles.foodName, { color: colors.foreground }]} numberOfLines={1}>
                                  {food.name}
                                </Text>
                                <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                                  P {food.protein}g · C {food.carbs}g · F {food.fat}g
                                </Text>
                                <View style={[styles.servingPill, { backgroundColor: colors.primary + "18" }]}>
                                  <Text style={[styles.servingPillText, { color: colors.primary }]}>
                                    {food.servingLabel ? `per ${food.servingLabel}` : "per serving"}
                                  </Text>
                                </View>
                              </View>
                              <Text style={[styles.foodCal, { color: colors.primary }]}>
                                {food.calories}
                              </Text>
                              <TouchableOpacity
                                onPress={() => handleToggleFavorite(food)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={styles.starBtn}
                              >
                                <Ionicons name="star" size={18} color="#f59f0a" />
                              </TouchableOpacity>
                            </TouchableOpacity>
                          </Animated.View>
                        );
                      })
                    )}
                  </>
                )}

                {recentFoods.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Recent Foods
                    </Text>
                    {recentGramsHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.primary + "40",
                            opacity: recentGramsHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="scale-outline" size={14} color={colors.primary} />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Tap a food to enter grams and scale macros
                        </Text>
                        <TouchableOpacity
                          onPress={dismissRecentGramsHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {recentResetDefaultsHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.primary + "40",
                            opacity: recentResetDefaultsHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Hold a card to reset its remembered defaults
                        </Text>
                        <TouchableOpacity
                          onPress={dismissRecentResetDefaultsHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {(recentFoodsExpanded ? recentFoods : recentFoods.slice(0, 5)).map((food, idx) => {
                      const canToggleRecent = !!(food.nutrients100g && food.servingLabel);
                      const showingRecent100g = canToggleRecent && recentFoodsPer100g.has(food.name);
                      const displayRecentCalories = showingRecent100g ? food.nutrients100g!.calories : food.calories;
                      const displayRecentProtein = showingRecent100g ? food.nutrients100g!.protein : food.protein;
                      const displayRecentCarbs = showingRecent100g ? food.nutrients100g!.carbs : food.carbs;
                      const displayRecentFat = showingRecent100g ? food.nutrients100g!.fat : food.fat;
                      const recentPillLabel = showingRecent100g
                        ? "per 100g"
                        : food.amountGrams !== undefined
                        ? `per ${Number.isInteger(food.amountGrams) ? food.amountGrams : food.amountGrams.toFixed(1)}g`
                        : food.servingLabel
                        ? `per ${food.servingLabel}`
                        : "per serving";

                      return (
                      <TouchableOpacity
                        key={`recent-${food.name}-${idx}`}
                        activeOpacity={0.8}
                        onPress={() => handleAddFood(food, { source: "recent" })}
                        onLongPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setPreviewSheetFood({
                            name: food.name,
                            calories: food.calories,
                            protein: food.protein,
                            carbs: food.carbs,
                            fat: food.fat,
                            servingLabel: food.servingLabel,
                            nutrients100g: food.nutrients100g,
                            _kind: "search",
                          });
                        }}
                        delayLongPress={500}
                        style={[
                          styles.foodCard,
                          { backgroundColor: colors.card, borderColor: colors.primary + "40" },
                        ]}
                      >
                        <View
                          style={[
                            styles.foodIcon,
                            { backgroundColor: colors.primary + "20" },
                          ]}
                        >
                          <Ionicons
                            name="time-outline"
                            size={18}
                            color={colors.primary}
                          />
                        </View>
                        <View style={styles.foodInfo}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={[styles.foodName, { color: colors.foreground, flexShrink: 1 }]} numberOfLines={1}>
                              {food.name}
                            </Text>
                            <Text style={{ fontSize: 11, color: colors.mutedForeground, flexShrink: 0 }}>
                              {formatRecentDate(food.lastEaten)}
                            </Text>
                          </View>
                          <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                            P {displayRecentProtein}g · C {displayRecentCarbs}g · F {displayRecentFat}g
                          </Text>
                          <TouchableOpacity
                            activeOpacity={canToggleRecent ? 0.7 : 1}
                            onPress={canToggleRecent ? (e) => {
                              e.stopPropagation();
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setRecentFoodsPer100g((prev) => {
                                const next = new Set(prev);
                                if (next.has(food.name)) next.delete(food.name);
                                else next.add(food.name);
                                return next;
                              });
                            } : undefined}
                            style={[
                              styles.servingPill,
                              { backgroundColor: colors.primary + "18" },
                              canToggleRecent && { paddingRight: 6 },
                            ]}
                          >
                            <Text style={[styles.servingPillText, { color: colors.primary }]}>
                              {recentPillLabel}
                            </Text>
                            {canToggleRecent && (
                              <Ionicons name="swap-horizontal-outline" size={11} color={colors.primary} style={{ marginLeft: 3 }} />
                            )}
                          </TouchableOpacity>
                        </View>
                        <Text style={[styles.foodCal, { color: colors.primary }]}>
                          {displayRecentCalories}
                        </Text>
                        <TouchableOpacity
                          onPress={isReordering ? undefined : () => {
                            const alreadyFavorited = isFavorite(food.name);
                            if (!alreadyFavorited) {
                              setRecentlyStarredNames((prev) => {
                                const next = new Set(prev);
                                next.add(food.name);
                                return next;
                              });
                              if (recentlyStarredTimersRef.current[food.name]) {
                                clearTimeout(recentlyStarredTimersRef.current[food.name]);
                              }
                              recentlyStarredTimersRef.current[food.name] = setTimeout(() => {
                                delete recentlyStarredTimersRef.current[food.name];
                                setRecentlyStarredNames((prev) => {
                                  const next = new Set(prev);
                                  next.delete(food.name);
                                  return next;
                                });
                              }, 800);
                            } else {
                              if (recentlyStarredTimersRef.current[food.name]) {
                                clearTimeout(recentlyStarredTimersRef.current[food.name]);
                                delete recentlyStarredTimersRef.current[food.name];
                              }
                              setRecentlyStarredNames((prev) => {
                                const next = new Set(prev);
                                next.delete(food.name);
                                return next;
                              });
                              setRecentlyUnstarredNames((prev) => {
                                const next = new Set(prev);
                                next.add(food.name);
                                return next;
                              });
                              if (recentlyUnstarredTimersRef.current[food.name]) {
                                clearTimeout(recentlyUnstarredTimersRef.current[food.name]);
                              }
                              recentlyUnstarredTimersRef.current[food.name] = setTimeout(() => {
                                delete recentlyUnstarredTimersRef.current[food.name];
                                setRecentlyUnstarredNames((prev) => {
                                  const next = new Set(prev);
                                  next.delete(food.name);
                                  return next;
                                });
                              }, 1500);
                            }
                            handleToggleFavorite(food);
                          }}
                          disabled={isReordering}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={[styles.starBtn, isReordering && { opacity: 0.35 }]}
                        >
                          <Ionicons
                            name={(isFavorite(food.name) || recentlyStarredNames.has(food.name)) ? "star" : "star-outline"}
                            size={18}
                            color={(isFavorite(food.name) || recentlyStarredNames.has(food.name)) ? "#f59f0a" : colors.mutedForeground}
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                      );
                    })}
                    {recentFoods.length > 5 && (
                      <TouchableOpacity
                        onPress={() => setRecentFoodsExpanded((prev) => !prev)}
                        activeOpacity={0.7}
                        style={{
                          alignSelf: "center",
                          marginTop: 4,
                          marginBottom: 2,
                          paddingVertical: 6,
                          paddingHorizontal: 16,
                          borderRadius: 20,
                          backgroundColor: colors.primary + "18",
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.primary }}>
                          {recentFoodsExpanded ? "Show less" : `See all (${recentFoods.length})`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                {customPresets.length > 0 && (
                  <>
                    <View style={styles.presetChipsHeader}>
                      <Text style={[styles.presetChipsLabel, { color: colors.mutedForeground }]}>
                        Saved Presets
                      </Text>
                      {isReorderingPresets ? (
                        <TouchableOpacity
                          onPress={exitPresetReorderMode}
                          style={[styles.reorderDoneBtn, { backgroundColor: colors.secondary }]}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.reorderDoneText, { color: colors.primaryForeground }]}>
                            Done
                          </Text>
                        </TouchableOpacity>
                      ) : customPresets.length >= 2 ? (
                        <TouchableOpacity
                          onPress={enterPresetReorderMode}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.reorderHint, { color: colors.mutedForeground }]}>
                            Reorder
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {presetLongPressHintVisible && !isReorderingPresets && (
                      <Animated.Text
                        style={[styles.presetLongPressHintText, { color: colors.mutedForeground, opacity: presetLongPressHintFadeAnim }]}
                      >
                        Hold a chip to edit or delete it
                      </Animated.Text>
                    )}
                    {isReorderingPresets && presetReorderHintVisible && (
                      <Animated.View
                        style={[
                          styles.reorderHintBanner,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.secondary + "40",
                            opacity: presetReorderHintFadeAnim,
                          },
                        ]}
                      >
                        <Ionicons name="swap-horizontal-outline" size={14} color={colors.secondary} />
                        <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                          Drag chips left or right to reorder
                        </Text>
                        <TouchableOpacity
                          onPress={dismissPresetReorderHint}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close" size={14} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                    {customPresets.length > 0 && !isReorderingPresets && (
                      <View
                        pointerEvents="none"
                        onLayout={(e) => {
                          const w = e.nativeEvent.layout.width;
                          if (w > 0) avgPresetChipWidthRef.current = w;
                        }}
                        style={{
                          position: "absolute",
                          opacity: 0,
                          flexDirection: "row",
                          alignItems: "center",
                          borderRadius: 20,
                          borderWidth: 1,
                          maxWidth: 200,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 10, paddingRight: 6, paddingVertical: 7 }}>
                          <Ionicons name="reorder-two-outline" size={11} color="transparent" />
                          <Ionicons name="bookmark" size={12} color="transparent" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_600SemiBold" }} numberOfLines={1}>
                            {customPresets[0].name}
                          </Text>
                        </View>
                        <View style={{ paddingHorizontal: 7, paddingVertical: 7 }}>
                          <Ionicons name="close" size={13} color="transparent" />
                        </View>
                      </View>
                    )}
                    {isReorderingPresets ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        scrollEnabled={false}
                        contentContainerStyle={[styles.filterScroll, { paddingVertical: 4, marginBottom: 4 }]}
                      >
                        {reorderPresetsItems.map((preset, idx) => (
                          <HorizontalDraggablePresetChip
                            key={`preset-drag-main-${preset.id}`}
                            preset={preset}
                            indexRef={indexRefsPresetRef.current[idx] ?? { current: idx }}
                            listRef={reorderPresetsRef}
                            avgChipWidthRef={avgPresetChipWidthRef}
                            isActive={idx === activeReorderPresetIdx}
                            isHover={idx === hoverReorderPresetIdx && idx !== activeReorderPresetIdx}
                            displacement={computePresetDisplacement(idx, activeReorderPresetIdx, hoverReorderPresetIdx)}
                            onDragStart={(i) => { setActiveReorderPresetIdx(i); setHoverReorderPresetIdx(i); }}
                            onHover={setHoverReorderPresetIdx}
                            onDrop={handlePresetReorderDrop}
                            onDelete={deletePresetInReorderMode}
                            colors={colors}
                          />
                        ))}
                      </ScrollView>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={[styles.filterScroll, { paddingVertical: 2, marginBottom: 4 }]}
                      >
                        {customPresets.map((preset) => {
                          if (!presetChipScaleAnims.current[preset.id]) {
                            presetChipScaleAnims.current[preset.id] = new Animated.Value(1);
                          }
                          if (!presetChipGlowAnims.current[preset.id]) {
                            presetChipGlowAnims.current[preset.id] = new Animated.Value(0);
                          }
                          const presetScale = presetChipScaleAnims.current[preset.id];
                          const presetGlow = presetChipGlowAnims.current[preset.id];
                          return (
                            <Animated.View
                              key={preset.id}
                              style={[
                                styles.presetChip,
                                { backgroundColor: colors.secondary + "18", borderColor: colors.secondary + "55", overflow: "hidden" },
                                { transform: [{ scale: presetScale }] },
                              ]}
                            >
                              <Animated.View
                                pointerEvents="none"
                                style={{
                                  position: "absolute",
                                  top: 0, left: 0, right: 0, bottom: 0,
                                  borderRadius: 20,
                                  backgroundColor: colors.secondary + "60",
                                  opacity: presetGlow,
                                }}
                              />
                              <TouchableOpacity
                                onPress={() => applyPreset(preset)}
                                onLongPress={() => openEditPresetModal(preset)}
                                delayLongPress={500}
                                activeOpacity={0.75}
                                style={styles.presetChipInner}
                              >
                                <Ionicons name="bookmark" size={12} color={colors.secondary} />
                                <Text
                                  style={[styles.presetChipText, { color: colors.secondary }]}
                                  numberOfLines={1}
                                >
                                  {preset.name}
                                </Text>
                              </TouchableOpacity>
                            </Animated.View>
                          );
                        })}
                      </ScrollView>
                    )}
                  </>
                )}

                <View style={styles.quickAddHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                    Quick Add
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowQuickEditor(true);
                    }}
                    activeOpacity={0.7}
                    style={[styles.quickEditBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  >
                    <Ionicons name="pencil-outline" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.quickEditBtnText, { color: colors.mutedForeground }]}>Edit</Text>
                  </TouchableOpacity>
                </View>
                {quickGramsHintVisible && (
                  <Animated.View
                    style={[
                      styles.reorderHintBanner,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.primary + "40",
                        opacity: quickGramsHintFadeAnim,
                      },
                    ]}
                  >
                    <Ionicons name="scale-outline" size={14} color={colors.primary} />
                    <Text style={[styles.reorderHintBannerText, { color: colors.mutedForeground }]}>
                      Tap a food to enter grams and scale macros
                    </Text>
                    <TouchableOpacity
                      onPress={dismissQuickGramsHint}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={14} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </>
            )}

            {/* History view — shown when History tab is active */}
            {activeTab === "history" && (
              <>
                {/* Filter bar — rendered via historyFilterPanelOpen so any future
                    collapse/expand toggle can flip that boolean and the chip
                    slide-in animation will replay automatically on every re-open. */}
                {historyFilterPanelOpen && (
                <><View
                  style={styles.historyFilterBar}
                  onLayout={(e) => {
                    historyFilterBarYRef.current = e.nativeEvent.layout.y;
                  }}
                >
                  <ScrollView
                    ref={historyFilterScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.historyFilterRow}
                  >
                    {(["all", "7d", "30d"] as const).map((range, idx) => {
                      const label = range === "all" ? "All time" : range === "7d" ? "Last 7 days" : "Last 30 days";
                      const active = historyDateRange === range;
                      const chip = (
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setHistoryDateRange(range);
                          }}
                          style={[
                            styles.historyFilterChip,
                            active
                              ? { backgroundColor: colors.primary, borderColor: colors.primary }
                              : { backgroundColor: colors.card, borderColor: colors.border },
                          ]}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.historyFilterChipText,
                              { color: active ? colors.primaryForeground : colors.mutedForeground },
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      );
                      return (
                        <Animated.View
                          key={range}
                          style={{
                            borderRadius: 20,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 0 },
                            shadowRadius: 8,
                            shadowOpacity: historyChipHighlightAnims[idx],
                            elevation: historyChipHighlightAnims[idx].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 6],
                            }),
                            opacity: historyChipFadeAnims[idx],
                            transform: [{ translateX: historyChipSlideAnims[idx] }],
                          }}
                        >
                          {chip}
                        </Animated.View>
                      );
                    })}

                    {/* Custom date range chip — visible when a custom range is active */}
                    {historyDateRange === "custom" && customDateRange && (
                      <View style={[
                        styles.historyFilterChip,
                        { backgroundColor: colors.primary + "18", borderColor: colors.primary, flexDirection: "row", alignItems: "center", gap: 4 },
                      ]}>
                        <Ionicons name="calendar" size={12} color={colors.primary} />
                        <Text style={[styles.historyFilterChipText, { color: colors.primary }]}>
                          {formatCustomRangeLabel(customDateRange.start, customDateRange.end)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setHistoryDateRange("7d");
                            setCustomDateRange(null);
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Ionicons name="close" size={13} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    )}

                    {/* Calendar icon button — opens date picker */}
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setCalendarSheetVisible(true);
                      }}
                      style={[
                        styles.historyFilterChip,
                        {
                          backgroundColor: historyDateRange === "custom" ? colors.primary + "18" : colors.card,
                          borderColor: historyDateRange === "custom" ? colors.primary : colors.border,
                          paddingHorizontal: 9,
                        },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={15}
                        color={historyDateRange === "custom" ? colors.primary : colors.mutedForeground}
                      />
                    </TouchableOpacity>

                    <Animated.View
                      style={{ opacity: historyChipDividerFadeAnim }}
                      pointerEvents="none"
                    >
                      <View style={styles.historyFilterDivider} />
                    </Animated.View>

                    {(["all", ...MEALS] as const).map((meal, mealIdx) => {
                      const chipIdx = 3 + mealIdx;
                      const label = meal === "all" ? "All meals" : meal.charAt(0).toUpperCase() + meal.slice(1);
                      const active = historyMealFilter === meal;
                      const dotColor = meal !== "all" ? MEAL_COLORS[meal as MealType] : colors.primary;
                      return (
                        <Animated.View
                          key={`meal-${meal}`}
                          style={{
                            borderRadius: 20,
                            shadowColor: dotColor,
                            shadowOffset: { width: 0, height: 0 },
                            shadowRadius: 8,
                            shadowOpacity: historyChipHighlightAnims[chipIdx],
                            elevation: historyChipHighlightAnims[chipIdx].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 6],
                            }),
                            opacity: historyChipFadeAnims[chipIdx],
                            transform: [{ translateX: historyChipSlideAnims[chipIdx] }],
                          }}
                        >
                          <TouchableOpacity
                            onPress={() => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                              setHistoryMealFilter(meal as HistoryMealFilter);
                            }}
                            style={[
                              styles.historyFilterChip,
                              active
                                ? { backgroundColor: dotColor + "22", borderColor: dotColor }
                                : { backgroundColor: colors.card, borderColor: colors.border },
                            ]}
                            activeOpacity={0.75}
                          >
                            {meal !== "all" && (
                              <View style={[styles.historyFilterDot, { backgroundColor: dotColor }]} />
                            )}
                            <Text
                              style={[
                                styles.historyFilterChipText,
                                { color: active ? dotColor : colors.mutedForeground },
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    })}

                    <Animated.View
                      style={{ opacity: historyDividerFadeAnim, transform: [{ translateX: historyDividerSlideAnim }] }}
                      pointerEvents="none"
                    >
                      <View style={styles.historyFilterDivider} />
                    </Animated.View>

                    <Animated.View
                      style={{
                        opacity: historyResetFadeAnim,
                        transform: [{ translateX: historyResetSlideAnim }],
                      }}
                      pointerEvents={historyDateRange !== "all" || historyMealFilter !== "all" ? "auto" : "none"}
                    >
                      <TouchableOpacity
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setHistoryDateRange("all");
                          setHistoryMealFilter("all");
                          setCustomDateRange(null);
                        }}
                        style={[
                          styles.historyFilterChip,
                          { backgroundColor: colors.destructive + "15", borderColor: colors.destructive + "60" },
                        ]}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="close-circle-outline" size={13} color={colors.destructive} />
                        <Text style={[styles.historyFilterChipText, { color: colors.destructive }]}>
                          Reset
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  </ScrollView>
                </View>

                {/* Long-press hint — shown once below history filter chips */}
                {historyFilterHintVisible && (
                  <Animated.View style={{ opacity: historyFilterHintFadeAnim }}>
                    <Text
                      style={[styles.filterHintText, { color: colors.mutedForeground }]}
                      onPress={handleHistoryFilterHintPress}
                    >
                      Tap a chip to filter by date range or meal type
                    </Text>
                  </Animated.View>
                )}
                </>)}

                {/* Calorie / macro trend chart */}
                {trendChartDays.length > 0 && (
                  <View
                    onLayout={(e) => {
                      trendChartYRef.current = e.nativeEvent.layout.y;
                    }}
                    style={[
                      styles.trendChartCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.trendChartHeader}>
                      <Text style={[styles.trendChartTitle, { color: colors.foreground }]}>
                        {trendMetric === "calories"
                          ? "Calorie Trend"
                          : trendMetric === "protein"
                          ? "Protein Trend"
                          : trendMetric === "carbs"
                          ? "Carbs Trend"
                          : "Fat Trend"}
                      </Text>
                      <Text style={[styles.trendChartSubtitle, { color: colors.mutedForeground }]}>
                        {trendChartTotalDays > trendChartDays.length
                          ? `Most recent ${trendChartDays.length} of ${trendChartTotalDays} days`
                          : `Last ${trendChartDays.length} day${trendChartDays.length !== 1 ? "s" : ""}`}
                        {highlightedDate ? " · tap pill → to jump to day" : " · tap a bar to highlight"}
                      </Text>
                    </View>
                    {/* Segmented metric selector */}
                    <View style={styles.trendMetricRow}>
                      {(
                        [
                          { key: "calories" as const, label: "Calories", color: colors.primary },
                          { key: "protein" as const, label: "Protein", color: "#3b82f6" },
                          { key: "carbs" as const, label: "Carbs", color: "#f97316" },
                          { key: "fat" as const, label: "Fat", color: "#ec4899" },
                        ] as const
                      ).map(({ key, label, color }) => {
                        const isActive = trendMetric === key;
                        return (
                          <TouchableOpacity
                            key={key}
                            onPress={() => setTrendMetric(key)}
                            style={[
                              styles.trendMetricPill,
                              {
                                backgroundColor: isActive ? color + "22" : "transparent",
                                borderColor: isActive ? color : colors.border,
                              },
                            ]}
                          >
                            <Animated.View
                              style={isActive ? { transform: [{ scale: trendPillPulse }] } : undefined}
                            >
                              <Text
                                style={[
                                  styles.trendMetricPillText,
                                  { color: isActive ? color : colors.mutedForeground },
                                ]}
                              >
                                {label}
                              </Text>
                            </Animated.View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <CalorieTrendChart
                      days={chartDisplayDays}
                      goal={
                        trendMetric === "calories"
                          ? CALORIE_GOAL
                          : trendMetric === "protein"
                          ? PROTEIN_GOAL
                          : trendMetric === "carbs"
                          ? CARBS_GOAL
                          : FAT_GOAL
                      }
                      unit={trendMetric === "calories" ? "kcal" : "g"}
                      accentColor={
                        trendMetric === "calories"
                          ? colors.primary
                          : trendMetric === "protein"
                          ? "#3b82f6"
                          : trendMetric === "carbs"
                          ? "#f97316"
                          : "#ec4899"
                      }
                      highlightedDate={highlightedDate}
                      onBarPress={handleChartBarPress}
                      onPillPress={handleChartPillPress}
                      onClearHighlight={handleClearHighlight}
                      mealBreakdown={highlightedDateMealBreakdown}
                      mealFilter={historyMealFilter}
                      onEditGoals={() =>
                        router.push(
                          trendMetric === "calories"
                            ? "/macro-goals"
                            : `/macro-goals?focus=${trendMetric}`
                        )
                      }
                      colors={colors}
                    />
                  </View>
                )}

                {resultCountVisible && (
                  <Animated.Text
                    style={[
                      styles.historyResultCount,
                      { color: colors.mutedForeground, opacity: resultCountFadeAnim },
                    ]}
                  >
                    {[
                      `${filteredHistoryDays.length} day${filteredHistoryDays.length !== 1 ? "s" : ""} found`,
                      historyDateRange === "7d"
                        ? "Last 7 days"
                        : historyDateRange === "30d"
                        ? "Last 30 days"
                        : historyDateRange === "custom" && customDateRange
                        ? formatCustomRangeLabel(customDateRange.start, customDateRange.end)
                        : null,
                      historyMealFilter !== "all"
                        ? `${historyMealFilter.charAt(0).toUpperCase() + historyMealFilter.slice(1)} only`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Animated.Text>
                )}

                {filteredHistoryDays.length >= 2 && weeklyAvgSummary && (
                  <View style={[styles.weeklyAvgCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.weeklyAvgHeader}>
                      <Text style={[styles.weeklyAvgTitle, { color: colors.foreground }]}>Daily Averages</Text>
                      <Text style={[styles.weeklyAvgSubtitle, { color: colors.mutedForeground }]}>
                        across {weeklyAvgSummary.days} days
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.weeklyAvgCalRow, { borderBottomColor: colors.border }]}
                      activeOpacity={0.7}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setTrendMetric("calories");
                        flatListRef.current?.scrollToOffset({ offset: trendChartYRef.current, animated: true });
                      }}
                    >
                      <View style={[styles.weeklyAvgCalBadge, {
                          backgroundColor: trendMetric === "calories" ? colors.primary + "30" : colors.primary + "18",
                          borderWidth: trendMetric === "calories" ? 1 : 0,
                          borderColor: trendMetric === "calories" ? colors.primary + "99" : "transparent",
                        }]}>
                        <Ionicons name="flame-outline" size={13} color={colors.primary} />
                        <Text style={[styles.weeklyAvgCalText, { color: colors.primary }]}>
                          {weeklyAvgSummary.avgCalories} / {CALORIE_GOAL} kcal avg/day
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.weeklyAvgMacroRow}>
                      <HistoryMacroChip
                        label="P"
                        value={weeklyAvgSummary.avgProtein}
                        goal={PROTEIN_GOAL}
                        color={colors.secondary}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTrendMetric("protein");
                          flatListRef.current?.scrollToOffset({ offset: trendChartYRef.current, animated: true });
                        }}
                        onBadgePress={() => openMacroDrillDown("protein", "Protein", PROTEIN_GOAL, colors.secondary, weeklyAvgSummary.avgProtein)}
                      />
                      <HistoryMacroChip
                        label="C"
                        value={weeklyAvgSummary.avgCarbs}
                        goal={CARBS_GOAL}
                        color={colors.warning}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTrendMetric("carbs");
                          flatListRef.current?.scrollToOffset({ offset: trendChartYRef.current, animated: true });
                        }}
                        onBadgePress={() => openMacroDrillDown("carbs", "Carbs", CARBS_GOAL, colors.warning, weeklyAvgSummary.avgCarbs)}
                      />
                      <HistoryMacroChip
                        label="F"
                        value={weeklyAvgSummary.avgFat}
                        goal={FAT_GOAL}
                        color={colors.accent}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setTrendMetric("fat");
                          flatListRef.current?.scrollToOffset({ offset: trendChartYRef.current, animated: true });
                        }}
                        onBadgePress={() => openMacroDrillDown("fat", "Fat", FAT_GOAL, colors.accent, weeklyAvgSummary.avgFat)}
                      />
                    </View>
                  </View>
                )}

                {filteredHistoryDays.length === 0 ? (
                  <View style={styles.historyEmpty}>
                    <Ionicons name="calendar-outline" size={44} color={colors.mutedForeground} />
                    <Text style={[styles.historyEmptyTitle, { color: colors.foreground }]}>
                      {historyDays.length === 0 ? "No past logs yet" : "No entries match your filters"}
                    </Text>
                    <Text style={[styles.historyEmptyText, { color: colors.mutedForeground }]}>
                      {historyDays.length === 0
                        ? "Meals you log will appear here day by day"
                        : "Try adjusting the date range or meal type filter"}
                    </Text>
                  </View>
                ) : (
                  filteredHistoryDays.map(({ date, logs, totals }) => {
                    const d = new Date(date + "T12:00:00");
                    const yesterday = new Date(Date.now() - 86400000);
                    const isYesterday = d.toDateString() === yesterday.toDateString();
                    const isHighlighted = date === highlightedDate;
                    const label = isYesterday
                      ? "Yesterday"
                      : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
                    const allGoalsMet =
                      totals.calories <= CALORIE_GOAL &&
                      totals.protein >= PROTEIN_GOAL &&
                      totals.carbs >= CARBS_GOAL &&
                      totals.fat >= FAT_GOAL;
                    return (
                      <View
                        key={date}
                        onLayout={(e) => {
                          const cardY = e.nativeEvent.layout.y;
                          historyCardYsRef.current[date] = cardY;
                          // Immediately mark cards that are already in the visible
                          // viewport when the history section first lays out.
                          if (cardY < scrollYRef.current + windowHeight) {
                            markDateSeen(date);
                          }
                        }}
                        style={[
                          styles.historyDay,
                          isHighlighted && {
                            borderColor: colors.warning,
                            borderWidth: 1.5,
                            borderRadius: 12,
                          },
                        ]}
                      >
                        <View style={[styles.historyDayHeader, { borderBottomColor: colors.border }]}>
                          <View style={styles.historyDayHeaderLeft}>
                            <Text style={[styles.historyDayLabel, { color: colors.foreground }]}>
                              {label}
                            </Text>
                            <Text style={[styles.historyDayDate, { color: colors.mutedForeground }]}>
                              {isYesterday ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}
                            </Text>
                            {isHighlighted && (
                              <>
                                <TouchableOpacity
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    flatListRef.current?.scrollToOffset({ offset: trendChartYRef.current, animated: true });
                                  }}
                                  activeOpacity={0.75}
                                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                  style={[styles.backToChartBtn, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "60" }]}
                                >
                                  <Ionicons name="arrow-up" size={10} color={colors.warning} />
                                  <Text style={[styles.backToChartBtnText, { color: colors.warning }]}>Chart</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    setHighlightedDate(null);
                                  }}
                                  activeOpacity={0.75}
                                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                  style={[styles.backToChartBtn, { backgroundColor: colors.warning + "20", borderColor: colors.warning + "60" }]}
                                >
                                  <Ionicons name="close" size={10} color={colors.warning} />
                                  <Text style={[styles.backToChartBtnText, { color: colors.warning }]}>Clear</Text>
                                </TouchableOpacity>
                              </>
                            )}
                            {allGoalsMet && (
                              <TouchableOpacity
                                onPress={() => {
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                  Alert.alert(
                                    "🌟 Perfect Day!",
                                    "You hit every macro goal and stayed within your calorie target. Amazing work — keep it up!",
                                  );
                                }}
                                activeOpacity={0.75}
                                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                                style={[styles.allGoalsMetBadge, { backgroundColor: colors.success + "20", borderColor: colors.success + "50" }]}
                              >
                                <Ionicons name="star" size={10} color={colors.success} />
                                <Text style={[styles.allGoalsMetText, { color: colors.success }]}>All goals met</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <View style={styles.historyDayHeaderRight}>
                            <MacroRing
                              protein={totals.protein}
                              carbs={totals.carbs}
                              fat={totals.fat}
                              shouldAnimate={seenDatesRef.current.has(date)}
                            />
                            <TouchableOpacity
                              onPress={() => setDayBreakdownDate(date)}
                              activeOpacity={0.75}
                              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                              <View style={[styles.historyDayBadge, styles.historyDayBadgeTappable, { backgroundColor: totals.calories <= CALORIE_GOAL ? colors.success + "20" : colors.destructive + "20" }]}>
                                <Text style={[styles.historyDayBadgeText, { color: totals.calories <= CALORIE_GOAL ? colors.success : colors.destructive }]}>
                                  {Math.round(totals.calories).toLocaleString()} / {CALORIE_GOAL.toLocaleString()} kcal
                                </Text>
                                <Ionicons name="chevron-up" size={11} color={totals.calories <= CALORIE_GOAL ? colors.success : colors.destructive} style={{ marginLeft: 2 }} />
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={[styles.historyMacroRow, { borderBottomColor: colors.border }]}>
                          <HistoryMacroChip label="P" value={Math.round(totals.protein)} goal={PROTEIN_GOAL} color={colors.secondary} />
                          <HistoryMacroChip label="C" value={Math.round(totals.carbs)} goal={CARBS_GOAL} color={colors.warning} />
                          <HistoryMacroChip label="F" value={Math.round(totals.fat)} goal={FAT_GOAL} color={colors.accent} />
                        </View>
                        {MEALS.map((meal) => {
                          const mealEntries = logs.filter((m) => m.mealType === meal);
                          if (mealEntries.length === 0) return null;
                          const mealCal = mealEntries.reduce((s, m) => s + m.calories, 0);
                          return (
                            <View key={meal} style={styles.historyMealSection}>
                              <View style={styles.historyMealHeader}>
                                <View style={[styles.mealDot, { backgroundColor: MEAL_COLORS[meal] }]} />
                                <Text style={[styles.historyMealTitle, { color: colors.foreground }]}>
                                  {meal.charAt(0).toUpperCase() + meal.slice(1)}
                                </Text>
                                <Text style={[styles.mealCal, { color: colors.mutedForeground }]}>
                                  {mealCal} kcal
                                </Text>
                              </View>
                              {mealEntries.map((log) => (
                                <HistoryFoodRow
                                  key={log.id}
                                  log={log}
                                  isFirst={log.id === firstHistoryLogId}
                                  onAddFood={() => handleAddFood({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType })}
                                  onDelete={handleMealDelete}
                                  onLogToday={handleLogToday}
                                  onSaved={handleMealSaved}
                                />
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    );
                  })
                )}
              </>
            )}

            {/* Search results header */}
            {activeTab === "today" && isSearching && filteredSearchResults.length > 0 && (
              <View style={styles.resultsHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Results
                </Text>
                <Text style={[styles.resultsCount, { color: colors.mutedForeground }]}>
                  {filteredSearchResults.length}
                  {activeFilters.size > 0 && searchResults.length !== filteredSearchResults.length
                    ? ` of ${searchResults.length}`
                    : ""}
                </Text>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
        ]}
        renderItem={({ item }) => {
          if (item._kind === "search") {
            const itemKey = `${item.name}:${item.servingLabel ?? ""}:${item.calories}`;
            const canToggle = !!(item.servingLabel && item.nutrients100g);
            const showing100g = canToggle && per100gItems.has(itemKey);
            const displayCalories = showing100g ? item.nutrients100g!.calories : item.calories;
            const displayProtein = showing100g ? item.nutrients100g!.protein : item.protein;
            const displayCarbs = showing100g ? item.nutrients100g!.carbs : item.carbs;
            const displayFat = showing100g ? item.nutrients100g!.fat : item.fat;
            const pillLabel = showing100g
              ? "per 100g"
              : item.servingLabel
              ? `per ${item.servingLabel}`
              : "per serving";
            const favFood: FavoriteFood = { name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, mealType: "snack", servingLabel: item.servingLabel };
            const starred = isFavorite(item.name);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (showing100g && item.nutrients100g) {
                    handleScannedFood({
                      ...item,
                      calories: item.nutrients100g.calories,
                      protein: item.nutrients100g.protein,
                      carbs: item.nutrients100g.carbs,
                      fat: item.nutrients100g.fat,
                      servingLabel: undefined,
                    }, "100");
                  } else {
                    handleScannedFood(item);
                  }
                }}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setPreviewSheetFood(item);
                }}
                delayLongPress={400}
                style={[
                  styles.foodCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.foodIcon,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Ionicons
                    name="restaurant-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.foodInfo}>
                  <Text style={[styles.foodName, { color: colors.foreground }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                    P {displayProtein}g · C {displayCarbs}g · F {displayFat}g
                  </Text>
                  <TouchableOpacity
                    activeOpacity={canToggle ? 0.7 : 1}
                    onPress={canToggle ? (e) => {
                      e.stopPropagation();
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPer100gItems((prev) => {
                        const next = new Set(prev);
                        if (next.has(itemKey)) next.delete(itemKey);
                        else next.add(itemKey);
                        return next;
                      });
                    } : undefined}
                    style={[
                      styles.servingPill,
                      { backgroundColor: colors.primary + "18" },
                      canToggle && { paddingRight: 6 },
                    ]}
                  >
                    <Text style={[styles.servingPillText, { color: colors.primary }]}>
                      {pillLabel}
                    </Text>
                    {canToggle && (
                      <Ionicons name="swap-horizontal-outline" size={11} color={colors.primary} style={{ marginLeft: 3 }} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={[styles.foodCal, { color: colors.primary }]}>
                  {displayCalories}
                </Text>
                <TouchableOpacity
                  onPress={() => handleToggleFavorite(favFood)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={starred ? "star" : "star-outline"}
                    size={18}
                    color={starred ? "#f59f0a" : colors.mutedForeground}
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }

          const favFood: FavoriteFood = { name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, mealType: item.mealType };
          const starred = isFavorite(item.name);
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleAddFood(item, { source: "quick" })}
              style={[
                styles.foodCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.foodIcon,
                  { backgroundColor: MEAL_COLORS[item.mealType] + "20" },
                ]}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={18}
                  color={MEAL_COLORS[item.mealType]}
                />
              </View>
              {(() => {
                const canToggleQuick = !!(item.nutrients100g && item.servingLabel);
                const showingQuick100g = canToggleQuick && quickPer100gMap[item.name] === true;
                const quickDisplayBase = showingQuick100g ? item.nutrients100g! : item;
                const quickPillLabel = showingQuick100g
                  ? "per 100g"
                  : item.servingLabel
                  ? `per ${item.servingLabel}`
                  : "per serving";
                return (
                  <>
                    <View style={styles.foodInfo}>
                      <Text style={[styles.foodName, { color: colors.foreground }]}>
                        {item.name}
                      </Text>
                      <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                        P {quickDisplayBase.protein}g · C {quickDisplayBase.carbs}g · F {quickDisplayBase.fat}g
                      </Text>
                      <TouchableOpacity
                        activeOpacity={canToggleQuick ? 0.7 : 1}
                        onPress={canToggleQuick ? (e) => {
                          e.stopPropagation();
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          const newVal = !quickPer100gMap[item.name];
                          setQuickPer100gMap((prev) => ({ ...prev, [item.name]: newVal }));
                          AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                            const storageMap: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                            storageMap[item.name] = { per100g: newVal, grams: 0 };
                            AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(storageMap));
                          }).catch(() => {});
                        } : undefined}
                        style={[
                          styles.servingPill,
                          { backgroundColor: colors.primary + "18" },
                          canToggleQuick && { paddingRight: 6 },
                        ]}
                      >
                        <Text style={[styles.servingPillText, { color: colors.primary }]}>
                          {quickPillLabel}
                        </Text>
                        {canToggleQuick && (
                          <Ionicons name="swap-horizontal-outline" size={11} color={colors.primary} style={{ marginLeft: 3 }} />
                        )}
                      </TouchableOpacity>
                    </View>
                    <Text style={[styles.foodCal, { color: colors.primary }]}>
                      {quickDisplayBase.calories}
                    </Text>
                  </>
                );
              })()}
              <TouchableOpacity
                onPress={() => handleToggleFavorite(favFood)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.starBtn}
              >
                <Ionicons
                  name={starred ? "star" : "star-outline"}
                  size={18}
                  color={starred ? "#f59f0a" : colors.mutedForeground}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      {/* Quick-Add Editor Sheet */}
      <QuickFoodsEditorSheet
        visible={showQuickEditor}
        onClose={() => setShowQuickEditor(false)}
        quickFoods={quickFoods}
        onUpdate={updateQuickFoods}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => {
          setShowScanner(false);
          refreshRecentScanCount();
        }}
        onFoodFound={handleScannedFood}
        onManualEntry={() => {
          setShowScanner(false);
          handleManualEntry();
        }}
      />

      {/* Recently Scanned Modal */}
      <RecentlyScannedModal
        visible={showRecentScans}
        onClose={() => {
          setShowRecentScans(false);
          refreshRecentScanCount();
        }}
        onFoodFound={(food, per100g) => handleScannedFood(food, undefined, per100g)}
      />

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualEntry}
        transparent
        animationType="slide"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Add Food Manually
            </Text>

            <TextInput
              placeholder="Food name"
              placeholderTextColor={colors.mutedForeground}
              value={manualForm.name}
              onChangeText={(v) => {
                setManualForm((f) => ({ ...f, name: v }));
                setManualMacrosPrefilledFor(null);
              }}
              onBlur={() => {
                const name = manualForm.name.trim();
                if (!name) return;
                const savedMeal = lastUsedMealMapRef.current[name] as MealType | undefined;
                if (savedMeal) setManualMeal(savedMeal);
                const snapshotForm = manualForm;
                AsyncStorage.getItem(MANUAL_MACROS_KEY)
                  .then((raw) => {
                    if (!raw) return;
                    const map: Record<string, { calories: string; protein: string; carbs: string; fat: string }> =
                      JSON.parse(raw);
                    const saved = map[name];
                    if (!saved) return;
                    const nextCalories = snapshotForm.calories === "" ? saved.calories : snapshotForm.calories;
                    const nextProtein = snapshotForm.protein === "" ? saved.protein : snapshotForm.protein;
                    const nextCarbs = snapshotForm.carbs === "" ? saved.carbs : snapshotForm.carbs;
                    const nextFat = snapshotForm.fat === "" ? saved.fat : snapshotForm.fat;
                    const anyApplied =
                      nextCalories !== snapshotForm.calories ||
                      nextProtein !== snapshotForm.protein ||
                      nextCarbs !== snapshotForm.carbs ||
                      nextFat !== snapshotForm.fat;
                    if (!anyApplied) return;
                    setManualForm((f) => ({
                      ...f,
                      calories: f.calories === "" ? saved.calories : f.calories,
                      protein: f.protein === "" ? saved.protein : f.protein,
                      carbs: f.carbs === "" ? saved.carbs : f.carbs,
                      fat: f.fat === "" ? saved.fat : f.fat,
                    }));
                    setManualMacrosPrefilledFor(name);
                  })
                  .catch(() => {});
              }}
              style={[
                styles.textInput,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            />

            <View style={styles.macroInputRow}>
              <MacroInput
                label="Calories"
                value={manualForm.calories}
                onChangeText={(v) => {
                  manualCaloriesAutoFilled.current = false;
                  setManualForm((f) => ({ ...f, calories: v }));
                }}
                colors={colors}
              />
              <MacroInput
                label="Protein (g)"
                value={manualForm.protein}
                onChangeText={(v) => setManualForm((f) => {
                  const updated = { ...f, protein: v };
                  if (manualCaloriesAutoFilled.current || updated.calories === "") {
                    const p = parseFloat(v) || 0;
                    const c = parseFloat(updated.carbs) || 0;
                    const ft = parseFloat(updated.fat) || 0;
                    const kcal = p * 4 + c * 4 + ft * 9;
                    if (kcal > 0) { manualCaloriesAutoFilled.current = true; return { ...updated, calories: String(Math.round(kcal)) }; }
                  }
                  return updated;
                })}
                colors={colors}
              />
            </View>
            <View style={styles.macroInputRow}>
              <MacroInput
                label="Carbs (g)"
                value={manualForm.carbs}
                onChangeText={(v) => setManualForm((f) => {
                  const updated = { ...f, carbs: v };
                  if (manualCaloriesAutoFilled.current || updated.calories === "") {
                    const p = parseFloat(updated.protein) || 0;
                    const c = parseFloat(v) || 0;
                    const ft = parseFloat(updated.fat) || 0;
                    const kcal = p * 4 + c * 4 + ft * 9;
                    if (kcal > 0) { manualCaloriesAutoFilled.current = true; return { ...updated, calories: String(Math.round(kcal)) }; }
                  }
                  return updated;
                })}
                colors={colors}
              />
              <MacroInput
                label="Fat (g)"
                value={manualForm.fat}
                onChangeText={(v) => setManualForm((f) => {
                  const updated = { ...f, fat: v };
                  if (manualCaloriesAutoFilled.current || updated.calories === "") {
                    const p = parseFloat(updated.protein) || 0;
                    const c = parseFloat(updated.carbs) || 0;
                    const ft = parseFloat(v) || 0;
                    const kcal = p * 4 + c * 4 + ft * 9;
                    if (kcal > 0) { manualCaloriesAutoFilled.current = true; return { ...updated, calories: String(Math.round(kcal)) }; }
                  }
                  return updated;
                })}
                colors={colors}
              />
            </View>

            {(() => {
              const protein = parseFloat(manualForm.protein) || 0;
              const carbs = parseFloat(manualForm.carbs) || 0;
              const fat = parseFloat(manualForm.fat) || 0;
              const calories = parseFloat(manualForm.calories) || 0;
              const macroKcal = Math.round(protein * 4 + carbs * 4 + fat * 9);
              const statedKcal = Math.round(calories);
              const hasAnyMacro = protein > 0 || carbs > 0 || fat > 0;
              const mismatch =
                hasAnyMacro &&
                statedKcal > 0 &&
                Math.abs(macroKcal - statedKcal) / statedKcal > 0.2;
              if (!hasAnyMacro) return null;
              return (
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    onPress={() => { if (mismatch) setShowManualBreakdown(v => !v); }}
                    activeOpacity={mismatch ? 0.7 : 1}
                  >
                    <Text
                      style={[
                        styles.macroCalHint,
                        { color: mismatch ? "#f59e0b" : colors.mutedForeground },
                      ]}
                    >
                      ~{macroKcal} kcal from macros
                      {mismatch ? "  ⚠ doesn't match stated calories" : ""}
                    </Text>
                  </TouchableOpacity>
                  {mismatch && (
                    <TouchableOpacity
                      onPress={() => {
                        setManualForm((f) => ({ ...f, calories: String(macroKcal) }));
                      }}
                      style={{ backgroundColor: "#f59e0b22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#f59e0b66" }}
                    >
                      <Text style={{ color: "#f59e0b", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Use macro total</Text>
                    </TouchableOpacity>
                  )}
                  {mismatch && showManualBreakdown && (
                    <View style={{ width: "100%", backgroundColor: "#f59e0b11", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#f59e0b33" }}>
                      <Text style={{ color: "#f59e0b", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
                        {`Protein ${protein}g × 4 = ${Math.round(protein * 4)} kcal\nCarbs ${carbs}g × 4 = ${Math.round(carbs * 4)} kcal\nFat ${fat}g × 9 = ${Math.round(fat * 9)} kcal`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            {manualMacrosPrefilledFor !== null && (
              <TouchableOpacity
                onPress={() => {
                  const foodName = manualMacrosPrefilledFor;
                  AsyncStorage.getItem(MANUAL_MACROS_KEY)
                    .then((raw) => {
                      const map: Record<string, { calories: string; protein: string; carbs: string; fat: string }> =
                        raw ? JSON.parse(raw) : {};
                      delete map[foodName];
                      return AsyncStorage.setItem(MANUAL_MACROS_KEY, JSON.stringify(map));
                    })
                    .catch(() => {});
                  setManualForm((f) => ({ ...f, calories: "", protein: "", carbs: "", fat: "" }));
                  setManualMacrosPrefilledFor(null);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  alignSelf: "flex-start",
                  gap: 4,
                  marginTop: 2,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: colors.muted,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Ionicons name="close-circle-outline" size={14} color={colors.mutedForeground} />
                <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                  Clear saved macros
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={openMacroDefaultsSheet}
              style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 4, marginTop: 6, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8, backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }}
            >
              <Ionicons name="bookmark-outline" size={13} color={colors.mutedForeground} />
              <Text style={{ fontSize: 12, color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>
                Manage saved macros
              </Text>
            </TouchableOpacity>

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Add to meal
            </Text>
            <View style={styles.mealPicker}>
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal}
                  onPress={() => setManualMeal(meal)}
                  style={[
                    styles.mealPickerBtn,
                    {
                      backgroundColor:
                        manualMeal === meal ? MEAL_COLORS[meal] + "30" : colors.muted,
                      borderColor:
                        manualMeal === meal ? MEAL_COLORS[meal] : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.mealPickerText,
                      {
                        color:
                          manualMeal === meal
                            ? MEAL_COLORS[meal]
                            : colors.mutedForeground,
                        fontFamily:
                          manualMeal === meal
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowManualEntry(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmManual}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: manualForm.name.trim()
                      ? colors.primary
                      : colors.muted,
                  },
                ]}
                disabled={!manualForm.name.trim()}
              >
                <Text
                  style={[
                    styles.modalConfirmText,
                    {
                      color: manualForm.name.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Add Food
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Macro Defaults Management Sheet */}
      <Modal
        visible={showMacroDefaultsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMacroDefaultsSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card, maxHeight: "80%" }]}
            variant="elevated"
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Saved Macro Defaults
              </Text>
              <TouchableOpacity
                onPress={() => setShowMacroDefaultsSheet(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {macroDefaultsEntries.length === 0 ? (
              <Text style={{ fontSize: 14, color: colors.mutedForeground, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 24 }}>
                No saved macro defaults yet.
              </Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
                {macroDefaultsEntries.map((entry) => (
                  <View
                    key={entry.name}
                    style={[styles.macroDefaultsRow, { borderBottomColor: colors.border }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.macroDefaultsFoodName, { color: colors.foreground }]}>
                        {entry.name}
                      </Text>
                      <Text style={[styles.macroDefaultsMacroLine, { color: colors.mutedForeground }]}>
                        {`${entry.calories} kcal · ${entry.protein}g P · ${entry.carbs}g C · ${entry.fat}g F`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteMacroDefault(entry.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.macroDefaultsDeleteBtn, { backgroundColor: colors.muted }]}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            {macroDefaultsEntries.length > 0 && (
              <TouchableOpacity
                onPress={clearAllMacroDefaults}
                style={[styles.macroDefaultsClearAllBtn, { borderColor: "#ef444466" }]}
              >
                <Text style={{ fontSize: 13, color: "#ef4444", fontFamily: "Inter_500Medium" }}>
                  Clear all
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowMacroDefaultsSheet(false)}
              style={[styles.modalCancelBtn, { borderColor: colors.border, marginTop: 8 }]}
            >
              <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                Done
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </Modal>

      {/* Filter Threshold Edit Modal */}
      <Modal
        visible={thresholdEditKey !== null}
        transparent
        animationType="fade"
        onRequestClose={closeThresholdEdit}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            {(() => {
              const def = FILTER_DEFS.find((d) => d.key === thresholdEditKey);
              if (!def) return null;
              const symbol = def.direction === "gte" ? "≥" : "≤";
              const step = def.unit === "kcal" ? 10 : 1;
              const bigStep = def.unit === "kcal" ? 50 : 5;
              return (
                <>
                  <View style={styles.thresholdModalHeader}>
                    <Ionicons name={def.icon} size={20} color={colors.primary} />
                    <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 0 }]}>
                      {def.label}
                    </Text>
                  </View>
                  <Text style={[styles.thresholdModalDesc, { color: colors.mutedForeground }]}>
                    Show foods where {def.nutrient} is {symbol} the value below.
                  </Text>

                  <View style={styles.thresholdRow}>
                    <TouchableOpacity
                      onPress={() => adjustThreshold(-bigStep)}
                      style={[styles.thresholdStepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.thresholdStepBtnText, { color: colors.foreground }]}>−{bigStep}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => adjustThreshold(-step)}
                      style={[styles.thresholdStepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.thresholdStepBtnText, { color: colors.foreground }]}>−{step}</Text>
                    </TouchableOpacity>

                    <View style={styles.thresholdValueContainer}>
                      <TextInput
                        value={thresholdEditValue}
                        onChangeText={(v) => setThresholdEditValue(v.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        style={[styles.thresholdValueInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.primary }]}
                        selectTextOnFocus
                      />
                      <Text style={[styles.thresholdUnit, { color: colors.mutedForeground }]}>{def.unit}</Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => adjustThreshold(step)}
                      style={[styles.thresholdStepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.thresholdStepBtnText, { color: colors.foreground }]}>+{step}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => adjustThreshold(bigStep)}
                      style={[styles.thresholdStepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.thresholdStepBtnText, { color: colors.foreground }]}>+{bigStep}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.thresholdPreview, { color: colors.mutedForeground }]}>
                    Filter: {def.label} {symbol}{thresholdEditValue || "0"}{def.unit}
                  </Text>

                  {parseInt(thresholdEditValue, 10) !== def.defaultThreshold && (
                    <TouchableOpacity
                      onPress={resetSingleThreshold}
                      style={[styles.thresholdRestoreBtn, { borderColor: colors.border }]}
                    >
                      <Ionicons name="refresh-outline" size={14} color={colors.mutedForeground} style={{ marginRight: 4 }} />
                      <Text style={[styles.thresholdRestoreBtnText, { color: colors.mutedForeground }]}>
                        Restore default ({def.defaultThreshold}{def.unit})
                      </Text>
                    </TouchableOpacity>
                  )}

                  <View style={styles.modalBtns}>
                    <TouchableOpacity
                      onPress={closeThresholdEdit}
                      style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                        Cancel
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveThreshold}
                      style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                        Save
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </GlassCard>
        </View>
      </Modal>

      {/* Add Food Confirmation Modal (quick-add, scanned & search results) */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => { selectedFoodSourceRef.current = null; reloadQuickPer100gMap(); setShowModal(false); setGramsPreFillHint(null); setModalShowPer100g(false); setSelectedFoodNutrients100g(undefined); setMacrosFromMemory(false); }}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {selectedFood?.name}
            </Text>
            {selectedFood && (() => {
              const canToggleServing = !!(selectedFoodServingLabel && selectedFoodNutrients100g);
              const isGramsMode = (selectedFoodIsApiResult && !selectedFoodServingLabel) || modalShowPer100g;
              const displayBase = modalShowPer100g && selectedFoodNutrients100g ? selectedFoodNutrients100g : selectedFood;
              const parsedGramsLive = parseFloat(grams);
              const validGramsLive = Number.isFinite(parsedGramsLive) && parsedGramsLive > 0;
              const factor = isGramsMode ? (validGramsLive ? parsedGramsLive : 0) / 100 : servings;
              return (
                <>
                  {canToggleServing ? (
                    <View style={styles.servingToggleRow}>
                      <TouchableOpacity
                        onPress={() => {
                          if (modalShowPer100g) {
                            setModalShowPer100g(false);
                            setServings(1);
                            setServingsText("1");
                            if (selectedFood) {
                              AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                                try {
                                  const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                                  map[selectedFood.name] = { per100g: false, grams: 0 };
                                  AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
                                } catch {}
                              });
                            }
                          }
                        }}
                        style={[
                          styles.servingToggleOption,
                          !modalShowPer100g && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text style={[
                          styles.servingToggleText,
                          { color: !modalShowPer100g ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                          {`per ${selectedFoodServingLabel}`}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          if (!modalShowPer100g) {
                            setModalShowPer100g(true);
                            setGrams("100");
                            setGramsPreFillHint(null);
                            if (selectedFood) {
                              AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                                try {
                                  const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                                  map[selectedFood.name] = { per100g: true, grams: 0 };
                                  AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
                                } catch {}
                              });
                            }
                          }
                        }}
                        style={[
                          styles.servingToggleOption,
                          modalShowPer100g && { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text style={[
                          styles.servingToggleText,
                          { color: modalShowPer100g ? colors.primaryForeground : colors.mutedForeground },
                        ]}>
                          {`per 100${selectedFoodUnit}`}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[styles.servingBadge, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
                      {selectedFoodServingLabel
                        ? `per ${selectedFoodServingLabel}`
                        : selectedFoodIsApiResult
                        ? `per 100${selectedFoodUnit}`
                        : "per serving"}
                    </Text>
                  )}
                  {isGramsMode ? (
                    <>
                    <Text style={[styles.gramsHintCentered, { color: colors.mutedForeground }]}>
                      {`Nutrition values are per 100 ${selectedFoodUnit} — enter your amount below`}
                    </Text>
                    <View style={styles.servingsRow}>
                      <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Amount</Text>
                      <View style={styles.gramsInputRow}>
                        <TextInput
                          style={[styles.gramsInput, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border }]}
                          value={grams}
                          onChangeText={(v) => {
                            const stripped = v.replace(/[^0-9.]/g, "");
                            const parts = stripped.split(".");
                            const normalized = parts.length > 2
                              ? parts[0] + "." + parts.slice(1).join("")
                              : stripped;
                            setGrams(normalized);
                            if (gramsPreFillHint !== null) setGramsPreFillHint(null);
                          }}
                          onBlur={() => {
                            const n = parseFloat(grams);
                            if (!isNaN(n) && n > 0) setGrams(String(n));
                            else setGrams("100");
                          }}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          returnKeyType="done"
                          maxLength={7}
                        />
                        <Text style={[styles.gramsUnit, { color: colors.mutedForeground }]}>g / ml</Text>
                      </View>
                      {gramsPreFillHint !== null && (
                        <Text style={[styles.gramsLastUsedHint, { color: colors.mutedForeground }]}>
                          Last used: {gramsPreFillHint}g
                        </Text>
                      )}
                    </View>
                    </>
                  ) : (
                    <View style={styles.servingsRow}>
                      <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Servings</Text>
                      <View style={styles.servingsControl}>
                        <TouchableOpacity
                          onPress={() => {
                            if (servings > 0.5) {
                              if (servingsPreFillHint) setServingsPreFillHint(false);
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setServings((s) => {
                                const steps = Math.round(s * 200) / 100;
                                const next = Math.max(0.5, Math.ceil(steps - 1) * 0.5);
                                setServingsText(Number.isInteger(next) ? String(next) : next.toFixed(1));
                                return next;
                              });
                            }
                          }}
                          style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="remove" size={16} color={servings <= 0.5 ? colors.mutedForeground : colors.foreground} />
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.servingsValue, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }]}
                          value={servingsText}
                          onChangeText={(v) => {
                            const stripped = v.replace(/[^0-9.]/g, "");
                            const parts = stripped.split(".");
                            const normalized = parts.length > 2
                              ? parts[0] + "." + parts.slice(1).join("")
                              : stripped;
                            setServingsText(normalized);
                            const n = parseFloat(normalized);
                            if (!isNaN(n) && n > 0) setServings(n);
                            if (servingsPreFillHint) setServingsPreFillHint(false);
                          }}
                          onBlur={() => {
                            const n = parseFloat(servingsText);
                            const snapped = !isNaN(n) && n > 0 ? Math.max(0.5, Math.round(n / 0.5) * 0.5) : 1;
                            setServings(snapped);
                            setServingsText(Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1));
                          }}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          returnKeyType="done"
                          maxLength={7}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            if (servingsPreFillHint) setServingsPreFillHint(false);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setServings((s) => {
                              const steps = Math.round(s * 200) / 100;
                              const next = Math.floor(steps + 1) * 0.5;
                              setServingsText(Number.isInteger(next) ? String(next) : next.toFixed(1));
                              return next;
                            });
                          }}
                          style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="add" size={16} color={colors.foreground} />
                        </TouchableOpacity>
                      </View>
                      {servingsPreFillHint && (
                        <Text style={[styles.gramsLastUsedHint, { color: colors.mutedForeground }]}>
                          Last used
                        </Text>
                      )}
                    </View>
                  )}
                  <View style={styles.modalNutrients}>
                    <NutrientChip
                      label="Calories"
                      value={isGramsMode && !validGramsLive ? "—" : `${Math.round(displayBase.calories * factor)}`}
                      color={colors.primary}
                    />
                    <NutrientChip
                      label="Protein"
                      value={isGramsMode && !validGramsLive ? "—" : `${Math.round(displayBase.protein * factor * 10) / 10}g`}
                      color={colors.secondary}
                    />
                    <NutrientChip
                      label="Carbs"
                      value={isGramsMode && !validGramsLive ? "—" : `${Math.round(displayBase.carbs * factor * 10) / 10}g`}
                      color={colors.warning}
                    />
                    <NutrientChip
                      label="Fat"
                      value={isGramsMode && !validGramsLive ? "—" : `${Math.round(displayBase.fat * factor * 10) / 10}g`}
                      color={colors.accent}
                    />
                  </View>
                  {macrosFromMemory && (
                    <TouchableOpacity
                      onPress={() => setMacrosFromMemory(false)}
                      style={[styles.macrosFromMemoryHint, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="bookmark-outline" size={12} color={colors.mutedForeground} style={{ marginRight: 4 }} />
                      <Text style={[styles.macrosFromMemoryHintText, { color: colors.mutedForeground }]}>
                        Using your saved values
                      </Text>
                      <Ionicons name="close" size={12} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  )}
                </>
              );
            })()}
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Add to meal
            </Text>
            <View style={styles.mealPicker}>
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal}
                  onPress={() => setSelectedMeal(meal)}
                  style={[
                    styles.mealPickerBtn,
                    {
                      backgroundColor:
                        selectedMeal === meal ? MEAL_COLORS[meal] + "30" : colors.muted,
                      borderColor:
                        selectedMeal === meal ? MEAL_COLORS[meal] : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.mealPickerText,
                      {
                        color:
                          selectedMeal === meal
                            ? MEAL_COLORS[meal]
                            : colors.mutedForeground,
                        fontFamily:
                          selectedMeal === meal
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => { selectedFoodSourceRef.current = null; reloadQuickPer100gMap(); setShowModal(false); setGramsPreFillHint(null); setModalShowPer100g(false); setSelectedFoodNutrients100g(undefined); setMacrosFromMemory(false); }}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmLog}
                disabled={((selectedFoodIsApiResult && !selectedFoodServingLabel) || modalShowPer100g) && !(parseFloat(grams) > 0)}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor:
                      ((selectedFoodIsApiResult && !selectedFoodServingLabel) || modalShowPer100g) && !(parseFloat(grams) > 0)
                        ? colors.muted
                        : colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalConfirmText,
                    {
                      color:
                        ((selectedFoodIsApiResult && !selectedFoodServingLabel) || modalShowPer100g) && !(parseFloat(grams) > 0)
                          ? colors.mutedForeground
                          : colors.primaryForeground,
                    },
                  ]}
                >
                  Add Food
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Search Result Preview Sheet */}
      <Modal
        visible={previewSheetFood !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewSheetFood(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, styles.previewSheetCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            {previewSheetFood && (() => {
              const item = previewSheetFood;
              const favFood: FavoriteFood = { name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, mealType: "snack", servingLabel: item.servingLabel };
              const starred = isFavorite(item.name);
              const servingText = item.servingLabel ? `per ${item.servingLabel}` : "per 100g";
              return (
                <>
                  <View style={styles.previewSheetHandle} />
                  <View style={styles.previewSheetHeader}>
                    <View style={styles.previewSheetTitleRow}>
                      <Text style={[styles.previewSheetName, { color: colors.foreground }]} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setPreviewSheetFood(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={[styles.breakdownCloseBtn, { backgroundColor: colors.muted }]}
                      >
                        <Ionicons name="close" size={18} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.previewSheetServingBadge, { backgroundColor: colors.primary + "18" }]}>
                      <Text style={[styles.previewSheetServingText, { color: colors.primary }]}>
                        {servingText}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.previewSheetCalRow}>
                    <Text style={[styles.previewSheetCalValue, { color: colors.foreground }]}>
                      {item.calories}
                    </Text>
                    <Text style={[styles.previewSheetCalLabel, { color: colors.mutedForeground }]}>
                      kcal
                    </Text>
                  </View>

                  {(() => {
                    const total = item.protein + item.carbs + item.fat;
                    const proteinPct = total > 0 ? item.protein / total : 1 / 3;
                    const carbsPct   = total > 0 ? item.carbs   / total : 1 / 3;
                    const fatPct     = total > 0 ? item.fat     / total : 1 / 3;
                    return (
                      <View style={styles.previewSheetMacroBar}>
                        <TouchableOpacity activeOpacity={0.75} onPress={() => highlightPreviewMacro("protein")} style={[styles.previewSheetMacroBarSegment, { flex: proteinPct, backgroundColor: "#3b82f6", borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }]} />
                        <TouchableOpacity activeOpacity={0.75} onPress={() => highlightPreviewMacro("carbs")}   style={[styles.previewSheetMacroBarSegment, { flex: carbsPct,   backgroundColor: "#f97316" }]} />
                        <TouchableOpacity activeOpacity={0.75} onPress={() => highlightPreviewMacro("fat")}     style={[styles.previewSheetMacroBarSegment, { flex: fatPct,     backgroundColor: "#ec4899", borderTopRightRadius: 6, borderBottomRightRadius: 6 }]} />
                      </View>
                    );
                  })()}

                  <View style={[styles.previewSheetMacroGrid, { backgroundColor: colors.muted }]}>
                    <Animated.View style={[styles.previewSheetMacroCell, { transform: [{ scale: previewMacroScale.protein }], opacity: previewMacroOpacity.protein }]}>
                      <Text style={[styles.previewSheetMacroValue, { color: "#3b82f6" }]}>
                        {item.protein}g
                      </Text>
                      <Text style={[styles.previewSheetMacroLabel, { color: colors.mutedForeground }]}>
                        Protein
                      </Text>
                    </Animated.View>
                    <View style={[styles.previewSheetMacroDivider, { backgroundColor: colors.border }]} />
                    <Animated.View style={[styles.previewSheetMacroCell, { transform: [{ scale: previewMacroScale.carbs }], opacity: previewMacroOpacity.carbs }]}>
                      <Text style={[styles.previewSheetMacroValue, { color: "#f97316" }]}>
                        {item.carbs}g
                      </Text>
                      <Text style={[styles.previewSheetMacroLabel, { color: colors.mutedForeground }]}>
                        Carbs
                      </Text>
                    </Animated.View>
                    <View style={[styles.previewSheetMacroDivider, { backgroundColor: colors.border }]} />
                    <Animated.View style={[styles.previewSheetMacroCell, { transform: [{ scale: previewMacroScale.fat }], opacity: previewMacroOpacity.fat }]}>
                      <Text style={[styles.previewSheetMacroValue, { color: "#ec4899" }]}>
                        {item.fat}g
                      </Text>
                      <Text style={[styles.previewSheetMacroLabel, { color: colors.mutedForeground }]}>
                        Fat
                      </Text>
                    </Animated.View>
                  </View>

                  <View style={styles.previewSheetActions}>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        handleToggleFavorite(favFood);
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.previewSheetStarBtn,
                        { backgroundColor: starred ? "#f59f0a18" : colors.muted, borderColor: starred ? "#f59f0a" : colors.border },
                      ]}
                    >
                      <Ionicons
                        name={starred ? "star" : "star-outline"}
                        size={20}
                        color={starred ? "#f59f0a" : colors.mutedForeground}
                      />
                      <Text style={[styles.previewSheetStarLabel, { color: starred ? "#f59f0a" : colors.mutedForeground }]}>
                        {starred ? "Starred" : "Star"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        Alert.alert(
                          "More Options",
                          item.name,
                          [
                            ...(starred ? [{
                              text: "Reorder Favorites",
                              onPress: () => {
                                setPreviewSheetFood(null);
                                enterReorderMode();
                              },
                            }] : []),
                            {
                              text: "Reset Defaults",
                              style: "destructive" as const,
                              onPress: () => {
                                setPreviewSheetFood(null);
                                handleResetFoodDefaults(item.name);
                              },
                            },
                            { text: "Cancel", style: "cancel" as const },
                          ]
                        );
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.previewSheetMoreBtn,
                        { backgroundColor: colors.muted, borderColor: colors.border },
                      ]}
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setPreviewSheetFood(null);
                        handleScannedFood(item);
                      }}
                      activeOpacity={0.8}
                      style={[styles.previewSheetLogBtn, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="add-circle-outline" size={20} color={colors.primaryForeground} />
                      <Text style={[styles.previewSheetLogLabel, { color: colors.primaryForeground }]}>
                        Log Food
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </GlassCard>
        </View>
      </Modal>

      {/* Save Custom Preset Modal */}
      <Modal
        visible={showSavePresetModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSavePresetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <View style={styles.thresholdModalHeader}>
              <Ionicons name="bookmark-outline" size={20} color={colors.secondary} />
              <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Save Filter Preset
              </Text>
            </View>
            <Text style={[styles.thresholdModalDesc, { color: colors.mutedForeground }]}>
              {activeFilters.size > 0
                ? `Saving: ${nutritionFilters
                    .filter((f) => activeFilters.has(f.key))
                    .map((f) => f.label)
                    .join(" + ")}`
                : "No active filters to save."}
            </Text>
            <TextInput
              placeholder="Preset name (e.g. High Protein Low Cal)"
              placeholderTextColor={colors.mutedForeground}
              value={savePresetName}
              onChangeText={setSavePresetName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={saveCustomPreset}
              maxLength={40}
              style={[
                styles.textInput,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.secondary + "88" },
              ]}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowSavePresetModal(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveCustomPreset}
                disabled={!savePresetName.trim() || activeFilters.size === 0}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor:
                      savePresetName.trim() && activeFilters.size > 0
                        ? colors.secondary
                        : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalConfirmText,
                    {
                      color:
                        savePresetName.trim() && activeFilters.size > 0
                          ? colors.primaryForeground
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  Save Preset
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Rename Preset Modal */}
      <Modal
        visible={editingPreset !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingPreset(null)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <View style={styles.thresholdModalHeader}>
              <Ionicons name="create-outline" size={20} color={colors.secondary} />
              <Text style={[styles.modalTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Rename Preset
              </Text>
            </View>
            <Text style={[styles.thresholdModalDesc, { color: colors.mutedForeground }]}>
              {editingPreset
                ? `Filters: ${editingPreset.filterKeys.join(", ")}`
                : ""}
            </Text>
            <TextInput
              placeholder="Preset name"
              placeholderTextColor={colors.mutedForeground}
              value={editPresetName}
              onChangeText={setEditPresetName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmRenamePreset}
              maxLength={40}
              style={[
                styles.textInput,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.secondary + "88" },
              ]}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setEditingPreset(null)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRenamePreset}
                disabled={!editPresetName.trim()}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: editPresetName.trim() ? colors.secondary : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalConfirmText,
                    {
                      color: editPresetName.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Rename
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Day Calorie Breakdown Sheet */}
      {(() => {
        const dayData = dayBreakdownDate
          ? historyDays.find((d) => d.date === dayBreakdownDate)
          : null;
        const d = dayData ? new Date(dayData.date + "T12:00:00") : null;
        const yesterday = new Date(Date.now() - 86400000);
        const isYesterday = d ? d.toDateString() === yesterday.toDateString() : false;
        const dayLabel = d
          ? isYesterday
            ? "Yesterday"
            : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
          : "";
        return (
          <Modal
            visible={dayBreakdownDate !== null}
            transparent
            animationType="slide"
            onRequestClose={() => { setDayBreakdownDate(null); setBreakdownReAddCount(0); setBreakdownHighlightMacro(null); setBreakdownBarTooltipMeal(null); }}
          >
            <View style={styles.modalOverlay}>
              <GlassCard
                style={[styles.modalCard, styles.breakdownSheetCard, { backgroundColor: colors.card }]}
                variant="elevated"
              >
                <View style={styles.breakdownSheetHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                        {dayLabel}
                      </Text>
                      {breakdownReAddCount > 0 && (
                        <View style={[styles.breakdownReAddBadge, { backgroundColor: colors.primary }]}>
                          <Text style={[styles.breakdownReAddBadgeText, { color: colors.primaryForeground }]}>
                            +{breakdownReAddCount}
                          </Text>
                        </View>
                      )}
                    </View>
                    {dayData && (
                      <Text style={[styles.breakdownSheetSubtitle, { color: colors.mutedForeground }]}>
                        {Math.round(dayData.totals.calories).toLocaleString()} / {CALORIE_GOAL.toLocaleString()} kcal total
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setDayBreakdownDate(null); setBreakdownReAddCount(0); setBreakdownHighlightMacro(null); setBreakdownBarTooltipMeal(null); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[styles.breakdownCloseBtn, { backgroundColor: colors.muted }]}
                  >
                    <Ionicons name="close" size={18} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>

                {dayData && (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={styles.breakdownScrollView}
                    contentContainerStyle={styles.breakdownScrollContent}
                  >
                    {MEALS.map((meal) => {
                      const entries = dayData.logs.filter((m) => m.mealType === meal);
                      if (entries.length === 0) return null;
                      const mealCal = entries.reduce((s, m) => s + m.calories, 0);
                      const mealProt = entries.reduce((s, m) => s + m.protein, 0);
                      const mealCarbs = entries.reduce((s, m) => s + m.carbs, 0);
                      const mealFat = entries.reduce((s, m) => s + m.fat, 0);
                      return (
                        <View key={meal} style={[styles.breakdownMealSection, { borderColor: colors.border }]}>
                          <View style={styles.breakdownMealHeader}>
                            <View style={[styles.mealDot, { backgroundColor: MEAL_COLORS[meal] }]} />
                            <Text style={[styles.breakdownMealTitle, { color: colors.foreground }]}>
                              {meal.charAt(0).toUpperCase() + meal.slice(1)}
                            </Text>
                            <Text style={[styles.breakdownMealCal, { color: MEAL_COLORS[meal] }]}>
                              {Math.round(mealCal)} kcal
                            </Text>
                          </View>
                          <View style={[styles.breakdownMacroRow, { backgroundColor: colors.muted }]}>
                            <View style={styles.breakdownMacroItem}>
                              <Text style={[styles.breakdownMacroValue, { color: colors.secondary }]}>{Math.round(mealProt)}g</Text>
                              <Text style={[styles.breakdownMacroLabel, { color: colors.mutedForeground }]}>Protein</Text>
                            </View>
                            <View style={[styles.breakdownMacroDivider, { backgroundColor: colors.border }]} />
                            <View style={styles.breakdownMacroItem}>
                              <Text style={[styles.breakdownMacroValue, { color: colors.warning }]}>{Math.round(mealCarbs)}g</Text>
                              <Text style={[styles.breakdownMacroLabel, { color: colors.mutedForeground }]}>Carbs</Text>
                            </View>
                            <View style={[styles.breakdownMacroDivider, { backgroundColor: colors.border }]} />
                            <View style={styles.breakdownMacroItem}>
                              <Text style={[styles.breakdownMacroValue, { color: colors.accent }]}>{Math.round(mealFat)}g</Text>
                              <Text style={[styles.breakdownMacroLabel, { color: colors.mutedForeground }]}>Fat</Text>
                            </View>
                          </View>
                          {(() => {
                            const totalDayCal = dayData.totals.calories;
                            const calShare = totalDayCal > 0 ? Math.min(mealCal / totalDayCal, 1) : 0;
                            const protCal = mealProt * 4;
                            const carbCal = mealCarbs * 4;
                            const fatCal = mealFat * 9;
                            const macroTotal = protCal + carbCal + fatCal;
                            const protFrac = macroTotal > 0 ? protCal / macroTotal : 0;
                            const carbFrac = macroTotal > 0 ? carbCal / macroTotal : 0;
                            const fatFrac = macroTotal > 0 ? fatCal / macroTotal : 0;
                            const protPct = Math.round(protFrac * 100);
                            const carbPct = Math.round(carbFrac * 100);
                            const fatPct = Math.round(fatFrac * 100);
                            const tooltipVisible = breakdownBarTooltipMeal === meal;
                            const showTooltip = () => {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setBreakdownBarTooltipMeal(meal);
                            };
                            const hideTooltip = () => setBreakdownBarTooltipMeal(null);
                            return (
                              <View style={{ position: "relative" }}>
                                {tooltipVisible && (
                                  <View style={[styles.breakdownBarTooltip, { backgroundColor: colors.foreground }]}>
                                    <Text style={[styles.breakdownBarTooltipText, { color: colors.background }]}>
                                      {`Protein ${protPct}%  ·  Carbs ${carbPct}%  ·  Fat ${fatPct}%`}
                                    </Text>
                                    <View style={[styles.breakdownBarTooltipArrow, { borderTopColor: colors.foreground }]} />
                                  </View>
                                )}
                                <View style={[styles.breakdownMiniBarTrack, { backgroundColor: colors.border }]}>
                                  <View style={[styles.breakdownMiniBarFill, { flex: calShare }]}>
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleBreakdownSegmentTap("protein")} onLongPress={showTooltip} onPressOut={hideTooltip} delayLongPress={400} style={[styles.breakdownMiniBarSegment, { flex: protFrac, backgroundColor: colors.secondary, opacity: breakdownHighlightMacro && breakdownHighlightMacro !== "protein" ? 0.4 : 1 }]} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} />
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleBreakdownSegmentTap("carbs")} onLongPress={showTooltip} onPressOut={hideTooltip} delayLongPress={400} style={[styles.breakdownMiniBarSegment, { flex: carbFrac, backgroundColor: colors.warning, opacity: breakdownHighlightMacro && breakdownHighlightMacro !== "carbs" ? 0.4 : 1 }]} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} />
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => handleBreakdownSegmentTap("fat")} onLongPress={showTooltip} onPressOut={hideTooltip} delayLongPress={400} style={[styles.breakdownMiniBarSegment, { flex: fatFrac, backgroundColor: colors.accent, opacity: breakdownHighlightMacro && breakdownHighlightMacro !== "fat" ? 0.4 : 1 }]} hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }} />
                                  </View>
                                  <View style={{ flex: 1 - calShare }} />
                                </View>
                              </View>
                            );
                          })()}
                          {(() => {
                            const macroKey = breakdownHighlightMacro;
                            const maxMacroVal = macroKey
                              ? Math.max(...entries.map((e) => e[macroKey] ?? 0), 0)
                              : 0;
                            const highlightColor =
                              macroKey === "protein"
                                ? colors.secondary
                                : macroKey === "carbs"
                                ? colors.warning
                                : macroKey === "fat"
                                ? colors.accent
                                : null;
                            return entries.map((log) => {
                              const share = macroKey && maxMacroVal > 0 ? (log[macroKey] ?? 0) / maxMacroVal : 0;
                              const bgOpacity = macroKey
                                ? Math.max(0.08, share * 0.28)
                                : 0;
                              const dimmed = macroKey && share === 0;
                              return (
                            <View key={log.id} style={[styles.breakdownFoodRow, { borderTopColor: colors.border, backgroundColor: highlightColor && share > 0 ? highlightColor + Math.round(bgOpacity * 255).toString(16).padStart(2, "0") : "transparent", opacity: dimmed ? 0.4 : 1 }]}>
                              <Text style={[styles.breakdownFoodName, { color: colors.foreground }]} numberOfLines={1}>
                                {log.name}
                              </Text>
                              <Text style={[styles.breakdownFoodMacros, { color: colors.mutedForeground }]}>
                                P {Math.round(log.protein)}g · C {Math.round(log.carbs)}g · F {Math.round(log.fat)}g
                              </Text>
                              <Text style={[styles.breakdownFoodCal, { color: colors.primary }]}>
                                {Math.round(log.calories)} kcal
                              </Text>
                              <TouchableOpacity
                                onPress={() => { handleAddFood({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType, amountGrams: log.amountGrams, nutrients100g: log.nutrients100g, servingLabel: log.servingLabel }, { forceServings: 1, forceMealType: log.mealType, showLoggedToast: true }); setBreakdownReAddCount((c) => c + 1); }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={[styles.breakdownReAddBtn, { backgroundColor: colors.primary + "1A", borderColor: colors.primary + "40" }]}
                              >
                                <Ionicons name="add" size={16} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                          );
                            });
                          })()}
                        </View>
                      );
                    })}

                    <View style={[styles.breakdownTotalRow, { borderTopColor: colors.border, backgroundColor: colors.muted }]}>
                      <Text style={[styles.breakdownTotalLabel, { color: colors.foreground }]}>Day Total</Text>
                      <View style={styles.breakdownTotalRight}>
                        <Text style={[styles.breakdownTotalMacros, { color: colors.mutedForeground }]}>
                          P {Math.round(dayData.totals.protein)}g · C {Math.round(dayData.totals.carbs)}g · F {Math.round(dayData.totals.fat)}g
                        </Text>
                        <Text style={[styles.breakdownTotalCal, { color: dayData.totals.calories <= CALORIE_GOAL ? colors.success : colors.destructive }]}>
                          {Math.round(dayData.totals.calories).toLocaleString()} kcal
                        </Text>
                      </View>
                    </View>
                  </ScrollView>
                )}

                <TouchableOpacity
                  onPress={() => { setDayBreakdownDate(null); setBreakdownReAddCount(0); setBreakdownHighlightMacro(null); setBreakdownBarTooltipMeal(null); }}
                  activeOpacity={0.8}
                  style={[styles.breakdownDoneBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.breakdownDoneBtnText, { color: colors.primaryForeground }]}>Done</Text>
                </TouchableOpacity>
              </GlassCard>
            </View>
          </Modal>
        );
      })()}

      {undoMeal !== null && (
        <AnimatedPressable
          onPressIn={handleUndoPressIn}
          onPressOut={handleUndoPressOut}
          style={[
            styles.undoToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: undoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: undoAnim,
              bottom: insets.bottom + 16,
            },
          ]}
        >
          <Text style={[styles.undoToastText, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
            "{undoMeal.name}" deleted
          </Text>
          <AnimatedCountdown value={undoCountdown} style={[styles.undoCountdownText, { color: colors.mutedForeground }]} />
          <TouchableOpacity
            onPress={handleUndoDelete}
            onPressIn={handleUndoPressIn}
            onPressOut={handleUndoPressOut}
            activeOpacity={0.75}
            style={[styles.undoBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.undoBtnText, { color: colors.primaryForeground }]}>Undo</Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.undoProgressBar,
              {
                backgroundColor: colors.primary,
                width: undoProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              },
            ]}
          />
        </AnimatedPressable>
      )}

      {restoredLabel !== null && (
        <Animated.View
          style={[
            styles.undoToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: restoredAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 0],
                  }),
                },
              ],
              opacity: restoredAnim,
              top: insets.top + 16,
              bottom: undefined,
            },
          ]}
        >
          <Text style={[styles.undoToastText, { color: colors.foreground }]}>
            Restored to {restoredLabel}
          </Text>
        </Animated.View>
      )}

      {logTodayName !== null && (
        <Animated.View
          style={[
            styles.undoToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: logTodayAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: logTodayAnim,
              bottom: insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" style={{ marginRight: 4 }} />
          <Text style={[styles.undoToastText, { color: colors.foreground }]} numberOfLines={1}>
            "{logTodayName}" logged for today
          </Text>
        </Animated.View>
      )}

      {starToastElement}

      {deletedPreset !== null && (
        <AnimatedPressable
          onPressIn={handlePresetUndoPressIn}
          onPressOut={handlePresetUndoPressOut}
          style={[
            styles.undoToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: presetUndoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: presetUndoAnim,
              bottom: Animated.add(insets.bottom + 16, presetDeleteOffsetAnim),
            },
          ]}
        >
          <Text style={[styles.undoToastText, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
            Preset "{deletedPreset.name}" deleted
          </Text>
          <AnimatedCountdown value={presetUndoCountdown} style={[styles.undoCountdownText, { color: colors.mutedForeground }]} />
          <TouchableOpacity
            onPress={handleUndoPresetDelete}
            onPressIn={handlePresetUndoPressIn}
            onPressOut={handlePresetUndoPressOut}
            activeOpacity={0.75}
            style={[styles.undoBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.undoBtnText, { color: colors.primaryForeground }]}>Undo</Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.undoProgressBar,
              {
                backgroundColor: colors.primary,
                width: presetUndoProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              },
            ]}
          />
        </AnimatedPressable>
      )}

      {renamedPreset !== null && (
        <AnimatedPressable
          onPressIn={handlePresetRenameUndoPressIn}
          onPressOut={handlePresetRenameUndoPressOut}
          style={[
            styles.undoToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: presetRenameUndoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: presetRenameUndoAnim,
              bottom: Animated.add(Animated.add(insets.bottom + 16, presetRenameOffsetAnim), keyboardHeightAnim),
            },
          ]}
        >
          <Text style={[styles.undoToastText, { color: colors.foreground, flex: 1 }]} numberOfLines={1}>
            Preset renamed to "{renamedPreset.newName}"
          </Text>
          <AnimatedCountdown value={presetRenameUndoCountdown} style={[styles.undoCountdownText, { color: colors.mutedForeground }]} />
          <TouchableOpacity
            onPress={handleUndoPresetRename}
            onPressIn={handlePresetRenameUndoPressIn}
            onPressOut={handlePresetRenameUndoPressOut}
            activeOpacity={0.75}
            style={[styles.undoBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.undoBtnText, { color: colors.primaryForeground }]}>Undo</Text>
          </TouchableOpacity>
          <Animated.View
            style={[
              styles.undoProgressBar,
              {
                backgroundColor: colors.primary,
                width: presetRenameUndoProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              },
            ]}
          />
        </AnimatedPressable>
      )}

      {savedMealToastMessage !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.starToast,
            {
              backgroundColor: "#22c55e",
              borderColor: "#16a34a",
              transform: [
                {
                  translateY: savedMealToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: savedMealToastAnim,
              bottom: insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={[styles.starToastText, { color: "#fff" }]} numberOfLines={1}>
            {savedMealToastMessage}
          </Text>
        </Animated.View>
      )}

      {presetSavedMessage !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.starToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: presetSavedAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: presetSavedAnim,
              bottom: (deletedPreset !== null || renamedPreset !== null) ? insets.bottom + 72 : insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="bookmark" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.starToastText, { color: colors.foreground }]}>
            {presetSavedMessage}
          </Text>
        </Animated.View>
      )}

      {filterSyncToastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.starToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: filterSyncAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: filterSyncAnim,
              bottom: insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="sync-outline" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.starToastText, { color: colors.foreground }]}>
            Filters updated from another device
          </Text>
        </Animated.View>
      )}

      {goalsSyncToastVisible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.starToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: goalsSyncAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: goalsSyncAnim,
              bottom: insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="sync-outline" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.starToastText, { color: colors.foreground }]}>
            Goals updated from another device
          </Text>
        </Animated.View>
      )}

      {per100gToastMessage !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.starToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: per100gToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [100, 0],
                  }),
                },
              ],
              opacity: per100gToastAnim,
              bottom: insets.bottom + 16,
            },
          ]}
        >
          <Ionicons name="scale-outline" size={16} color={colors.secondary} style={{ marginRight: 6 }} />
          <Text style={[styles.starToastText, { color: colors.foreground }]}>
            {per100gToastMessage}
          </Text>
        </Animated.View>
      )}

      {macroAlert !== null && (
        <View
          pointerEvents="box-none"
          style={[
            styles.macroAlertToast,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              bottom: insets.bottom + 90,
            },
          ]}
        >
          <Ionicons name="nutrition-outline" size={16} color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[styles.macroAlertTitle, { color: colors.foreground }]}>
              {macroAlert.cal > 0 ? `${macroAlert.cal} kcal remaining` : "Daily goal reached! 🎉"}
            </Text>
            <Text style={[styles.macroAlertSub, { color: colors.mutedForeground }]}>
              {`P: ${macroAlert.prot}g · C: ${macroAlert.carb}g · F: ${macroAlert.fat}g left`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setMacroAlert(null)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Macro Drill-Down Sheet */}
      <Modal
        visible={macroDrillDown !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMacroDrillDown(null)}
      >
        <TouchableOpacity
          style={styles.drillDownBackdrop}
          activeOpacity={1}
          onPress={() => setMacroDrillDown(null)}
        />
        {macroDrillDown !== null && (
          <MacroDrillDownSheet
            drillDown={macroDrillDown}
            onClose={() => setMacroDrillDown(null)}
          />
        )}
      </Modal>

      {/* Calendar Date Picker Sheet */}
      <CalendarPickerSheet
        visible={calendarSheetVisible}
        onClose={() => setCalendarSheetVisible(false)}
        markedDates={markedDates}
        onRangeSelect={(start, end) => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setCustomDateRange({ start, end });
          setHistoryDateRange("custom");
        }}
        initialStart={customDateRange?.start}
        initialEnd={customDateRange?.end}
        colors={colors}
      />
      <SyncIndicator status={syncStatus} />
    </View>
  );
}

function MacroInput({
  label,
  value,
  onChangeText,
  colors,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={styles.macroInputItem}>
      <Text style={[styles.macroInputLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <TextInput
        placeholder="0"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="numeric"
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.textInput,
          styles.macroInputField,
          { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      />
    </View>
  );
}

function MacroBar({
  label,
  value,
  goal,
  color,
  isHighlighted = false,
  onPress,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  isHighlighted?: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  const fillRatio = Math.min(1, Math.max(0, value / goal));
  const ratio = goal > 0 ? value / goal : 1;
  const isOver = ratio > 1;
  const badge: "low" | "over" | null =
    ratio < 0.8 ? "low" : ratio > 1.1 ? "over" : null;
  const badgeColor = badge === "low" ? colors.warning : colors.accent;

  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isHighlighted) {
      Animated.timing(highlightAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start();
      return;
    }
    Animated.sequence([
      Animated.timing(highlightAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 0.6, duration: 150, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 1, duration: 150, useNativeDriver: false }),
      Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
    ]).start();
  }, [isHighlighted]);

  useEffect(() => {
    if (!isOver) {
      glowAnim.setValue(0.5);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 650,
          useNativeDriver: false,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isOver]);

  const animatedShadowOpacity = isOver ? glowAnim : undefined;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.macroBarContainer,
          {
            backgroundColor: highlightAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", color + "18"],
            }),
            borderRadius: 8,
            paddingHorizontal: 4,
          },
        ]}
      >
        <View style={styles.macroBarHeader}>
          <Text style={[styles.macroBarLabel, { color: colors.mutedForeground }]}>
            {label}
          </Text>
          {badge !== null && (
            <View style={[styles.historyMacroBadge, { backgroundColor: badgeColor + "22", borderColor: badgeColor + "66" }]}>
              <Text style={[styles.historyMacroBadgeText, { color: badgeColor }]}>
                {badge === "low" ? "Low" : "Over"}
              </Text>
            </View>
          )}
          <Text style={[styles.macroBarValue, { color: colors.foreground }]}>
            {value}/{goal}g
          </Text>
        </View>
        <Animated.View
          style={[
            styles.macroTrackWrapper,
            isOver && {
              shadowColor: colors.destructive,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: animatedShadowOpacity,
              shadowRadius: 7,
              elevation: 6,
            },
          ]}
        >
          <View style={[styles.macroTrack, { backgroundColor: isOver ? colors.destructive + "30" : colors.muted }]}>
            <View style={styles.macroFlex}>
              <View style={[styles.macroFill, { flex: fillRatio, backgroundColor: isOver ? colors.destructive : color }]} />
              <View style={{ flex: 1 - fillRatio }} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function HistoryFoodRow({ log, onAddFood, onDelete, onLogToday, isFirst, onSaved }: { log: MealLog; onAddFood: () => void; onDelete: (meal: MealLog) => void; onLogToday: (meal: MealLog) => void; isFirst?: boolean; onSaved?: (label: string) => void }) {
  const colors = useColors();
  const { updateMealLog, syncMealName } = useFitness();
  const { syncStatus: histSyncStatus, startSync: histStartSync, finishSync: histFinishSync } = useSyncIndicator();
  const swipeableRef = useRef<Swipeable>(null);
  const runHintAnimation = useSwipeHint(HISTORY_SWIPE_DELETE_HINT_STORAGE_KEY, isFirst ?? false);

  useEffect(() => {
    if (!runHintAnimation) return;
    let cancelled = false;
    const peekTimer = setTimeout(() => {
      if (cancelled) return;
      swipeableRef.current?.openRight();
      setTimeout(() => {
        if (!cancelled) swipeableRef.current?.close();
      }, 700);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(peekTimer);
    };
  }, [runHintAnimation]);

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editForm, setEditForm] = useState<ManualForm>({
    name: log.name,
    calories: String(log.calories),
    protein: String(log.protein),
    carbs: String(log.carbs),
    fat: String(log.fat),
  });
  const [editMealType, setEditMealType] = useState<MealType>(log.mealType);
  const [editServings, setEditServings] = useState(1);
  const editServingsRef = useRef(1);
  const [editServingsText, setEditServingsText] = useState("1");
  const [editBase, setEditBase] = useState({ calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat });
  const [editGrams, setEditGrams] = useState<number | undefined>(log.amountGrams);
  const editGramsRef = useRef<number | undefined>(log.amountGrams);
  const editCaloriesAutoFilled = useRef(false);
  const [showHistBreakdown, setShowHistBreakdown] = useState(false);
  const [editGramsText, setEditGramsText] = useState(
    log.amountGrams !== undefined
      ? (Number.isInteger(log.amountGrams) ? String(log.amountGrams) : log.amountGrams.toFixed(1))
      : ""
  );
  const [editShowPer100g, setEditShowPer100g] = useState(false);
  const perGramRef = useRef<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const [editDate, setEditDate] = useState(log.date);
  const histSaveShakeX = useSharedValue(0);
  const histSaveShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: histSaveShakeX.value }] }));

  // Narrow sync: keep editForm.name current even when the sheet is open.
  // The full-reset effect below is guarded by showEditSheet, so if syncMealName
  // propagates a name change to this linked entry while the sheet is open, the
  // name in the form would otherwise go stale until the sheet is closed.
  useEffect(() => {
    setEditForm((prev) => (prev.name === log.name ? prev : { ...prev, name: log.name }));
  }, [log.name]);

  useEffect(() => {
    if (showEditSheet) return;
    editCaloriesAutoFilled.current = false;
    setShowHistBreakdown(false);
    setEditForm({
      name: log.name,
      calories: String(log.calories),
      protein: String(log.protein),
      carbs: String(log.carbs),
      fat: String(log.fat),
    });
    setEditBase({ calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat });
    setEditMealType(log.mealType);
    setEditDate(log.date);
    setEditServings(1);
    editServingsRef.current = 1;
    setEditServingsText("1");
    const g = log.amountGrams;
    setEditGrams(g);
    editGramsRef.current = g;
    setEditGramsText(
      g !== undefined
        ? (Number.isInteger(g) ? String(g) : g.toFixed(1))
        : ""
    );
  }, [log.name, log.calories, log.protein, log.carbs, log.fat, log.mealType, log.amountGrams, log.date, showEditSheet]);

  function openEditSheet() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm({
      name: log.name,
      calories: String(log.calories),
      protein: String(log.protein),
      carbs: String(log.carbs),
      fat: String(log.fat),
    });
    setEditMealType(log.mealType);
    setEditDate(log.date);
    setEditServings(1);
    editServingsRef.current = 1;
    setEditServingsText("1");
    setEditBase({ calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat });
    const g = log.amountGrams;
    setEditGrams(g);
    editGramsRef.current = g;
    setEditGramsText(
      g !== undefined
        ? (Number.isInteger(g) ? String(g) : g.toFixed(1))
        : ""
    );
    if (log.nutrients100g) {
      perGramRef.current = {
        calories: log.nutrients100g.calories / 100,
        protein: log.nutrients100g.protein / 100,
        carbs: log.nutrients100g.carbs / 100,
        fat: log.nutrients100g.fat / 100,
      };
    } else if (g !== undefined && g > 0) {
      perGramRef.current = {
        calories: log.calories / g,
        protein: log.protein / g,
        carbs: log.carbs / g,
        fat: log.fat / g,
      };
    } else {
      perGramRef.current = null;
    }
    const hasGrams = log.amountGrams !== undefined && log.amountGrams > 0;
    if (hasGrams) {
      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
        try {
          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
          const entry = map[log.name];
          const pref = entry !== null && typeof entry === "object" ? entry : null;
          const isStale = !pref || (pref.grams > 0 && pref.grams !== log.amountGrams);
          if (!isStale && pref!.per100g && perGramRef.current) {
            setEditShowPer100g(true);
            setEditGramsText("100");
            setEditGrams(100);
            editGramsRef.current = 100;
            setEditBase({
              calories: perGramRef.current.calories * 100,
              protein: perGramRef.current.protein * 100,
              carbs: perGramRef.current.carbs * 100,
              fat: perGramRef.current.fat * 100,
            });
            setEditServings(1);
            editServingsRef.current = 1;
            setEditServingsText("1");
          } else {
            setEditShowPer100g(false);
          }
        } catch {
          setEditShowPer100g(false);
        }
      });
    } else {
      setEditShowPer100g(false);
    }
    setShowEditSheet(true);
  }

  function handleGramsChange(text: string) {
    const stripped = text.replace(/[^0-9.]/g, "");
    const parts = stripped.split(".");
    const normalized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : stripped;
    setEditGramsText(normalized);
    const n = parseFloat(normalized);
    if (!isNaN(n) && n > 0) {
      setEditGrams(n);
      editGramsRef.current = n;
      if (perGramRef.current) {
        const newBase = {
          calories: perGramRef.current.calories * n,
          protein: perGramRef.current.protein * n,
          carbs: perGramRef.current.carbs * n,
          fat: perGramRef.current.fat * n,
        };
        setEditBase(newBase);
        setEditForm(f => ({
          ...f,
          calories: String(Math.round(newBase.calories)),
          protein: String(Math.round(newBase.protein * 10) / 10),
          carbs: String(Math.round(newBase.carbs * 10) / 10),
          fat: String(Math.round(newBase.fat * 10) / 10),
        }));
        setEditServings(1);
        editServingsRef.current = 1;
        setEditServingsText("1");
      }
    } else if (normalized === "" || normalized === "0") {
      setEditGrams(undefined);
      editGramsRef.current = undefined;
      perGramRef.current = null;
    }
  }

  function commitGramsBaseline(gramsText: string) {
    const n = parseFloat(gramsText);
    if (!isNaN(n) && n > 0 && !perGramRef.current) {
      perGramRef.current = {
        calories: log.calories / n,
        protein: log.protein / n,
        carbs: log.carbs / n,
        fat: log.fat / n,
      };
      setEditBase({
        calories: perGramRef.current.calories * n,
        protein: perGramRef.current.protein * n,
        carbs: perGramRef.current.carbs * n,
        fat: perGramRef.current.fat * n,
      });
      setEditServings(1);
      editServingsRef.current = 1;
      setEditServingsText("1");
    }
  }

  function handleMacroDirectEdit(field: 'calories' | 'protein' | 'carbs' | 'fat', text: string) {
    if (field === 'calories') {
      editCaloriesAutoFilled.current = false;
    }
    const n = parseFloat(text);
    const isValid = !isNaN(n) && n >= 0;
    const servingsAtEdit = editServingsRef.current;
    const baseValue = isValid ? (servingsAtEdit > 0 ? n / servingsAtEdit : n) : null;
    // Compute auto-fill decision synchronously before any state updates
    let autoFillBase: number | null = null;
    if (field !== 'calories' && baseValue !== null && (editCaloriesAutoFilled.current || editForm.calories === "")) {
      const p = field === 'protein' ? baseValue : editBase.protein;
      const c = field === 'carbs' ? baseValue : editBase.carbs;
      const ft = field === 'fat' ? baseValue : editBase.fat;
      const kcal = p * 4 + c * 4 + ft * 9;
      if (kcal > 0) {
        editCaloriesAutoFilled.current = true;
        autoFillBase = kcal;
      }
    }
    setEditForm(f => {
      const updated = { ...f, [field]: text };
      if (autoFillBase !== null) {
        updated.calories = String(Math.round(autoFillBase * servingsAtEdit));
      }
      return updated;
    });
    if (baseValue !== null) {
      const grams = editGramsRef.current;
      setEditBase(prev => {
        const newBase = { ...prev, [field]: baseValue };
        if (autoFillBase !== null) {
          newBase.calories = autoFillBase;
        }
        if (grams !== undefined && grams > 0) {
          perGramRef.current = {
            calories: newBase.calories / grams,
            protein: newBase.protein / grams,
            carbs: newBase.carbs / grams,
            fat: newBase.fat / grams,
          };
        }
        return newBase;
      });
    }
  }

  function handleSaveEdit() {
    const name = editForm.name.trim();
    const hasBlankNumeric = editForm.calories === "" || editForm.protein === "" || editForm.carbs === "" || editForm.fat === "";
    if (!name || hasBlankNumeric) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      histSaveShakeX.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }
    const oldName = log.name;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const savedBase = editBase;
    const savedServings = editServings;
    const savedMealType = editMealType;
    const savedGrams = editGrams;
    const savedCalories = Math.round(savedBase.calories * savedServings);
    histStartSync();
    const histSyncCb = name !== oldName
      ? makeCombinedSyncCallback(2, histFinishSync)
      : histFinishSync;
    updateMealLog(log.id, {
      name,
      calories: savedCalories,
      protein: Math.round(savedBase.protein * savedServings * 10) / 10,
      carbs: Math.round(savedBase.carbs * savedServings * 10) / 10,
      fat: Math.round(savedBase.fat * savedServings * 10) / 10,
      mealType: savedMealType,
      amountGrams: savedGrams !== undefined ? Math.round(savedGrams * savedServings * 10) / 10 : undefined,
      date: editDate,
    }, histSyncCb);
    if (name !== oldName) {
      syncMealName(log.id, name, histSyncCb);
    }
    setShowEditSheet(false);
    onSaved?.(`${name} saved · ${savedCalories} kcal`);
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    onDelete(log);
  }

  function handleLogTodayPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    swipeableRef.current?.close();
    onLogToday(log);
  }

  function renderRightActions() {
    return (
      <View style={{ flexDirection: "row" }}>
        <TouchableOpacity
          onPress={handleLogTodayPress}
          activeOpacity={0.85}
          style={[styles.deleteAction, { backgroundColor: "#22c55e" }]}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.deleteActionText}>Log Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDelete}
          activeOpacity={0.85}
          style={[styles.deleteAction, { backgroundColor: "#ef4444" }]}
        >
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={60}
        overshootRight={false}
        onSwipeableOpen={() => Haptics.selectionAsync()}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={openEditSheet}
          style={[styles.historyFoodRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
        >
          <View style={styles.historyFoodInfo}>
            <View style={styles.nutritionNameRow}>
              <Text style={[styles.historyFoodName, { color: colors.foreground }]} numberOfLines={1}>
                {log.name}
              </Text>
              {log.amountGrams !== undefined && (
                <Text style={[styles.nutritionAmountBadge, { color: colors.mutedForeground }]}>
                  {Number.isInteger(log.amountGrams) ? log.amountGrams : log.amountGrams.toFixed(1)} g
                </Text>
              )}
            </View>
            <Text style={[styles.historyFoodMacros, { color: colors.mutedForeground }]}>
              P {log.protein}g · C {log.carbs}g · F {log.fat}g
            </Text>
          </View>
          <View style={styles.historyFoodRight}>
            <Text style={[styles.historyFoodCal, { color: colors.primary }]}>
              {log.calories}
            </Text>
            <View style={styles.historyFoodActions}>
              <Ionicons name="pencil-outline" size={13} color={colors.mutedForeground} />
              <TouchableOpacity
                onPress={(e) => { e.stopPropagation(); onAddFood(); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.historyFoodAddBtn}
              >
                <Ionicons name="add-circle-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>

      <Modal
        visible={showEditSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Edit Meal
            </Text>

            <Text style={[styles.editFieldLabel, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              value={editForm.name}
              onChangeText={(text) => setEditForm(f => ({ ...f, name: text }))}
              placeholder="Meal name"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              selectTextOnFocus
              maxLength={120}
              style={[
                styles.editFoodNameLabel,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: editForm.name.trim() ? colors.border : "#ef4444" },
              ]}
            />
            {!editForm.name.trim() && (
              <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4, marginBottom: 2, fontFamily: "Inter_400Regular" }}>
                Name can't be blank
              </Text>
            )}

            {log.nutrients100g !== undefined && (
              <View style={[styles.servingToggleRow, { marginBottom: 12, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => {
                    if (editShowPer100g) {
                      setEditShowPer100g(false);
                      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                        try {
                          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                          map[log.name] = { per100g: false, grams: log.amountGrams ?? 0 };
                          AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
                        } catch {}
                      });
                      if (log.amountGrams !== undefined && log.amountGrams > 0 && perGramRef.current) {
                        const g = log.amountGrams;
                        const gText = Number.isInteger(g) ? String(g) : g.toFixed(1);
                        setEditGramsText(gText);
                        setEditGrams(g);
                        editGramsRef.current = g;
                        setEditBase({
                          calories: perGramRef.current.calories * g,
                          protein: perGramRef.current.protein * g,
                          carbs: perGramRef.current.carbs * g,
                          fat: perGramRef.current.fat * g,
                        });
                      } else {
                        setEditGramsText("");
                        setEditGrams(undefined);
                        editGramsRef.current = undefined;
                        setEditBase({
                          calories: log.calories,
                          protein: log.protein,
                          carbs: log.carbs,
                          fat: log.fat,
                        });
                      }
                      setEditServings(1);
                      editServingsRef.current = 1;
                      setEditServingsText("1");
                    }
                  }}
                  style={[
                    styles.servingToggleOption,
                    !editShowPer100g && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={[
                    styles.servingToggleText,
                    { color: !editShowPer100g ? colors.primaryForeground : colors.mutedForeground },
                  ]}>
                    {log.servingLabel ? `per ${log.servingLabel}` : "per serving"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!editShowPer100g && perGramRef.current) {
                      setEditShowPer100g(true);
                      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                        try {
                          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                          map[log.name] = { per100g: true, grams: log.amountGrams ?? 0 };
                          AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
                        } catch {}
                      });
                      setEditGramsText("100");
                      setEditGrams(100);
                      editGramsRef.current = 100;
                      setEditBase({
                        calories: perGramRef.current.calories * 100,
                        protein: perGramRef.current.protein * 100,
                        carbs: perGramRef.current.carbs * 100,
                        fat: perGramRef.current.fat * 100,
                      });
                      setEditServings(1);
                      editServingsRef.current = 1;
                      setEditServingsText("1");
                    }
                  }}
                  style={[
                    styles.servingToggleOption,
                    editShowPer100g && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={[
                    styles.servingToggleText,
                    { color: editShowPer100g ? colors.primaryForeground : colors.mutedForeground },
                  ]}>
                    per 100g
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.gramsRow}>
              <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Amount (g)</Text>
              <TextInput
                placeholder="—"
                placeholderTextColor={colors.mutedForeground}
                value={editGramsText}
                onChangeText={handleGramsChange}
                onBlur={() => {
                  const n = parseFloat(editGramsText);
                  if (isNaN(n) || n <= 0) {
                    setEditGramsText(editGrams !== undefined ? String(editGrams) : "");
                  } else {
                    commitGramsBaseline(editGramsText);
                  }
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
                returnKeyType="done"
                maxLength={7}
                style={[
                  styles.gramsInput,
                  { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              />
              <Text style={[styles.gramsUnit, { color: colors.mutedForeground }]}>g</Text>
            </View>
            {(() => {
              const pg = perGramRef.current;
              const n = parseFloat(editGramsText);
              if (!pg || isNaN(n) || n <= 0) return null;
              const cal = Math.round(pg.calories * n);
              const pro = Math.round(pg.protein * n * 10) / 10;
              const carb = Math.round(pg.carbs * n * 10) / 10;
              const fat = Math.round(pg.fat * n * 10) / 10;
              return (
                <Text style={[styles.gramsPreview, { color: colors.mutedForeground }]}>
                  ~{cal} kcal · {pro}g P · {carb}g C · {fat}g F at {n}g
                </Text>
              );
            })()}

            <View style={styles.servingsRow}>
              <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Servings</Text>
              <View style={styles.servingsControl}>
                <TouchableOpacity
                  onPress={() => {
                    if (editServings > 0.5) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const steps = Math.round(editServings * 200) / 100;
                      const next = Math.max(0.5, Math.ceil(steps - 1) * 0.5);
                      setEditServings(next);
                      editServingsRef.current = next;
                      setEditServingsText(Number.isInteger(next) ? String(next) : next.toFixed(1));
                      setEditForm(f => ({
                        ...f,
                        calories: String(Math.round(editBase.calories * next)),
                        protein: String(Math.round(editBase.protein * next * 10) / 10),
                        carbs: String(Math.round(editBase.carbs * next * 10) / 10),
                        fat: String(Math.round(editBase.fat * next * 10) / 10),
                      }));
                    }
                  }}
                  style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="remove" size={16} color={editServings <= 0.5 ? colors.mutedForeground : colors.foreground} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.servingsValue, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }]}
                  value={editServingsText}
                  onChangeText={(v) => {
                    const stripped = v.replace(/[^0-9.]/g, "");
                    const parts = stripped.split(".");
                    const normalized = parts.length > 2
                      ? parts[0] + "." + parts.slice(1).join("")
                      : stripped;
                    setEditServingsText(normalized);
                    const n = parseFloat(normalized);
                    if (!isNaN(n) && n > 0) {
                      setEditServings(n);
                      editServingsRef.current = n;
                      setEditForm(f => ({
                        ...f,
                        calories: String(Math.round(editBase.calories * n)),
                        protein: String(Math.round(editBase.protein * n * 10) / 10),
                        carbs: String(Math.round(editBase.carbs * n * 10) / 10),
                        fat: String(Math.round(editBase.fat * n * 10) / 10),
                      }));
                    }
                  }}
                  onBlur={() => {
                    const n = parseFloat(editServingsText);
                    const snapped = !isNaN(n) && n > 0 ? Math.max(0.5, Math.round(n / 0.5) * 0.5) : 1;
                    setEditServings(snapped);
                    editServingsRef.current = snapped;
                    setEditServingsText(Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1));
                    setEditForm(f => ({
                      ...f,
                      calories: String(Math.round(editBase.calories * snapped)),
                      protein: String(Math.round(editBase.protein * snapped * 10) / 10),
                      carbs: String(Math.round(editBase.carbs * snapped * 10) / 10),
                      fat: String(Math.round(editBase.fat * snapped * 10) / 10),
                    }));
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  returnKeyType="done"
                  maxLength={7}
                />
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const steps = Math.round(editServings * 200) / 100;
                    const next = Math.floor(steps + 1) * 0.5;
                    setEditServings(next);
                    editServingsRef.current = next;
                    setEditServingsText(Number.isInteger(next) ? String(next) : next.toFixed(1));
                    setEditForm(f => ({
                      ...f,
                      calories: String(Math.round(editBase.calories * next)),
                      protein: String(Math.round(editBase.protein * next * 10) / 10),
                      carbs: String(Math.round(editBase.carbs * next * 10) / 10),
                      fat: String(Math.round(editBase.fat * next * 10) / 10),
                    }));
                  }}
                  style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.editRefLine, { color: colors.mutedForeground }]}>
              {editServings === 1
                ? `Per serving${log.servingLabel ? ` (${log.servingLabel})` : ""}`
                : `Total (${editServings % 1 === 0 ? editServings : editServings.toFixed(1)} × per serving)`}
            </Text>

            <View style={styles.modalNutrients}>
              {(
                [
                  { field: 'calories' as const, label: 'Calories', color: colors.primary, suffix: 'kcal' },
                  { field: 'protein' as const, label: 'Protein', color: colors.secondary, suffix: 'g' },
                  { field: 'carbs' as const, label: 'Carbs', color: colors.warning, suffix: 'g' },
                  { field: 'fat' as const, label: 'Fat', color: '#ef4444', suffix: 'g' },
                ]
              ).map(({ field, label, color, suffix }) => (
                <View key={field} style={[styles.nutrientChip, { backgroundColor: color + "15", borderColor: color + "40" }]}>
                  <Text style={[styles.nutrientChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    value={editForm[field]}
                    onChangeText={(v) => handleMacroDirectEdit(field, v.replace(/[^0-9.]/g, ""))}
                    onBlur={() => {
                      const n = parseFloat(editForm[field]);
                      const formatted = isNaN(n) || n < 0
                        ? "0"
                        : field === 'calories'
                          ? String(Math.round(n))
                          : String(Math.round(n * 10) / 10);
                      setEditForm(f => ({ ...f, [field]: formatted }));
                    }}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    returnKeyType="done"
                    style={[styles.nutrientChipValue, { color, textAlign: 'center', minWidth: 36 }]}
                  />
                  <Text style={[styles.nutrientChipLabel, { color: colors.mutedForeground }]}>{suffix}</Text>
                </View>
              ))}
            </View>
            {(editForm.calories === "" || editForm.protein === "" || editForm.carbs === "" || editForm.fat === "") && (
              <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4, marginBottom: 2, fontFamily: "Inter_400Regular" }}>
                {editForm.calories === "" ? "Calories can't be blank" : editForm.protein === "" ? "Protein can't be blank" : editForm.carbs === "" ? "Carbs can't be blank" : "Fat can't be blank"}
              </Text>
            )}

            {(() => {
              const pKcal = Math.round(editBase.protein * editServings * 4);
              const cKcal = Math.round(editBase.carbs * editServings * 4);
              const fKcal = Math.round(editBase.fat * editServings * 9);
              const macroKcal = pKcal + cKcal + fKcal;
              const pG = Math.round(editBase.protein * editServings * 10) / 10;
              const cG = Math.round(editBase.carbs * editServings * 10) / 10;
              const fG = Math.round(editBase.fat * editServings * 10) / 10;
              const statedKcal = Math.round(editBase.calories * editServings);
              const mismatch =
                statedKcal > 0 &&
                Math.abs(macroKcal - statedKcal) / statedKcal > 0.2;
              const perServing = editBase.protein * 4 + editBase.carbs * 4 + editBase.fat * 9;
              return (
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => { if (mismatch) setShowHistBreakdown(v => !v); }}
                    activeOpacity={mismatch ? 0.7 : 1}
                  >
                    <Text
                      style={[
                        styles.macroCalHint,
                        { color: mismatch ? "#f59e0b" : colors.mutedForeground },
                      ]}
                    >
                      ~{macroKcal} kcal from macros
                      {mismatch ? "  ⚠ doesn't match stated calories" : ""}
                    </Text>
                  </TouchableOpacity>
                  {mismatch && (
                    <TouchableOpacity
                      onPress={() => {
                        const rounded = Math.round(perServing);
                        setEditBase(prev => ({ ...prev, calories: rounded }));
                        setEditForm(prev => ({ ...prev, calories: String(rounded) }));
                      }}
                      style={{ backgroundColor: "#f59e0b22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#f59e0b66" }}
                    >
                      <Text style={{ color: "#f59e0b", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Use macro total</Text>
                    </TouchableOpacity>
                  )}
                  {mismatch && showHistBreakdown && (
                    <View style={{ width: "100%", backgroundColor: "#f59e0b11", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#f59e0b33" }}>
                      <Text style={{ color: "#f59e0b", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
                        {`Protein ${pG}g × 4 = ${pKcal} kcal\nCarbs ${cG}g × 4 = ${cKcal} kcal\nFat ${fG}g × 9 = ${fKcal} kcal`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Meal type
            </Text>
            <View style={styles.mealPicker}>
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal}
                  onPress={() => setEditMealType(meal)}
                  style={[
                    styles.mealPickerBtn,
                    {
                      backgroundColor:
                        editMealType === meal ? MEAL_COLORS[meal] + "30" : colors.muted,
                      borderColor:
                        editMealType === meal ? MEAL_COLORS[meal] : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.mealPickerText,
                      {
                        color:
                          editMealType === meal
                            ? MEAL_COLORS[meal]
                            : colors.mutedForeground,
                        fontFamily:
                          editMealType === meal
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Date
            </Text>
            <View style={styles.datePickerRow}>
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(editDate + "T12:00:00");
                  d.setDate(d.getDate() - 1);
                  setEditDate(d.toISOString().split("T")[0]);
                }}
                style={styles.dateArrowBtn}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.datePickerLabel, { color: colors.foreground }]}>
                {new Date(editDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const today = new Date().toISOString().split("T")[0];
                  if (editDate >= today) return;
                  const d = new Date(editDate + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  setEditDate(d.toISOString().split("T")[0]);
                }}
                style={styles.dateArrowBtn}
                hitSlop={8}
                disabled={editDate >= new Date().toISOString().split("T")[0]}
              >
                <Ionicons name="chevron-forward" size={20} color={editDate >= new Date().toISOString().split("T")[0] ? colors.mutedForeground : colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowEditSheet(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Reanimated.View style={[histSaveShakeStyle, { flex: 2 }]}>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  style={[styles.modalConfirmBtn, { flex: 1, backgroundColor: colors.primary, opacity: (editForm.name.trim() && editForm.calories !== "" && editForm.protein !== "" && editForm.carbs !== "" && editForm.fat !== "") ? 1 : 0.45 }]}
                >
                  <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                    Save Changes
                  </Text>
                </TouchableOpacity>
              </Reanimated.View>
            </View>
          </GlassCard>
        </View>
      </Modal>
      <SyncIndicator status={histSyncStatus} />
    </>
  );
}

function NutritionRow({ log, onDelete, onToggleStar, isFirst, onSaved }: { log: MealLog; onDelete: (meal: MealLog) => void; onToggleStar?: () => void; isFirst?: boolean; onSaved?: (label: string) => void }) {
  const colors = useColors();
  const { updateMealLog, syncMealName, favoriteFoods } = useFitness();
  const { syncStatus: rowSyncStatus, startSync: rowStartSync, finishSync: rowFinishSync } = useSyncIndicator();
  const starred = favoriteFoods.some((f) => f.name === log.name);
  const swipeableRef = useRef<Swipeable>(null);
  const runHintAnimation = useSwipeHint(SWIPE_DELETE_HINT_STORAGE_KEY, isFirst ?? false);

  useEffect(() => {
    if (!runHintAnimation) return;
    let cancelled = false;
    const peekTimer = setTimeout(() => {
      if (cancelled) return;
      swipeableRef.current?.openRight();
      setTimeout(() => {
        if (!cancelled) swipeableRef.current?.close();
      }, 700);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(peekTimer);
    };
  }, [runHintAnimation]);

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editForm, setEditForm] = useState<ManualForm>({
    name: log.name,
    calories: String(log.calories),
    protein: String(log.protein),
    carbs: String(log.carbs),
    fat: String(log.fat),
  });
  const [editMealType, setEditMealType] = useState<MealType>(log.mealType);
  const [editServings, setEditServings] = useState(1);
  const editServingsRef = useRef(1);
  const [editServingsText, setEditServingsText] = useState("1");
  const [editBase, setEditBase] = useState({ calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat });
  const [editGrams, setEditGrams] = useState<number | undefined>(log.amountGrams);
  const editGramsRef = useRef<number | undefined>(log.amountGrams);
  const [editGramsText, setEditGramsText] = useState(
    log.amountGrams !== undefined
      ? (Number.isInteger(log.amountGrams) ? String(log.amountGrams) : log.amountGrams.toFixed(1))
      : ""
  );
  const [editShowPer100g, setEditShowPer100g] = useState(false);
  const perGramRef = useRef<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);
  const editCaloriesAutoFilled = useRef(false);
  const [showRowBreakdown, setShowRowBreakdown] = useState(false);
  const [editDate, setEditDate] = useState(log.date);
  const rowSaveShakeX = useSharedValue(0);
  const rowSaveShakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rowSaveShakeX.value }] }));

  // Narrow sync: keep editForm.name current even when the sheet is open.
  // The full-reset effect below is guarded by showEditSheet, so if syncMealName
  // propagates a name change to this linked entry while the sheet is open, the
  // name in the form would otherwise go stale until the sheet is closed.
  useEffect(() => {
    setEditForm((prev) => (prev.name === log.name ? prev : { ...prev, name: log.name }));
  }, [log.name]);

  useEffect(() => {
    if (showEditSheet) return;
    editCaloriesAutoFilled.current = false;
    setShowRowBreakdown(false);
    setEditForm({
      name: log.name,
      calories: String(log.calories),
      protein: String(log.protein),
      carbs: String(log.carbs),
      fat: String(log.fat),
    });
    setEditBase({ calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat });
    setEditMealType(log.mealType);
    setEditDate(log.date);
    setEditServings(1);
    editServingsRef.current = 1;
    setEditServingsText("1");
    const g = log.amountGrams;
    setEditGrams(g);
    editGramsRef.current = g;
    setEditGramsText(
      g !== undefined
        ? (Number.isInteger(g) ? String(g) : g.toFixed(1))
        : ""
    );
  }, [log.name, log.calories, log.protein, log.carbs, log.fat, log.mealType, log.amountGrams, log.date, showEditSheet]);

  function openEditSheet() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditForm({
      name: log.name,
      calories: String(log.calories),
      protein: String(log.protein),
      carbs: String(log.carbs),
      fat: String(log.fat),
    });
    setEditMealType(log.mealType);
    setEditDate(log.date);
    setEditServings(1);
    editServingsRef.current = 1;
    setEditServingsText("1");
    setEditBase({ calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat });
    const g = log.amountGrams;
    setEditGrams(g);
    editGramsRef.current = g;
    setEditGramsText(
      g !== undefined
        ? (Number.isInteger(g) ? String(g) : g.toFixed(1))
        : ""
    );
    if (log.nutrients100g) {
      // Authoritative per-gram ratio from the stored 100g snapshot
      perGramRef.current = {
        calories: log.nutrients100g.calories / 100,
        protein: log.nutrients100g.protein / 100,
        carbs: log.nutrients100g.carbs / 100,
        fat: log.nutrients100g.fat / 100,
      };
    } else if (g !== undefined && g > 0) {
      perGramRef.current = {
        calories: log.calories / g,
        protein: log.protein / g,
        carbs: log.carbs / g,
        fat: log.fat / g,
      };
    } else {
      perGramRef.current = null;
    }
    const hasGrams = log.amountGrams !== undefined && log.amountGrams > 0;
    if (hasGrams) {
      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
        try {
          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
          const entry = map[log.name];
          const pref = entry !== null && typeof entry === "object" ? entry : null;
          const isStale = !pref || (pref.grams > 0 && pref.grams !== log.amountGrams);
          if (!isStale && pref!.per100g && perGramRef.current) {
            setEditShowPer100g(true);
            setEditGramsText("100");
            setEditGrams(100);
            editGramsRef.current = 100;
            setEditBase({
              calories: perGramRef.current.calories * 100,
              protein: perGramRef.current.protein * 100,
              carbs: perGramRef.current.carbs * 100,
              fat: perGramRef.current.fat * 100,
            });
            setEditServings(1);
            editServingsRef.current = 1;
            setEditServingsText("1");
          } else {
            setEditShowPer100g(false);
          }
        } catch {
          setEditShowPer100g(false);
        }
      });
    } else {
      setEditShowPer100g(false);
    }
    setShowEditSheet(true);
  }

  function handleGramsChange(text: string) {
    const stripped = text.replace(/[^0-9.]/g, "");
    const parts = stripped.split(".");
    const normalized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : stripped;
    setEditGramsText(normalized);
    const n = parseFloat(normalized);
    if (!isNaN(n) && n > 0) {
      setEditGrams(n);
      editGramsRef.current = n;
      if (perGramRef.current) {
        const newBase = {
          calories: perGramRef.current.calories * n,
          protein: perGramRef.current.protein * n,
          carbs: perGramRef.current.carbs * n,
          fat: perGramRef.current.fat * n,
        };
        setEditBase(newBase);
        setEditForm(f => ({
          ...f,
          calories: String(Math.round(newBase.calories)),
          protein: String(Math.round(newBase.protein * 10) / 10),
          carbs: String(Math.round(newBase.carbs * 10) / 10),
          fat: String(Math.round(newBase.fat * 10) / 10),
        }));
        setEditServings(1);
        editServingsRef.current = 1;
        setEditServingsText("1");
      }
      // If perGramRef.current is null (no stored amountGrams), wait for onBlur
      // to finalize the gram value before locking the per-gram ratio.
    } else if (normalized === "" || normalized === "0") {
      setEditGrams(undefined);
      editGramsRef.current = undefined;
      perGramRef.current = null;
    }
  }

  function commitGramsBaseline(gramsText: string) {
    const n = parseFloat(gramsText);
    if (!isNaN(n) && n > 0 && !perGramRef.current) {
      perGramRef.current = {
        calories: log.calories / n,
        protein: log.protein / n,
        carbs: log.carbs / n,
        fat: log.fat / n,
      };
      setEditBase({
        calories: perGramRef.current.calories * n,
        protein: perGramRef.current.protein * n,
        carbs: perGramRef.current.carbs * n,
        fat: perGramRef.current.fat * n,
      });
      setEditServings(1);
      editServingsRef.current = 1;
      setEditServingsText("1");
    }
  }

  function handleMacroDirectEdit(field: 'calories' | 'protein' | 'carbs' | 'fat', text: string) {
    if (field === 'calories') {
      editCaloriesAutoFilled.current = false;
    }
    const n = parseFloat(text);
    const isValid = !isNaN(n) && n >= 0;
    const servingsAtEdit = editServingsRef.current;
    const baseValue = isValid ? (servingsAtEdit > 0 ? n / servingsAtEdit : n) : null;
    // Compute auto-fill decision synchronously before any state updates
    let autoFillBase: number | null = null;
    if (field !== 'calories' && baseValue !== null && (editCaloriesAutoFilled.current || editForm.calories === "")) {
      const p = field === 'protein' ? baseValue : editBase.protein;
      const c = field === 'carbs' ? baseValue : editBase.carbs;
      const ft = field === 'fat' ? baseValue : editBase.fat;
      const kcal = p * 4 + c * 4 + ft * 9;
      if (kcal > 0) {
        editCaloriesAutoFilled.current = true;
        autoFillBase = kcal;
      }
    }
    setEditForm(f => {
      const updated = { ...f, [field]: text };
      if (autoFillBase !== null) {
        updated.calories = String(Math.round(autoFillBase * servingsAtEdit));
      }
      return updated;
    });
    if (baseValue !== null) {
      const grams = editGramsRef.current;
      setEditBase(prev => {
        const newBase = { ...prev, [field]: baseValue };
        if (autoFillBase !== null) {
          newBase.calories = autoFillBase;
        }
        if (grams !== undefined && grams > 0) {
          perGramRef.current = {
            calories: newBase.calories / grams,
            protein: newBase.protein / grams,
            carbs: newBase.carbs / grams,
            fat: newBase.fat / grams,
          };
        }
        return newBase;
      });
    }
  }

  function handleSaveEdit() {
    const name = editForm.name.trim();
    const hasBlankNumeric = editForm.calories === "" || editForm.protein === "" || editForm.carbs === "" || editForm.fat === "";
    if (!name || hasBlankNumeric) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      rowSaveShakeX.value = withSequence(
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }
    const oldName = log.name;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const savedBase = editBase;
    const savedServings = editServings;
    const savedMealType = editMealType;
    const savedGrams = editGrams;
    const savedCalories = Math.round(savedBase.calories * savedServings);
    rowStartSync();
    const rowSyncCb = name !== oldName
      ? makeCombinedSyncCallback(2, rowFinishSync)
      : rowFinishSync;
    updateMealLog(log.id, {
      name,
      calories: savedCalories,
      protein: Math.round(savedBase.protein * savedServings * 10) / 10,
      carbs: Math.round(savedBase.carbs * savedServings * 10) / 10,
      fat: Math.round(savedBase.fat * savedServings * 10) / 10,
      mealType: savedMealType,
      amountGrams: savedGrams !== undefined ? Math.round(savedGrams * savedServings * 10) / 10 : undefined,
      date: editDate,
    }, rowSyncCb);
    if (name !== oldName) {
      syncMealName(log.id, name, rowSyncCb);
    }
    setShowEditSheet(false);
    onSaved?.(`${name} saved · ${savedCalories} kcal`);
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    onDelete(log);
  }

  function renderRightActions() {
    return (
      <TouchableOpacity
        onPress={handleDelete}
        activeOpacity={0.85}
        style={[styles.deleteAction, { backgroundColor: "#ef4444" }]}
      >
        <Ionicons name="trash-outline" size={20} color="#fff" />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    );
  }

  return (
    <>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={60}
        overshootRight={false}
        onSwipeableOpen={() => Haptics.selectionAsync()}
      >
        <View style={[styles.nutritionRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={openEditSheet}
            activeOpacity={0.7}
            style={styles.nutritionRowMain}
          >
            <View style={styles.nutritionRowInfo}>
              <View style={styles.nutritionNameRow}>
                <Text style={[styles.nutritionName, { color: colors.foreground }]} numberOfLines={1}>
                  {log.name}
                </Text>
                {log.amountGrams !== undefined && (
                  <Text style={[styles.nutritionAmountBadge, { color: colors.mutedForeground }]}>
                    {Number.isInteger(log.amountGrams) ? log.amountGrams : log.amountGrams.toFixed(1)} g
                  </Text>
                )}
              </View>
              <Text style={[styles.nutritionMacroSub, { color: colors.mutedForeground }]}>
                {log.protein}g P · {log.carbs}g C · {log.fat}g F
              </Text>
            </View>
            <View style={styles.nutritionRowRight}>
              <Text style={[styles.nutritionCal, { color: colors.primary }]}>
                {log.calories} kcal
              </Text>
              <Ionicons name="pencil-outline" size={13} color={colors.mutedForeground} style={{ marginTop: 1 }} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              if (onToggleStar) {
                onToggleStar();
              }
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.nutritionStarBtn}
          >
            <Ionicons
              name={starred ? "star" : "star-outline"}
              size={17}
              color={starred ? "#f59f0a" : colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>
      </Swipeable>

      <Modal
        visible={showEditSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditSheet(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            style={[styles.modalCard, { backgroundColor: colors.card }]}
            variant="elevated"
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Edit Meal
            </Text>

            <Text style={[styles.editFieldLabel, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              value={editForm.name}
              onChangeText={(text) => setEditForm(f => ({ ...f, name: text }))}
              placeholder="Meal name"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="done"
              selectTextOnFocus
              maxLength={120}
              style={[
                styles.editFoodNameLabel,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: editForm.name.trim() ? colors.border : "#ef4444" },
              ]}
            />
            {!editForm.name.trim() && (
              <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4, marginBottom: 2, fontFamily: "Inter_400Regular" }}>
                Name can't be blank
              </Text>
            )}

            {log.nutrients100g !== undefined && (
              <View style={[styles.servingToggleRow, { marginBottom: 12, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => {
                    if (editShowPer100g) {
                      setEditShowPer100g(false);
                      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                        try {
                          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                          map[log.name] = { per100g: false, grams: log.amountGrams ?? 0 };
                          AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
                        } catch {}
                      });
                      if (log.amountGrams !== undefined && log.amountGrams > 0 && perGramRef.current) {
                        // Restore original logged grams and scale macros accordingly
                        const g = log.amountGrams;
                        const gText = Number.isInteger(g) ? String(g) : g.toFixed(1);
                        setEditGramsText(gText);
                        setEditGrams(g);
                        editGramsRef.current = g;
                        setEditBase({
                          calories: perGramRef.current.calories * g,
                          protein: perGramRef.current.protein * g,
                          carbs: perGramRef.current.carbs * g,
                          fat: perGramRef.current.fat * g,
                        });
                      } else {
                        // Food was logged in serving mode (no grams): restore original macros
                        setEditGramsText("");
                        setEditGrams(undefined);
                        editGramsRef.current = undefined;
                        setEditBase({
                          calories: log.calories,
                          protein: log.protein,
                          carbs: log.carbs,
                          fat: log.fat,
                        });
                      }
                      setEditServings(1);
                      editServingsRef.current = 1;
                      setEditServingsText("1");
                    }
                  }}
                  style={[
                    styles.servingToggleOption,
                    !editShowPer100g && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={[
                    styles.servingToggleText,
                    { color: !editShowPer100g ? colors.primaryForeground : colors.mutedForeground },
                  ]}>
                    {log.servingLabel ? `per ${log.servingLabel}` : "per serving"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (!editShowPer100g && perGramRef.current) {
                      setEditShowPer100g(true);
                      AsyncStorage.getItem(EDIT_PER100G_PREF_KEY).then((raw) => {
                        try {
                          const map: Record<string, { per100g: boolean; grams: number } | boolean> = raw ? JSON.parse(raw) : {};
                          map[log.name] = { per100g: true, grams: log.amountGrams ?? 0 };
                          AsyncStorage.setItem(EDIT_PER100G_PREF_KEY, JSON.stringify(map));
                        } catch {}
                      });
                      setEditGramsText("100");
                      setEditGrams(100);
                      editGramsRef.current = 100;
                      setEditBase({
                        calories: perGramRef.current.calories * 100,
                        protein: perGramRef.current.protein * 100,
                        carbs: perGramRef.current.carbs * 100,
                        fat: perGramRef.current.fat * 100,
                      });
                      setEditServings(1);
                      editServingsRef.current = 1;
                      setEditServingsText("1");
                    }
                  }}
                  style={[
                    styles.servingToggleOption,
                    editShowPer100g && { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={[
                    styles.servingToggleText,
                    { color: editShowPer100g ? colors.primaryForeground : colors.mutedForeground },
                  ]}>
                    per 100g
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.gramsRow}>
              <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Amount (g)</Text>
              <TextInput
                placeholder="—"
                placeholderTextColor={colors.mutedForeground}
                value={editGramsText}
                onChangeText={handleGramsChange}
                onBlur={() => {
                  const n = parseFloat(editGramsText);
                  if (isNaN(n) || n <= 0) {
                    setEditGramsText(editGrams !== undefined ? String(editGrams) : "");
                  } else {
                    commitGramsBaseline(editGramsText);
                  }
                }}
                keyboardType="decimal-pad"
                selectTextOnFocus
                returnKeyType="done"
                maxLength={7}
                style={[
                  styles.gramsInput,
                  { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              />
              <Text style={[styles.gramsUnit, { color: colors.mutedForeground }]}>g</Text>
            </View>
            {(() => {
              const pg = perGramRef.current;
              const n = parseFloat(editGramsText);
              if (!pg || isNaN(n) || n <= 0) return null;
              const cal = Math.round(pg.calories * n);
              const pro = Math.round(pg.protein * n * 10) / 10;
              const carb = Math.round(pg.carbs * n * 10) / 10;
              const fat = Math.round(pg.fat * n * 10) / 10;
              return (
                <Text style={[styles.gramsPreview, { color: colors.mutedForeground }]}>
                  ~{cal} kcal · {pro}g P · {carb}g C · {fat}g F at {n}g
                </Text>
              );
            })()}

            <View style={styles.servingsRow}>
              <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Servings</Text>
              <View style={styles.servingsControl}>
                <TouchableOpacity
                  onPress={() => {
                    if (editServings > 0.5) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      const steps = Math.round(editServings * 200) / 100;
                      const next = Math.max(0.5, Math.ceil(steps - 1) * 0.5);
                      setEditServings(next);
                      editServingsRef.current = next;
                      setEditServingsText(Number.isInteger(next) ? String(next) : next.toFixed(1));
                      setEditForm(f => ({
                        ...f,
                        calories: String(Math.round(editBase.calories * next)),
                        protein: String(Math.round(editBase.protein * next * 10) / 10),
                        carbs: String(Math.round(editBase.carbs * next * 10) / 10),
                        fat: String(Math.round(editBase.fat * next * 10) / 10),
                      }));
                    }
                  }}
                  style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="remove" size={16} color={editServings <= 0.5 ? colors.mutedForeground : colors.foreground} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.servingsValue, { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4 }]}
                  value={editServingsText}
                  onChangeText={(v) => {
                    const stripped = v.replace(/[^0-9.]/g, "");
                    const parts = stripped.split(".");
                    const normalized = parts.length > 2
                      ? parts[0] + "." + parts.slice(1).join("")
                      : stripped;
                    setEditServingsText(normalized);
                    const n = parseFloat(normalized);
                    if (!isNaN(n) && n > 0) {
                      setEditServings(n);
                      editServingsRef.current = n;
                      setEditForm(f => ({
                        ...f,
                        calories: String(Math.round(editBase.calories * n)),
                        protein: String(Math.round(editBase.protein * n * 10) / 10),
                        carbs: String(Math.round(editBase.carbs * n * 10) / 10),
                        fat: String(Math.round(editBase.fat * n * 10) / 10),
                      }));
                    }
                  }}
                  onBlur={() => {
                    const n = parseFloat(editServingsText);
                    const snapped = !isNaN(n) && n > 0 ? Math.max(0.5, Math.round(n / 0.5) * 0.5) : 1;
                    setEditServings(snapped);
                    editServingsRef.current = snapped;
                    setEditServingsText(Number.isInteger(snapped) ? String(snapped) : snapped.toFixed(1));
                    setEditForm(f => ({
                      ...f,
                      calories: String(Math.round(editBase.calories * snapped)),
                      protein: String(Math.round(editBase.protein * snapped * 10) / 10),
                      carbs: String(Math.round(editBase.carbs * snapped * 10) / 10),
                      fat: String(Math.round(editBase.fat * snapped * 10) / 10),
                    }));
                  }}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  returnKeyType="done"
                  maxLength={7}
                />
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    const steps = Math.round(editServings * 200) / 100;
                    const next = Math.floor(steps + 1) * 0.5;
                    setEditServings(next);
                    editServingsRef.current = next;
                    setEditServingsText(Number.isInteger(next) ? String(next) : next.toFixed(1));
                    setEditForm(f => ({
                      ...f,
                      calories: String(Math.round(editBase.calories * next)),
                      protein: String(Math.round(editBase.protein * next * 10) / 10),
                      carbs: String(Math.round(editBase.carbs * next * 10) / 10),
                      fat: String(Math.round(editBase.fat * next * 10) / 10),
                    }));
                  }}
                  style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="add" size={16} color={colors.foreground} />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.editRefLine, { color: colors.mutedForeground }]}>
              {editServings === 1
                ? `Per serving${log.servingLabel ? ` (${log.servingLabel})` : ""}`
                : `Total (${editServings % 1 === 0 ? editServings : editServings.toFixed(1)} × per serving)`}
            </Text>

            <View style={styles.modalNutrients}>
              {(
                [
                  { field: 'calories' as const, label: 'Calories', color: colors.primary, suffix: 'kcal' },
                  { field: 'protein' as const, label: 'Protein', color: colors.secondary, suffix: 'g' },
                  { field: 'carbs' as const, label: 'Carbs', color: colors.warning, suffix: 'g' },
                  { field: 'fat' as const, label: 'Fat', color: '#ef4444', suffix: 'g' },
                ]
              ).map(({ field, label, color, suffix }) => (
                <View key={field} style={[styles.nutrientChip, { backgroundColor: color + "15", borderColor: color + "40" }]}>
                  <Text style={[styles.nutrientChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
                  <TextInput
                    value={editForm[field]}
                    onChangeText={(v) => handleMacroDirectEdit(field, v.replace(/[^0-9.]/g, ""))}
                    onBlur={() => {
                      const n = parseFloat(editForm[field]);
                      const formatted = isNaN(n) || n < 0
                        ? "0"
                        : field === 'calories'
                          ? String(Math.round(n))
                          : String(Math.round(n * 10) / 10);
                      setEditForm(f => ({ ...f, [field]: formatted }));
                    }}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    returnKeyType="done"
                    style={[styles.nutrientChipValue, { color, textAlign: 'center', minWidth: 36 }]}
                  />
                  <Text style={[styles.nutrientChipLabel, { color: colors.mutedForeground }]}>{suffix}</Text>
                </View>
              ))}
            </View>
            {(editForm.calories === "" || editForm.protein === "" || editForm.carbs === "" || editForm.fat === "") && (
              <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4, marginBottom: 2, fontFamily: "Inter_400Regular" }}>
                {editForm.calories === "" ? "Calories can't be blank" : editForm.protein === "" ? "Protein can't be blank" : editForm.carbs === "" ? "Carbs can't be blank" : "Fat can't be blank"}
              </Text>
            )}

            {(() => {
              const pKcal = Math.round(editBase.protein * editServings * 4);
              const cKcal = Math.round(editBase.carbs * editServings * 4);
              const fKcal = Math.round(editBase.fat * editServings * 9);
              const macroKcal = pKcal + cKcal + fKcal;
              const pG = Math.round(editBase.protein * editServings * 10) / 10;
              const cG = Math.round(editBase.carbs * editServings * 10) / 10;
              const fG = Math.round(editBase.fat * editServings * 10) / 10;
              const statedKcal = Math.round(editBase.calories * editServings);
              const mismatch =
                statedKcal > 0 &&
                Math.abs(macroKcal - statedKcal) / statedKcal > 0.2;
              const perServing = editBase.protein * 4 + editBase.carbs * 4 + editBase.fat * 9;
              return (
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => { if (mismatch) setShowRowBreakdown(v => !v); }}
                    activeOpacity={mismatch ? 0.7 : 1}
                  >
                    <Text
                      style={[
                        styles.macroCalHint,
                        { color: mismatch ? "#f59e0b" : colors.mutedForeground },
                      ]}
                    >
                      ~{macroKcal} kcal from macros
                      {mismatch ? "  ⚠ doesn't match stated calories" : ""}
                    </Text>
                  </TouchableOpacity>
                  {mismatch && (
                    <TouchableOpacity
                      onPress={() => {
                        const rounded = Math.round(perServing);
                        setEditBase(prev => ({ ...prev, calories: rounded }));
                        setEditForm(prev => ({ ...prev, calories: String(rounded) }));
                      }}
                      style={{ backgroundColor: "#f59e0b22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#f59e0b66" }}
                    >
                      <Text style={{ color: "#f59e0b", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Use macro total</Text>
                    </TouchableOpacity>
                  )}
                  {mismatch && showRowBreakdown && (
                    <View style={{ width: "100%", backgroundColor: "#f59e0b11", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: "#f59e0b33" }}>
                      <Text style={{ color: "#f59e0b", fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 18 }}>
                        {`Protein ${pG}g × 4 = ${pKcal} kcal\nCarbs ${cG}g × 4 = ${cKcal} kcal\nFat ${fG}g × 9 = ${fKcal} kcal`}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })()}

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Meal type
            </Text>
            <View style={styles.mealPicker}>
              {MEALS.map((meal) => (
                <TouchableOpacity
                  key={meal}
                  onPress={() => setEditMealType(meal)}
                  style={[
                    styles.mealPickerBtn,
                    {
                      backgroundColor:
                        editMealType === meal ? MEAL_COLORS[meal] + "30" : colors.muted,
                      borderColor:
                        editMealType === meal ? MEAL_COLORS[meal] : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.mealPickerText,
                      {
                        color:
                          editMealType === meal
                            ? MEAL_COLORS[meal]
                            : colors.mutedForeground,
                        fontFamily:
                          editMealType === meal
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Date
            </Text>
            <View style={styles.datePickerRow}>
              <TouchableOpacity
                onPress={() => {
                  const d = new Date(editDate + "T12:00:00");
                  d.setDate(d.getDate() - 1);
                  setEditDate(d.toISOString().split("T")[0]);
                }}
                style={styles.dateArrowBtn}
                hitSlop={8}
              >
                <Ionicons name="chevron-back" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={[styles.datePickerLabel, { color: colors.foreground }]}>
                {new Date(editDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const today = new Date().toISOString().split("T")[0];
                  if (editDate >= today) return;
                  const d = new Date(editDate + "T12:00:00");
                  d.setDate(d.getDate() + 1);
                  setEditDate(d.toISOString().split("T")[0]);
                }}
                style={styles.dateArrowBtn}
                hitSlop={8}
                disabled={editDate >= new Date().toISOString().split("T")[0]}
              >
                <Ionicons name="chevron-forward" size={20} color={editDate >= new Date().toISOString().split("T")[0] ? colors.mutedForeground : colors.foreground} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowEditSheet(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Reanimated.View style={[rowSaveShakeStyle, { flex: 2 }]}>
                <TouchableOpacity
                  onPress={handleSaveEdit}
                  style={[styles.modalConfirmBtn, { flex: 1, backgroundColor: colors.primary, opacity: (editForm.name.trim() && editForm.calories !== "" && editForm.protein !== "" && editForm.carbs !== "" && editForm.fat !== "") ? 1 : 0.45 }]}
                >
                  <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                    Save Changes
                  </Text>
                </TouchableOpacity>
              </Reanimated.View>
            </View>
          </GlassCard>
        </View>
      </Modal>
      <SyncIndicator status={rowSyncStatus} />
    </>
  );
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function HistoryMacroChip({
  label,
  value,
  goal,
  color,
  onPress,
  onBadgePress,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
  onPress?: () => void;
  onBadgePress?: () => void;
}) {
  const colors = useColors();
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  const ratio = goal > 0 ? value / goal : 1;
  const chipColor = ratio > 1 ? colors.destructive : ratio >= 0.9 ? colors.warning : color;
  const badge: "low" | "over" | null =
    ratio < 0.8 ? "low" : ratio > 1.1 ? "over" : null;
  const badgeColor = badge === "low" ? colors.warning : colors.accent;
  const badgeLabel = badge === "low" ? "Low" : "Over";

  const colorAnim = useRef(new Animated.Value(1)).current;
  const [fromColor, setFromColor] = useState(chipColor);
  const prevChipColorRef = useRef(chipColor);

  useLayoutEffect(() => {
    if (prevChipColorRef.current !== chipColor) {
      prevChipColorRef.current = chipColor;
      colorAnim.stopAnimation();
      colorAnim.setValue(0);
      Animated.timing(colorAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) setFromColor(chipColor);
      });
    }
  }, [chipColor]);

  const animBg = colorAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor + "15", chipColor + "15"] });
  const animBgPressable = colorAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor + "15", chipColor + "15"] });
  const animBorder = colorAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor + "55", chipColor + "55"] });
  const animBorderLight = colorAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor + "35", chipColor + "35"] });
  const animText = colorAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor, chipColor] });
  const animBarBg = colorAnim.interpolate({ inputRange: [0, 1], outputRange: [fromColor + "30", chipColor + "30"] });

  const badgeEl = badge !== null ? (
    onBadgePress ? (
      <TouchableOpacity
        onPress={(e) => { e.stopPropagation?.(); onBadgePress(); }}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={[styles.historyMacroBadge, { backgroundColor: badgeColor + "22", borderColor: badgeColor + "66" }]}
      >
        <Text style={[styles.historyMacroBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
        <Ionicons name="chevron-forward" size={8} color={badgeColor} style={{ marginLeft: 1 }} />
      </TouchableOpacity>
    ) : (
      <View style={[styles.historyMacroBadge, { backgroundColor: badgeColor + "22", borderColor: badgeColor + "66" }]}>
        <Text style={[styles.historyMacroBadgeText, { color: badgeColor }]}>{badgeLabel}</Text>
      </View>
    )
  ) : null;

  const inner = (
    <>
      <View style={styles.historyMacroChipLabelRow}>
        <Text style={[styles.historyMacroChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
        {badgeEl}
      </View>
      <Animated.Text style={[styles.historyMacroChipValue, { color: animText }]}>
        {value}<Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>/{goal}g</Text>
      </Animated.Text>
      <Animated.View style={[styles.historyMacroChipBar, { backgroundColor: animBarBg }]}>
        <Animated.View style={[styles.historyMacroChipBarFill, { backgroundColor: animText, width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
      </Animated.View>
    </>
  );

  if (onPress) {
    return (
      <AnimatedTouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[styles.historyMacroChip, { backgroundColor: animBgPressable, borderColor: animBorder }]}
      >
        {inner}
      </AnimatedTouchableOpacity>
    );
  }
  return (
    <Animated.View style={[styles.historyMacroChip, { backgroundColor: animBg, borderColor: animBorderLight }]}>
      {inner}
    </Animated.View>
  );
}

function formatDrillDate(dateStr: string): string {
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

type DrillDownData = {
  label: string;
  macro: "protein" | "carbs" | "fat";
  goal: number;
  color: string;
  badge: "low" | "over";
  avgValue: number;
  outOfRangeDays: { date: string; value: number }[];
  inRangeDays: { date: string; value: number }[];
};

function MacroDrillDownSheet({
  drillDown,
  onClose,
}: {
  drillDown: DrillDownData;
  onClose: () => void;
}) {
  const colors = useColors();
  const badgeColor = drillDown.badge === "low" ? colors.warning : colors.accent;

  function DayRow({ date, value, dimmed }: { date: string; value: number; dimmed?: boolean }) {
    const pct = drillDown.goal > 0 ? Math.round((value / drillDown.goal) * 100) : 0;
    const barColor = dimmed ? colors.mutedForeground : drillDown.color;
    return (
      <View style={[styles.drillDownDayRow, { borderBottomColor: colors.border, opacity: dimmed ? 0.55 : 1 }]}>
        <Text style={[styles.drillDownDayDate, { color: colors.foreground }]}>
          {formatDrillDate(date)}
        </Text>
        <View style={styles.drillDownDayRight}>
          <View style={[styles.drillDownDayBar, { backgroundColor: barColor + "25" }]}>
            <View style={[
              styles.drillDownDayBarFill,
              { backgroundColor: barColor, width: `${Math.min(pct, 100)}%` as `${number}%` }
            ]} />
          </View>
          <Text style={[styles.drillDownDayValue, { color: barColor }]}>{value}g</Text>
          <Text style={[styles.drillDownDayPct, { color: colors.mutedForeground }]}>{pct}%</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.drillDownSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.drillDownHandle, { backgroundColor: colors.mutedForeground + "55" }]} />

      <View style={styles.drillDownHeader}>
        <View style={[styles.drillDownIconBg, { backgroundColor: drillDown.color + "20" }]}>
          <Ionicons
            name={drillDown.macro === "protein" ? "barbell-outline" : drillDown.macro === "carbs" ? "leaf-outline" : "water-outline"}
            size={18}
            color={drillDown.color}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.drillDownTitle, { color: colors.foreground }]}>
            {drillDown.label} Breakdown
          </Text>
          <Text style={[styles.drillDownSubtitle, { color: colors.mutedForeground }]}>
            Avg {drillDown.avgValue}g · Goal {drillDown.goal}g
          </Text>
        </View>
        <View style={[styles.drillDownBadgePill, { backgroundColor: badgeColor + "20", borderColor: badgeColor + "60" }]}>
          <Text style={[styles.drillDownBadgePillText, { color: badgeColor }]}>
            {drillDown.badge === "low" ? "Low avg" : "Over avg"}
          </Text>
        </View>
      </View>

      <Text style={[styles.drillDownSectionLabel, { color: colors.mutedForeground }]}>
        {drillDown.badge === "low"
          ? `Days below 80% of goal (${Math.round(drillDown.goal * 0.8)}g)`
          : `Days above 110% of goal (${Math.round(drillDown.goal * 1.1)}g)`}
      </Text>

      <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
        {drillDown.outOfRangeDays.length === 0 ? (
          <Text style={[styles.drillDownEmpty, { color: colors.mutedForeground }]}>
            No single day stands out — the average is dragged by many days near the threshold.
          </Text>
        ) : (
          drillDown.outOfRangeDays.map(({ date, value }) => (
            <DayRow key={date} date={date} value={value} />
          ))
        )}
        {drillDown.inRangeDays.length > 0 && (
          <>
            <Text style={[styles.drillDownSectionLabel, { color: colors.mutedForeground, marginTop: 12 }]}>
              On-track days
            </Text>
            {drillDown.inRangeDays.map(({ date, value }) => (
              <DayRow key={date} date={date} value={value} dimmed />
            ))}
          </>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={onClose}
        style={[styles.drillDownDismiss, { borderColor: colors.border }]}
      >
        <Text style={[styles.drillDownDismissText, { color: colors.mutedForeground }]}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

function NutrientChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.nutrientChip,
        { backgroundColor: color + "15", borderColor: color + "40" },
      ]}
    >
      <Text style={[styles.nutrientChipLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.nutrientChipValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 10 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  headerTitle: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerDate: { fontSize: 14, fontFamily: "Inter_400Regular" },
  scanBtnGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recentBtnWrapper: {
    position: "relative",
  },
  recentBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recentBtnBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  recentBtnBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  scanBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  per100gPill: {
    alignSelf: "flex-start",
  },
  per100gPillInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  per100gPillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  searchEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  searchEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  macroCard: { padding: 16 },
  macroCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  macroCardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  editGoalsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  editGoalsText: {
    fontSize: 12,
    fontWeight: "500",
  },
  macroRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  macros: { flex: 1, gap: 10 },
  macroBarContainer: { gap: 4 },
  macroBarHeader: { flexDirection: "row", justifyContent: "space-between" },
  macroBarLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  macroBarValue: { fontSize: 11, fontFamily: "Inter_500Medium" },
  macroTrackWrapper: { borderRadius: 3 },
  macroTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  macroFlex: { flex: 1, flexDirection: "row", height: "100%" },
  macroFill: { height: "100%", borderRadius: 3 },
  mealSection: { gap: 6 },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  mealDot: { width: 8, height: 8, borderRadius: 4 },
  mealTitle: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  mealCal: { fontSize: 13, fontFamily: "Inter_400Regular" },
  nutritionRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
    paddingRight: 4,
  },
  nutritionRowMain: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    paddingRight: 8,
  },
  nutritionRowInfo: { flex: 1, gap: 2 },
  nutritionNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  nutritionAmountBadge: { fontSize: 11, fontFamily: "Inter_400Regular", opacity: 0.8 },
  nutritionRowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nutritionStarBtn: {
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  nutritionName: { fontSize: 14, fontFamily: "Inter_400Regular" },
  nutritionMacroSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  nutritionCal: { fontSize: 14, fontFamily: "Inter_500Medium" },
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    flexDirection: "column",
    gap: 3,
  },
  deleteActionText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    marginTop: 4,
  },
  quickAddHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  quickEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  quickEditBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  foodCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  foodIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  foodInfo: { flex: 1, gap: 2 },
  foodName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  foodMacros: { fontSize: 12, fontFamily: "Inter_400Regular" },
  servingPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
  },
  servingPillText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  foodCal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#00000088",
    justifyContent: "flex-end",
  },
  modalCard: {
    margin: 12,
    borderRadius: 20,
    padding: 20,
    gap: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  servingBadge: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    overflow: "hidden",
  },
  servingToggleRow: {
    flexDirection: "row",
    alignSelf: "flex-start",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  servingToggleOption: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  servingToggleText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  gramsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  gramsHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  gramsPreview: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
    marginBottom: 4,
  },
  editFieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 2,
  },
  editFoodNameLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  editRefLine: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  macroCalHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 6,
    marginBottom: 2,
  },
  servingsLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  servingsControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  servingsBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  servingsValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    minWidth: 28,
    textAlign: "center",
  },
  gramsInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gramsInput: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    width: 80,
    textAlign: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  gramsUnit: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  gramsHintCentered: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  gramsLastUsedHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    textAlign: "right",
  },
  macrosFromMemoryHint: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  macrosFromMemoryHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  macroDefaultsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  macroDefaultsFoodName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  macroDefaultsMacroLine: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  macroDefaultsDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  macroDefaultsClearAllBtn: {
    alignSelf: "center",
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalNutrients: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nutrientChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    minWidth: 72,
  },
  nutrientChipLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  nutrientChipValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  mealPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  mealPickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  mealPickerText: {
    fontSize: 13,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  modalConfirmBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  textInput: {
    height: 46,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  macroInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  macroInputItem: { flex: 1, gap: 6 },
  macroInputLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  macroInputField: { height: 40 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterScroll: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 4,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
  },
  filterCountBadge: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  filterClearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    flexShrink: 0,
  },
  filterClearText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  filterActions: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
    flexShrink: 0,
  },
  filterHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 4,
    opacity: 0.75,
  },
  presetNudgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  presetNudgeText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  presetLongPressHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingBottom: 4,
    opacity: 0.7,
  },
  filterCombinedSummary: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 2,
    opacity: 0.9,
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  resultsCount: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  starBtn: {
    padding: 2,
  },
  favHighlightWrapper: {
    borderRadius: 14,
    marginBottom: 0,
  },
  dragHandle: {
    padding: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reorderDoneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  reorderDoneText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  reorderHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  reorderHintBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  reorderHintBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  tabSwitcher: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tabBtnText: {
    fontSize: 13,
  },
  historyFilterBar: {
    marginBottom: 12,
  },
  historyFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  historyFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  historyFilterChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  historyFilterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  historyFilterDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(128,128,128,0.25)",
    marginHorizontal: 2,
  },
  historyResultCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  historyEmpty: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  historyEmptyTitle: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  historyEmptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 240,
  },
  trendChartCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  trendChartHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 4,
  },
  trendChartTitle: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  trendChartSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  trendMetricRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  trendMetricPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  trendMetricPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  weeklyAvgCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  weeklyAvgHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 4,
  },
  weeklyAvgTitle: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  weeklyAvgSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  weeklyAvgCalRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
  },
  weeklyAvgCalBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  weeklyAvgCalText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  weeklyAvgMacroRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  historyDay: {
    gap: 0,
    borderRadius: 14,
    overflow: "hidden",
  },
  historyDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyDayHeaderLeft: {
    gap: 1,
  },
  historyDayHeaderRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  historyDayLabel: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  historyDayDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  backToChartBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  backToChartBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  allGoalsMetBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  allGoalsMetText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  historyDayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  historyDayBadgeTappable: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyDayBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  breakdownSheetCard: {
    maxHeight: "80%",
    gap: 0,
    paddingBottom: 0,
  },
  breakdownSheetHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  breakdownSheetSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  breakdownCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  breakdownScrollView: {
    flexShrink: 1,
  },
  breakdownScrollContent: {
    gap: 10,
    paddingBottom: 14,
  },
  breakdownMealSection: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  breakdownMealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  breakdownMealTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  breakdownMealCal: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  breakdownMacroRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  breakdownMacroItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  breakdownMacroDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    marginHorizontal: 4,
  },
  breakdownMacroValue: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  breakdownMacroLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  breakdownMiniBarTrack: {
    flexDirection: "row",
    height: 4,
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 2,
    overflow: "hidden",
  },
  breakdownBarTooltip: {
    position: "absolute",
    bottom: "100%",
    alignSelf: "center",
    left: 12,
    right: 12,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 6,
    alignItems: "center",
    zIndex: 100,
  },
  breakdownBarTooltipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.1,
  },
  breakdownBarTooltipArrow: {
    position: "absolute",
    bottom: -5,
    alignSelf: "center",
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  breakdownMiniBarFill: {
    flexDirection: "row",
    overflow: "hidden",
  },
  breakdownMiniBarSegment: {
    height: 4,
  },
  breakdownFoodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  breakdownFoodName: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  breakdownFoodMacros: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  breakdownFoodCal: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 60,
    textAlign: "right",
  },
  breakdownReAddBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  breakdownReAddBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownReAddBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 16,
  },
  breakdownTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  breakdownTotalLabel: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  breakdownTotalRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  breakdownTotalMacros: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  breakdownTotalCal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  breakdownDoneBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
  },
  breakdownDoneBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  historyMacroRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyMacroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  historyMacroChipLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  historyMacroChipValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  historyMacroChipBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  historyMacroChipBarFill: {
    height: 4,
    borderRadius: 2,
  },
  historyMacroChipLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  historyMacroBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  historyMacroBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
  historyMealSection: {
    gap: 0,
  },
  historyMealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  historyMealTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  historyFoodRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  historyFoodInfo: {
    flex: 1,
    gap: 2,
  },
  historyFoodName: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  historyFoodMacros: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  historyFoodRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyFoodActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  historyFoodAddBtn: {
    padding: 2,
  },
  historyFoodCal: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  thresholdModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  thresholdModalDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  thresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 14,
  },
  thresholdStepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 36,
    alignItems: "center",
  },
  thresholdStepBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  thresholdValueContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  thresholdValueInput: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    width: 72,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  thresholdUnit: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  thresholdPreview: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 10,
  },
  thresholdRestoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
  },
  thresholdRestoreBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  undoToast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: 8,
    overflow: "hidden",
  },
  undoProgressBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 3,
    opacity: 0.5,
  },
  undoToastText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  undoBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  undoBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  undoCountdownText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 16,
    textAlign: "center",
  },
  starToast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  starToastText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    maxWidth: 180,
  },
  presetChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 7,
    flex: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },
  presetDeleteBtn: {
    paddingHorizontal: 7,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  presetChipsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  presetChipsLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  presetDragItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingRight: 12,
    marginBottom: 6,
  },
  macroAlertToast: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  macroAlertTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  macroAlertSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  previewSheetCard: {
    gap: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  previewSheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#88888855",
    marginBottom: 16,
  },
  previewSheetHeader: {
    gap: 8,
    marginBottom: 4,
  },
  previewSheetTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  previewSheetName: {
    flex: 1,
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 24,
  },
  previewSheetServingBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  previewSheetServingText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  previewSheetCalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginVertical: 16,
    justifyContent: "center",
  },
  previewSheetCalValue: {
    fontSize: 48,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 52,
  },
  previewSheetCalLabel: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    paddingBottom: 4,
  },
  previewSheetMacroBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
  },
  previewSheetMacroBarSegment: {
    height: "100%",
  },
  previewSheetMacroGrid: {
    flexDirection: "row",
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  previewSheetMacroCell: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  previewSheetMacroDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginVertical: 4,
  },
  previewSheetMacroValue: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  previewSheetMacroLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  previewSheetActions: {
    flexDirection: "row",
    gap: 10,
  },
  previewSheetStarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewSheetMoreBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  previewSheetStarLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  previewSheetLogBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
  },
  previewSheetLogLabel: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  drillDownBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drillDownSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 12,
  },
  drillDownHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  drillDownHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  drillDownIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  drillDownTitle: {
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  drillDownSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  drillDownBadgePill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  drillDownBadgePillText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  drillDownSectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  drillDownEmpty: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 12,
  },
  drillDownDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  drillDownDayDate: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  drillDownDayRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  drillDownDayBar: {
    width: 60,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  drillDownDayBarFill: {
    height: 5,
    borderRadius: 3,
  },
  drillDownDayValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 38,
    textAlign: "right",
  },
  drillDownDayPct: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    minWidth: 32,
    textAlign: "right",
  },
  drillDownDismiss: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  drillDownDismissText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  dateArrowBtn: {
    padding: 6,
    borderRadius: 8,
  },
  datePickerLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    flex: 1,
    textAlign: "center",
  },
});
