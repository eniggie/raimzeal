import React, { useState, useEffect } from "react";
import {
  KeyboardAvoidingView,
  Modal,
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
import { ScannedFood } from "@/components/BarcodeScannerModal";

interface Props {
  visible: boolean;
  food: ScannedFood | null;
  onSave: (updated: ScannedFood) => void;
  onClose: () => void;
}

function parseNum(raw: string, allowDecimal = true): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

export function ScanEditSheet({ visible, food, onSave, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  useEffect(() => {
    if (food && visible) {
      setName(food.name);
      setCalories(String(food.calories));
      setProtein(String(food.protein));
      setCarbs(String(food.carbs));
      setFat(String(food.fat));
    }
  }, [food, visible]);

  function handleSave() {
    if (!name.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated: ScannedFood = {
      ...(food ?? {}),
      name: name.trim(),
      calories: parseNum(calories, false),
      protein: parseNum(protein),
      carbs: parseNum(carbs),
      fat: parseNum(fat),
    };
    onSave(updated);
  }

  const canSave = name.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="create-outline" size={20} color={colors.primary} />
              <Text style={[styles.title, { color: colors.foreground }]}>
                Edit Product
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Product Name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Greek Yogurt"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              autoCapitalize="words"
            />

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              Nutrition (per serving)
            </Text>

            <View style={styles.macroRow}>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Calories
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  value={calories}
                  onChangeText={setCalories}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                  returnKeyType="next"
                />
              </View>
            </View>

            <View style={styles.macroRow}>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Protein (g)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Carbs (g)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                />
              </View>
              <View style={styles.macroField}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Fat (g)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.foreground,
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  onSubmitEditing={canSave ? handleSave : undefined}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.saveBtn,
                { backgroundColor: canSave ? colors.primary : colors.muted },
              ]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={canSave ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.saveBtnText,
                  {
                    color: canSave
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                Save Changes
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 10,
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  macroRow: {
    flexDirection: "row",
    gap: 10,
  },
  macroField: {
    flex: 1,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 12,
    marginTop: 20,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
