import React, { useCallback, useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { GlassCard } from "@/components/GlassCard";
import { AnimatedPressable } from "@/components/AnimatedPressable";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "@raimzeal_meal_plan_v1";
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["Breakfast", "Lunch", "Dinner"] as const;
type MealType = typeof MEALS[number];

interface MealOption { name: string; calories: number; protein: number; prep: string; }
type WeekPlan = Record<string, Record<MealType, string>>;

const MEAL_LIBRARY: Record<MealType, MealOption[]> = {
  Breakfast: [
    { name: "Greek yogurt + berries + granola", calories: 380, protein: 22, prep: "2 min" },
    { name: "Scrambled eggs + avocado toast", calories: 420, protein: 26, prep: "8 min" },
    { name: "Protein smoothie (banana, oats, whey)", calories: 360, protein: 30, prep: "3 min" },
    { name: "Overnight oats + peanut butter", calories: 400, protein: 18, prep: "5 min" },
    { name: "Veggie omelette (3 eggs)", calories: 310, protein: 24, prep: "10 min" },
    { name: "Porridge + banana + honey", calories: 340, protein: 10, prep: "5 min" },
    { name: "Whole grain toast + smoked salmon", calories: 390, protein: 28, prep: "5 min" },
  ],
  Lunch: [
    { name: "Grilled chicken salad + quinoa", calories: 480, protein: 42, prep: "15 min" },
    { name: "Tuna & chickpea wrap", calories: 440, protein: 35, prep: "5 min" },
    { name: "Brown rice + stir-fried veg + tofu", calories: 420, protein: 22, prep: "15 min" },
    { name: "Turkey & avocado sandwich", calories: 460, protein: 36, prep: "5 min" },
    { name: "Lentil soup + bread roll", calories: 380, protein: 20, prep: "20 min" },
    { name: "Salmon & sweet potato bowl", calories: 520, protein: 38, prep: "20 min" },
    { name: "Greek salad + falafel wraps", calories: 400, protein: 18, prep: "10 min" },
  ],
  Dinner: [
    { name: "Lean beef stir-fry + brown rice", calories: 560, protein: 44, prep: "20 min" },
    { name: "Baked salmon + roasted veg", calories: 500, protein: 40, prep: "25 min" },
    { name: "Chicken breast + sweet potato + greens", calories: 520, protein: 46, prep: "25 min" },
    { name: "Turkey mince bolognese + pasta", calories: 580, protein: 42, prep: "25 min" },
    { name: "Prawn & vegetable curry + rice", calories: 500, protein: 34, prep: "25 min" },
    { name: "Black bean tacos + guacamole", calories: 460, protein: 22, prep: "15 min" },
    { name: "Lamb chops + roasted root veg", calories: 560, protein: 44, prep: "30 min" },
  ],
};

function generateWeekPlan(seed: number): WeekPlan {
  const plan: WeekPlan = {};
  DAYS.forEach((day, di) => {
    plan[day] = {} as Record<MealType, string>;
    MEALS.forEach((meal, mi) => {
      const options = MEAL_LIBRARY[meal];
      plan[day][meal] = options[(di * 3 + mi + seed) % options.length].name;
    });
  });
  return plan;
}

function buildGroceryList(plan: WeekPlan): string[] {
  const items = new Set<string>();
  const ingredientMap: Record<string, string[]> = {
    "Greek yogurt + berries + granola": ["Greek yogurt (1kg)", "Mixed berries", "Granola"],
    "Scrambled eggs + avocado toast": ["Eggs (12-pack)", "Avocados (4)", "Whole grain bread"],
    "Protein smoothie (banana, oats, whey)": ["Bananas (6)", "Rolled oats (500g)", "Whey protein powder"],
    "Overnight oats + peanut butter": ["Rolled oats (500g)", "Peanut butter (1 jar)", "Milk / plant milk"],
    "Veggie omelette (3 eggs)": ["Eggs (12-pack)", "Bell peppers", "Spinach", "Onions"],
    "Porridge + banana + honey": ["Rolled oats (500g)", "Bananas (6)", "Honey"],
    "Whole grain toast + smoked salmon": ["Whole grain bread", "Smoked salmon (200g)", "Cream cheese"],
    "Grilled chicken salad + quinoa": ["Chicken breasts (4)", "Quinoa (500g)", "Mixed salad leaves", "Cucumber", "Cherry tomatoes"],
    "Tuna & chickpea wrap": ["Canned tuna (4 tins)", "Chickpeas (2 tins)", "Whole wheat wraps", "Lettuce"],
    "Brown rice + stir-fried veg + tofu": ["Brown rice (1kg)", "Firm tofu (400g)", "Mixed stir-fry veg", "Soy sauce"],
    "Turkey & avocado sandwich": ["Turkey slices (200g)", "Avocados (4)", "Whole grain bread"],
    "Lentil soup + bread roll": ["Red lentils (500g)", "Vegetable stock", "Onions", "Carrots", "Celery", "Bread rolls"],
    "Salmon & sweet potato bowl": ["Salmon fillets (4)", "Sweet potatoes (1kg)", "Broccoli"],
    "Greek salad + falafel wraps": ["Falafel (box)", "Tomatoes", "Cucumber", "Feta cheese", "Olives", "Whole wheat wraps"],
    "Lean beef stir-fry + brown rice": ["Lean beef strips (500g)", "Brown rice (1kg)", "Mixed stir-fry veg", "Oyster sauce"],
    "Baked salmon + roasted veg": ["Salmon fillets (4)", "Mixed veg (courgette, peppers, onion)", "Olive oil"],
    "Chicken breast + sweet potato + greens": ["Chicken breasts (4)", "Sweet potatoes (1kg)", "Kale / broccoli"],
    "Turkey mince bolognese + pasta": ["Turkey mince (500g)", "Pasta (500g)", "Chopped tomatoes (2 tins)", "Garlic", "Onions"],
    "Prawn & vegetable curry + rice": ["King prawns (400g)", "Coconut milk (1 tin)", "Curry paste", "Basmati rice (500g)"],
    "Black bean tacos + guacamole": ["Black beans (2 tins)", "Corn tortillas", "Avocados (4)", "Lime", "Coriander"],
    "Lamb chops + roasted root veg": ["Lamb chops (4)", "Carrots", "Parsnips", "Sweet potato (1kg)"],
  };
  Object.values(plan).forEach((dayMeals) => {
    Object.values(dayMeals).forEach((mealName) => {
      (ingredientMap[mealName] ?? [mealName]).forEach((item) => items.add(item));
    });
  });
  return Array.from(items).sort();
}

export default function MealPlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [plan, setPlan] = useState<WeekPlan>(generateWeekPlan(0));
  const [activeTab, setActiveTab] = useState<"plan" | "grocery">("plan");
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [planSeed, setPlanSeed] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const data = JSON.parse(raw);
        setPlan(data.plan);
        setPlanSeed(data.seed ?? 0);
        setCheckedItems(new Set(data.checked ?? []));
      }
    });
  }, []);

  const handleRegenerate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSeed = planSeed + 1;
    const newPlan = generateWeekPlan(newSeed);
    setPlan(newPlan);
    setPlanSeed(newSeed);
    setCheckedItems(new Set());
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ plan: newPlan, seed: newSeed, checked: [] }));
  }, [planSeed]);

  const toggleChecked = useCallback(async (item: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = new Set(checkedItems);
    next.has(item) ? next.delete(item) : next.add(item);
    setCheckedItems(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ plan, seed: planSeed, checked: Array.from(next) }));
  }, [checkedItems, plan, planSeed]);

  const groceryList = buildGroceryList(plan);
  const dayMeals = plan[selectedDay] ?? {} as Record<MealType, string>;


  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 40 + 84 : 110 }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Weekly Meal Plan</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Reign · High-protein balanced plan</Text>
        </View>
        <TouchableOpacity
          onPress={handleRegenerate}
          style={[styles.regenBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.secondary} />
          <Text style={[styles.regenText, { color: colors.secondary }]}>New Plan</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Row */}
      <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
        {(["plan", "grocery"] as const).map((t) => {
          const active = activeTab === t;
          return (
            <TouchableOpacity key={t} onPress={() => { Haptics.selectionAsync(); setActiveTab(t); }}
              style={[styles.tabBtn, active && { backgroundColor: colors.card }]}>
              <Ionicons
                name={t === "plan" ? "calendar-outline" : "cart-outline"}
                size={15}
                color={active ? colors.secondary : colors.mutedForeground}
              />
              <Text style={[styles.tabLabel, { color: active ? colors.foreground : colors.mutedForeground, fontFamily: active ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                {t === "plan" ? "Meal Plan" : `Grocery List (${groceryList.length})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Meal Plan Tab */}
      {activeTab === "plan" && (
        <>
          {/* Day selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
            {DAYS.map((day) => {
              const active = selectedDay === day;
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => { Haptics.selectionAsync(); setSelectedDay(day); }}
                  style={[styles.dayBtn, { backgroundColor: active ? colors.secondary : colors.muted }]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayBtnText, { color: active ? colors.secondaryForeground : colors.mutedForeground }]}>{day}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <GlassCard style={styles.mealsCard}>
            <Text style={[styles.dayTitle, { color: colors.foreground }]}>{selectedDay}'s Meals</Text>
            {MEALS.map((meal, i) => {
              const mealName = dayMeals[meal] ?? "—";
              const option = MEAL_LIBRARY[meal].find((o) => o.name === mealName);
              const mealColors: Record<MealType, string> = { Breakfast: "#f59e0b", Lunch: "#10b981", Dinner: "#3b82f6" };
              const mealColor = mealColors[meal];
              return (
                <View key={meal} style={[styles.mealRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.mealTag, { backgroundColor: mealColor + "20" }]}>
                    <Text style={[styles.mealTagText, { color: mealColor }]}>{meal}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.mealName, { color: colors.foreground }]}>{mealName}</Text>
                    {option && (
                      <Text style={[styles.mealMacros, { color: colors.mutedForeground }]}>
                        {option.calories} kcal · {option.protein}g protein · {option.prep} prep
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            {(() => {
              const totalCal = MEALS.reduce((s, m) => {
                const opt = MEAL_LIBRARY[m].find((o) => o.name === dayMeals[m]);
                return s + (opt?.calories ?? 0);
              }, 0);
              const totalProt = MEALS.reduce((s, m) => {
                const opt = MEAL_LIBRARY[m].find((o) => o.name === dayMeals[m]);
                return s + (opt?.protein ?? 0);
              }, 0);
              return (
                <View style={[styles.dayTotals, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                  <Text style={[styles.dayTotalText, { color: colors.foreground }]}>Total: {totalCal} kcal · {totalProt}g protein</Text>
                </View>
              );
            })()}
          </GlassCard>
        </>
      )}

      {/* Grocery List Tab */}
      {activeTab === "grocery" && (
        <GlassCard style={styles.groceryCard}>
          <View style={styles.groceryHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Weekly Grocery List</Text>
            <Text style={[styles.groceryCount, { color: colors.mutedForeground }]}>
              {checkedItems.size}/{groceryList.length} done
            </Text>
          </View>
          <View style={[styles.groceryProgress, { backgroundColor: colors.muted }]}>
            <View style={[styles.groceryFill, { width: `${groceryList.length > 0 ? (checkedItems.size / groceryList.length) * 100 : 0}%`, backgroundColor: colors.secondary }]} />
          </View>
          {groceryList.map((item) => {
            const checked = checkedItems.has(item);
            return (
              <TouchableOpacity key={item} onPress={() => toggleChecked(item)} activeOpacity={0.75}
                style={[styles.groceryRow, { borderBottomColor: colors.border }]}>
                <View style={[styles.checkbox, {
                  backgroundColor: checked ? colors.secondary + "20" : "transparent",
                  borderColor: checked ? colors.secondary : colors.border,
                }]}>
                  {checked && <Ionicons name="checkmark" size={12} color={colors.secondary} />}
                </View>
                <Text style={[styles.groceryItem, { color: checked ? colors.mutedForeground : colors.foreground, textDecorationLine: checked ? "line-through" : "none" }]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  title: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  regenText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabRow: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 2 },
  tabBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 10 },
  tabLabel: { fontSize: 12 },
  dayRow: { gap: 8, paddingHorizontal: 2 },
  dayBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  dayBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  mealsCard: { gap: 0 },
  dayTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  mealRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12 },
  mealTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, minWidth: 80, alignItems: "center" },
  mealTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  mealName: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  mealMacros: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  dayTotals: { paddingVertical: 10, paddingHorizontal: 14, marginTop: 4 },
  dayTotalText: { fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  groceryCard: { gap: 0 },
  groceryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  groceryCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  groceryProgress: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 12 },
  groceryFill: { height: "100%", borderRadius: 2 },
  groceryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, borderBottomWidth: 0.5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  groceryItem: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  gateWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  gateSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  gateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
