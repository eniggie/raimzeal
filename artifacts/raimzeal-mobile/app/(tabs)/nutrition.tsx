import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, NutritionLog } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";
import { ProgressRing } from "@/components/ProgressRing";

const CALORIE_GOAL = 2200;
const PROTEIN_GOAL = 150;
const CARBS_GOAL = 250;
const FAT_GOAL = 70;

const QUICK_FOODS = [
  { name: "Protein Shake", calories: 180, protein: 25, carbs: 10, fat: 4, meal: "breakfast" as const },
  { name: "Chicken Breast", calories: 165, protein: 31, carbs: 0, fat: 3.6, meal: "lunch" as const },
  { name: "Brown Rice (1 cup)", calories: 215, protein: 5, carbs: 45, fat: 1.8, meal: "lunch" as const },
  { name: "Greek Yogurt", calories: 130, protein: 17, carbs: 8, fat: 3, meal: "snack" as const },
  { name: "Banana", calories: 89, protein: 1, carbs: 23, fat: 0.3, meal: "snack" as const },
  { name: "Almonds (30g)", calories: 174, protein: 6, carbs: 6, fat: 15, meal: "snack" as const },
  { name: "Oatmeal", calories: 147, protein: 5, carbs: 27, fat: 2.5, meal: "breakfast" as const },
  { name: "Salmon Fillet", calories: 208, protein: 29, carbs: 0, fat: 10, meal: "dinner" as const },
];

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "#f59e0b",
  lunch: "#00d2eb",
  dinner: "#8b5cf6",
  snack: "#22c55e",
};

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { nutritionLogs, addNutrition, totalCaloriesToday } = useFitness();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = nutritionLogs.filter((n) => n.date === today);

  const totalProtein = todayLogs.reduce((s, n) => s + n.protein, 0);
  const totalCarbs = todayLogs.reduce((s, n) => s + n.carbs, 0);
  const totalFat = todayLogs.reduce((s, n) => s + n.fat, 0);

  const [showModal, setShowModal] = useState(false);
  const [selectedFood, setSelectedFood] = useState<typeof QUICK_FOODS[0] | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>("lunch");

  function handleAddFood(food: typeof QUICK_FOODS[0]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood(food);
    setSelectedMeal(food.meal);
    setShowModal(true);
  }

  function handleConfirmLog() {
    if (!selectedFood) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addNutrition({ ...selectedFood, meal: selectedMeal, date: today });
    setShowModal(false);
  }

  const MEALS: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={QUICK_FOODS}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={{ gap: 16 }}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: topPad + 16 }]}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Nutrition
              </Text>
              <Text style={[styles.headerDate, { color: colors.mutedForeground }]}>
                Today
              </Text>
            </View>

            {/* Macro Summary */}
            <GlassCard style={styles.macroCard}>
              <View style={styles.macroRow}>
                <ProgressRing
                  progress={totalCaloriesToday / CALORIE_GOAL}
                  size={90}
                  strokeWidth={8}
                  color={colors.primary}
                  label={totalCaloriesToday.toString()}
                  sublabel="kcal"
                />
                <View style={styles.macros}>
                  <MacroBar
                    label="Protein"
                    value={Math.round(totalProtein)}
                    goal={PROTEIN_GOAL}
                    color={colors.secondary}
                  />
                  <MacroBar
                    label="Carbs"
                    value={Math.round(totalCarbs)}
                    goal={CARBS_GOAL}
                    color={colors.warning}
                  />
                  <MacroBar
                    label="Fat"
                    value={Math.round(totalFat)}
                    goal={FAT_GOAL}
                    color={colors.accent}
                  />
                </View>
              </View>
            </GlassCard>

            {/* Today's Meals */}
            {MEALS.map((meal) => {
              const mealLogs = todayLogs.filter((n) => n.meal === meal);
              if (mealLogs.length === 0) return null;
              const mealCal = mealLogs.reduce((s, n) => s + n.calories, 0);
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

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Quick Add
            </Text>
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === "web" ? 34 + 84 : 100 },
        ]}
        renderItem={({ item }) => (
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
                { backgroundColor: MEAL_COLORS[item.meal] + "20" },
              ]}
            >
              <Ionicons
                name="restaurant-outline"
                size={18}
                color={MEAL_COLORS[item.meal]}
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
            <Ionicons name="add" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      />

      {/* Add Modal */}
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
              <View style={styles.modalNutrients}>
                <NutrientChip label="Calories" value={`${selectedFood.calories}`} color={colors.primary} />
                <NutrientChip label="Protein" value={`${selectedFood.protein}g`} color={colors.secondary} />
                <NutrientChip label="Carbs" value={`${selectedFood.carbs}g`} color={colors.warning} />
                <NutrientChip label="Fat" value={`${selectedFood.fat}g`} color={colors.accent} />
              </View>
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
                        selectedMeal === meal
                          ? MEAL_COLORS[meal] + "30"
                          : colors.muted,
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
  const progress = Math.min(1, value / goal);
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
        <View
          style={[
            styles.macroFill,
            { backgroundColor: color, width: `${progress * 100}%` as any },
          ]}
        />
      </View>
    </View>
  );
}

function NutritionRow({ log }: { log: NutritionLog }) {
  const colors = useColors();
  return (
    <View style={[styles.nutritionRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.nutritionName, { color: colors.foreground }]}>
        {log.name}
      </Text>
      <Text style={[styles.nutritionCal, { color: colors.primary }]}>
        {log.calories} kcal
      </Text>
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
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold" },
  headerDate: { fontSize: 14, fontFamily: "Inter_400Regular" },
  macroCard: { padding: 16 },
  macroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  macros: { flex: 1, gap: 10 },
  macroBarContainer: { gap: 4 },
  macroBarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  macroBarLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  macroBarValue: { fontSize: 11, fontFamily: "Inter_500Medium" },
  macroTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
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
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  nutritionName: { fontSize: 14, fontFamily: "Inter_400Regular" },
  nutritionCal: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginTop: 8,
  },
  foodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 8,
  },
  foodIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  foodInfo: { flex: 1, gap: 2 },
  foodName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  foodMacros: { fontSize: 11, fontFamily: "Inter_400Regular" },
  foodCal: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "flex-end",
  },
  modalCard: {
    margin: 16,
    padding: 24,
    borderRadius: 20,
    gap: 16,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalNutrients: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nutrientChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  nutrientChipLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  nutrientChipValue: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  mealPicker: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  mealPickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  mealPickerText: { fontSize: 13 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  modalConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
