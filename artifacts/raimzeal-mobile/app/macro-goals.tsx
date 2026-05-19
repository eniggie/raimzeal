import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { useMacroGoals, DEFAULT_MACRO_GOALS } from "@/contexts/MacroGoalsContext";

interface GoalField {
  key: "calories" | "protein" | "carbs" | "fat";
  label: string;
  unit: string;
  placeholder: string;
  color: string;
}

export default function MacroGoalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { goals, setGoals, loaded } = useMacroGoals();

  const [calories, setCalories] = useState(goals.calories.toString());
  const [protein, setProtein] = useState(goals.protein.toString());
  const [carbs, setCarbs] = useState(goals.carbs.toString());
  const [fat, setFat] = useState(goals.fat.toString());

  const initialised = useRef(false);
  useEffect(() => {
    if (loaded && !initialised.current) {
      initialised.current = true;
      setCalories(goals.calories.toString());
      setProtein(goals.protein.toString());
      setCarbs(goals.carbs.toString());
      setFat(goals.fat.toString());
    }
  }, [loaded, goals]);

  const fields: GoalField[] = [
    { key: "calories", label: "Daily Calories", unit: "kcal", placeholder: "2200", color: colors.primary },
    { key: "protein", label: "Protein", unit: "g", placeholder: "150", color: colors.secondary },
    { key: "carbs", label: "Carbohydrates", unit: "g", placeholder: "250", color: colors.warning },
    { key: "fat", label: "Fat", unit: "g", placeholder: "70", color: colors.accent },
  ];

  const values: Record<string, string> = { calories, protein, carbs, fat };
  const setters: Record<string, (v: string) => void> = {
    calories: setCalories,
    protein: setProtein,
    carbs: setCarbs,
    fat: setFat,
  };

  async function handleSave() {
    const cal = parseInt(calories, 10);
    const pro = parseInt(protein, 10);
    const car = parseInt(carbs, 10);
    const fa = parseInt(fat, 10);

    if (!cal || !pro || !car || !fa || cal <= 0 || pro <= 0 || car <= 0 || fa <= 0) {
      Alert.alert("Invalid values", "Please enter a positive number for each goal.");
      return;
    }

    await setGoals({ calories: cal, protein: pro, carbs: car, fat: fa });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  function handleReset() {
    Alert.alert(
      "Reset to defaults",
      "This will restore the default goals (2200 kcal, 150g protein, 250g carbs, 70g fat).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            setCalories(DEFAULT_MACRO_GOALS.calories.toString());
            setProtein(DEFAULT_MACRO_GOALS.protein.toString());
            setCarbs(DEFAULT_MACRO_GOALS.carbs.toString());
            setFat(DEFAULT_MACRO_GOALS.fat.toString());
            Haptics.selectionAsync();
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Daily Goals</Text>
          {loaded ? (
            <TouchableOpacity onPress={handleSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.saveBtn, { color: colors.primary }]}>Save</Text>
            </TouchableOpacity>
          ) : (
            <ActivityIndicator size="small" color={colors.primary} />
          )}
        </View>

        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Set your personal daily nutrition targets. These are used for progress rings and macro tracking across the app.
        </Text>

        {/* Goal inputs */}
        {fields.map((field) => (
          <View key={field.key} style={styles.fieldWrap}>
            <View style={styles.fieldLabelRow}>
              <View style={[styles.fieldDot, { backgroundColor: field.color }]} />
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                {field.label}
              </Text>
            </View>
            <View
              style={[
                styles.inputBox,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <TextInput
                style={[styles.textInput, { color: colors.foreground }]}
                value={values[field.key]}
                onChangeText={setters[field.key]}
                placeholder={field.placeholder}
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
                returnKeyType="done"
              />
              <Text style={[styles.unit, { color: colors.mutedForeground }]}>{field.unit}</Text>
            </View>
          </View>
        ))}

        {/* Save button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.saveFullBtn, { backgroundColor: colors.primary }]}
          onPress={handleSave}
        >
          <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
            Save Goals
          </Text>
        </TouchableOpacity>

        {/* Reset link */}
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.resetBtn}
          onPress={handleReset}
        >
          <Text style={[styles.resetText, { color: colors.mutedForeground }]}>
            Reset to defaults
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  saveBtn: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    marginBottom: 4,
  },
  fieldWrap: { gap: 6 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fieldDot: { width: 8, height: 8, borderRadius: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  inputBox: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textInput: { fontSize: 16, fontFamily: "Inter_400Regular", flex: 1 },
  unit: { fontSize: 14, fontFamily: "Inter_500Medium", marginLeft: 8 },
  saveFullBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  resetBtn: { alignItems: "center", paddingVertical: 4 },
  resetText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
