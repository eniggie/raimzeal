import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  LayoutAnimation,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, MealLog, FavoriteFood } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";
import { ProgressRing } from "@/components/ProgressRing";
import { BarcodeScannerModal, ScannedFood } from "@/components/BarcodeScannerModal";
import { CalorieTrendChart } from "@/components/CalorieTrendChart";

const CALORIE_GOAL = 2200;
const PROTEIN_GOAL = 150;
const CARBS_GOAL = 250;
const FAT_GOAL = 70;
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
  { name: "Protein Shake", calories: 180, protein: 25, carbs: 10, fat: 4, mealType: "breakfast" },
  { name: "Chicken Breast (150g)", calories: 248, protein: 46, carbs: 0, fat: 5, mealType: "lunch" },
  { name: "Brown Rice (1 cup)", calories: 215, protein: 5, carbs: 45, fat: 2, mealType: "lunch" },
  { name: "Greek Yogurt", calories: 130, protein: 17, carbs: 8, fat: 3, mealType: "snack" },
  { name: "Banana", calories: 89, protein: 1, carbs: 23, fat: 0, mealType: "snack" },
  { name: "Almonds (30g)", calories: 174, protein: 6, carbs: 6, fat: 15, mealType: "snack" },
  { name: "Oatmeal (1 cup)", calories: 147, protein: 5, carbs: 27, fat: 3, mealType: "breakfast" },
  { name: "Salmon Fillet (150g)", calories: 312, protein: 43, carbs: 0, fat: 15, mealType: "dinner" },
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
const FILTER_HINT_STORAGE_KEY = "@nutrition_filter_hint_dismissed";
const CUSTOM_PRESETS_STORAGE_KEY = "@nutrition_custom_filter_presets";

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

  return { name, calories, protein, carbs, fat, servingLabel };
}

type QuickItem = Omit<MealLog, "id" | "date"> & { _kind: "quick" };
type SearchItem = ScannedFood & { _kind: "search" };
type FoodListItem = QuickItem | SearchItem;

const QUICK_LIST: FoodListItem[] = QUICK_FOODS.map((f) => ({ ...f, _kind: "quick" }));

const DRAG_ITEM_HEIGHT = 68;

