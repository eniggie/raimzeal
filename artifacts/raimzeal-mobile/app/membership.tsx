import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { LinearGradient } from "expo-linear-gradient";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  priceLabel: string;
  features: string[];
  cta: string;
  highlighted: boolean;
  priceId: string | null;
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: "free",
    name: "Foundation",
    tagline: "Start your journey",
    price: 0,
    priceLabel: "Free forever",
    features: [
      "10 workouts from library",
      "Basic calorie & macro tracking",
      "Community (read-only)",
      "5 Ovia AI messages/day",
      "Basic progress charts",
      "Weight tracking",
    ],
    cta: "Current plan",
    highlighted: false,
    priceId: null,
  },
  {
    id: "athlete",
    name: "Athlete",
    tagline: "For the dedicated",
    price: 9.99,
    priceLabel: "$9.99 / month",
    features: [
      "Full workout library & programs",
      "Unlimited nutrition logging",
      "Full body measurements",
      "Unlimited Ovia AI",
      "Community posting & comments",
      "Progress PDF export",
      "Activity tracker & reminders",
      "Progress card sharing",
      "Calendar scheduling",
    ],
    cta: "Start Athlete",
    highlighted: true,
    priceId: null,
  },
  {
    id: "elite",
    name: "Elite",
    tagline: "Maximum performance",
    price: 19.99,
    priceLabel: "$19.99 / month",
    features: [
      "Everything in Athlete",
      "Priority Ovia AI (GPT-4.1 Turbo)",
      "AI-generated meal plans",
      "Weekly Ovia coaching digest",
      "Custom workout builder",
      "Early access to new features",
      "Exclusive Elite badge",
      "PDF coaching reports",
    ],
    cta: "Go Elite",
    highlighted: false,
    priceId: null,
  },
];

const PLAN_GRADIENT: Record<string, readonly [string, string]> = {
  free:    ["#1a1a1e", "#1a1a1e"],
  athlete: ["#2E8B571a", "#2E8B5708"],
  elite:   ["#C9A84C1a", "#C9A84C08"],
};

const PLAN_ACCENT: Record<string, string> = {
  free:    "#6b7280",
  athlete: "#2E8B57",
  elite:   "#C9A84C",
};

const PLAN_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  free:    "star-outline",
  athlete: "flash-outline",
  elite:   "diamond-outline",
};

export default function MembershipScreen() {
  const colors = useColors();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { plans?: Plan[] } | null) => {
        if (data?.plans) setPlans(data.plans);
      })
      .catch(() => {/* keep fallback */});
  }, []);

  async function handleUpgrade(plan: Plan) {
    if (plan.id === "free" || !plan.priceId) return;
    setCheckoutLoading(plan.id);
    try {
      const baseUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? "";
      const appUrl = baseUrl ? new URL(baseUrl).origin : "https://raimzeal.replit.app";
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${appUrl}/membership?success=1`,
          cancelUrl:  `${appUrl}/membership`,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        await Linking.openURL(data.url);
      } else {
        Alert.alert("Error", data.error ?? "Could not start checkout");
      }
    } catch {
      Alert.alert("Error", "Could not connect to payment server");
    } finally {
      setCheckoutLoading(null);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.foreground }]}>Membership</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Choose the plan that fits your goals
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {plans.map((plan) => {
          const accent = PLAN_ACCENT[plan.id] ?? "#6b7280";
          const icon   = PLAN_ICON[plan.id] ?? "star-outline";
          const grad   = PLAN_GRADIENT[plan.id] ?? (["#1a1a1e", "#1a1a1e"] as const);
          const isLoading = checkoutLoading === plan.id;
          const isFree = plan.id === "free";

          return (
            <LinearGradient
              key={plan.id}
              colors={[grad[0], grad[1]]}
              style={[
                styles.card,
                plan.highlighted && { borderColor: accent, borderWidth: 1.5 },
                !plan.highlighted && { borderColor: "#ffffff12", borderWidth: 1 },
              ]}
            >
              {plan.highlighted && (
                <View style={[styles.badge, { backgroundColor: accent }]}>
                  <Text style={styles.badgeText}>Most Popular</Text>
                </View>
              )}

              {/* Plan header */}
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, { backgroundColor: accent + "22" }]}>
                  <Ionicons name={icon} size={22} color={accent} />
                </View>
                <View style={styles.cardTitleBlock}>
                  <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
                  <Text style={[styles.planTagline, { color: colors.mutedForeground }]}>{plan.tagline}</Text>
                </View>
                <View style={styles.priceBlock}>
                  <Text style={[styles.price, { color: colors.foreground }]}>
                    {plan.price === 0 ? "Free" : `$${plan.price}`}
                  </Text>
                  {plan.price > 0 && (
                    <Text style={[styles.priceSub, { color: colors.mutedForeground }]}>/mo</Text>
                  )}
                </View>
              </View>

              {/* Features */}
              <View style={styles.featureList}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Ionicons name="checkmark-circle" size={16} color={accent} style={styles.checkIcon} />
                    <Text style={[styles.featureText, { color: colors.foreground + "cc" }]}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <TouchableOpacity
                style={[
                  styles.ctaBtn,
                  isFree
                    ? { backgroundColor: "#ffffff12" }
                    : { backgroundColor: accent },
                  (isLoading || (!!checkoutLoading && !isLoading)) && { opacity: 0.6 },
                ]}
                onPress={() => handleUpgrade(plan)}
                disabled={isFree || isLoading || !!checkoutLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={isFree ? colors.foreground : "#fff"} />
                ) : (
                  <Text
                    style={[
                      styles.ctaText,
                      { color: isFree ? colors.mutedForeground : plan.id === "elite" ? "#000" : "#fff" },
                    ]}
                  >
                    {plan.cta}
                  </Text>
                )}
              </TouchableOpacity>
            </LinearGradient>
          );
        })}

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          Secure payment via Stripe · Cancel anytime
        </Text>
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
  badge: {
    position: "absolute",
    top: -11,
    left: 18,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 99,
  },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
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
  footer: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
