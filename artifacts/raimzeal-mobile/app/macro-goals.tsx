import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useMacroGoals, DEFAULT_MACRO_GOALS } from "@/contexts/MacroGoalsContext";
import { useFitness } from "@/contexts/FitnessContext";
import { computeSuggestedGoalsWithBreakdown, primaryGoalLabel, BREAKDOWN_GLOSSARY, GlossaryEntry, formatBreakdownText } from "@/lib/tdee";
import { useAuth } from "@/contexts/AuthContext";
import { upsertUserPreferences } from "@/lib/db";

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
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { goals, setGoals, loaded } = useMacroGoals();
  const { user } = useFitness();
  const { user: authUser } = useAuth();

  const [calories, setCalories] = useState(goals.calories.toString());
  const [protein, setProtein] = useState(goals.protein.toString());
  const [carbs, setCarbs] = useState(goals.carbs.toString());
  const [fat, setFat] = useState(goals.fat.toString());

  // Force a re-render whenever this screen comes back into focus so the
  // suggestion banner always reflects the latest profile data (e.g. after
  // the user saves edits in the Edit Profile screen and navigates back).
  // Also resets focusApplied on blur so the scroll+pulse animation replays
  // if the user returns with the same `focus` query param still present.
  const [focusTick, setFocusTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setFocusTick((t) => t + 1);
      return () => {
        focusApplied.current = false;
      };
    }, [])
  );

  const scrollRef = useRef<ScrollView>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const fieldOffsets = useRef<Record<string, number>>({});
  const focusApplied = useRef(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  // Tracks the field the keyboard is currently open on (independent of the
  // deep-link pulse animation tracked by focusedField).
  const [editingField, setEditingField] = useState<string | null>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!focus || focusApplied.current || !loaded) return;
    const validKeys = ["protein", "carbs", "fat"];
    if (!validKeys.includes(focus)) return;

    const applyFocus = () => {
      focusApplied.current = true;
      setFocusedField(focus);
      const offset = fieldOffsets.current[focus];
      if (offset !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, offset - 80), animated: true });
      }
      setTimeout(() => {
        inputRefs.current[focus]?.focus();
      }, 350);

      pulseAnim.setValue(0);
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.15, duration: 200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 700, useNativeDriver: false }),
      ]).start();

      setTimeout(() => setFocusedField(null), 2000);
    };

    const timer = setTimeout(applyFocus, 120);
    return () => clearTimeout(timer);
  }, [focus, loaded, focusTick]);

  // Derive the suggestion and breakdown from individual profile fields so the
  // card recomputes immediately whenever any field changes — including
  // biologicalSex — even while the screen remains focused (no navigate-away
  // required). useFocusEffect above handles the async Supabase resync path.
  const suggestedResult = useMemo(
    () => computeSuggestedGoalsWithBreakdown(user),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      user?.weight,
      user?.height,
      user?.age,
      user?.biologicalSex,
      user?.fitnessLevel,
      // goals is an array — JSON-stringify for stable comparison
      // eslint-disable-next-line react-hooks/exhaustive-deps
      JSON.stringify(user?.goals),
      user?.units,
    ]
  );
  const suggested = suggestedResult?.goals ?? null;
  const breakdown = suggestedResult?.breakdown ?? null;
  const goalLabel = user?.goals?.length ? primaryGoalLabel(user.goals) : "your goals";

  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [glossaryEntry, setGlossaryEntry] = useState<GlossaryEntry | null>(null);

  function openGlossary(key: string) {
    const entry = BREAKDOWN_GLOSSARY[key];
    if (!entry) return;
    Haptics.selectionAsync();
    setGlossaryEntry(entry);
  }

  function closeGlossary() {
    setGlossaryEntry(null);
  }

  function toggleBreakdown() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setBreakdownExpanded((v) => !v);
    Haptics.selectionAsync();
  }

  function applySuggestion() {
    if (!suggested) return;
    Haptics.selectionAsync();
    setCalories(suggested.calories.toString());
    setProtein(suggested.protein.toString());
    setCarbs(suggested.carbs.toString());
    setFat(suggested.fat.toString());
  }

  const [isCopied, setIsCopied] = useState(false);

  async function handleShareBreakdown() {
    if (!breakdown || !suggested) return;
    Haptics.selectionAsync();
    const text = formatBreakdownText(breakdown, suggested, goalLabel);
    try {
      await Share.share({ message: text });
      // Share.share resolves with { action } on success or rejects if the
      // sheet cannot be displayed — either way no further action is needed.
    } catch {
      // share sheet could not be displayed (e.g. simulator restriction)
    }
  }

  async function handleCopyBreakdown() {
    if (!breakdown || !suggested) return;
    const text = formatBreakdownText(breakdown, suggested, goalLabel);
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  const fields: GoalField[] = [
    { key: "calories", label: "Daily Calories", unit: "kcal", placeholder: "2200", color: colors.primary },
    { key: "protein", label: "Protein", unit: "g", placeholder: "150", color: colors.secondary },
    { key: "carbs", label: "Carbohydrates", unit: "g", placeholder: "250", color: colors.warning },
    { key: "fat", label: "Fat", unit: "g", placeholder: "70", color: colors.accent },
  ];

  // Map each macro field key to the glossary entry that explains it.
  // calories has no standalone glossary entry, so it is intentionally absent.
  const MACRO_TIP_KEY: Partial<Record<GoalField["key"], string>> = {
    protein: "macro_protein",
    carbs: "macro_carbs",
    fat: "macro_fat",
  } as const;

  const values: Record<string, string> = { calories, protein, carbs, fat };
  const setters: Record<string, (v: string) => void> = {
    calories: setCalories,
    protein: setProtein,
    carbs: setCarbs,
    fat: setFat,
  };

  const kcalFromMacros = React.useMemo(() => {
    const pro = parseInt(protein, 10);
    const car = parseInt(carbs, 10);
    const fa = parseInt(fat, 10);
    if (isNaN(pro) || isNaN(car) || isNaN(fa)) return null;
    return pro * 4 + car * 4 + fa * 9;
  }, [protein, carbs, fat]);

  const macroMismatch = React.useMemo(() => {
    const cal = parseInt(calories, 10);
    if (kcalFromMacros === null || isNaN(cal) || cal <= 0) return false;
    return Math.abs(kcalFromMacros - cal) / cal > 0.2;
  }, [kcalFromMacros, calories]);

  async function handleSave() {
    const cal = parseInt(calories, 10);
    const pro = parseInt(protein, 10);
    const car = parseInt(carbs, 10);
    const fa = parseInt(fat, 10);

    if (!cal || !pro || !car || !fa || cal <= 0 || pro <= 0 || car <= 0 || fa <= 0) {
      Alert.alert("Invalid values", "Please enter a positive number for each goal.");
      return;
    }

    const newGoals = { calories: cal, protein: pro, carbs: car, fat: fa };
    await setGoals(newGoals);
    if (authUser?.id) {
      upsertUserPreferences(authUser.id, { macroGoals: newGoals }).catch(() => {});
    }
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
        ref={scrollRef}
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

        {/* Suggested for you banner */}
        {suggested && (
            <View
              style={[
                styles.suggestionBanner,
                { backgroundColor: colors.primary + "18", borderColor: colors.primary + "55" },
              ]}
            >
              <View style={styles.suggestionIconWrap}>
                <Ionicons name="sparkles" size={18} color={colors.primary} />
              </View>
              <View style={styles.suggestionBody}>
                <View style={styles.suggestionTitleRow}>
                  <Text style={[styles.suggestionTitle, { color: colors.primary }]}>
                    Suggested for you
                  </Text>
                </View>
                <Text style={[styles.suggestionSubtitle, { color: colors.mutedForeground }]}>
                  Based on your profile & {goalLabel} — tap to pre-fill
                </Text>
                <View style={styles.suggestionPills}>
                  <SuggestionPill label={`${suggested.calories} kcal`} color={colors.primary} />
                  <SuggestionPill label={`${suggested.protein}g protein`} color={colors.secondary} />
                  <SuggestionPill label={`${suggested.carbs}g carbs`} color={colors.warning} />
                  <SuggestionPill label={`${suggested.fat}g fat`} color={colors.accent} />
                </View>

                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={toggleBreakdown}
                  style={[
                    styles.howCalculatedRow,
                    { borderColor: colors.primary + "35", backgroundColor: colors.primary + "0C" },
                  ]}
                >
                  <Ionicons name="calculator-outline" size={14} color={colors.primary} />
                  <Text style={[styles.howCalculatedText, { color: colors.primary }]}>
                    How is this calculated?
                  </Text>
                  <Ionicons
                    name={breakdownExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={colors.primary}
                    style={styles.howCalculatedChevron}
                  />
                </TouchableOpacity>

                {breakdownExpanded && breakdown && (
                  <View style={[styles.breakdownCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                    <Text style={[styles.breakdownHeading, { color: colors.primary }]}>
                      How we calculated this
                    </Text>
                    <Text style={[styles.breakdownNote, { color: colors.mutedForeground }]}>
                      Based on your weight, height, age, biological sex, and activity level using the Mifflin-St Jeor formula.
                    </Text>

                    <BreakdownRow
                      label="Basal Metabolic Rate (BMR)"
                      value={`${breakdown.bmr} kcal`}
                      note={`Calories your body burns at rest · ${breakdown.sexLabel}`}
                      colors={colors}
                      glossaryKey="bmr"
                      onHelpPress={openGlossary}
                    />
                    <BreakdownRow
                      label={`× Activity level (${breakdown.activityLabel})`}
                      value={`${breakdown.tdee} kcal`}
                      note="Total Daily Energy Expenditure"
                      colors={colors}
                      glossaryKey="tdee"
                      onHelpPress={openGlossary}
                    />
                    <BreakdownRow
                      label={`Goal adjustment (${goalLabel})`}
                      value={breakdown.goalAdjustment === 0 ? "0 kcal" : `${breakdown.goalAdjustment > 0 ? "+" : ""}${breakdown.goalAdjustment} kcal`}
                      note={
                        breakdown.goalAdjustment < 0
                          ? "Calorie deficit to support fat loss"
                          : breakdown.goalAdjustment > 0
                          ? "Calorie surplus to support muscle growth"
                          : "No adjustment — eating at TDEE maintains current weight"
                      }
                      colors={colors}
                      valueColor={
                        breakdown.goalAdjustment < 0
                          ? colors.warning
                          : breakdown.goalAdjustment > 0
                          ? colors.secondary
                          : colors.mutedForeground
                      }
                      glossaryKey="goal_adjustment"
                      onHelpPress={openGlossary}
                    />
                    <BreakdownRow
                      label="Target calories"
                      value={`${breakdown.targetCalories} kcal`}
                      note="Rounded to the nearest 50 kcal"
                      colors={colors}
                      bold
                      glossaryKey="target_calories"
                      onHelpPress={openGlossary}
                    />

                    <View style={[styles.breakdownDivider, { backgroundColor: colors.primary + "25" }]} />

                    <Text style={[styles.breakdownSubheading, { color: colors.mutedForeground }]}>
                      Macro split
                    </Text>
                    <BreakdownRow
                      label="Protein"
                      value={`${Math.round(breakdown.proteinRatio * 100)}% of calories`}
                      note={`${suggested.protein}g · 4 kcal per gram`}
                      colors={colors}
                      glossaryKey="macro_protein"
                      onHelpPress={openGlossary}
                    />
                    <BreakdownRow
                      label="Carbohydrates"
                      value={`${Math.round(breakdown.carbRatio * 100)}% of calories`}
                      note={`${suggested.carbs}g · 4 kcal per gram`}
                      colors={colors}
                      glossaryKey="macro_carbs"
                      onHelpPress={openGlossary}
                    />
                    <BreakdownRow
                      label="Fat"
                      value={`${Math.round(breakdown.fatRatio * 100)}% of calories`}
                      note={`${suggested.fat}g · 9 kcal per gram`}
                      colors={colors}
                      glossaryKey="macro_fat"
                      onHelpPress={openGlossary}
                    />

                    <TouchableOpacity
                      activeOpacity={0.82}
                      onPress={applySuggestion}
                      style={[styles.applyBtn, { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.applyBtnText, { color: colors.primaryForeground }]}>
                        Apply these goals
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.shareCopyRow}>
                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={handleShareBreakdown}
                        style={[styles.shareBtn, styles.shareCopyBtn, { borderColor: colors.primary + "55", backgroundColor: colors.primary + "12" }]}
                      >
                        <Ionicons name="share-outline" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.shareBtnText, { color: colors.primary }]}>Share</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.82}
                        onPress={handleCopyBreakdown}
                        style={[styles.shareBtn, styles.shareCopyBtn, { borderColor: colors.primary + "55", backgroundColor: isCopied ? colors.primary + "28" : colors.primary + "12" }]}
                      >
                        <Ionicons name={isCopied ? "checkmark-outline" : "copy-outline"} size={16} color={colors.primary} style={{ marginRight: 6 }} />
                        <Text style={[styles.shareBtnText, { color: colors.primary }]}>
                          {isCopied ? "Copied!" : "Copy text"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {!breakdownExpanded && (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={applySuggestion}
                    style={styles.applyInlineBtn}
                  >
                    <Text style={[styles.applyInlineBtnText, { color: colors.primary }]}>
                      Apply suggestion
                    </Text>
                    <Ionicons name="chevron-forward" size={13} color={colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
        )}

        {/* Goal inputs */}
        {fields.map((field) => {
          const isHighlighted = focusedField === field.key;
          const animatedBorderColor = isHighlighted
            ? pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.border, field.color],
              })
            : colors.border;
          const animatedShadowOpacity = isHighlighted
            ? pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.45],
              })
            : 0;
          return (
            <View
              key={field.key}
              style={styles.fieldWrap}
              onLayout={(e) => {
                fieldOffsets.current[field.key] = e.nativeEvent.layout.y;
              }}
            >
              <View style={styles.fieldLabelRow}>
                <View style={[styles.fieldDot, { backgroundColor: field.color }]} />
                <Text style={[styles.fieldLabel, { color: isHighlighted ? field.color : colors.mutedForeground }]}>
                  {field.label}
                </Text>
              </View>
              <Animated.View
                style={[
                  styles.inputBox,
                  {
                    backgroundColor: colors.muted,
                    borderColor: animatedBorderColor,
                    shadowColor: field.color,
                    shadowOpacity: animatedShadowOpacity,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: isHighlighted ? 4 : 0,
                  },
                ]}
              >
                <TextInput
                  ref={(r) => { inputRefs.current[field.key] = r; }}
                  style={[styles.textInput, { color: colors.foreground }]}
                  value={values[field.key]}
                  onChangeText={setters[field.key]}
                  placeholder={field.placeholder}
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                  returnKeyType="done"
                  onFocus={() => setEditingField(field.key)}
                  onBlur={() => setEditingField(null)}
                />
                <Text style={[styles.unit, { color: colors.mutedForeground }]}>{field.unit}</Text>
              </Animated.View>

              {/* Inline glossary tip — visible while the field is focused */}
              {editingField === field.key && MACRO_TIP_KEY[field.key] && (
                <View style={[styles.macroTip, { backgroundColor: field.color + "12", borderColor: field.color + "40" }]}>
                  <Ionicons name="information-circle-outline" size={13} color={field.color} style={styles.macroTipIcon} />
                  <Text style={[styles.macroTipText, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {BREAKDOWN_GLOSSARY[MACRO_TIP_KEY[field.key]!].body.split(".")[0] + "."}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Macro-calorie hint / mismatch warning */}
        {kcalFromMacros !== null && (
          <View
            style={[
              styles.macroHintBox,
              macroMismatch
                ? { backgroundColor: colors.warning + "18", borderColor: colors.warning + "55" }
                : { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            {macroMismatch ? (
              <Ionicons name="warning-outline" size={16} color={colors.warning} style={styles.macroHintIcon} />
            ) : (
              <Ionicons name="calculator-outline" size={16} color={colors.mutedForeground} style={styles.macroHintIcon} />
            )}
            <View style={styles.macroHintBody}>
              <Text
                style={[
                  styles.macroHintPrimary,
                  { color: macroMismatch ? colors.warning : colors.mutedForeground },
                ]}
              >
                ~{kcalFromMacros} kcal from macros
              </Text>
              {macroMismatch && (
                <Text style={[styles.macroHintSub, { color: colors.warning }]}>
                  This differs from your {parseInt(calories, 10) > 0 ? parseInt(calories, 10) : "—"} kcal calorie goal by more than 20%. Adjust your macros or calorie target so they align.
                </Text>
              )}
            </View>
          </View>
        )}

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
      {/* Glossary bottom-sheet modal */}
      <Modal
        visible={glossaryEntry !== null}
        transparent
        animationType="slide"
        onRequestClose={closeGlossary}
      >
        <Pressable style={styles.glossaryOverlay} onPress={closeGlossary}>
          <Pressable
            style={[styles.glossarySheet, { backgroundColor: colors.card ?? colors.background, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <View style={[styles.glossaryHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.glossaryTitle, { color: colors.foreground }]}>
              {glossaryEntry?.title}
            </Text>
            <Text style={[styles.glossaryBody, { color: colors.mutedForeground }]}>
              {glossaryEntry?.body}
            </Text>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={closeGlossary}
              style={[styles.glossaryCloseBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
            >
              <Text style={[styles.glossaryCloseBtnText, { color: colors.foreground }]}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SuggestionPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: color + "22" }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

interface BreakdownRowProps {
  label: string;
  value: string;
  note?: string;
  bold?: boolean;
  valueColor?: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  glossaryKey?: string;
  onHelpPress?: (key: string) => void;
}

function BreakdownRow({ label, value, note, bold, valueColor, colors, glossaryKey, onHelpPress }: BreakdownRowProps) {
  return (
    <View style={styles.breakdownRow}>
      <View style={styles.breakdownRowLeft}>
        <View style={styles.breakdownRowLabelRow}>
          <Text
            style={[
              styles.breakdownRowLabel,
              { color: colors.foreground },
              bold && { fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {label}
          </Text>
          {glossaryKey && onHelpPress ? (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => onHelpPress(glossaryKey)}
              style={styles.helpIconBtn}
            >
              <Ionicons name="help-circle-outline" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
        {note ? (
          <Text style={[styles.breakdownRowNote, { color: colors.mutedForeground }]}>{note}</Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.breakdownRowValue,
          { color: valueColor ?? colors.foreground },
          bold && { fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
    </View>
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
  suggestionBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  suggestionIconWrap: { marginTop: 1 },
  suggestionBody: { flex: 1, gap: 3 },
  suggestionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  suggestionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  suggestionSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  suggestionPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  howCalculatedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: "flex-start",
  },
  howCalculatedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  howCalculatedChevron: {
    marginLeft: 2,
  },
  breakdownCard: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  breakdownHeading: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  breakdownNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
    marginBottom: 4,
  },
  breakdownSubheading: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 2,
  },
  breakdownDivider: {
    height: 1,
    marginVertical: 4,
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  breakdownRowLeft: { flex: 1, gap: 1 },
  breakdownRowLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  breakdownRowNote: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
  breakdownRowValue: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
    flexShrink: 0,
  },
  applyBtn: {
    marginTop: 8,
    borderRadius: 10,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  shareCopyRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  shareCopyBtn: {
    flex: 1,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    height: 38,
  },
  shareBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  applyInlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  applyInlineBtnText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
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
  macroHintBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  macroHintIcon: { marginTop: 1 },
  macroTip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
  },
  macroTipIcon: { marginTop: 1, flexShrink: 0 },
  macroTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  macroHintBody: { flex: 1, gap: 3 },
  macroHintPrimary: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  macroHintSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  breakdownRowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  helpIconBtn: {
    marginTop: 1,
  },
  glossaryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  glossarySheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 36,
    gap: 12,
  },
  glossaryHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 4,
  },
  glossaryTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    lineHeight: 24,
  },
  glossaryBody: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  glossaryCloseBtn: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  glossaryCloseBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
