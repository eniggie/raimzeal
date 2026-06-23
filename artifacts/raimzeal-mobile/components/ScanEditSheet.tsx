import React, { useState, useEffect, useRef } from "react";
import {
  Animated,
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
  onSaveAndAdd?: (updated: ScannedFood) => void;
}

function parseNum(raw: string, allowDecimal = true): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const n = allowDecimal ? parseFloat(cleaned) : parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

function computeDefaultQty(food: ScannedFood): string {
  if (food.servingLabel) {
    const m = food.servingLabel.match(/^(\d+(?:\.\d+)?)\s*(?:g|ml)$/i);
    if (m) return m[1];
  }
  return "100";
}

export function ScanEditSheet({ visible, food, onSave, onClose, onSaveAndAdd }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");

  const [quantity, setQuantity] = useState("100");
  const [canScale, setCanScale] = useState(false);
  const basis100gRef = useRef<{ calories: number; protein: number; carbs: number; fat: number } | null>(null);

  const [loggedToast, setLoggedToast] = useState(false);
  const [toastLabel, setToastLabel] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (food && visible) {
      setName(food.name);
      setCalories(String(food.calories));
      setProtein(String(food.protein));
      setCarbs(String(food.carbs));
      setFat(String(food.fat));

      if (food.nutrients100g) {
        basis100gRef.current = food.nutrients100g;
        setCanScale(true);
      } else if (!food.servingLabel) {
        basis100gRef.current = { calories: food.calories, protein: food.protein, carbs: food.carbs, fat: food.fat };
        setCanScale(true);
      } else {
        basis100gRef.current = null;
        setCanScale(false);
      }
      setQuantity(computeDefaultQty(food));
    }
  }, [food, visible]);

  function applyQuantity(rawQty: string) {
    const basis = basis100gRef.current;
    if (!basis) return;
    const qty = parseFloat(rawQty);
    if (!qty || qty <= 0) return;
    const f = qty / 100;
    setCalories(String(Math.round(basis.calories * f)));
    setProtein(String(Math.round(basis.protein * f * 10) / 10));
    setCarbs(String(Math.round(basis.carbs * f * 10) / 10));
    setFat(String(Math.round(basis.fat * f * 10) / 10));
  }

  function buildUpdated(): ScannedFood {
    const qty = parseFloat(quantity) || 0;
    const u = food?.unit ?? "g";
    const derivedLabel =
      canScale && qty > 0
        ? `${qty % 1 === 0 ? String(Math.round(qty)) : String(qty)}${u}`
        : food?.servingLabel;
    return {
      ...(food ?? {}),
      name: name.trim(),
      calories: parseNum(calories, false),
      protein: parseNum(protein),
      carbs: parseNum(carbs),
      fat: parseNum(fat),
      servingLabel: derivedLabel,
    };
  }

  function handleSave() {
    if (!name.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(buildUpdated());
  }

  function showLoggedToast(label: string) {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastLabel(label);
    setLoggedToast(true);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      setLoggedToast(false);
    });
    toastTimerRef.current = setTimeout(() => setLoggedToast(false), 2200);
  }

  function handleSaveAndAdd() {
    if (!name.trim() || !onSaveAndAdd) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = buildUpdated();
    onSaveAndAdd(updated);
    showLoggedToast(`${updated.name} added · ${updated.calories} kcal`);
    if (food) {
      setName(food.name);
      setCalories(String(food.calories));
      setProtein(String(food.protein));
      setCarbs(String(food.carbs));
      setFat(String(food.fat));
      setQuantity(computeDefaultQty(food));
    }
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

          {loggedToast && (
            <Animated.View
              style={[styles.loggedToast, { opacity: toastOpacity }]}
              pointerEvents="none"
            >
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={styles.loggedToastText} numberOfLines={1}>{toastLabel}</Text>
            </Animated.View>
          )}

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
              {(() => {
                if (canScale) {
                  const qty = parseFloat(quantity) || 0;
                  const u = food?.unit ?? "g";
                  return qty > 0
                    ? `Nutrition · per ${qty % 1 === 0 ? String(Math.round(qty)) : String(qty)}${u}`
                    : "Nutrition · per 100g";
                }
                return `Nutrition · ${food?.servingLabel ? `per ${food.servingLabel}` : "per 100g"}`;
              })()}
            </Text>

            {canScale && (
              <View style={[styles.macroRow, { marginBottom: 2 }]}>
                <View style={styles.macroField}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>
                    Amount ({food?.unit ?? "g"})
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
                    value={quantity}
                    onChangeText={(v) => {
                      setQuantity(v);
                      applyQuantity(v);
                    }}
                    placeholder="100"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    returnKeyType="next"
                  />
                </View>
              </View>
            )}

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

            {(() => {
              const proteinNum = parseNum(protein);
              const carbsNum = parseNum(carbs);
              const fatNum = parseNum(fat);
              const caloriesNum = parseNum(calories, false);
              const macroKcal = Math.round(proteinNum * 4 + carbsNum * 4 + fatNum * 9);
              const statedKcal = Math.round(caloriesNum);
              const hasAnyMacro = proteinNum > 0 || carbsNum > 0 || fatNum > 0;
              const mismatch =
                hasAnyMacro &&
                statedKcal > 0 &&
                Math.abs(macroKcal - statedKcal) / statedKcal > 0.2;
              if (!hasAnyMacro) return null;
              return (
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontFamily: "Inter_400Regular",
                      color: mismatch ? "#f59e0b" : colors.mutedForeground,
                    }}
                  >
                    ~{macroKcal} kcal from macros
                    {mismatch ? "  ⚠ doesn't match stated calories" : ""}
                  </Text>
                  {mismatch && (
                    <TouchableOpacity
                      onPress={() => {
                        setCalories(String(macroKcal));
                      }}
                      style={{ backgroundColor: "#f59e0b22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#f59e0b66" }}
                    >
                      <Text style={{ color: "#f59e0b", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>Use macro total</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })()}

            {onSaveAndAdd && (
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: canSave ? colors.primary : colors.muted },
                ]}
                onPress={handleSaveAndAdd}
                disabled={!canSave}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="add-circle-outline"
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
                  Save & Add
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.saveBtn,
                onSaveAndAdd
                  ? { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }
                  : { backgroundColor: canSave ? colors.primary : colors.muted },
              ]}
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.8}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={
                  onSaveAndAdd
                    ? canSave ? colors.foreground : colors.mutedForeground
                    : canSave ? colors.primaryForeground : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.saveBtnText,
                  {
                    color: onSaveAndAdd
                      ? canSave ? colors.foreground : colors.mutedForeground
                      : canSave ? colors.primaryForeground : colors.mutedForeground,
                  },
                ]}
              >
                Save Changes
              </Text>
            </TouchableOpacity>
            {onSaveAndAdd && (
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.doneBtnText, { color: colors.mutedForeground }]}>
                  Done
                </Text>
              </TouchableOpacity>
            )}
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
  doneBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    marginTop: 4,
  },
  doneBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  loggedToast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    maxWidth: "88%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#22c55e",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  loggedToastText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
