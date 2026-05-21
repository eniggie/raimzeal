import React, { useState, useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useFitness } from "@/contexts/FitnessContext";
import {
  getBloodTypeGuidance,
  getGenotypeGuidance,
  getBloodGroupLabel,
  type BloodType,
  type Genotype,
  type HealthGuidance,
} from "@/lib/healthProfile";

export default function HealthProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useFitness();

  const [activeTab, setActiveTab] = useState<"blood" | "genotype">(
    !user?.bloodType && user?.genotype ? "genotype" : "blood"
  );

  useEffect(() => {
    if (!user?.bloodType && user?.genotype) setActiveTab("genotype");
    else if (user?.bloodType && !user?.genotype) setActiveTab("blood");
  }, [user?.bloodType, user?.genotype]);

  const bloodGuidance: HealthGuidance | null =
    user?.bloodType ? getBloodTypeGuidance(user.bloodType as BloodType) : null;

  const genoGuidance: HealthGuidance | null =
    user?.genotype ? getGenotypeGuidance(user.genotype as Genotype) : null;

  const guidance = activeTab === "blood" ? bloodGuidance : genoGuidance;
  const isSS = user?.genotype === "SS";
  const isSC = user?.genotype === "SC";
  const isHighRisk = isSS || isSC;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Health Profile
          </Text>
          <TouchableOpacity onPress={() => router.push("/edit-profile")}>
            <Ionicons name="create-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Blood group + genotype badges */}
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "40" }]}>
            <Ionicons name="water-outline" size={16} color={colors.primary} />
            <View>
              <Text style={[styles.badgeLabel, { color: colors.mutedForeground }]}>Blood Group</Text>
              <Text style={[styles.badgeValue, { color: colors.foreground }]}>
                {getBloodGroupLabel(user?.bloodType, user?.rhFactor)}
              </Text>
            </View>
          </View>
          <View style={[styles.badge, {
            backgroundColor: isHighRisk ? "#ef444420" : colors.primary + "18",
            borderColor: isHighRisk ? "#ef444440" : colors.primary + "40",
          }]}>
            <Ionicons name="git-network-outline" size={16} color={isHighRisk ? "#ef4444" : colors.primary} />
            <View>
              <Text style={[styles.badgeLabel, { color: colors.mutedForeground }]}>Genotype</Text>
              <Text style={[styles.badgeValue, { color: isHighRisk ? "#ef4444" : colors.foreground }]}>
                {user?.genotype ?? "Not set"}
              </Text>
            </View>
          </View>
        </View>

        {/* Set profile prompt if nothing set */}
        {!user?.bloodType && !user?.genotype && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={28} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Add your health details
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Go to Edit Profile to set your blood type, Rh factor, and genotype. You'll then see personalised,
              evidence-based food guidance here.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/edit-profile")}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.emptyBtnText, { color: colors.primaryForeground }]}>
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tab switcher */}
        {(user?.bloodType || user?.genotype) && (
          <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
            {user?.bloodType && (
              <TouchableOpacity
                onPress={() => setActiveTab("blood")}
                style={[styles.tab, activeTab === "blood" && { backgroundColor: colors.card }]}
              >
                <Text style={[styles.tabText, {
                  color: activeTab === "blood" ? colors.foreground : colors.mutedForeground,
                  fontFamily: activeTab === "blood" ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>
                  Blood Type {user.bloodType}
                </Text>
              </TouchableOpacity>
            )}
            {user?.genotype && (
              <TouchableOpacity
                onPress={() => setActiveTab("genotype")}
                style={[styles.tab, activeTab === "genotype" && { backgroundColor: colors.card }]}
              >
                <Text style={[styles.tabText, {
                  color: activeTab === "genotype" ? colors.foreground : colors.mutedForeground,
                  fontFamily: activeTab === "genotype" ? "Inter_600SemiBold" : "Inter_400Regular",
                }]}>
                  Genotype {user.genotype}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {guidance && (
          <>
            {/* Summary card */}
            <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.guidanceTitle, { color: colors.foreground }]}>{guidance.title}</Text>
              <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>{guidance.summary}</Text>
            </View>

            {/* High-risk medical alert for SS/SC */}
            {isHighRisk && activeTab === "genotype" && (
              <View style={[styles.alertCard, { backgroundColor: "#ef444412", borderColor: "#ef444440" }]}>
                <Ionicons name="warning-outline" size={20} color="#ef4444" />
                <Text style={[styles.alertText, { color: "#ef4444" }]}>
                  Sickle cell disease requires ongoing medical supervision. These nutrition guidelines
                  supplement — they do NOT replace — your haematologist's treatment plan.
                </Text>
              </View>
            )}

            {/* Eat more */}
            <GuidanceSection title="Eat More" colors={colors} items={guidance.eatMore} bulletColor="#22c55e" />

            {/* Eat less */}
            <GuidanceSection title="Eat Less / Limit" colors={colors} items={guidance.eatLess} bulletColor="#ef4444" />

            {/* Key nutrients */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Key Nutrients</Text>
            {guidance.keyNutrients.map((n, i) => (
              <View key={i} style={[styles.nutrientCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.nutrientHeader}>
                  <Ionicons name="flash" size={16} color={colors.accent} />
                  <Text style={[styles.nutrientName, { color: colors.foreground }]}>{n.nutrient}</Text>
                </View>
                <Text style={[styles.nutrientReason, { color: colors.mutedForeground }]}>{n.reason}</Text>
                <View style={styles.foodChips}>
                  {n.foods.map((f, fi) => (
                    <View key={fi} style={[styles.foodChip, { backgroundColor: colors.accent + "18", borderColor: colors.accent + "40" }]}>
                      <Text style={[styles.foodChipText, { color: colors.accent }]}>{f}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* Hydration */}
            <View style={[styles.infoCard, { backgroundColor: "#3b82f618", borderColor: "#3b82f640" }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="water" size={18} color="#3b82f6" />
                <Text style={[styles.infoTitle, { color: "#3b82f6" }]}>Hydration</Text>
              </View>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{guidance.hydration}</Text>
            </View>

            {/* Exercise note */}
            <View style={[styles.infoCard, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "35" }]}>
              <View style={styles.infoHeader}>
                <Ionicons name="barbell-outline" size={18} color={colors.primary} />
                <Text style={[styles.infoTitle, { color: colors.primary }]}>Exercise</Text>
              </View>
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{guidance.exerciseNote}</Text>
            </View>

            {/* Disclaimer */}
            <View style={[styles.disclaimerCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
                {guidance.disclaimer}
              </Text>
            </View>

            {/* Sources */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Evidence Sources</Text>
            <View style={[styles.sourcesCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {guidance.sources.map((s, i) => (
                <Text key={i} style={[styles.sourceText, { color: colors.mutedForeground }]}>• {s}</Text>
              ))}
              <TouchableOpacity
                style={styles.harvardLink}
                onPress={() => Linking.openURL("https://www.hsph.harvard.edu/nutritionsource/")}
              >
                <Ionicons name="open-outline" size={13} color={colors.primary} />
                <Text style={[styles.harvardLinkText, { color: colors.primary }]}>
                  Harvard T.H. Chan — The Nutrition Source
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function GuidanceSection({
  title, colors, items, bulletColor,
}: {
  title: string;
  colors: ReturnType<typeof useColors>;
  items: string[];
  bulletColor: string;
}) {
  return (
    <>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {items.map((item, i) => (
          <View
            key={i}
            style={[
              styles.bulletRow,
              i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <View style={[styles.bullet, { backgroundColor: bulletColor + "30" }]}>
              <View style={[styles.bulletDot, { backgroundColor: bulletColor }]} />
            </View>
            <Text style={[styles.bulletText, { color: colors.foreground }]}>{item}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 12 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8,
  },
  headerTitle: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  badgeRow: { flexDirection: "row", gap: 12 },
  badge: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  badgeLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  badgeValue: { fontSize: 18, fontFamily: "SpaceGrotesk_700Bold" },
  emptyCard: {
    alignItems: "center", gap: 10, padding: 24, borderRadius: 16,
    borderWidth: 1, marginTop: 8,
  },
  emptyTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  emptyBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  tabRow: { flexDirection: "row", borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabText: { fontSize: 13 },
  summaryCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  guidanceTitle: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
  summaryText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  alertCard: {
    flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start",
  },
  alertText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontFamily: "SpaceGrotesk_700Bold", marginTop: 4 },
  listCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  bulletRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  bullet: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  bulletDot: { width: 8, height: 8, borderRadius: 4 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  nutrientCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  nutrientHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  nutrientName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  nutrientReason: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  foodChips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  foodChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  foodChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  infoCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  disclaimerCard: {
    flexDirection: "row", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "flex-start",
  },
  disclaimerText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  sourcesCard: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  sourceText: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 16 },
  harvardLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  harvardLinkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