interface DraggableFavItemProps {
  food: FavoriteFood;
  indexRef: React.MutableRefObject<number>;
  listRef: React.MutableRefObject<FavoriteFood[]>;
  itemHeightRef: React.MutableRefObject<number>;
  isActive: boolean;
  isHover: boolean;
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
  onDragStart,
  onHover,
  onDrop,
  colors,
}: DraggableFavItemProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const currentDy = useRef(0);

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
        translateY.setValue(0);
        currentDy.current = 0;
        onDragStartRef.current(indexRef.current);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, { dy }) => {
        translateY.setValue(dy);
        currentDy.current = dy;
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_ITEM_HEIGHT;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(dy / slotHeight)));
        onHoverRef.current(to);
      },
      onPanResponderRelease: () => {
        const from = indexRef.current;
        const total = listRef.current.length;
        const slotHeight = itemHeightRef.current > 0 ? itemHeightRef.current : DRAG_ITEM_HEIGHT;
        const to = Math.max(0, Math.min(total - 1, from + Math.round(currentDy.current / slotHeight)));
        translateY.setValue(0);
        onDropRef.current(from, to);
      },
      onPanResponderTerminate: () => {
        translateY.setValue(0);
        onHoverRef.current(-1);
      },
    })
  ).current;

  return (
    <Animated.View
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
          transform: [{ translateY }],
          zIndex: isActive ? 100 : 1,
          elevation: isActive ? 8 : 0,
          shadowColor: "#000",
          shadowOpacity: isActive ? 0.18 : 0,
          shadowRadius: isActive ? 8 : 0,
          shadowOffset: { width: 0, height: 4 },
          opacity: isActive ? 0.92 : 1,
        },
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
      </View>
      <Text style={[styles.foodCal, { color: colors.primary }]}>{food.calories}</Text>
    </Animated.View>
  );
}

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getTodayMeals, getTodayMacros, addMealLog, removeMealLog, mealLogs, favoriteFoods, toggleFavoriteFood, reorderFavoriteFoods } = useFitness();

  const isFavorite = useCallback(
    (name: string) => favoriteFoods.some((f) => f.name === name),
    [favoriteFoods]
  );

  function handleToggleFavorite(food: FavoriteFood) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavoriteFood(food);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const todayMeals = getTodayMeals();
  const { calories, protein, carbs, fat } = getTodayMacros();

  const recentFoods = React.useMemo(() => {
    const favoriteNames = new Set(favoriteFoods.map((f) => f.name));
    const seen = new Set<string>();
    const result: Omit<MealLog, "id" | "date">[] = [];
    for (const log of mealLogs) {
      if (!seen.has(log.name) && !favoriteNames.has(log.name)) {
        seen.add(log.name);
        result.push({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType });
      }
      if (result.length >= 5) break;
    }
    return result;
  }, [mealLogs, favoriteFoods]);

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

  type HistoryDateRange = "7d" | "30d" | "all";
  type HistoryMealFilter = MealType | "all";

  const [historyDateRange, setHistoryDateRange] = useState<HistoryDateRange>("all");
  const [historyMealFilter, setHistoryMealFilter] = useState<HistoryMealFilter>("all");

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
  }, [historyDays, historyDateRange, historyMealFilter]);

  const [highlightedDate, setHighlightedDate] = useState<string | null>(null);

  const trendChartDays = React.useMemo(() => {
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MAX_DAYS = 14;
    const recent = historyDays.slice(0, MAX_DAYS).reverse();
    return recent.map(({ date, totals }) => {
      const d = new Date(date + "T12:00:00");
      return {
        date,
        calories: Math.round(totals.calories),
        label: DAY_LABELS[d.getDay()],
      };
    });
  }, [historyDays]);

  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Omit<MealLog, "id" | "date"> | null>(null);
  const [selectedFoodServingLabel, setSelectedFoodServingLabel] = useState<string | undefined>(undefined);
  const [selectedFoodIsApiResult, setSelectedFoodIsApiResult] = useState(false);
  const [servings, setServings] = useState(1);
  const [servingsText, setServingsText] = useState("1");
  const [grams, setGrams] = useState("100");
  const [selectedMeal, setSelectedMeal] = useState<MealType>("lunch");
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);
  const [manualMeal, setManualMeal] = useState<MealType>("snack");
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const [filterThresholds, setFilterThresholds] = useState<FilterThresholds>(getDefaultThresholds);
  const [thresholdEditKey, setThresholdEditKey] = useState<string | null>(null);
  const [thresholdEditValue, setThresholdEditValue] = useState<string>("");

  const [isReordering, setIsReordering] = useState(false);
  const [reorderItems, setReorderItems] = useState<FavoriteFood[]>([]);
  const reorderItemsRef = useRef<FavoriteFood[]>([]);
  const [activeReorderIdx, setActiveReorderIdx] = useState(-1);
  const [hoverReorderIdx, setHoverReorderIdx] = useState(-1);
  const indexRefsRef = useRef<React.MutableRefObject<number>[]>([]);
  const itemHeightRef = useRef(DRAG_ITEM_HEIGHT);

  const [undoMeal, setUndoMeal] = useState<MealLog | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoAnim = useRef(new Animated.Value(0)).current;

  const [customPresets, setCustomPresets] = useState<CustomFilterPreset[]>([]);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");

  const [filterHintVisible, setFilterHintVisible] = useState(false);
  const filterHintShownRef = useRef(false);
  const filterHintDismissedRef = useRef(false);
  const filterHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function dismissFilterHint() {
    if (filterHintTimerRef.current) {
      clearTimeout(filterHintTimerRef.current);
      filterHintTimerRef.current = null;
    }
    filterHintDismissedRef.current = true;
    setFilterHintVisible(false);
    AsyncStorage.setItem(FILTER_HINT_STORAGE_KEY, "1").catch(() => {});
  }

  useEffect(() => {
    return () => {
      if (filterHintTimerRef.current) clearTimeout(filterHintTimerRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  function showUndoToast(meal: MealLog) {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoMeal(meal);
    Animated.spring(undoAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
    undoTimerRef.current = setTimeout(() => {
      dismissUndoToast();
    }, 3000);
  }

  function dismissUndoToast() {
    Animated.timing(undoAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setUndoMeal(null);
    });
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  function handleUndoDelete() {
    if (!undoMeal) return;
    dismissUndoToast();
    addMealLog(undoMeal);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleMealDelete(meal: MealLog) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    removeMealLog(meal.id);
    showUndoToast(meal);
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
  }

  function deleteCustomPreset(id: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = customPresets.filter((p) => p.id !== id);
    setCustomPresets(next);
    AsyncStorage.setItem(CUSTOM_PRESETS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  function applyPreset(preset: CustomFilterPreset) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const validKeys = new Set(FILTER_DEFS.map((d) => d.key));
    const keys = preset.filterKeys.filter((k) => validKeys.has(k));
    setActiveFilters(new Set(keys));
  }

  function openSavePresetModal() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissFilterHint();
    setSavePresetName("");
    setShowSavePresetModal(true);
  }

  const nutritionFilters = React.useMemo(() => buildFilters(filterThresholds), [filterThresholds]);

  function openThresholdEdit(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    dismissFilterHint();
    const def = FILTER_DEFS.find((d) => d.key === key);
    const current = filterThresholds[key] ?? def?.defaultThreshold ?? 0;
    setThresholdEditKey(key);
    setThresholdEditValue(String(current));
  }

  function saveThreshold() {
    if (!thresholdEditKey) return;
    const parsed = parseInt(thresholdEditValue, 10);
    if (isNaN(parsed) || parsed < 0) return;
    const next = { ...filterThresholds, [thresholdEditKey]: parsed };
    setFilterThresholds(next);
    AsyncStorage.setItem(THRESHOLDS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setThresholdEditKey(null);
  }

  function adjustThreshold(delta: number) {
    const parsed = parseInt(thresholdEditValue, 10) || 0;
    const next = Math.max(0, parsed + delta);
    setThresholdEditValue(String(next));
  }

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const listData: FoodListItem[] = isSearching ? filteredSearchResults : QUICK_LIST;

  useEffect(() => {
    if (activeTab !== "today" || !isSearching) return;
    if (filterHintShownRef.current) return;
    filterHintShownRef.current = true;
    AsyncStorage.getItem(FILTER_HINT_STORAGE_KEY).then((val) => {
      if (val) return;
      if (filterHintDismissedRef.current) return;
      setFilterHintVisible(true);
      filterHintTimerRef.current = setTimeout(() => {
        filterHintTimerRef.current = null;
        setFilterHintVisible(false);
        AsyncStorage.setItem(FILTER_HINT_STORAGE_KEY, "1").catch(() => {});
      }, 4000);
    }).catch(() => {});
  }, [activeTab, isSearching]);

  function toggleFilter(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    setActiveFilters(new Set());
  }

  const hasCustomThresholds = React.useMemo(() => {
    return FILTER_DEFS.some((def) => filterThresholds[def.key] !== def.defaultThreshold);
  }, [filterThresholds]);

  function resetAllThresholds() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const defaults = getDefaultThresholds();
    setFilterThresholds(defaults);
    AsyncStorage.removeItem(THRESHOLDS_STORAGE_KEY).catch(() => {});
  }

  function enterReorderMode() {
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
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = [...reorderItemsRef.current];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    next.forEach((_, i) => {
      if (indexRefsRef.current[i]) indexRefsRef.current[i].current = i;
    });
    reorderItemsRef.current = next;
    setReorderItems(next);
    reorderFavoriteFoods(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  function handleAddFood(food: Omit<MealLog, "id" | "date">) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood(food);
    setSelectedFoodServingLabel(undefined);
    setSelectedFoodIsApiResult(false);
    setServings(1);
    setServingsText("1");
    setSelectedMeal(food.mealType);
    setShowModal(true);
  }

  function handleScannedFood(food: ScannedFood) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedFood({ ...food, mealType: "snack" });
    setSelectedFoodServingLabel(food.servingLabel);
    setSelectedFoodIsApiResult(true);
    setServings(1);
    setServingsText("1");
    setGrams("100");
    setSelectedMeal("snack");
    setShowModal(true);
  }

  function handleManualEntry() {
    setManualForm(EMPTY_MANUAL);
    setManualMeal("snack");
    setShowManualEntry(true);
  }

  function handleConfirmLog() {
    if (!selectedFood) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const { name, calories, protein, carbs, fat } = selectedFood;
    const isGramsMode = selectedFoodIsApiResult && !selectedFoodServingLabel;
    const factor = isGramsMode ? (parseFloat(grams) || 0) / 100 : servings;
    const meal: MealLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      name,
      calories: Math.round(calories * factor),
      protein: Math.round(protein * factor * 10) / 10,
      carbs: Math.round(carbs * factor * 10) / 10,
      fat: Math.round(fat * factor * 10) / 10,
      mealType: selectedMeal,
    };
    addMealLog(meal);
    setShowModal(false);
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
    addMealLog(meal);
    setShowManualEntry(false);
  }

  const flatListRef = useRef<FlatList<FoodListItem>>(null);

  function handleChartBarPress(date: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHighlightedDate((prev) => (prev === date ? null : date));
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={activeTab === "today" ? listData : []}
        keyExtractor={(item, i) => `${item._kind}-${item.name}-${i}`}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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

            {/* Filter chips — shown while searching on Today tab */}
            {activeTab === "today" && isSearching && (
              <View style={{ gap: 8 }}>
                {/* Custom preset chips row */}
                {customPresets.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.filterScroll, { paddingVertical: 2 }]}
                  >
                    {customPresets.map((preset) => (
                      <View
                        key={preset.id}
                        style={[
                          styles.presetChip,
                          { backgroundColor: colors.secondary + "18", borderColor: colors.secondary + "55" },
                        ]}
                      >
                        <TouchableOpacity
                          onPress={() => applyPreset(preset)}
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
                      </View>
                    ))}
                  </ScrollView>
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
                      return (
                        <TouchableOpacity
                          key={filter.key}
                          onPress={() => !isZeroCount && toggleFilter(filter.key)}
                          onLongPress={() => {
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
                            },
                          ]}
                        >
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
                      );
                    })}
                  </ScrollView>

                  <View style={styles.filterActions}>
                    {activeFilters.size >= 1 && (
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
                    )}
                    {hasCustomThresholds && (
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
                    )}
                    {activeFilters.size > 0 && (
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
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Combined filter summary — shown below chips when 2+ filters are active */}
            {activeTab === "today" && isSearching && activeFilters.size >= 2 && !searchLoading && searchDone && (
              <Text style={[styles.filterCombinedSummary, { color: colors.primary }]}>
                {(() => {
                  const count = filteredSearchResults.length;
                  const labels = nutritionFilters
                    .filter((f) => activeFilters.has(f.key))
                    .map((f) => f.label);
                  const labelText =
                    labels.length === 2
                      ? `${labels[0]} + ${labels[1]}`
                      : `all ${labels.length} filters`;
                  return `${count} ${count === 1 ? "result" : "results"} match ${labelText}`;
                })()}
              </Text>
            )}

            {/* Long-press hint — shown once below filter chips */}
            {activeTab === "today" && isSearching && filterHintVisible && (
              <Text style={[styles.filterHintText, { color: colors.mutedForeground }]}>
                Long-press an active chip to save as preset · long-press an inactive chip to adjust its threshold
              </Text>
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
                  <View style={styles.macroRow}>
                    <ProgressRing
                      progress={calories / CALORIE_GOAL}
                      size={90}
                      strokeWidth={8}
                      color={colors.primary}
                      label={calories.toString()}
                      sublabel="kcal"
                    />
                    <View style={styles.macros}>
                      <MacroBar
                        label="Protein"
                        value={Math.round(protein)}
                        goal={PROTEIN_GOAL}
                        color={colors.secondary}
                      />
                      <MacroBar
                        label="Carbs"
                        value={Math.round(carbs)}
                        goal={CARBS_GOAL}
                        color={colors.warning}
                      />
                      <MacroBar
                        label="Fat"
                        value={Math.round(fat)}
                        goal={FAT_GOAL}
                        color={colors.accent}
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
                        <NutritionRow key={log.id} log={log} onDelete={handleMealDelete} />
                      ))}
                    </View>
                  );
                })}

                {favoriteFoods.length > 0 && (
                  <>
                    <View style={styles.sectionHeaderRow}>
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
                    {isReordering ? (
                      reorderItems.map((food, idx) => (
                        <DraggableFavItem
                          key={`drag-${food.name}-${idx}`}
                          food={food}
                          indexRef={indexRefsRef.current[idx] ?? { current: idx }}
                          listRef={reorderItemsRef}
                          itemHeightRef={itemHeightRef}
                          isActive={idx === activeReorderIdx}
                          isHover={idx === hoverReorderIdx && idx !== activeReorderIdx}
                          onDragStart={(i) => { setActiveReorderIdx(i); setHoverReorderIdx(i); }}
                          onHover={setHoverReorderIdx}
                          onDrop={handleReorderDrop}
                          colors={colors}
                        />
                      ))
                    ) : (
                      favoriteFoods.map((food, idx) => (
                        <TouchableOpacity
                          key={`fav-${food.name}-${idx}`}
                          activeOpacity={0.8}
                          onPress={() => handleAddFood(food)}
                          onLongPress={favoriteFoods.length > 1 ? enterReorderMode : undefined}
                          delayLongPress={500}
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
                      ))
                    )}
                  </>
                )}

                {recentFoods.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Recent Foods
                    </Text>
                    {recentFoods.map((food, idx) => (
                      <TouchableOpacity
                        key={`recent-${food.name}-${idx}`}
                        activeOpacity={0.8}
                        onPress={() => handleAddFood(food)}
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
                          <Text style={[styles.foodName, { color: colors.foreground }]} numberOfLines={1}>
                            {food.name}
                          </Text>
                          <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                            P {food.protein}g · C {food.carbs}g · F {food.fat}g
                          </Text>
                        </View>
                        <Text style={[styles.foodCal, { color: colors.primary }]}>
                          {food.calories}
                        </Text>
                        <TouchableOpacity
                          onPress={isReordering ? undefined : () => handleToggleFavorite(food)}
                          disabled={isReordering}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={[styles.starBtn, isReordering && { opacity: 0.35 }]}
                        >
                          <Ionicons
                            name={isFavorite(food.name) ? "star" : "star-outline"}
                            size={18}
                            color={isFavorite(food.name) ? "#f59f0a" : colors.mutedForeground}
                          />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Quick Add
                </Text>
              </>
            )}

            {/* History view — shown when History tab is active */}
            {activeTab === "history" && (
              <>
                {/* Filter bar */}
                <View style={styles.historyFilterBar}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.historyFilterRow}
                  >
                    {(["all", "7d", "30d"] as const).map((range) => {
                      const label = range === "all" ? "All time" : range === "7d" ? "Last 7 days" : "Last 30 days";
                      const active = historyDateRange === range;
                      return (
                        <TouchableOpacity
                          key={range}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                    })}

                    <View style={styles.historyFilterDivider} />

                    {(["all", ...MEALS] as const).map((meal) => {
                      const label = meal === "all" ? "All meals" : meal.charAt(0).toUpperCase() + meal.slice(1);
                      const active = historyMealFilter === meal;
                      const dotColor = meal !== "all" ? MEAL_COLORS[meal as MealType] : colors.primary;
                      return (
                        <TouchableOpacity
                          key={`meal-${meal}`}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
                      );
                    })}
                  </ScrollView>
                </View>

                {/* Calorie trend chart */}
                {trendChartDays.length > 0 && (
                  <View
                    style={[
                      styles.trendChartCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <View style={styles.trendChartHeader}>
                      <Text style={[styles.trendChartTitle, { color: colors.foreground }]}>
                        Calorie Trend
                      </Text>
                      <Text style={[styles.trendChartSubtitle, { color: colors.mutedForeground }]}>
                        Last {trendChartDays.length} day{trendChartDays.length !== 1 ? "s" : ""}
                        {highlightedDate ? " · tap again to clear" : " · tap a bar to highlight"}
                      </Text>
                    </View>
                    <CalorieTrendChart
                      days={trendChartDays}
                      goalCalories={CALORIE_GOAL}
                      highlightedDate={highlightedDate}
                      onBarPress={handleChartBarPress}
                      colors={colors}
                    />
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
                    return (
                      <View
                        key={date}
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
                          </View>
                          <View style={[styles.historyDayBadge, { backgroundColor: colors.primary + "18" }]}>
                            <Text style={[styles.historyDayBadgeText, { color: colors.primary }]}>
                              {Math.round(totals.calories)} kcal
                            </Text>
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
                                  onAddFood={() => handleAddFood({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType })}
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
            const favFood: FavoriteFood = { name: item.name, calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat, mealType: "snack" };
            const starred = isFavorite(item.name);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => handleScannedFood(item)}
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
                    P {item.protein}g · C {item.carbs}g · F {item.fat}g
                  </Text>
                  <View style={[styles.servingPill, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.servingPillText, { color: colors.primary }]}>
                      per {item.servingLabel ?? "100g"}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.foodCal, { color: colors.primary }]}>
                  {item.calories}
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
              onPress={() => handleAddFood(item)}
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
              <View style={styles.foodInfo}>
                <Text style={[styles.foodName, { color: colors.foreground }]}>
                  {item.name}
                </Text>
                <Text style={[styles.foodMacros, { color: colors.mutedForeground }]}>
                  P {item.protein}g · C {item.carbs}g · F {item.fat}g
                </Text>
                <View style={[styles.servingPill, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.servingPillText, { color: colors.primary }]}>
                    per serving
                  </Text>
                </View>
              </View>
              <Text style={[styles.foodCal, { color: colors.primary }]}>
                {item.calories}
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
        }}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onFoodFound={handleScannedFood}
        onManualEntry={() => {
          setShowScanner(false);
          handleManualEntry();
        }}
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
              onChangeText={(v) => setManualForm((f) => ({ ...f, name: v }))}
              style={[
                styles.textInput,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            />

            <View style={styles.macroInputRow}>
              <MacroInput
                label="Calories"
                value={manualForm.calories}
                onChangeText={(v) => setManualForm((f) => ({ ...f, calories: v }))}
                colors={colors}
              />
              <MacroInput
                label="Protein (g)"
                value={manualForm.protein}
                onChangeText={(v) => setManualForm((f) => ({ ...f, protein: v }))}
                colors={colors}
              />
            </View>
            <View style={styles.macroInputRow}>
              <MacroInput
                label="Carbs (g)"
                value={manualForm.carbs}
                onChangeText={(v) => setManualForm((f) => ({ ...f, carbs: v }))}
                colors={colors}
              />
              <MacroInput
                label="Fat (g)"
                value={manualForm.fat}
                onChangeText={(v) => setManualForm((f) => ({ ...f, fat: v }))}
                colors={colors}
              />
            </View>

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

      {/* Filter Threshold Edit Modal */}
      <Modal
        visible={thresholdEditKey !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setThresholdEditKey(null)}
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

                  <View style={styles.modalBtns}>
                    <TouchableOpacity
                      onPress={() => {
                        const def2 = FILTER_DEFS.find((d) => d.key === thresholdEditKey);
                        if (def2) {
                          setThresholdEditValue(String(def2.defaultThreshold));
                        }
                      }}
                      style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                        Reset
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
        onRequestClose={() => setShowModal(false)}
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
              const isGramsMode = selectedFoodIsApiResult && !selectedFoodServingLabel;
              const factor = isGramsMode ? (parseFloat(grams) || 0) / 100 : servings;
              return (
                <>
                  <Text style={[styles.servingBadge, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
                    {selectedFoodServingLabel
                      ? `per ${selectedFoodServingLabel}`
                      : selectedFoodIsApiResult
                      ? "per 100g"
                      : "per serving"}
                  </Text>
                  {isGramsMode ? (
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
                    </View>
                  ) : (
                    <View style={styles.servingsRow}>
                      <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Servings</Text>
                      <View style={styles.servingsControl}>
                        <TouchableOpacity
                          onPress={() => {
                            if (servings > 0.5) {
                              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setServings((s) => {
                                const next = Math.max(0.5, Math.round((s - 0.5) * 10) / 10);
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
                          }}
                          onBlur={() => {
                            const n = parseFloat(servingsText);
                            const valid = !isNaN(n) && n > 0 ? Math.max(0.5, n) : 1;
                            setServings(valid);
                            setServingsText(String(valid));
                          }}
                          keyboardType="decimal-pad"
                          selectTextOnFocus
                          returnKeyType="done"
                          maxLength={7}
                        />
                        <TouchableOpacity
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setServings((s) => {
                              const next = Math.round((s + 0.5) * 10) / 10;
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
                    </View>
                  )}
                  <View style={styles.modalNutrients}>
                    <NutrientChip
                      label="Calories"
                      value={`${Math.round(selectedFood.calories * factor)}`}
                      color={colors.primary}
                    />
                    <NutrientChip
                      label="Protein"
                      value={`${Math.round(selectedFood.protein * factor * 10) / 10}g`}
                      color={colors.secondary}
                    />
                    <NutrientChip
                      label="Carbs"
                      value={`${Math.round(selectedFood.carbs * factor * 10) / 10}g`}
                      color={colors.warning}
                    />
                    <NutrientChip
                      label="Fat"
                      value={`${Math.round(selectedFood.fat * factor * 10) / 10}g`}
                      color={colors.accent}
                    />
                  </View>
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
                onPress={() => setShowModal(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmLog}
                disabled={selectedFoodIsApiResult && !selectedFoodServingLabel && !(parseFloat(grams) > 0)}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor:
                      selectedFoodIsApiResult && !selectedFoodServingLabel && !(parseFloat(grams) > 0)
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
                        selectedFoodIsApiResult && !selectedFoodServingLabel && !(parseFloat(grams) > 0)
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

      {undoMeal !== null && (
        <Animated.View
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
          <Text style={[styles.undoToastText, { color: colors.foreground }]} numberOfLines={1}>
            "{undoMeal.name}" deleted
          </Text>
          <TouchableOpacity
            onPress={handleUndoDelete}
            activeOpacity={0.75}
            style={[styles.undoBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.undoBtnText, { color: colors.primaryForeground }]}>Undo</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const colors = useColors();
  const fillRatio = Math.min(1, Math.max(0, value / goal));
  return (
    <View style={styles.macroBarContainer}>
      <View style={styles.macroBarHeader}>
        <Text style={[styles.macroBarLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text style={[styles.macroBarValue, { color: colors.foreground }]}>
          {value}/{goal}g
        </Text>
      </View>
      <View style={[styles.macroTrack, { backgroundColor: colors.muted }]}>
        <View style={styles.macroFlex}>
          <View style={[styles.macroFill, { flex: fillRatio, backgroundColor: color }]} />
          <View style={{ flex: 1 - fillRatio }} />
        </View>
      </View>
    </View>
  );
}

function HistoryFoodRow({ log, onAddFood }: { log: MealLog; onAddFood: () => void }) {
  const colors = useColors();
  const { removeMealLog } = useFitness();
  const swipeableRef = useRef<Swipeable>(null);

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    Alert.alert(
      "Delete meal?",
      `Remove "${log.name}" from this day's log?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            removeMealLog(log.id);
          },
        },
      ]
    );
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
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={60}
      overshootRight={false}
    >
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onAddFood}
        style={[styles.historyFoodRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}
      >
        <View style={styles.historyFoodInfo}>
          <Text style={[styles.historyFoodName, { color: colors.foreground }]} numberOfLines={1}>
            {log.name}
          </Text>
          <Text style={[styles.historyFoodMacros, { color: colors.mutedForeground }]}>
            P {log.protein}g · C {log.carbs}g · F {log.fat}g
          </Text>
        </View>
        <View style={styles.historyFoodRight}>
          <Text style={[styles.historyFoodCal, { color: colors.primary }]}>
            {log.calories}
          </Text>
          <Ionicons name="add-circle-outline" size={18} color={colors.mutedForeground} />
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

function NutritionRow({ log, onDelete }: { log: MealLog; onDelete: (meal: MealLog) => void }) {
  const colors = useColors();
  const { updateMealLog, toggleFavoriteFood, favoriteFoods } = useFitness();
  const starred = favoriteFoods.some((f) => f.name === log.name);
  const swipeableRef = useRef<Swipeable>(null);

  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editForm, setEditForm] = useState<ManualForm>({
    name: log.name,
    calories: String(log.calories),
    protein: String(log.protein),
    carbs: String(log.carbs),
    fat: String(log.fat),
  });
  const [editMealType, setEditMealType] = useState<MealType>(log.mealType);

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
    setShowEditSheet(true);
  }

  function handleSaveEdit() {
    const name = editForm.name.trim();
    if (!name) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateMealLog(log.id, {
      name,
      calories: parseInt(editForm.calories, 10) || 0,
      protein: parseFloat(editForm.protein) || 0,
      carbs: parseFloat(editForm.carbs) || 0,
      fat: parseFloat(editForm.fat) || 0,
      mealType: editMealType,
    });
    setShowEditSheet(false);
  }

  function handleDelete() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    swipeableRef.current?.close();
    Alert.alert(
      "Delete meal?",
      `Remove "${log.name}" from today's log?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(log),
        },
      ]
    );
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
      >
        <View style={[styles.nutritionRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={openEditSheet}
            activeOpacity={0.7}
            style={styles.nutritionRowMain}
          >
            <View style={styles.nutritionRowInfo}>
              <Text style={[styles.nutritionName, { color: colors.foreground }]}>
                {log.name}
              </Text>
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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              toggleFavoriteFood({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType });
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

            <TextInput
              placeholder="Food name"
              placeholderTextColor={colors.mutedForeground}
              value={editForm.name}
              onChangeText={(v) => setEditForm((f) => ({ ...f, name: v }))}
              style={[
                styles.textInput,
                { color: colors.foreground, backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            />

            <View style={styles.macroInputRow}>
              <MacroInput
                label="Calories"
                value={editForm.calories}
                onChangeText={(v) => setEditForm((f) => ({ ...f, calories: v }))}
                colors={colors}
              />
              <MacroInput
                label="Protein (g)"
                value={editForm.protein}
                onChangeText={(v) => setEditForm((f) => ({ ...f, protein: v }))}
                colors={colors}
              />
            </View>
            <View style={styles.macroInputRow}>
              <MacroInput
                label="Carbs (g)"
                value={editForm.carbs}
                onChangeText={(v) => setEditForm((f) => ({ ...f, carbs: v }))}
                colors={colors}
              />
              <MacroInput
                label="Fat (g)"
                value={editForm.fat}
                onChangeText={(v) => setEditForm((f) => ({ ...f, fat: v }))}
                colors={colors}
              />
            </View>

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

            <View style={styles.modalBtns}>
              <TouchableOpacity
                onPress={() => setShowEditSheet(false)}
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={[
                  styles.modalConfirmBtn,
                  {
                    backgroundColor: editForm.name.trim()
                      ? colors.primary
                      : colors.muted,
                  },
                ]}
                disabled={!editForm.name.trim()}
              >
                <Text
                  style={[
                    styles.modalConfirmText,
                    {
                      color: editForm.name.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Save Changes
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

function HistoryMacroChip({
  label,
  value,
  goal,
  color,
}: {
  label: string;
  value: number;
  goal: number;
  color: string;
}) {
  const colors = useColors();
  const progress = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={[styles.historyMacroChip, { backgroundColor: color + "15", borderColor: color + "35" }]}>
      <Text style={[styles.historyMacroChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.historyMacroChipValue, { color }]}>
        {value}<Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>/{goal}g</Text>
      </Text>
      <View style={[styles.historyMacroChipBar, { backgroundColor: color + "30" }]}>
        <View style={[styles.historyMacroChipBarFill, { backgroundColor: color, width: `${Math.round(progress * 100)}%` as `${number}%` }]} />
      </View>
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
  macroRow: { flexDirection: "row", alignItems: "center", gap: 20 },
  macros: { flex: 1, gap: 10 },
  macroBarContainer: { gap: 4 },
  macroBarHeader: { flexDirection: "row", justifyContent: "space-between" },
  macroBarLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  macroBarValue: { fontSize: 11, fontFamily: "Inter_500Medium" },
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
  servingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  historyDayLabel: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  historyDayDate: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  historyDayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  historyDayBadgeText: {
    fontSize: 13,
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
    marginBottom: 18,
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
});
