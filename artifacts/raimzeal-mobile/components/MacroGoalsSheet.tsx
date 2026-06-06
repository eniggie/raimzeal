import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  LayoutAnimation,
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
import { useMacroGoals, MacroGoals } from "@/contexts/MacroGoalsContext";
import { useFitness } from "@/contexts/FitnessContext";
import {
  computeSuggestedGoalsWithBreakdown,
  primaryGoalLabel,
  BREAKDOWN_GLOSSARY,
  GlossaryEntry,
} from "@/lib/tdee";

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
  const { goals, setGoals } = useMacroGoals();
  const { user } = useFitness();

  const suggestedResult = computeSuggestedGoalsWithBreakdown(user);
  const suggested = suggestedResult?.goals ?? null;
  const breakdown = suggestedResult?.breakdown ?? null;
  const goalLabel = user?.goals?.length ? primaryGoalLabel(user.goals) : "your goals";

  const [calories, setCalories] = useState(goals.calories.toString());
  const [protein, setProtein] = useState(goals.protein.toString());
  const [carbs, setCarbs] = useState(goals.carbs.toString());
  const [fat, setFat] = useState(goals.fat.toString());
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [glossaryEntry, setGlossaryEntry] = useState<GlossaryEntry | null>(null);

  const initialised = useRef(false);

  useEffect(() => {
    if (visible) {
      setCalories(goals.calories.toString());
      setProtein(goals.protein.toString());
      setCarbs(goals.carbs.toString());
      setFat(goals.fat.toString());
      setBreakdownExpanded(false);
      setGlossaryEntry(null);
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

  function toggleBreakdown() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBreakdownExpanded((v) => !v);
    Haptics.selectionAsync();
  }

  function openGlossary(key: string) {
    const entry = BREAKDOWN_GLOSSARY[key];
    if (!entry) return;
    Haptics.selectionAsync();
    setGlossaryEntry(entry);
  }

  function getOutOfRangeWarning(): string | null {
    const cal = parseNum(calories);
    const pro = parseNum(protein);
    const carb = parseNum(carbs);
    const f = parseNum(fat);

    const issues: string[] = [];

    if (cal < 800) issues.push("calories look quite low (under 800 kcal)");
    else if (cal > 6000) issues.push("calories look very high (over 6,000 kcal)");

    if (pro < 5) issues.push("protein looks very low (under 5g)");
    else if (pro > 700) issues.push("protein looks very high (over 700g)");

    if (carb < 5) issues.push("carbs look very low (under 5g)");
    else if (carb > 700) issues.push("carbs look very high (over 700g)");

    if (f < 5) issues.push("fat looks very low (under 5g)");
    else if (f > 700) issues.push("fat looks very high (over 700g)");

    if (issues.length === 0) return null;

    const list = issues.map((s) => `• ${s.charAt(0).toUpperCase() + s.slice(1)}`).join("\n");
    return `Heads up — ${issues.length === 1 ? "this" : "a few things"} look a bit unusual:\n\n${list}\n\nAre you sure you want to save these goals?`;
  }

  async function doSave() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await setGoals({
      calories: parseNum(calories),
      protein: parseNum(protein),
      carbs: parseNum(carbs),
      fat: parseNum(fat),
    });
    onClose();
  }

  async function handleSave() {
    const warning = getOutOfRangeWarning();
    if (warning) {
      Alert.alert("Double-check your goals", warning, [
        { text: "Go back", style: "cancel" },
        { text: "Save anyway", style: "destructive", onPress: doSave },
      ]);
      return;
    }
    await doSave();
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

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
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

            {/* Use Suggested chip + breakdown */}
            {suggested && breakdown && (
              <View style={[styles.suggestBlock, { borderColor: colors.primary + "40", backgroundColor: colors.primary + "0A" }]}>
                <View style={styles.suggestChipRow}>
                  <TouchableOpacity
                    style={styles.suggestChipInner}
                    onPress={handleUseSuggested}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                    <Text style={[styles.suggestChipText, { color: colors.primary }]}>
                      Use Suggested ({suggested.calories} kcal)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={toggleBreakdown}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.howBtn}
                  >
                    <Text style={[styles.howBtnText, { color: colors.primary }]}>
                      How is this calculated?
                    </Text>
                    <Ionicons
                      name={breakdownExpanded ? "chevron-up" : "chevron-down"}
                      size={13}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                </View>

                {breakdownExpanded && (
                  <View style={[styles.breakdownPanel, { borderTopColor: colors.primary + "30" }]}>
                    {/* Section: calorie calculation chain */}
                    <Text style={[styles.breakdownSectionLabel, { color: colors.mutedForeground }]}>
                      How your calorie target was worked out
                    </Text>

                    <MiniBreakdownRow
                      label="Resting burn (BMR)"
                      value={`${breakdown.bmr} kcal`}
                      note={`Calories your body needs at rest · ${breakdown.sexLabel}`}
                      glossaryKey="bmr"
                      onInfoPress={openGlossary}
                      colors={colors}
                    />
                    <MiniBreakdownRow
                      label={`Activity level (${breakdown.activityLabel})`}
                      value={`${breakdown.tdee} kcal`}
                      note="Total daily burn, including movement"
                      glossaryKey="tdee"
                      onInfoPress={openGlossary}
                      colors={colors}
                    />
                    <MiniBreakdownRow
                      label={`Goal tweak (${goalLabel})`}
                      value={
                        breakdown.goalAdjustment === 0
                          ? "0 kcal"
                          : `${breakdown.goalAdjustment > 0 ? "+" : ""}${breakdown.goalAdjustment} kcal`
                      }
                      note={
                        breakdown.goalAdjustment < 0
                          ? "Eating a little less than you burn"
                          : breakdown.goalAdjustment > 0
                          ? "Eating a little more than you burn"
                          : "Eating exactly what you burn — maintenance"
                      }
                      valueColor={
                        breakdown.goalAdjustment < 0
                          ? colors.warning
                          : breakdown.goalAdjustment > 0
                          ? colors.secondary
                          : undefined
                      }
                      glossaryKey="goal_adjustment"
                      onInfoPress={openGlossary}
                      colors={colors}
                    />
                    <MiniBreakdownRow
                      label="Your daily calorie target"
                      value={`${breakdown.targetCalories} kcal`}
                      note="Rounded to the nearest 50 kcal"
                      glossaryKey="target_calories"
                      onInfoPress={openGlossary}
                      colors={colors}
                      bold
                    />

                    {/* Divider */}
                    <View style={[styles.breakdownDivider, { backgroundColor: colors.primary + "20" }]} />

                    {/* Section: macro split */}
                    <Text style={[styles.breakdownSectionLabel, { color: colors.mutedForeground }]}>
                      How your macros were split
                    </Text>

                    <MiniBreakdownRow
                      label={`Protein (${Math.round(breakdown.proteinRatio * 100)}% of calories)`}
                      value={`${suggested.protein}g`}
                      note="Keeps you full and supports muscle"
                      glossaryKey="macro_protein"
                      onInfoPress={openGlossary}
                      colors={colors}
                    />
                    <MiniBreakdownRow
                      label={`Carbs (${Math.round(breakdown.carbRatio * 100)}% of calories)`}
                      value={`${suggested.carbs}g`}
                      note="Your body's go-to energy source"
                      glossaryKey="macro_carbs"
                      onInfoPress={openGlossary}
                      colors={colors}
                    />
                    <MiniBreakdownRow
                      label={`Fat (${Math.round(breakdown.fatRatio * 100)}% of calories)`}
                      value={`${suggested.fat}g`}
                      note="Supports hormones and long-lasting energy"
                      glossaryKey="macro_fat"
                      onInfoPress={openGlossary}
                      colors={colors}
                    />

                    <Text style={[styles.breakdownFooter, { color: colors.mutedForeground }]}>
                      Tap the{" "}
                      <Ionicons name="information-circle-outline" size={11} color={colors.mutedForeground} />{" "}
                      icon next to any term to learn more.
                    </Text>
                  </View>
                )}
              </View>
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
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {/* Glossary explanation modal */}
      {glossaryEntry && (
        <Modal
          visible={!!glossaryEntry}
          transparent
          animationType="fade"
          onRequestClose={() => setGlossaryEntry(null)}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={styles.glossaryBackdrop}
            activeOpacity={1}
            onPress={() => setGlossaryEntry(null)}
          />
          <View style={styles.glossaryWrapper} pointerEvents="box-none">
            <View style={[styles.glossaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.glossaryHeader}>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
                <Text style={[styles.glossaryTitle, { color: colors.foreground }]}>
                  {glossaryEntry.title}
                </Text>
                <TouchableOpacity
                  onPress={() => setGlossaryEntry(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.glossaryBody, { color: colors.mutedForeground }]}>
                {glossaryEntry.body}
              </Text>
              <TouchableOpacity
                style={[styles.glossaryDismiss, { backgroundColor: colors.primary }]}
                onPress={() => setGlossaryEntry(null)}
                activeOpacity={0.85}
              >
                <Text style={[styles.glossaryDismissText, { color: colors.primaryForeground }]}>
                  Got it
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </Modal>
  );
}

interface MiniBreakdownRowProps {
  label: string;
  value: string;
  note?: string;
  bold?: boolean;
  valueColor?: string;
  glossaryKey?: string;
  onInfoPress?: (key: string) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}

function MiniBreakdownRow({
  label,
  value,
  note,
  bold,
  valueColor,
  glossaryKey,
  onInfoPress,
  colors,
}: MiniBreakdownRowProps) {
  return (
    <View style={miniStyles.row}>
      <View style={miniStyles.left}>
        <View style={miniStyles.labelRow}>
          <Text
            style={[
              miniStyles.label,
              { color: colors.foreground },
              bold && { fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {label}
          </Text>
          {glossaryKey && onInfoPress && (
            <TouchableOpacity
              onPress={() => onInfoPress(glossaryKey)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={miniStyles.infoBtn}
            >
              <Ionicons
                name="information-circle-outline"
                size={13}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          )}
        </View>
        {note ? (
          <Text style={[miniStyles.note, { color: colors.mutedForeground }]}>{note}</Text>
        ) : null}
      </View>
      <Text
        style={[
          miniStyles.value,
          { color: valueColor ?? colors.foreground },
          bold && { fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const miniStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 5,
  },
  left: { flex: 1, gap: 1 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  label: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, flexShrink: 1 },
  note: { fontSize: 10, fontFamily: "Inter_400Regular", lineHeight: 14 },
  value: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "right", flexShrink: 0 },
  infoBtn: { flexShrink: 0 },
});

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
    maxHeight: "90%",
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
    marginBottom: 16,
  },
  suggestBlock: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    overflow: "hidden",
  },
  suggestChipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  suggestChipInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  suggestChipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  howBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingLeft: 6,
    flexShrink: 0,
  },
  howBtnText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  breakdownPanel: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 0,
  },
  breakdownSectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 2,
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 10,
  },
  breakdownFooter: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    lineHeight: 15,
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
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 4,
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  glossaryBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  glossaryWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glossaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  glossaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  glossaryTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 20,
  },
  glossaryBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  glossaryDismiss: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 2,
  },
  glossaryDismissText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
