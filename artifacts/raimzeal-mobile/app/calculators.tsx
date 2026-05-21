import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";

type Tab = "bmr" | "oneRM";
type Gender = "male" | "female";
type Unit = "metric" | "imperial";

interface ActivityLevel {
  label: string;
  sublabel: string;
  multiplier: number;
}

const ACTIVITY_LEVELS: ActivityLevel[] = [
  { label: "Sedentary", sublabel: "Desk job, no exercise", multiplier: 1.2 },
  { label: "Light", sublabel: "1-3x/week exercise", multiplier: 1.375 },
  { label: "Moderate", sublabel: "3-5x/week exercise", multiplier: 1.55 },
  { label: "Active", sublabel: "6-7x/week exercise", multiplier: 1.725 },
  { label: "Very Active", sublabel: "Hard training, physical job", multiplier: 1.9 },
];

const ONE_RM_PERCENTAGES = [100, 95, 90, 85, 80, 75, 70, 65, 60];

function calcBMR(gender: Gender, weightKg: number, heightCm: number, age: number) {
  if (gender === "male") {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

function brzycki1RM(weight: number, reps: number) {
  if (reps <= 0 || reps > 36) return 0;
  if (reps === 1) return weight;
  return weight * (36 / (37 - reps));
}

export default function CalculatorsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useFitness();

  const [tab, setTab] = useState<Tab>("bmr");

  const unitFromProfile: Unit = user?.units === "imperial" ? "imperial" : "metric";

  const [gender, setGender] = useState<Gender>("male");
  const [unit, setUnit] = useState<Unit>(unitFromProfile);
  const [weightInput, setWeightInput] = useState(
    user?.weight ? String(user.weight) : ""
  );
  const [heightInput, setHeightInput] = useState(
    user?.height ? String(user.height) : ""
  );
  const [ageInput, setAgeInput] = useState(
    user?.age ? String(user.age) : ""
  );
  const [activityIdx, setActivityIdx] = useState(2);

  const [rmWeight, setRmWeight] = useState("");
  const [rmReps, setRmReps] = useState("");

  function toKg(v: number) {
    return unit === "imperial" ? v * 0.453592 : v;
  }
  function toCm(v: number) {
    return unit === "imperial" ? v * 2.54 : v;
  }

  const weightKg = toKg(parseFloat(weightInput) || 0);
  const heightCm = toCm(parseFloat(heightInput) || 0);
  const age = parseInt(ageInput) || 0;

  const bmrValid = weightKg > 0 && heightCm > 0 && age > 0;
  const bmr = bmrValid ? calcBMR(gender, weightKg, heightCm, age) : 0;
  const tdee = bmr * ACTIVITY_LEVELS[activityIdx].multiplier;

  const rmW = parseFloat(rmWeight) || 0;
  const rmR = parseInt(rmReps) || 0;
  const oneRM = rmW > 0 && rmR > 0 ? brzycki1RM(rmW, rmR) : 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Calculators
        </Text>
        <View style={{ width: 34 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["bmr", "oneRM"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tab,
              tab === t && {
                borderBottomWidth: 2,
                borderBottomColor: colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === t ? colors.primary : colors.mutedForeground },
              ]}
            >
              {t === "bmr" ? "BMR / TDEE" : "1RM Strength"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === "bmr" && (
          <>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Uses the Mifflin-St Jeor equation — the most validated BMR formula for active individuals.
            </Text>

            {/* Unit toggle */}
            <View style={[styles.segmented, { backgroundColor: colors.muted }]}>
              {(["metric", "imperial"] as Unit[]).map((u) => (
                <Pressable
                  key={u}
                  onPress={() => setUnit(u)}
                  style={[
                    styles.segment,
                    u === unit && { backgroundColor: colors.card },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: u === unit ? colors.foreground : colors.mutedForeground },
                    ]}
                  >
                    {u === "metric" ? "Metric (kg/cm)" : "Imperial (lbs/in)"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Gender */}
            <View style={[styles.segmented, { backgroundColor: colors.muted }]}>
              {(["male", "female"] as Gender[]).map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[
                    styles.segment,
                    g === gender && { backgroundColor: colors.card },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: g === gender ? colors.foreground : colors.mutedForeground },
                    ]}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Inputs */}
            <View style={styles.inputsRow}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  Weight ({unit === "metric" ? "kg" : "lbs"})
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  placeholder="70"
                  placeholderTextColor={colors.mutedForeground}
                  value={weightInput}
                  onChangeText={setWeightInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  Height ({unit === "metric" ? "cm" : "in"})
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  placeholder="175"
                  placeholderTextColor={colors.mutedForeground}
                  value={heightInput}
                  onChangeText={setHeightInput}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  Age
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  keyboardType="number-pad"
                  placeholder="25"
                  placeholderTextColor={colors.mutedForeground}
                  value={ageInput}
                  onChangeText={setAgeInput}
                />
              </View>
            </View>

            {/* Activity level */}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
              Activity Level
            </Text>
            <View style={styles.activityList}>
              {ACTIVITY_LEVELS.map((a, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.75}
                  onPress={() => setActivityIdx(i)}
                  style={[
                    styles.activityRow,
                    {
                      backgroundColor:
                        activityIdx === i ? colors.primary + "18" : colors.card,
                      borderColor:
                        activityIdx === i ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.activityInfo}>
                    <Text style={[styles.activityLabel, { color: colors.foreground }]}>
                      {a.label}
                    </Text>
                    <Text style={[styles.activitySub, { color: colors.mutedForeground }]}>
                      {a.sublabel}
                    </Text>
                  </View>
                  <Text style={[styles.activityMultiplier, { color: colors.mutedForeground }]}>
                    ×{a.multiplier}
                  </Text>
                  {activityIdx === i && (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Results */}
            {bmrValid ? (
              <>
                <View style={[styles.resultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.resultRow}>
                    <View>
                      <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                        BMR (Basal Metabolic Rate)
                      </Text>
                      <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>
                        Calories burned at complete rest
                      </Text>
                    </View>
                    <Text style={[styles.resultValue, { color: colors.foreground }]}>
                      {Math.round(bmr).toLocaleString()}
                    </Text>
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={styles.resultRow}>
                    <View>
                      <Text style={[styles.resultLabel, { color: colors.mutedForeground }]}>
                        TDEE (Maintenance)
                      </Text>
                      <Text style={[styles.resultSub, { color: colors.mutedForeground }]}>
                        Your daily calorie target to maintain weight
                      </Text>
                    </View>
                    <Text style={[styles.resultValueLarge, { color: colors.primary }]}>
                      {Math.round(tdee).toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={[styles.goalsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.goalsTitle, { color: colors.foreground }]}>
                    Calorie targets by goal
                  </Text>
                  {[
                    { label: "Aggressive cut", delta: -700, color: "#ef4444" },
                    { label: "Moderate cut", delta: -350, color: "#f97316" },
                    { label: "Maintenance", delta: 0, color: "#10b981" },
                    { label: "Lean bulk", delta: 200, color: "#3b82f6" },
                    { label: "Aggressive bulk", delta: 500, color: "#8b5cf6" },
                  ].map((g) => (
                    <View
                      key={g.label}
                      style={[styles.goalRow, { borderBottomColor: colors.border }]}
                    >
                      <View style={[styles.goalDot, { backgroundColor: g.color }]} />
                      <Text style={[styles.goalLabel, { color: colors.foreground }]}>
                        {g.label}
                      </Text>
                      <Text style={[styles.goalValue, { color: g.color }]}>
                        {Math.round(tdee + g.delta).toLocaleString()} kcal
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View style={[styles.placeholder, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="calculator-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  Fill in weight, height and age to see your results
                </Text>
              </View>
            )}
          </>
        )}

        {tab === "oneRM" && (
          <>
            <Text style={[styles.sectionDesc, { color: colors.mutedForeground }]}>
              Estimates your 1 rep max using the Brzycki formula. Works best with 1–10 reps.
            </Text>

            <View style={styles.inputsRow}>
              <View style={[styles.inputGroup, { flex: 1.5 }]}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  Weight lifted (kg or lbs)
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor={colors.mutedForeground}
                  value={rmWeight}
                  onChangeText={setRmWeight}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
                  Reps done
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      color: colors.foreground,
                    },
                  ]}
                  keyboardType="number-pad"
                  placeholder="5"
                  placeholderTextColor={colors.mutedForeground}
                  value={rmReps}
                  onChangeText={setRmReps}
                />
              </View>
            </View>

            {oneRM > 0 ? (
              <>
                <View
                  style={[
                    styles.oneRMHero,
                    { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" },
                  ]}
                >
                  <Text style={[styles.oneRMLabel, { color: colors.mutedForeground }]}>
                    Estimated 1 Rep Max
                  </Text>
                  <Text style={[styles.oneRMValue, { color: colors.primary }]}>
                    {Math.round(oneRM)} kg
                  </Text>
                  <Text style={[styles.oneRMSub, { color: colors.mutedForeground }]}>
                    Brzycki formula · {rmWeight}kg × {rmReps} reps
                  </Text>
                </View>

                <View
                  style={[
                    styles.rmTable,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.rmTableTitle, { color: colors.foreground }]}>
                    Training percentages
                  </Text>
                  {ONE_RM_PERCENTAGES.map((pct) => (
                    <View
                      key={pct}
                      style={[
                        styles.rmRow,
                        { borderBottomColor: colors.border },
                        pct === 100 && {
                          backgroundColor: colors.primary + "12",
                        },
                      ]}
                    >
                      <Text style={[styles.rmPct, { color: pct === 100 ? colors.primary : colors.mutedForeground }]}>
                        {pct}%
                      </Text>
                      <Text style={[styles.rmWeight, { color: colors.foreground }]}>
                        {Math.round((pct / 100) * oneRM)} kg
                      </Text>
                      <Text style={[styles.rmReps, { color: colors.mutedForeground }]}>
                        {pct >= 95
                          ? "1–2 reps"
                          : pct >= 85
                          ? "3–5 reps"
                          : pct >= 75
                          ? "6–8 reps"
                          : pct >= 65
                          ? "10–12 reps"
                          : "15+ reps"}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <View
                style={[
                  styles.placeholder,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name="barbell-outline" size={40} color={colors.mutedForeground} />
                <Text style={[styles.placeholderText, { color: colors.mutedForeground }]}>
                  Enter the weight you lifted and how many reps you did
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 34, alignItems: "flex-start" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, paddingTop: 20, gap: 16 },
  sectionDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  segmented: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: "center",
  },
  segmentText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  inputsRow: { flexDirection: "row", gap: 10 },
  inputGroup: { flex: 1, gap: 6 },
  inputLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  activityList: { gap: 8 },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  activityInfo: { flex: 1 },
  activityLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  activitySub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  activityMultiplier: { fontSize: 12, fontFamily: "Inter_400Regular" },
  resultsCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  resultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  resultLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  resultSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2, maxWidth: 180 },
  resultValue: { fontSize: 22, fontFamily: "SpaceGrotesk_700Bold" },
  resultValueLarge: { fontSize: 30, fontFamily: "SpaceGrotesk_700Bold" },
  divider: { height: 1 },
  goalsCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    gap: 12,
  },
  goalsTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  goalDot: { width: 8, height: 8, borderRadius: 4 },
  goalLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  goalValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  placeholder: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  placeholderText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 260,
  },
  oneRMHero: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 6,
  },
  oneRMLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  oneRMValue: { fontSize: 52, fontFamily: "SpaceGrotesk_700Bold" },
  oneRMSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  rmTable: { borderRadius: 18, borderWidth: 1, overflow: "hidden", padding: 16, gap: 0 },
  rmTableTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  rmRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    gap: 0,
  },
  rmPct: { width: 48, fontSize: 14, fontFamily: "Inter_700Bold" },
  rmWeight: { flex: 1, fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  rmReps: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
