import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
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
import { useColors } from "@/hooks/useColors";
import { useFitness, MealLog } from "@/contexts/FitnessContext";

type MealType = MealLog["mealType"];
type Category = "All" | "Breakfast" | "Lunch" | "Dinner" | "Snack";

interface Recipe {
  id: string;
  name: string;
  emoji: string;
  category: Exclude<Category, "All">;
  prepTime: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
  description: string;
  mealType: MealType;
}

const RECIPES: Recipe[] = [
  // Breakfast
  {
    id: "r1", name: "Protein Oatmeal Bowl", emoji: "🥣", category: "Breakfast",
    prepTime: "5 min", calories: 450, protein: 30, carbs: 55, fat: 10, mealType: "breakfast",
    description: "High-protein oatmeal loaded with banana and almond butter for sustained energy.",
    ingredients: ["1 cup rolled oats", "1 scoop whey protein", "1 banana", "1 tbsp almond butter", "Almond milk"],
  },
  {
    id: "r2", name: "Egg White Omelette", emoji: "🍳", category: "Breakfast",
    prepTime: "10 min", calories: 280, protein: 35, carbs: 8, fat: 9, mealType: "breakfast",
    description: "Light and filling omelette with veggies and feta. Perfect macro balance.",
    ingredients: ["4 egg whites", "1 whole egg", "Spinach", "Bell peppers", "30g feta cheese", "Olive oil"],
  },
  {
    id: "r3", name: "Greek Yogurt Parfait", emoji: "🍓", category: "Breakfast",
    prepTime: "3 min", calories: 320, protein: 22, carbs: 40, fat: 6, mealType: "breakfast",
    description: "Layered parfait with protein-rich Greek yogurt, granola, and fresh berries.",
    ingredients: ["200g Greek yogurt (0%)", "3 tbsp granola", "Mixed berries", "1 tsp honey"],
  },
  {
    id: "r4", name: "Avocado Toast & Eggs", emoji: "🥑", category: "Breakfast",
    prepTime: "10 min", calories: 420, protein: 22, carbs: 35, fat: 22, mealType: "breakfast",
    description: "Whole grain toast topped with avocado and 2 soft-boiled eggs.",
    ingredients: ["2 slices whole grain bread", "½ avocado", "2 eggs", "Lemon juice", "Red pepper flakes"],
  },
  {
    id: "r5", name: "Protein Smoothie", emoji: "🥤", category: "Breakfast",
    prepTime: "3 min", calories: 350, protein: 30, carbs: 38, fat: 7, mealType: "breakfast",
    description: "Quick blender meal with protein, greens, and banana. Perfect pre/post workout.",
    ingredients: ["1 scoop protein powder", "1 banana", "1 cup spinach", "1 cup almond milk", "1 tbsp peanut butter"],
  },
  // Lunch
  {
    id: "r6", name: "Grilled Chicken Salad", emoji: "🥗", category: "Lunch",
    prepTime: "15 min", calories: 480, protein: 45, carbs: 20, fat: 22, mealType: "lunch",
    description: "Classic high-protein salad with grilled chicken, greens, and olive oil dressing.",
    ingredients: ["200g chicken breast", "Mixed greens", "Cherry tomatoes", "Cucumber", "2 tbsp olive oil", "Lemon"],
  },
  {
    id: "r7", name: "Tuna Rice Bowl", emoji: "🍚", category: "Lunch",
    prepTime: "10 min", calories: 520, protein: 42, carbs: 60, fat: 8, mealType: "lunch",
    description: "Tuna and brown rice bowl with edamame and a soy sesame dressing.",
    ingredients: ["1 can tuna", "1 cup brown rice", "½ cup edamame", "Soy sauce", "Sesame oil", "Green onion"],
  },
  {
    id: "r8", name: "Turkey Wrap", emoji: "🌯", category: "Lunch",
    prepTime: "5 min", calories: 430, protein: 38, carbs: 42, fat: 10, mealType: "lunch",
    description: "High-protein turkey wrap with hummus and fresh veggies. Great meal prep option.",
    ingredients: ["150g turkey breast", "1 whole wheat tortilla", "Lettuce", "Tomato", "2 tbsp hummus"],
  },
  {
    id: "r9", name: "Quinoa Veggie Bowl", emoji: "🥙", category: "Lunch",
    prepTime: "20 min", calories: 490, protein: 22, carbs: 65, fat: 14, mealType: "lunch",
    description: "Plant-based bowl with quinoa, roasted vegetables, chickpeas and tahini.",
    ingredients: ["1 cup quinoa", "Chickpeas (1 can)", "Roasted zucchini", "Roasted peppers", "2 tbsp tahini"],
  },
  {
    id: "r10", name: "Salmon & Sweet Potato", emoji: "🐟", category: "Lunch",
    prepTime: "25 min", calories: 550, protein: 42, carbs: 45, fat: 18, mealType: "lunch",
    description: "Omega-3 rich salmon with sweet potato and broccoli. Anti-inflammatory powerhouse.",
    ingredients: ["200g salmon fillet", "1 medium sweet potato", "Broccoli", "Olive oil", "Garlic", "Lemon"],
  },
  // Dinner
  {
    id: "r11", name: "Chicken Breast & Rice", emoji: "🍗", category: "Dinner",
    prepTime: "25 min", calories: 510, protein: 48, carbs: 50, fat: 10, mealType: "dinner",
    description: "The classic lean muscle meal. Simple, effective, and easy to scale.",
    ingredients: ["200g chicken breast", "1 cup white rice", "Green beans", "Olive oil", "Seasoning"],
  },
  {
    id: "r12", name: "Lean Beef Stir Fry", emoji: "🥩", category: "Dinner",
    prepTime: "20 min", calories: 580, protein: 45, carbs: 50, fat: 16, mealType: "dinner",
    description: "High-protein stir fry with lean beef strips, colourful veg, and brown rice.",
    ingredients: ["200g lean beef strips", "1 cup brown rice", "Broccoli", "Carrots", "Soy sauce", "Ginger"],
  },
  {
    id: "r13", name: "Baked Tilapia & Veg", emoji: "🐠", category: "Dinner",
    prepTime: "20 min", calories: 380, protein: 45, carbs: 20, fat: 12, mealType: "dinner",
    description: "Light and lean baked fish with asparagus and cherry tomatoes. Low-carb.",
    ingredients: ["200g tilapia fillet", "Asparagus", "Cherry tomatoes", "Olive oil", "Lemon", "Herbs"],
  },
  {
    id: "r14", name: "Turkey Meatballs & Pasta", emoji: "🍝", category: "Dinner",
    prepTime: "30 min", calories: 620, protein: 48, carbs: 68, fat: 14, mealType: "dinner",
    description: "High-protein turkey meatballs with whole grain pasta and tomato sauce.",
    ingredients: ["250g ground turkey", "100g whole grain pasta", "Tomato sauce", "Garlic", "Parmesan", "Basil"],
  },
  {
    id: "r15", name: "Shrimp Fried Rice", emoji: "🍤", category: "Dinner",
    prepTime: "20 min", calories: 520, protein: 38, carbs: 60, fat: 12, mealType: "dinner",
    description: "High-protein fried rice with shrimp, eggs, and mixed vegetables.",
    ingredients: ["200g shrimp", "1.5 cups brown rice", "2 eggs", "Mixed veg", "Soy sauce", "Sesame oil"],
  },
  // Snacks
  {
    id: "r16", name: "Whey Protein Shake", emoji: "💪", category: "Snack",
    prepTime: "1 min", calories: 160, protein: 25, carbs: 8, fat: 3, mealType: "snack",
    description: "Quick post-workout or between-meal protein hit.",
    ingredients: ["1 scoop whey protein", "250ml water or almond milk"],
  },
  {
    id: "r17", name: "Almonds & Apple", emoji: "🍎", category: "Snack",
    prepTime: "1 min", calories: 220, protein: 6, carbs: 28, fat: 14, mealType: "snack",
    description: "Perfect combo of healthy fats, fibre, and natural sugar for sustained energy.",
    ingredients: ["30g almonds", "1 medium apple"],
  },
  {
    id: "r18", name: "Rice Cakes & Peanut Butter", emoji: "🥜", category: "Snack",
    prepTime: "2 min", calories: 200, protein: 8, carbs: 24, fat: 9, mealType: "snack",
    description: "Light, crunchy snack with healthy fats and protein.",
    ingredients: ["3 rice cakes", "2 tbsp peanut butter"],
  },
  {
    id: "r19", name: "Cottage Cheese Bowl", emoji: "🫙", category: "Snack",
    prepTime: "2 min", calories: 180, protein: 20, carbs: 14, fat: 4, mealType: "snack",
    description: "Casein-rich slow-release protein. Great before bed or between meals.",
    ingredients: ["150g cottage cheese (low fat)", "Mixed berries", "1 tsp honey"],
  },
  {
    id: "r20", name: "Hummus & Veggies", emoji: "🥕", category: "Snack",
    prepTime: "3 min", calories: 190, protein: 8, carbs: 22, fat: 9, mealType: "snack",
    description: "Plant-based protein snack with fibre-rich raw vegetables.",
    ingredients: ["4 tbsp hummus", "Carrot sticks", "Celery sticks", "Cucumber slices"],
  },
];

