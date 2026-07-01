import React from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface CitationNoteProps {
  /** Short label describing what the citation backs, e.g. "BMI classification". */
  label: string;
  /** Name of the source shown as a tappable link, e.g. "CDC Adult BMI guidance". */
  sourceName: string;
  sourceUrl: string;
}

/**
 * Inline source citation for medical/health calculations (BMI, BMR/TDEE, diet
 * guidance) shown directly next to the value it backs — required by App Review
 * guideline 1.4.1 for apps that surface health calculations or recommendations.
 */
export function CitationNote({ label, sourceName, sourceUrl }: CitationNoteProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(sourceUrl)}
      activeOpacity={0.7}
      style={styles.row}
    >
      <Ionicons name="information-circle-outline" size={12} color={colors.mutedForeground} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        {label} source: <Text style={{ color: colors.primary, textDecorationLine: "underline" }}>{sourceName}</Text>
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" },
  text: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
