import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { STRIPE_DONATION_URL } from "@/lib/constants";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/db";

const FOUNDATION_FEATURES = [
  "Full workout library & custom workouts",
  "Ovia AI coaching — 10 messages/day",
  "Full community: post, comment, like",
  "Nutrition & meal logging with macros",
  "Body measurements & weight tracking",
  "Progress charts & personal records",
  "Sleep tracking & streak tracking",
  "Workout calendar scheduling",
  "Data export (JSON / CSV)",
  "Public profile with shareable link",
  "Macro target calculator",
];

const RISE_FEATURES = [
  "Everything in Foundation",
  "Ovia AI coaching — 200 messages/day",
  "Voice notes in Ovia AI (speak your check-in)",
  "Priority community badge",
  "Advanced nutrition analytics",
  "Extended workout history (unlimited)",
  "Weekly Ovia AI coaching digest email",
];

const REIGN_FEATURES = [
  "Everything in Rise",
  "Ovia AI coaching — 500 messages/day",
  "AI-powered meal plan suggestions",
  "Advanced body composition analytics",
  "Custom macro goal recommendations",
  "Reign supporter badge",
  "Early access to all new features",
];

const LEGACY_FEATURES = [
  "Everything in Reign",
  "Ovia AI coaching — unlimited messages",
  "Private Inner Circle Community (Legacy-only feed)",
  "Legacy Leaderboard — see your rank among founders",
  "Monthly AI Health Report (personalised by Ovia)",
  "Personalised 4-week Coaching Plan from Ovia AI",
  "Accountability Partner Matching with another Legacy member",
  "Founding Member Certificate — Legacy Founder #",
  "Legacy founder badge + lifetime community recognition",
  "Dedicated priority support",
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
    monthly: 9.99,
    yearly: 99,
    yearlyEquiv: 8.25,
    popular: false,
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
    monthly: 19.99,
    yearly: 199,
    yearlyEquiv: 16.58,
    popular: true,
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
    monthly: 49.99,
    yearly: 499,
    yearlyEquiv: 41.58,
    popular: false,
    features: LEGACY_FEATURES,
  },
];

export default function MembershipScreen() {
  const colors = useColors();
  const router = useRouter();
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<Record<string, boolean>>({});
  // intentionally no checkoutError state — each case now uses specific Alert dialogs

  async function handleCheckout(tier: string, interval: "monthly" | "yearly") {
    setCheckoutLoading((prev) => ({ ...prev, [tier]: true }));

    // 1 — Verify auth session (guarded separately so a Supabase hiccup
    //     doesn't land in the generic outer catch).
    let accessToken: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token ?? null;
    } catch {
      Alert.alert("Sign In Required", "Please sign in to your RAIMZEAL account to subscribe.");
      setCheckoutLoading((prev) => ({ ...prev, [tier]: false }));
      return;
    }

    if (!accessToken) {
      Alert.alert("Sign In Required", "Please sign in to your RAIMZEAL account to subscribe.");
      setCheckoutLoading((prev) => ({ ...prev, [tier]: false }));
      return;
    }

    // 2 — Call the checkout-session endpoint.
    let res: Response;
    try {
      res = await fetch(`${getApiBase()}/stripe/checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tier, interval }),
      });
    } catch {
      Alert.alert("Connection Error", "Server temporarily unavailable. Please wait a moment and try again.");
      setCheckoutLoading((prev) => ({ ...prev, [tier]: false }));
      return;
    }

    // 3 — Parse the response body (guard against non-JSON gateway pages).
    let data: { url?: string; error?: string; code?: string } = {};
    try {
      data = await res.json() as typeof data;
    } catch {
      // non-JSON response (proxy/gateway error page) — treat as unavailable
    }

    setCheckoutLoading((prev) => ({ ...prev, [tier]: false }));

    // 4 — Handle each outcome.
    if (res.status === 503 || data.code === "STRIPE_NOT_CONFIGURED") {
      Alert.alert(
        "Temporarily Unavailable",
        "Checkout is temporarily unavailable. Please try again in a moment.",
        [{ text: "OK" }]
      );
      return;
    }

    if (res.status === 401) {
      Alert.alert("Session Expired", "Please sign out, sign back in, and try again.");
      return;
    }

    if (!res.ok || !data.url) {
      const msg = data.error ?? `Could not start checkout (${res.status}). Please try again.`;
      Alert.alert("Checkout Error", msg);
      return;
    }

    try {
      await Linking.openURL(data.url);
    } catch {
      Alert.alert("Error", "Could not open the checkout page. Please try again.");
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
              <Text style={styles.saveBadgeText}>Save 17%</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Paid plan cards */}
        {PAID_PLANS.map((plan) => {
          const price = billing === "monthly" ? plan.monthly : plan.yearly;
          const period = billing === "monthly" ? "/mo" : "/yr";
          const isLoading = checkoutLoading[plan.key] ?? false;

          return (
            <View key={plan.key}>
              {plan.popular && (
                <View style={styles.popularBadgeWrap}>
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>Most Popular</Text>
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
                      ${Number.isInteger(price) ? price : price.toFixed(2)}
                    </Text>
                    <Text style={[styles.priceSub, { color: colors.mutedForeground }]}>{period}</Text>
                  </View>
                </View>

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
                      opacity: isLoading ? 0.7 : 1,
                    },
                  ]}
                  activeOpacity={0.8}
                  disabled={isLoading}
                  onPress={() => handleCheckout(plan.key, billing)}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={plan.color} />
                  ) : (
                    <Text style={[styles.ctaText, { color: plan.color }]}>
                      {`Subscribe ${billing === "monthly" ? "Monthly" : "Yearly"} — $${Number.isInteger(price) ? price : price.toFixed(2)}${period}`}
                    </Text>
                  )}
                </TouchableOpacity>

                <Text style={[styles.secureNote, { color: colors.mutedForeground }]}>
                  Secure checkout via Stripe · Cancel anytime
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
    backgroundColor: "#a855f7",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowColor: "#a855f7",
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
  featureList: { gap: 8 },
  featureRow:  { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  checkIcon:   { marginTop: 1 },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },
  comingSoonBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  comingSoonText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 17 },
  errorText:   { fontSize: 12, textAlign: "center" },
  ctaBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
  },
  ctaText:    { fontSize: 14, fontWeight: "700" },
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