const CATEGORIES: Category[] = ["All", "Breakfast", "Lunch", "Dinner", "Snack"];

const CAT_COLORS: Record<string, string> = {
  Breakfast: "#f59e0b",
  Lunch: "#10b981",
  Dinner: "#3b82f6",
  Snack: "#ec4899",
};

function MacroPill({ label, value, color, colors }: {
  label: string; value: string; color: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={[mpStyles.pill, { backgroundColor: color + "20" }]}>
      <Text style={[mpStyles.label, { color }]}>{value}</Text>
      <Text style={[mpStyles.sub, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}
const mpStyles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: "center" },
  label: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

export default function RecipesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addMealLog } = useFitness();

  const [category, setCategory] = useState<Category>("All");
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());

  const filtered = category === "All" ? RECIPES : RECIPES.filter((r) => r.category === category);

  function logRecipe(recipe: Recipe) {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const log: MealLog = {
      id: Date.now().toString(),
      date: new Date().toISOString().split("T")[0],
      name: recipe.name,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      mealType: recipe.mealType,
    };
    addMealLog(log);
    setLoggedIds((prev) => new Set([...prev, recipe.id]));
    setSelected(null);
    Alert.alert("✓ Logged!", `${recipe.name} has been added to today's nutrition.`);
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Recipe Book</Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catScroll}
        style={[styles.catBar, { borderBottomColor: colors.border }]}
      >
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setCategory(cat)}
            style={[
              styles.catPill,
              {
                backgroundColor: category === cat
                  ? (cat === "All" ? colors.primary : CAT_COLORS[cat])
                  : colors.muted,
              },
            ]}
          >
            <Text
              style={[
                styles.catPillText,
                { color: category === cat ? "#fff" : colors.mutedForeground },
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.recipeGrid}>
          {filtered.map((recipe) => {
            const catColor = CAT_COLORS[recipe.category];
            const isLogged = loggedIds.has(recipe.id);
            return (
              <TouchableOpacity
                key={recipe.id}
                activeOpacity={0.8}
                onPress={() => setSelected(recipe)}
                style={[
                  styles.recipeCard,
                  { backgroundColor: colors.card, borderColor: isLogged ? catColor + "60" : colors.border },
                ]}
              >
                <View style={styles.recipeCardTop}>
                  <Text style={styles.recipeEmoji}>{recipe.emoji}</Text>
                  <View style={[styles.catTag, { backgroundColor: catColor + "20" }]}>
                    <Text style={[styles.catTagText, { color: catColor }]}>{recipe.category}</Text>
                  </View>
                </View>
                <Text style={[styles.recipeName, { color: colors.foreground }]}>{recipe.name}</Text>
                <Text style={[styles.recipePrepTime, { color: colors.mutedForeground }]}>
                  ⏱ {recipe.prepTime}
                </Text>
                <View style={styles.recipeMacros}>
                  <Text style={[styles.recipeCal, { color: colors.foreground }]}>
                    {recipe.calories} kcal
                  </Text>
                  <Text style={[styles.recipeP, { color: "#3b82f6" }]}>{recipe.protein}p</Text>
                  <Text style={[styles.recipeC, { color: "#f97316" }]}>{recipe.carbs}c</Text>
                  <Text style={[styles.recipeF, { color: "#ec4899" }]}>{recipe.fat}f</Text>
                </View>
                {isLogged && (
                  <View style={[styles.loggedBadge, { backgroundColor: catColor }]}>
                    <Text style={styles.loggedBadgeText}>Logged ✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Recipe detail modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        {selected && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalEmoji}>{selected.emoji}</Text>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>{selected.name}</Text>
                  <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
                    {selected.description}
                  </Text>

                  {/* Macros */}
                  <View style={styles.modalMacros}>
                    <MacroPill label="kcal" value={selected.calories.toString()} color={colors.warning} colors={colors} />
                    <MacroPill label="protein" value={`${selected.protein}g`} color="#3b82f6" colors={colors} />
                    <MacroPill label="carbs" value={`${selected.carbs}g`} color="#f97316" colors={colors} />
                    <MacroPill label="fat" value={`${selected.fat}g`} color="#ec4899" colors={colors} />
                  </View>

                  {/* Ingredients */}
                  <Text style={[styles.modalSectionTitle, { color: colors.foreground }]}>
                    Ingredients
                  </Text>
                  {selected.ingredients.map((ing, i) => (
                    <View key={i} style={styles.ingredientRow}>
                      <View style={[styles.ingredientDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.ingredientText, { color: colors.foreground }]}>{ing}</Text>
                    </View>
                  ))}

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={() => setSelected(null)}
                      style={[styles.closeBtn, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.closeBtnText, { color: colors.foreground }]}>Close</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => logRecipe(selected)}
                      style={[styles.logBtn, { backgroundColor: colors.primary }]}
                    >
                      <Ionicons name="add-circle" size={18} color={colors.primaryForeground} />
                      <Text style={[styles.logBtnText, { color: colors.primaryForeground }]}>
                        Log to Today
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1 },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 20, fontFamily: "SpaceGrotesk_700Bold" },
  catBar: { borderBottomWidth: 1, maxHeight: 56 },
  catScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row", alignItems: "center" },
  catPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  catPillText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  recipeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  recipeCard: {
    width: "47%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 6,
    position: "relative",
    overflow: "hidden",
  },
  recipeCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recipeEmoji: { fontSize: 28 },
  catTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catTagText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  recipeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
  recipePrepTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  recipeMacros: { flexDirection: "row", gap: 4, alignItems: "center", flexWrap: "wrap" },
  recipeCal: { fontSize: 12, fontFamily: "Inter_700Bold", flex: 1 },
  recipeP: { fontSize: 11, fontFamily: "Inter_500Medium" },
  recipeC: { fontSize: 11, fontFamily: "Inter_500Medium" },
  recipeF: { fontSize: 11, fontFamily: "Inter_500Medium" },
  loggedBadge: {
    position: "absolute", top: 0, right: 0,
    paddingHorizontal: 8, paddingVertical: 4,
    borderBottomLeftRadius: 12,
  },
  loggedBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, maxHeight: "90%" },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  modalContent: { paddingHorizontal: 20, paddingBottom: 32, gap: 14, alignItems: "center" },
  modalEmoji: { fontSize: 52 },
  modalTitle: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  modalDesc: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  modalMacros: { flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center" },
  modalSectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", alignSelf: "flex-start" },
  ingredientRow: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start" },
  ingredientDot: { width: 6, height: 6, borderRadius: 3 },
  ingredientText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  modalActions: { flexDirection: "row", gap: 12, width: "100%", marginTop: 8 },
  closeBtn: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  closeBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  logBtn: { flex: 2, height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
