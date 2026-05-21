import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

const ALL_FEATURES = [
  "Full workout library & programs",
  "Unlimited nutrition logging",
  "Full body measurements",
  "Unlimited Ovia AI coaching",
  "Community posting & comments",
  "Activity tracker & reminders",
  "Progress card sharing",
  "Calendar scheduling",
  "Weekly Ovia coaching digest",
  "Custom workout builder",
  "Early access to new features",
  "Basic progress charts",
  "Weight tracking",
];

export default function MembershipScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Membership</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Everything included, forever
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#2E8B571a", "#2E8B5708"]}
          style={[styles.card, { borderColor: "#2E8B57", borderWidth: 1.5 }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: "#2E8B5722" }]}>
              <Ionicons name="star-outline" size={22} color="#2E8B57" />
            </View>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.planName, { color: colors.foreground }]}>RAIMZEAL</Text>
              <Text style={[styles.planTagline, { color: colors.mutedForeground }]}>All features included</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={[styles.price, { color: colors.foreground }]}>Free</Text>
              <Text style={[styles.priceSub, { color: colors.mutedForeground }]}>forever</Text>
            </View>
          </View>

          <View style={styles.featureList}>
            {ALL_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={16} color="#2E8B57" style={styles.checkIcon} />
                <Text style={[styles.featureText, { color: colors.foreground + "cc" }]}>{f}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: "#ffffff12" }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={[styles.ctaText, { color: colors.mutedForeground }]}>
              You're all set
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Donation card */}
        <View style={[styles.donationCard, { borderColor: "#2E8B5740", backgroundColor: "#2E8B5710" }]}>
          <Text style={[styles.donationHeadline, { color: colors.foreground }]}>
            Non-profit organization · RAIMZEAL is free forever
          </Text>
          <Text style={[styles.donationBody, { color: colors.mutedForeground }]}>
            Most platforms sold out. We didn't.{"\n\n"}No ads. No investors. No subscriptions — just your health, protected. We said no to deals that would have changed that.{"\n\n"}If RAIMZEAL has played even a small role in your journey, a donation keeps the lights on for you and for the next person who finds us. You're not supporting an app. You're part of a movement.
          </Text>
          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() =>
              Linking.openURL("https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00").catch(() => {
                Linking.openURL("mailto:support@raimzeal.com?subject=Donation");
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="heart" size={15} color="#fff" />
            <Text style={styles.donateBtnText}>Donate — Any Amount</Text>
          </TouchableOpacity>
          <Text style={[styles.donationLinksLabel, { color: colors.mutedForeground }]}>
            RAIMZY — Dr. Ephraim Oviawe{"\n"}Author · Music Artist · Strategist · The mind behind RAIMZEAL
          </Text>
          <View style={styles.donationLinkCol}>
            <TouchableOpacity onPress={() => Linking.openURL("https://linktr.ee/Raimzy")}>
              <Text style={styles.donationLink}>linktr.ee/Raimzy — all resources</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL("https://www.raimzy.com")}>
              <Text style={styles.donationLink}>www.raimzy.com — official site</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL("https://unitedmasters.com/raimzy")}>
              <Text style={styles.donationLink}>unitedmasters.com/raimzy — music</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL("https://www.amazon.com/author/dr.ephraim-oviawe")}>
              <Text style={styles.donationLink}>amazon.com — books by Dr. Oviawe</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.donationAttrib, { color: colors.mutedForeground }]}>
            Created and powered by ECONTEUR LLC{"\n"}www.econteur.com
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#ffffff10",
    alignItems: "center",
    justifyContent: "center",
  },
  title:    { fontSize: 22, fontWeight: "800", letterSpacing: 0.3 },
  subtitle: { fontSize: 13, marginTop: 2 },
  scroll:   { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  iconBox:   { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitleBlock: { flex: 1 },
  planName:    { fontSize: 17, fontWeight: "700" },
  planTagline: { fontSize: 12, marginTop: 1 },
  priceBlock:  { alignItems: "flex-end" },
  price:       { fontSize: 20, fontWeight: "900" },
  priceSub:    { fontSize: 11, marginTop: -2 },
  featureList: { gap: 8 },
  featureRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  checkIcon:   { marginTop: 1 },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontSize: 15, fontWeight: "700" },
  donationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  donationHeadline: { fontSize: 14, fontWeight: "800", lineHeight: 20 },
  donationBody:     { fontSize: 12, lineHeight: 19 },
  donateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#2E8B57",
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 4,
  },
  donateBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  donationLinksLabel: { fontSize: 11, marginTop: 4, lineHeight: 17 },
  donationLinkCol: { flexDirection: "column", gap: 5, marginTop: 2 },
  donationLink:    { fontSize: 12, fontWeight: "700", color: "#2E8B57" },
  donationAttrib:  { fontSize: 11, lineHeight: 17, marginTop: 4 },
});
