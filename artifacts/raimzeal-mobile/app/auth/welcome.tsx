import { useRouter } from "expo-router";
import React from "react";
import {
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const FEATURES = [
  { icon: "barbell-outline" as const, text: "Track workouts & personal records" },
  { icon: "restaurant-outline" as const, text: "Log meals & monitor macros" },
  { icon: "trending-up-outline" as const, text: "Visualise your progress over time" },
  { icon: "chatbubble-ellipses-outline" as const, text: "Chat with Ovia, your AI coach" },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Hero */}
      <View
        style={[
          styles.hero,
          { paddingTop: insets.top + 40, backgroundColor: colors.card },
        ]}
      >
        <View style={[styles.logoWrap, { backgroundColor: colors.primary }]}>
          <Text style={[styles.logoLetter, { color: colors.primaryForeground }]}>R</Text>
        </View>
        <Text style={[styles.brand, { color: colors.foreground }]}>RAIMZEAL</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Your AI-powered fitness companion
        </Text>
      </View>

      {/* Features */}
      <View style={styles.features}>
        {FEATURES.map((f) => (
          <View key={f.text} style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + "20" }]}>
              <Ionicons name={f.icon} size={18} color={colors.primary} />
            </View>
            <Text style={[styles.featureText, { color: colors.foreground }]}>{f.text}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View
        style={[
          styles.actions,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/auth/signup")}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            Create Free Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={() => router.push("/auth/login")}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          style={styles.phoneBtn}
          onPress={() => router.push("/auth/phone")}
        >
          <Ionicons name="phone-portrait-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.phoneBtnText, { color: colors.mutedForeground }]}>
            Continue with phone number
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: {
    alignItems: "center",
    paddingBottom: 40,
    gap: 12,
  },
  logoWrap: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { fontSize: 42, fontFamily: "SpaceGrotesk_700Bold" },
  brand: { fontSize: 32, fontFamily: "SpaceGrotesk_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 15, fontFamily: "Inter_400Regular" },
  features: { flex: 1, padding: 24, gap: 16, justifyContent: "center" },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  actions: { padding: 24, gap: 12 },
  primaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  secondaryBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  phoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
  },
  phoneBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
