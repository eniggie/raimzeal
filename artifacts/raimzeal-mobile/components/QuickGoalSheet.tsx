import React, { useEffect, useState } from "react";
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export type QuickGoalMacro = "calories" | "protein" | "carbs" | "fat";

const MACRO_META: Record<
  QuickGoalMacro,
  { label: string; unit: string; step: number; min: number; max: number; color: string }
> = {
  calories: { label: "Calories", unit: "kcal", step: 50, min: 100, max: 10000, color: "#2E8B57" },
  protein:  { label: "Protein",  unit: "g",    step: 5,  min: 5,   max: 500,   color: "#C9A84C" },
  carbs:    { label: "Carbs",    unit: "g",    step: 5,  min: 5,   max: 1000,  color: "#f97316" },
  fat:      { label: "Fat",      unit: "g",    step: 5,  min: 5,   max: 500,   color: "#8B31C7" },
};

interface QuickGoalSheetProps {
  visible: boolean;
  macro: QuickGoalMacro | null;
  currentGoal: number;
  onClose: () => void;
  onSave: (value: number) => void;
}

export function QuickGoalSheet({
  visible,
  macro,
  currentGoal,
  onClose,
  onSave,
}: QuickGoalSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(currentGoal);

  useEffect(() => {
    if (visible && macro) setValue(currentGoal);
  }, [visible, macro, currentGoal]);

  if (!macro) return null;

  const meta = MACRO_META[macro];

  function nudge(dir: 1 | -1) {
    Haptics.selectionAsync();
    setValue((v) => Math.min(meta.max, Math.max(meta.min, v + dir * meta.step)));
  }

  function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSave(value);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Quick Goal · {meta.label}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Current goal: {currentGoal} {meta.unit}
        </Text>

        <View style={styles.stepperRow}>
          <TouchableOpacity
            onPress={() => nudge(-1)}
            onLongPress={() => nudge(-1)}
            delayLongPress={300}
            style={[styles.stepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.stepBtnText, { color: colors.foreground }]}>−</Text>
          </TouchableOpacity>

          <View style={styles.valueBox}>
            <Text style={[styles.valueText, { color: meta.color }]}>{value}</Text>
            <Text style={[styles.unitText, { color: colors.mutedForeground }]}>
              {meta.unit}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => nudge(1)}
            onLongPress={() => nudge(1)}
            delayLongPress={300}
            style={[styles.stepBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.stepBtnText, { color: colors.foreground }]}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.stepHint, { color: colors.mutedForeground }]}>
          Each tap: ±{meta.step} {meta.unit}
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[styles.saveBtn, { backgroundColor: meta.color }]}
        >
          <Text style={styles.saveBtnText}>Save Goal</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  cancelText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginBottom: 12,
  },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: {
    fontSize: 26,
    fontFamily: "Inter_400Regular",
    lineHeight: 30,
    includeFontPadding: false,
  },
  valueBox: {
    alignItems: "center",
    minWidth: 120,
  },
  valueText: {
    fontSize: 48,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 56,
    includeFontPadding: false,
  },
  unitText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  stepHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 28,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
