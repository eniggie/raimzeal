import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness, BodyMeasurement } from "@/contexts/FitnessContext";
import { useAuth } from "@/contexts/AuthContext";
import { SyncIndicator } from "@/components/SyncIndicator";
import { useSyncIndicator } from "@/hooks/useSyncIndicator";
import { CitationNote } from "@/components/CitationNote";

function generateId(): string {
  return `bm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function calcBMI(weight: number, heightCm: number): string {
  if (!heightCm || !weight) return "—";
  const h = heightCm / 100;
  return (weight / (h * h)).toFixed(1);
}

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "#3b82f6" };
  if (bmi < 25) return { label: "Healthy", color: "#22c55e" };
  if (bmi < 30) return { label: "Overweight", color: "#f59e0b" };
  return { label: "Obese", color: "#ef4444" };
}

interface MeasurementField {
  key: keyof Omit<BodyMeasurement, "id" | "date">;
  label: string;
  unit: string;
  icon: string;
  color: string;
}

const FIELDS: MeasurementField[] = [
  { key: "weight", label: "Weight", unit: "kg", icon: "scale-outline", color: "#2E8B57" },
  { key: "chest", label: "Chest", unit: "cm", icon: "body-outline", color: "#8B31C7" },
  { key: "waist", label: "Waist", unit: "cm", icon: "body-outline", color: "#C9A84C" },
  { key: "hips", label: "Hips", unit: "cm", icon: "body-outline", color: "#3b82f6" },
  { key: "arms", label: "Arms", unit: "cm", icon: "fitness-outline", color: "#ef4444" },
  { key: "thighs", label: "Thighs", unit: "cm", icon: "fitness-outline", color: "#f59e0b" },
];

export default function BodyMeasurementsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ add?: string }>();
  const { bodyMeasurements, addBodyMeasurement, user, settings } = useFitness();
  const { syncStatus, startSync, finishSync } = useSyncIndicator();

  const { user: authUser } = useAuth();

  const topPad = Platform.OS === "web" ? 20 : insets.top;
  const unitLabel = settings.weightUnit === "lbs" ? "lbs" : "kg";

  const [showModal, setShowModal] = useState(params.add === "1");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [fields, setFields] = useState<Partial<Record<keyof Omit<BodyMeasurement, "id" | "date">, string>>>({
    weight: "",
    chest: "",
    waist: "",
    hips: "",
    arms: "",
    thighs: "",
  });
  const [saving, setSaving] = useState(false);

  const sortedMeasurements = [...bodyMeasurements].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const latest = sortedMeasurements[0];
  const previous = sortedMeasurements[1];
  const weightChange = latest && previous ? latest.weight - previous.weight : 0;
  const bmiValue = latest && user?.height ? parseFloat(calcBMI(latest.weight, user.height)) : null;
  const bmiInfo = bmiValue ? bmiCategory(bmiValue) : null;

  function openAdd() {
    setFields({ weight: "", chest: "", waist: "", hips: "", arms: "", thighs: "" });
    setShowModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleSave() {
    const w = parseFloat(fields.weight ?? "");
    if (!w || isNaN(w) || w <= 0) {
      Alert.alert("Weight required", "Please enter a valid weight to log your measurement.");
      return;
    }
    if (w > 700) {
      Alert.alert("Check your value", "Weight seems unusually high. Please double-check the number.");
      return;
    }
    setSaving(true);
    const measurement: BodyMeasurement = {
      id: generateId(),
      date: new Date().toISOString().split("T")[0],
      weight: w,
      chest: fields.chest ? parseFloat(fields.chest) || undefined : undefined,
      waist: fields.waist ? parseFloat(fields.waist) || undefined : undefined,
      hips: fields.hips ? parseFloat(fields.hips) || undefined : undefined,
      arms: fields.arms ? parseFloat(fields.arms) || undefined : undefined,
      thighs: fields.thighs ? parseFloat(fields.thighs) || undefined : undefined,
    };
    startSync();
    try {
      addBodyMeasurement(measurement);
      finishSync(true);
    } catch {
      finishSync(false);
    }
    setShowModal(false);
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function renderMeasurement({ item, index }: { item: BodyMeasurement; index: number }) {
    const prev = sortedMeasurements[index + 1];
    const delta = prev ? item.weight - prev.weight : null;
    const expanded = expandedId === item.id;

    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          setExpandedId(expanded ? null : item.id);
        }}
        activeOpacity={0.8}
        style={[styles.measureCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.measureMain}>
          <View style={styles.measureDate}>
            <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
            <Text style={[styles.measureDateText, { color: colors.mutedForeground }]}>
              {formatDate(item.date)}
            </Text>
          </View>
          <View style={styles.measureRight}>
            <Text style={[styles.measureWeight, { color: colors.foreground }]}>
              {item.weight.toFixed(1)} {unitLabel}
            </Text>
            {delta !== null && (
              <View
                style={[
                  styles.deltaBadge,
                  {
                    backgroundColor:
                      (delta <= 0 ? colors.success : colors.destructive) + "20",
                  },
                ]}
              >
                <Ionicons
                  name={delta <= 0 ? "trending-down" : "trending-up"}
                  size={11}
                  color={delta <= 0 ? colors.success : colors.destructive}
                />
                <Text
                  style={[
                    styles.deltaText,
                    { color: delta <= 0 ? colors.success : colors.destructive },
                  ]}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}
                </Text>
              </View>
            )}
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </View>
        </View>

        {expanded && (
          <View style={[styles.measureDetails, { borderTopColor: colors.border }]}>
            {(["chest", "waist", "hips", "arms", "thighs"] as const).map((key) => {
              const val = item[key];
              if (val === undefined) return null;
              const f = FIELDS.find((f) => f.key === key);
              return (
                <View key={key} style={styles.measureDetail}>
                  <Text style={[styles.measureDetailLabel, { color: colors.mutedForeground }]}>
                    {f?.label}
                  </Text>
                  <Text style={[styles.measureDetailValue, { color: colors.foreground }]}>
                    {val} cm
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Body Measurements
        </Text>
        <TouchableOpacity
          onPress={openAdd}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add" size={18} color={colors.primaryForeground} />
          <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>
            Add Entry
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sortedMeasurements}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Stats Overview */}
            <View style={styles.statsGrid}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name="scale-outline" size={20} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {latest?.weight.toFixed(1) ?? "—"} {unitLabel}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Current Weight
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="analytics-outline"
                  size={20}
                  color={bmiInfo?.color ?? colors.primary}
                />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {bmiValue?.toFixed(1) ?? "—"}
                </Text>
                <Text style={[styles.statLabel, { color: bmiInfo?.color ?? colors.mutedForeground }]}>
                  {bmiInfo?.label ?? "BMI"}
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={weightChange <= 0 ? "trending-down-outline" : "trending-up-outline"}
                  size={20}
                  color={weightChange <= 0 ? colors.success : colors.destructive}
                />
                <Text
                  style={[
                    styles.statValue,
                    { color: weightChange <= 0 ? colors.success : colors.destructive },
                  ]}
                >
                  {weightChange > 0 ? "+" : ""}
                  {weightChange.toFixed(1)} {unitLabel}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Last Change
                </Text>
              </View>

              <View
                style={[
                  styles.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Ionicons name="time-outline" size={20} color={colors.secondary} />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {sortedMeasurements.length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  Entries
                </Text>
              </View>
            </View>

            {/* Body Composition Insights */}
            {sortedMeasurements.length >= 2 ? (() => {
              const oldest = sortedMeasurements[sortedMeasurements.length - 1];
              const daysDiff = Math.max(1, (new Date(latest!.date).getTime() - new Date(oldest.date).getTime()) / (1000 * 60 * 60 * 24));
              const totalChange = latest!.weight - oldest.weight;
              const weeklyRate = (totalChange / daysDiff) * 7;
              const direction = weeklyRate < -0.05 ? "losing" : weeklyRate > 0.05 ? "gaining" : "maintaining";
              const rateStr = Math.abs(weeklyRate).toFixed(2);
              return (
                <View style={[styles.insightsCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}>
                  <View style={styles.insightsHeader}>
                    <Ionicons name="analytics" size={16} color={colors.primary} />
                    <Text style={[styles.insightsTitle, { color: colors.primary }]}>Body Composition Insights</Text>
                  </View>
                  <Text style={[styles.insightRow, { color: colors.foreground }]}>
                    📈 You are <Text style={{ fontFamily: "Inter_600SemiBold" }}>{direction}</Text> weight at ~{rateStr} {unitLabel}/week
                  </Text>
                  <Text style={[styles.insightRow, { color: colors.foreground }]}>
                    ⚖️ Total change since first entry: <Text style={{ fontFamily: "Inter_600SemiBold" }}>{totalChange >= 0 ? "+" : ""}{totalChange.toFixed(1)} {unitLabel}</Text>
                  </Text>
                  {bmiValue && bmiInfo && (
                    <>
                      <Text style={[styles.insightRow, { color: colors.foreground }]}>
                        🩺 BMI <Text style={{ fontFamily: "Inter_600SemiBold", color: bmiInfo.color }}>{bmiValue.toFixed(1)} — {bmiInfo.label}</Text>
                        {bmiValue < 18.5 ? " (aim for 18.5–24.9)" : bmiValue < 25 ? " — great range to maintain" : bmiValue < 30 ? " (aim for below 25)" : " (consult a healthcare professional)"}
                      </Text>
                      <CitationNote
                        label="BMI classification"
                        sourceName="CDC Adult BMI Categories"
                        sourceUrl="https://www.cdc.gov/bmi/adult-calculator/bmi-categories.html"
                      />
                    </>
                  )}
                  <Text style={[styles.insightRow, { color: colors.mutedForeground }]}>
                    📅 Tracked over {Math.round(daysDiff)} days across {sortedMeasurements.length} entries
                  </Text>
                </View>
              );
            })() : null}

            {sortedMeasurements.length > 0 && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                History
              </Text>
            )}
          </>
        }
        renderItem={renderMeasurement}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="body-outline" size={52} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No measurements yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Tap "Add Entry" to log your first body measurement and start tracking your progress.
            </Text>
            <TouchableOpacity
              onPress={openAdd}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
                Log First Measurement
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Add Measurement Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalScreen, { backgroundColor: colors.background }]}>
            <View
              style={[styles.modalHeader, { borderBottomColor: colors.border }]}
            >
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Add Measurement
              </Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving || !fields.weight?.trim()}
                style={[
                  styles.modalSaveBtn,
                  {
                    backgroundColor: fields.weight?.trim()
                      ? colors.primary
                      : colors.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalSaveBtnText,
                    {
                      color: fields.weight?.trim()
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.modalNote, { color: colors.mutedForeground }]}>
                Weight is required. All other measurements are optional but help you track body composition more accurately.
              </Text>

              {FIELDS.map((f) => (
                <View key={f.key} style={styles.inputRow}>
                  <View
                    style={[
                      styles.inputIconBox,
                      { backgroundColor: f.color + "20" },
                    ]}
                  >
                    <Ionicons
                      name={f.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={f.color}
                    />
                  </View>
                  <View style={styles.inputInfo}>
                    <Text style={[styles.inputLabel, { color: colors.foreground }]}>
                      {f.label}
                      {f.key === "weight" && (
                        <Text style={{ color: colors.destructive }}> *</Text>
                      )}
                    </Text>
                    <Text style={[styles.inputUnit, { color: colors.mutedForeground }]}>
                      {f.key === "weight" ? unitLabel : f.unit}
                    </Text>
                  </View>
                  <TextInput
                    value={fields[f.key] ?? ""}
                    onChangeText={(v) =>
                      setFields((prev) => ({ ...prev, [f.key]: v }))
                    }
                    keyboardType="decimal-pad"
                    placeholder={f.key === "weight" ? "e.g. 75.5" : "Optional"}
                    placeholderTextColor={colors.mutedForeground}
                    style={[
                      styles.fieldInput,
                      {
                        backgroundColor: colors.muted,
                        color: colors.foreground,
                        borderColor:
                          f.key === "weight" && !fields.weight?.trim()
                            ? colors.destructive + "60"
                            : colors.border,
                      },
                    ]}
                  />
                </View>
              ))}

              <View
                style={[
                  styles.modalTip,
                  { backgroundColor: colors.muted, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={15}
                  color={colors.mutedForeground}
                />
                <Text style={[styles.modalTipText, { color: colors.mutedForeground }]}>
                  Measure first thing in the morning, after using the bathroom, and before eating for the most consistent results.
                </Text>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <SyncIndicator status={syncStatus} />
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
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 12 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  statCard: {
    width: "47%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 5,
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
    marginTop: 4,
  },
  insightsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  insightsTitle: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  insightRow: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  measureCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 2,
  },
  measureMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  measureDate: { flexDirection: "row", alignItems: "center", gap: 6 },
  measureDateText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  measureRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  measureWeight: { fontSize: 16, fontFamily: "Inter_700Bold" },
  deltaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  deltaText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  measureDetails: {
    borderTopWidth: 1,
    padding: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  measureDetail: { width: "30%" },
  measureDetailLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
  measureDetailValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  emptyState: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  emptyBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalScreen: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 14,
    borderBottomWidth: 1,
  },
  modalCancel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  modalTitle: { fontSize: 17, fontFamily: "SpaceGrotesk_700Bold" },
  modalSaveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  modalSaveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  modalBody: { padding: 16, gap: 12 },
  modalNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inputIconBox: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  inputInfo: { flex: 1 },
  inputLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  inputUnit: { fontSize: 11, fontFamily: "Inter_400Regular" },
  fieldInput: {
    width: 90,
    height: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    textAlign: "right",
  },
  modalTip: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 8,
    alignItems: "flex-start",
  },
  modalTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
});
