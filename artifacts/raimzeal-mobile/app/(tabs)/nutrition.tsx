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
import { useFitness, MealLog } from "@/contexts/FitnessContext";
import { GlassCard } from "@/components/GlassCard";
import { ProgressRing } from "@/components/ProgressRing";
import { BarcodeScannerModal, ScannedFood } from "@/components/BarcodeScannerModal";

const CALORIE_GOAL = 2200;
const PROTEIN_GOAL = 150;
const CARBS_GOAL = 250;
const FAT_GOAL = 70;

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

interface ManualForm {
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

const EMPTY_MANUAL: ManualForm = { name: "", calories: "", protein: "", carbs: "", fat: "" };

export default function NutritionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getTodayMeals, getTodayMacros, addMealLog } = useFitness();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const todayMeals = getTodayMeals();
  const { calories, protein, carbs, fat } = getTodayMacros();

  const [showModal, setShowModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [selectedFood, setSelectedFood] = useState<typeof QUICK_FOODS[0] | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>("lunch");
  const [manualForm, setManualForm] = useState<ManualForm>(EMPTY_MANUAL);
  const [manualMeal, setManualMeal] = useState<MealType>("snack");

  function handleAddFood(food: typeof QUICK_FOODS[0]) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFood(food);
    setSelectedMeal(food.mealType);
    setShowModal(true);
  }

  function handleScannedFood(food: ScannedFood) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSelectedFood({ ...food, mealType: "snack" });
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
    const meal: MealLog = {
      ...selectedFood,
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
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
        data={QUICK_FOODS}
        keyExtractor={(item) => item.name}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <View style={{ gap: 16 }}>
            <View style={[styles.header, { paddingTop: topPad + 16 }]}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Nutrition
              </Text>
              <View style={styles.headerActions}>
                <Text style={[styles.headerDate, { color: colors.mutedForeground }]}>
                  Today
                </Text>
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
            </View>

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
            <Ionicons name="add" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
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

      {/* Add Food Confirmation Modal (for quick-add & scanned foods) */}
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
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  nutritionName: { fontSize: 14, fontFamily: "Inter_400Regular" },
  nutritionCal: { fontSize: 14, fontFamily: "Inter_500Medium" },
  sectionTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold", marginTop: 8 },
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
  modalCard: { margin: 16, padding: 24, borderRadius: 20, gap: 16 },
  modalTitle: { fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  modalNutrients: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  mealPicker: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mealPickerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  mealPickerText: { fontSize: 13 },
  modalBtns: { flexDirection: "row", gap: 10 },
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
  textInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  macroInputRow: { flexDirection: "row", gap: 10 },
  macroInputItem: { flex: 1, gap: 4 },
  macroInputLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  macroInputField: { height: 44 },
});
