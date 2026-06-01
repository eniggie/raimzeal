import React, { useState } from "react";
import {
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { STRIPE_DONATION_URL } from "@/lib/constants";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";
import { Linking } from "react-native";

const FOUNDATION_FEATURES = [
  "Basic workout logging",
  "Basic food logging",
  "Water tracking",
  "Body measurements",
  "Progress photos",
  "Basic community challenges",
  "Limited AI wellness coach",
  "Limited barcode & food scan results",
  "Basic weekly summary",
];

const RISE_FEATURES = [
  "Everything in Foundation",
  "Improved food scan results",
  "Macro breakdown — calories, protein, carbs, fat, fiber",
  "Basic meal planning",
  "Basic adaptive workouts",
  "Habit reminders",
  "Weekly wellness report",
  "More AI coach messages",
];

const REIGN_FEATURES = [
  "Everything in Rise",
  "Full AI wellness coach",
  "Full food scan analysis",
  "Cycle syncing",
  "Adaptive strength programs",
  "Stress & sleep readiness",
  "Nutrition planning & recipes",
  "Hydration recommendations",
  "Progress insights",
  "Wearable integration (where available)",
  "Priority AI recommendations",
];

const LEGACY_FEATURES = [
  "Everything in Reign",
  "Fertility & pregnancy wellness tracking",
  "Advanced wearable insights",
  "Predictive wellness alerts",
  "Advanced weekly reports",
  "Premium community challenges",
  "Priority support",
  "Early access to new features",
  "Legacy supporter badge",
];

type PaidPlan = {
  key: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  borderColor: string;
  bgStart: string;
  bgEnd: string;
  monthly: number;
  yearly: number;
  yearlyEquiv: number;
  popular: boolean;
  badgeLabel: string | null;
  foundingOffer: string | null;
  features: string[];
};

const PAID_PLANS: PaidPlan[] = [
  {
    key: "rise",
    name: "Rise",
    icon: "flash-outline",
    color: "#60a5fa",
    borderColor: "#3b82f6",
    bgStart: "#1e3a5f",
    bgEnd: "#0f172a",
    monthly: 4.99,
    yearly: 39.99,
    yearlyEquiv: 3.33,
    popular: false,
    badgeLabel: null,
    foundingOffer: null,
    features: RISE_FEATURES,
  },
  {
    key: "reign",
    name: "Reign",
    icon: "star-outline",
    color: "#c084fc",
    borderColor: "#a855f7",
    bgStart: "#3b1f5e",
    bgEnd: "#0f172a",
    monthly: 9.99,
    yearly: 79.99,
    yearlyEquiv: 6.67,
    popular: true,
    badgeLabel: "Best Value",
    foundingOffer: "Founding Member Price: $4.99/mo for the first 1,000 members.",
    features: REIGN_FEATURES,
  },
  {
    key: "legacy",
    name: "Legacy",
    icon: "trophy-outline",
    color: "#fbbf24",
    borderColor: "#f59e0b",
    bgStart: "#3d2a0a",
    bgEnd: "#0f172a",
    monthly: 19.99,
    yearly: 149.99,
    yearlyEquiv: 12.50,
    popular: false,
    badgeLabel: null,
    foundingOffer: null,
    features: LEGACY_FEATURES,
  },
];

function getPlatformPaymentLabel(): string {
  if (Platform.OS === "ios") return "Apple In-App Purchase";
  if (Platform.OS === "android") return "Google Play Billing";
  return "Stripe";
}

function getPlatformPaymentNote(): string {
  if (Platform.OS === "ios") {
    return "iOS subscriptions are processed via Apple In-App Purchase. Native payment setup is in progress — check back soon!";
  }
  if (Platform.OS === "android") {
    return "Android subscriptions are processed via Google Play Billing. Native payment setup is in progress — check back soon!";
  }
  return "";
}

export default function MembershipScreen() {
  const colors = useColors();
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  const isMobilePlatform = Platform.OS === "ios" || Platform.OS === "android";
  const paymentLabel = getPlatformPaymentLabel();
  const paymentNote = getPlatformPaymentNote();

  function handleSubscribeTap(plan: PaidPlan, interval: "monthly" | "yearly") {
    const price = interval === "monthly" ? plan.monthly : plan.yearly;
    const period = interval === "monthly" ? "/mo" : "/yr";

    if (Platform.OS === "ios") {
      Alert.alert(
        `${plan.name} — Apple In-App Purchase`,
        `$${price.toFixed(2)}${period}\n\nApple In-App Purchase setup is in progress. Thank you for your interest in the ${plan.name} plan! We'll notify you as soon as native iOS payments are available.\n\nIn the meantime, you can subscribe via our website at raimzeal.com.`,
        [
          { text: "Visit raimzeal.com", onPress: () => Linking.openURL("https://raimzeal.com/membership") },
          { text: "OK", style: "cancel" },
        ]
      );
      return;
    }

    if (Platform.OS === "android") {
      Alert.alert(
        `${plan.name} — Google Play Billing`,
        `$${price.toFixed(2)}${period}\n\nGoogle Play Billing setup is in progress. Thank you for your interest in the ${plan.name} plan! We'll notify you as soon as native Android payments are available.\n\nIn the meantime, you can subscribe via our website at raimzeal.com.`,
        [
          { text: "Visit raimzeal.com", onPress: () => Linking.openURL("https://raimzeal.com/membership") },
          { text: "OK", style: "cancel" },
        ]
      );
      return;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Membership</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Foundation is free forever. Rise, Reign &amp; Legacy unlock more.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Platform payment notice */}
        {isMobilePlatform && (
          <View style={[styles.platformNotice, { borderColor: "#2E8B5740", backgroundColor: "#2E8B5710" }]}>
            <Ionicons
              name={Platform.OS === "ios" ? "logo-apple" : "logo-google-playstore"}
              size={16}
              color="#2E8B57"
            />
            <Text style={[styles.platformNoticeText, { color: colors.mutedForeground }]}>
              {paymentNote}
            </Text>
          </View>
        )}

        {/* Foundation — Free Forever */}
        <LinearGradient
          colors={["#2E8B571a", "#2E8B5708"]}
          style={[styles.card, { borderColor: "#2E8B57", borderWidth: 1.5 }]}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.iconBox, { backgroundColor: "#2E8B5722" }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#2E8B57" />
            </View>
            <View style={styles.cardTitleBlock}>
              <Text style={[styles.planName, { color: colors.foreground }]}>Foundation</Text>
              <Text style={[styles.planTagline, { color: colors.mutedForeground }]}>RAIMZEAL — All core features</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={[styles.price, { color: "#2E8B57" }]}>Free</Text>
              <Text style={[styles.priceSub, { color: colors.mutedForeground }]}>forever</Text>
            </View>
          </View>

          <View style={styles.featureList}>
            {FOUNDATION_FEATURES.map((f) => (
              <View key={f} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={15} color="#2E8B57" style={styles.checkIcon} />
                <Text style={[styles.featureText, { color: colors.foreground + "cc" }]}>{f}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Billing toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, billing === "monthly" && styles.toggleBtnActive]}
            onPress={() => setBilling("monthly")}
          >
            <Text style={[styles.toggleLabel, billing === "monthly" ? styles.toggleLabelActive : { color: colors.mutedForeground }]}>
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, billing === "yearly" && styles.toggleBtnActive]}
            onPress={() => setBilling("yearly")}
          >
            <Text style={[styles.toggleLabel, billing === "yearly" ? styles.toggleLabelActive : { color: colors.mutedForeground }]}>
              Yearly
            </Text>
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save up to 37%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Paid plan cards */}
        {PAID_PLANS.map((plan) => {
          const price = billing === "monthly" ? plan.monthly : plan.yearly;
          const period = billing === "monthly" ? "/mo" : "/yr";

          return (
            <View key={plan.key}>
              {plan.popular && plan.badgeLabel && (
                <View style={styles.popularBadgeWrap}>
                  <View style={[styles.popularBadge, { backgroundColor: plan.key === "reign" ? "#a855f7" : "#2E8B57" }]}>
                    <Ionicons name="flame" size={11} color="#fff" />
                    <Text style={styles.popularBadgeText}>{plan.badgeLabel}</Text>
                  </View>
                </View>
              )}
              <LinearGradient
                colors={[plan.bgStart, plan.bgEnd]}
                style={[styles.card, { borderColor: plan.borderColor + "66", borderWidth: 1.5 }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: plan.color + "22" }]}>
                    <Ionicons name={plan.icon} size={20} color={plan.color} />
                  </View>
                  <View style={styles.cardTitleBlock}>
                    <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                    <Text style={[styles.planTagline, { color: colors.mutedForeground }]}>
                      {billing === "yearly"
                        ? `$${plan.yearlyEquiv.toFixed(2)}/mo equivalent`
                        : "Billed monthly · Cancel anytime"}
                    </Text>
                  </View>
                  <View style={styles.priceBlock}>
                    <Text style={[styles.price, { color: plan.color }]}>
                      ${price.toFixed(2)}
                    </Text>
                    <Text style={[styles.priceSub, { color: colors.mutedForeground }]}>{period}</Text>
                  </View>
                </View>

                {/* Founding member offer */}
                {plan.foundingOffer && (
                  <View style={[styles.foundingBanner, { borderColor: plan.color + "40", backgroundColor: plan.color + "12" }]}>
                    <Ionicons name="flame" size={13} color={plan.color} />
                    <Text style={[styles.foundingText, { color: plan.color }]}>{plan.foundingOffer}</Text>
                  </View>
                )}

                <View style={styles.featureList}>
                  {plan.features.map((f) => (
                    <View key={f} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={15} color={plan.color} style={styles.checkIcon} />
                      <Text style={[styles.featureText, { color: colors.foreground + "cc" }]}>{f}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.ctaBtn,
                    {
                      backgroundColor: plan.color + "25",
                      borderColor: plan.color + "60",
                      borderWidth: 1,
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleSubscribeTap(plan, billing)}
                >
                  <Text style={[styles.ctaText, { color: plan.color }]}>
                    {`Subscribe via ${paymentLabel} — $${price.toFixed(2)}${period}`}
                  </Text>
                </TouchableOpacity>

                <Text style={[styles.secureNote, { color: colors.mutedForeground }]}>
                  {isMobilePlatform
                    ? `Paid via ${paymentLabel} · Cancel anytime`
                    : "Secure checkout via Stripe · Cancel anytime"}
                </Text>
              </LinearGradient>
            </View>
          );
        })}

        {/* Donation card */}
        <View style={[styles.donationCard, { borderColor: "#2E8B5740", backgroundColor: "#2E8B5710" }]}>
          <Text style={[styles.donationHeadline, { color: colors.foreground }]}>
            The Foundation Plan is free forever — no subscription, no catch.
          </Text>
          <Text style={[styles.donationBody, { color: colors.mutedForeground }]}>
            The Foundation Plan is free forever, built for fitness, food therapy, wellness, and healthcare support. Your health was never up for sale.{"\n\n"}A voluntary donation keeps the staff and platform running for everyone — you are never required to give anything.
          </Text>
          <TouchableOpacity
            style={styles.donateBtn}
            onPress={() =>
              Linking.openURL(STRIPE_DONATION_URL).catch(() => {
                Linking.openURL("mailto:support@raimzeal.com?subject=Donation");
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="heart" size={15} color="#fff" />
            <Text style={styles.donateBtnText}>Donate — Any Amount</Text>
          </TouchableOpacity>
          <Text style={[styles.donationLinksLabel, { color: colors.foreground }]}>
            RAIMZY — Dr. Ephraim Oviawe PHD, MBA, MTS, CST, AMA, DMIPRO, CSM, PMP
          </Text>
          <Text style={[styles.donationBody, { color: colors.mutedForeground }]}>
            Author, music artist, strategist, and the mind behind RAIMZEAL. Explore his books, music, courses, and coaching — built around leadership, wellness, creativity, and business execution.
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
            Created and powered by ECONTEUR LLC · www.econteur.com
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
  scroll:   { paddingHorizontal: 16, paddingBottom: 48, gap: 12 },

  platformNotice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  platformNoticeText: { fontSize: 12, flex: 1, lineHeight: 18 },

  toggleRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff0a",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: "#ffffff15",
    alignSelf: "center",
  },
  toggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: "#2E8B57" },
  toggleLabel: { fontSize: 13, fontWeight: "600" },
  toggleLabelActive: { color: "#fff" },
  saveBadge: {
    backgroundColor: "#ffffff30",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  saveBadgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },

  popularBadgeWrap: { alignItems: "center", marginBottom: -10, zIndex: 1 },
  popularBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  popularBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  card: {
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 4 },
  iconBox:   { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  cardTitleBlock: { flex: 1, gap: 4 },
  planName:    { fontSize: 17, fontWeight: "700" },
  planTagline: { fontSize: 12, marginTop: 1 },
  priceBlock:  { alignItems: "flex-end" },
  price:       { fontSize: 22, fontWeight: "900" },
  priceSub:    { fontSize: 11, marginTop: -2 },

  foundingBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  foundingText: { fontSize: 12, fontWeight: "700", flex: 1, lineHeight: 17 },

  featureList: { gap: 8 },
  featureRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  checkIcon:   { marginTop: 1 },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  ctaText:    { fontSize: 14, fontWeight: "700", textAlign: "center" },
  secureNote: { fontSize: 11, textAlign: "center", marginTop: -4 },

  donationCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    gap: 10,
    marginTop: 4,
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
  donationLinksLabel: { fontSize: 11, marginTop: 4, lineHeight: 17, fontWeight: "700" },
  donationLinkCol: { flexDirection: "column", gap: 5, marginTop: 2 },
  donationLink:    { fontSize: 12, fontWeight: "700", color: "#2E8B57" },
  donationAttrib:  { fontSize: 11, lineHeight: 17, marginTop: 4 },
});
