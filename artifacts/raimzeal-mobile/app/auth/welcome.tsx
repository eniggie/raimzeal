import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

WebBrowser.maybeCompleteAuthSession();

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
  const { signInWithApple, signInWithGoogleToken } = useAuth();

  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: extra.googleWebClientId,
    iosClientId: extra.googleIosClientId,
    scopes: ["openid", "profile", "email"],
  });

  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleAppleAuth() {
    setAppleLoading(true);
    const { error } = await signInWithApple();
    setAppleLoading(false);
    if (error) Alert.alert("Apple sign-in failed", error);
  }

  async function handleGoogleAuth() {
    if (!request) return;
    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === "success") {
        const idToken = result.authentication?.idToken;
        if (!idToken) throw new Error("Google did not return an identity token");
        const { error } = await signInWithGoogleToken(idToken);
        if (error) Alert.alert("Google sign-in failed", error);
      }
    } catch (e) {
      Alert.alert("Google sign-in failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Hero */}
      <View
        style={[
          styles.hero,
          { paddingTop: insets.top + 40, backgroundColor: colors.card },
        ]}
      >
        <View style={styles.logoWrap}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logoImage}
            resizeMode="cover"
          />
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

        {/* Quick OAuth sign-in / sign-up */}
        {Platform.OS !== "web" && (
          <>
            {/* Google — all platforms */}
            {googleLoading ? (
              <View style={[styles.googleBtn, { backgroundColor: "#ffffff" }]}>
                <ActivityIndicator size="small" color="#1f1f1f" />
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.googleBtn, { backgroundColor: "#ffffff" }]}
                onPress={handleGoogleAuth}
                disabled={!request || googleLoading}
                activeOpacity={0.8}
              >
                <Ionicons name="logo-google" size={18} color="#1f1f1f" />
                <Text style={styles.googleBtnText}>Continue with Google</Text>
              </TouchableOpacity>
            )}

            {/* Apple — iOS only */}
            {Platform.OS === "ios" && (
              appleLoading ? (
                <View style={styles.appleLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.foreground} />
                </View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={14}
                  style={styles.appleBtn}
                  onPress={handleAppleAuth}
                />
              )
            )}
          </>
        )}

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
    width: 88,
    height: 88,
    borderRadius: 22,
    overflow: "hidden",
  },
  logoImage: { width: 88, height: 88 },
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
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dadce0",
  },
  googleBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1f1f1f" },
  appleBtn: { width: "100%", height: 50 },
  appleLoadingWrap: {
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  phoneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
  },
  phoneBtnText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
