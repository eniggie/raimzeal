import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { useMacroGoals, MacroGoals } from "@/contexts/MacroGoalsContext";
import { useFitness } from "@/contexts/FitnessContext";
import { computeSuggestedGoals } from "@/lib/tdee";

interface Props {
  visible: boolean;
  onClose: () => void;
}

function parseNum(raw: string): number {
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

interface FieldConfig {
  key: keyof MacroGoals;
  label: string;
  unit: string;
  color: string;
  placeholder: string;
}

export function MacroGoalsSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { goals, setGoals, loaded } = useMacroGoals();
  const { user } = useFitness();
  const suggested = computeSuggestedGoals(user);

  const [calories, setCalories] = useState(goals.calories.toString());
  const [protein, setProtein] = useState(goals.protein.toString());
  const [carbs, setCarbs] = useState(goals.carbs.toString());
  const [fat, setFat] = useState(goals.fat.toString());

  const initialised = useRef(false);

  useEffect(() => {
    if (visible) {
      setCalories(goals.calories.toString());
      setProtein(goals.protein.toString());
      setCarbs(goals.carbs.toString());
      setFat(goals.fat.toString());
      initialised.current = false;
    }
  }, [visible, goals]);

  const fields: FieldConfig[] = [
    { key: "calories", label: "Daily Calories", unit: "kcal", color: colors.primary, placeholder: "2200" },
    { key: "protein", label: "Protein", unit: "g", color: colors.secondary, placeholder: "150" },
    { key: "carbs", label: "Carbohydrates", unit: "g", color: colors.warning, placeholder: "250" },
    { key: "fat", label: "Fat", unit: "g", color: colors.accent, placeholder: "70" },
  ];

  const values: Record<keyof MacroGoals, string> = { calories, protein, carbs, fat };
  const setters: Record<keyof MacroGoals, (v: string) => void> = {
    calories: setCalories,
    protein: setProtein,
    carbs: setCarbs,
    fat: setFat,
  };

  function hasChanges() {
    return (
      parseNum(calories) !== goals.calories ||
      parseNum(protein) !== goals.protein ||
      parseNum(carbs) !== goals.carbs ||
      parseNum(fat) !== goals.fat
    );
  }

  function handleUseSuggested() {
    if (!suggested) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCalories(suggested.calories.toString());
    setProtein(suggested.protein.toString());
    setCarbs(suggested.carbs.toString());
    setFat(suggested.fat.toString());
  }

  async function handleSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setGoals({
      calories: parseNum(calories),
      protein: parseNum(protein),
      carbs: parseNum(carbs),
      fat: parseNum(fat),
    });
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kavWrapper}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Edit Macro Goals
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
            Set your daily targets — changes apply immediately.
          </Text>

          {/* Use Suggested chip */}
          {suggested && (
            <TouchableOpacity
              style={[
                styles.suggestChip,
                { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" },
              ]}
              onPress={handleUseSuggested}
              activeOpacity={0.75}
            >
              <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
              <Text style={[styles.suggestChipText, { color: colors.primary }]}>
                Use Suggested ({suggested.calories} kcal)
              </Text>
            </TouchableOpacity>
          )}

          {/* Fields */}
          <View style={styles.fields}>
            {fields.map((f) => (
              <View key={f.key} style={styles.fieldRow}>
                <View style={[styles.fieldDot, { backgroundColor: f.color }]} />
                <View style={styles.fieldLabelWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{f.label}</Text>
                  <Text style={[styles.fieldUnit, { color: colors.mutedForeground }]}>{f.unit}</Text>
                </View>
                <View
                  style={[
                    styles.fieldInputWrap,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <TextInput
                    value={values[f.key]}
                    onChangeText={setters[f.key]}
                    keyboardType="number-pad"
                    style={[styles.fieldInput, { color: colors.foreground }]}
                    placeholderTextColor={colors.mutedForeground}
                    placeholder={f.placeholder}
                    selectTextOnFocus
                    maxLength={5}
                  />
                </View>
              </View>
            ))}
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              {
                backgroundColor: hasChanges() ? colors.primary : colors.muted,
              },
            ]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.primaryForeground} />
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
              Save Goals
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kavWrapper: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 0,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  sheetSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 20,
  },
  fields: {
    gap: 12,
    marginBottom: 24,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fieldDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fieldLabelWrap: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  fieldUnit: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  fieldInputWrap: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: "center",
  },
  fieldInput: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    minWidth: 56,
  },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  suggestChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
