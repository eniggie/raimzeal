import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, MealLog, FavoriteFood } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";
import { ProgressRing } from "@/components/ProgressRing";
import { BarcodeScannerModal, ScannedFood } from "@/components/BarcodeScannerModal";

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

interface NutritionFilter {
  key: string;
  label: string;
  icon: IoniconsName;
  test: (item: ScannedFood) => boolean;
}

const NUTRITION_FILTERS: NutritionFilter[] = [
  {
    key: "high_protein",
    label: "High Protein",
    icon: "barbell-outline",
    test: (item) => item.protein >= 15,
  },
  {
    key: "low_calorie",
    label: "Low Calorie",
    icon: "flame-outline",
    test: (item) => item.calories <= 150,
  },
  {
    key: "low_fat",
    label: "Low Fat",
    icon: "water-outline",
    test: (item) => item.fat <= 5,
  },
  {
    key: "low_carb",
    label: "Low Carb",
    icon: "leaf-outline",
    test: (item) => item.carbs <= 10,
  },
];

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

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getTodayMeals, getTodayMacros, addMealLog, mealLogs, favoriteFoods, toggleFavoriteFood } = useFitness();

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

  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Omit<MealLog, "id" | "date"> | null>(null);
  const [selectedFoodServingLabel, setSelectedFoodServingLabel] = useState<string | undefined>(undefined);
  const [selectedFoodIsApiResult, setSelectedFoodIsApiResult] = useState(false);
  const [servings, setServings] = useState(1);
  const [selectedMeal, setSelectedMeal] = useState<MealType>("lunch");
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);
  const [manualMeal, setManualMeal] = useState<MealType>("snack");
  const [activeTab, setActiveTab] = useState<"today" | "history">("today");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodListItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

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
          NUTRITION_FILTERS.filter((f) => activeFilters.has(f.key)).every((f) =>
            f.test(item)
          )
        )
      : searchResults;

  const listData: FoodListItem[] = isSearching ? filteredSearchResults : QUICK_LIST;

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

  function handleAddFood(food: Omit<MealLog, "id" | "date">) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood(food);
    setSelectedFoodServingLabel(undefined);
    setSelectedFoodIsApiResult(false);
    setServings(1);
    setSelectedMeal(food.mealType);
    setShowModal(true);
  }

  function handleScannedFood(food: ScannedFood) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedFood({ ...food, mealType: "snack" });
    setSelectedFoodServingLabel(food.servingLabel);
    setSelectedFoodIsApiResult(true);
    setServings(1);
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
    const meal: MealLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      name,
      calories: Math.round(calories * servings),
      protein: Math.round(protein * servings * 10) / 10,
      carbs: Math.round(carbs * servings * 10) / 10,
      fat: Math.round(fat * servings * 10) / 10,
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
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
                    setActiveFilters(new Set());
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={17} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}
            </View>}

            {/* Filter chips — shown while searching on Today tab */}
            {activeTab === "today" && isSearching && (
              <View style={styles.filterRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterScroll}
                >
                  {NUTRITION_FILTERS.map((filter) => {
                    const active = activeFilters.has(filter.key);
                    return (
                      <TouchableOpacity
                        key={filter.key}
                        onPress={() => toggleFilter(filter.key)}
                        activeOpacity={0.75}
                        style={[
                          styles.filterChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.muted,
                            borderColor: active
                              ? colors.primary
                              : colors.border,
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
                          {filter.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

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
                        <NutritionRow key={log.id} log={log} />
                      ))}
                    </View>
                  );
                })}

                {favoriteFoods.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                      Favorites
                    </Text>
                    {favoriteFoods.map((food, idx) => (
                      <TouchableOpacity
                        key={`fav-${food.name}-${idx}`}
                        activeOpacity={0.8}
                        onPress={() => handleAddFood(food)}
                        style={[
                          styles.foodCard,
                          { backgroundColor: colors.card, borderColor: "#f59f0a40" },
                        ]}
                      >
                        <View
                          style={[
                            styles.foodIcon,
                            { backgroundColor: "#f59f0a20" },
                          ]}
                        >
                          <Ionicons
                            name="star"
                            size={18}
                            color="#f59f0a"
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
                          onPress={() => handleToggleFavorite(food)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.starBtn}
                        >
                          <Ionicons name="star" size={18} color="#f59f0a" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
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
                          onPress={() => handleToggleFavorite(food)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={styles.starBtn}
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
                {historyDays.length === 0 ? (
                  <View style={styles.historyEmpty}>
                    <Ionicons name="calendar-outline" size={44} color={colors.mutedForeground} />
                    <Text style={[styles.historyEmptyTitle, { color: colors.foreground }]}>
                      No past logs yet
                    </Text>
                    <Text style={[styles.historyEmptyText, { color: colors.mutedForeground }]}>
                      Meals you log will appear here day by day
                    </Text>
                  </View>
                ) : (
                  historyDays.map(({ date, logs, totals }) => {
                    const d = new Date(date + "T12:00:00");
                    const today = new Date();
                    const yesterday = new Date(Date.now() - 86400000);
                    const isYesterday = d.toDateString() === yesterday.toDateString();
                    const label = isYesterday
                      ? "Yesterday"
                      : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
                    return (
                      <View key={date} style={styles.historyDay}>
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
                          <HistoryMacroChip label="P" value={Math.round(totals.protein)} color={colors.secondary} />
                          <HistoryMacroChip label="C" value={Math.round(totals.carbs)} color={colors.warning} />
                          <HistoryMacroChip label="F" value={Math.round(totals.fat)} color={colors.accent} />
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
                                <TouchableOpacity
                                  key={log.id}
                                  activeOpacity={0.75}
                                  onPress={() => handleAddFood({ name: log.name, calories: log.calories, protein: log.protein, carbs: log.carbs, fat: log.fat, mealType: log.mealType })}
                                  style={[styles.historyFoodRow, { borderBottomColor: colors.border }]}
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
            {selectedFood && (
              <>
                <Text style={[styles.servingBadge, { color: colors.mutedForeground, backgroundColor: colors.muted }]}>
                  {selectedFoodServingLabel
                    ? `per ${selectedFoodServingLabel}`
                    : selectedFoodIsApiResult
                    ? "per 100g"
                    : "per serving"}
                </Text>
                <View style={styles.servingsRow}>
                  <Text style={[styles.servingsLabel, { color: colors.foreground }]}>Servings</Text>
                  <View style={styles.servingsControl}>
                    <TouchableOpacity
                      onPress={() => {
                        if (servings > 0.5) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setServings((s) => Math.max(0.5, Math.round((s - 0.5) * 10) / 10));
                        }
                      }}
                      style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="remove" size={16} color={servings <= 0.5 ? colors.mutedForeground : colors.foreground} />
                    </TouchableOpacity>
                    <Text style={[styles.servingsValue, { color: colors.foreground }]}>
                      {Number.isInteger(servings) ? servings : servings.toFixed(1)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setServings((s) => Math.round((s + 0.5) * 10) / 10);
                      }}
                      style={[styles.servingsBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="add" size={16} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.modalNutrients}>
                  <NutrientChip
                    label="Calories"
                    value={`${Math.round(selectedFood.calories * servings)}`}
                    color={colors.primary}
                  />
                  <NutrientChip
                    label="Protein"
                    value={`${Math.round(selectedFood.protein * servings * 10) / 10}g`}
                    color={colors.secondary}
                  />
                  <NutrientChip
                    label="Carbs"
                    value={`${Math.round(selectedFood.carbs * servings * 10) / 10}g`}
                    color={colors.warning}
                  />
                  <NutrientChip
                    label="Fat"
                    value={`${Math.round(selectedFood.fat * servings * 10) / 10}g`}
                    color={colors.accent}
                  />
                </View>
              </>
            )}
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
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>
                  Add Food
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>
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

function NutritionRow({ log }: { log: MealLog }) {
  const colors = useColors();
  const { removeMealLog } = useFitness();
  const swipeableRef = useRef<Swipeable>(null);

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
      <View style={[styles.nutritionRow, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Text style={[styles.nutritionName, { color: colors.foreground }]}>
          {log.name}
        </Text>
        <Text style={[styles.nutritionCal, { color: colors.primary }]}>
          {log.calories} kcal
        </Text>
      </View>
    </Swipeable>
  );
}

function HistoryMacroChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.historyMacroChip, { backgroundColor: color + "15", borderColor: color + "35" }]}>
      <Text style={[styles.historyMacroChipLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.historyMacroChipValue, { color }]}>{value}g</Text>
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
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingLeft: 16,
  },
  nutritionName: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1 },
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
    paddingVertical: 5,
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
});
