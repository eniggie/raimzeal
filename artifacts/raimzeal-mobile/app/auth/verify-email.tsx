import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resendEmailConfirmation } = useAuth();
  const [resending, setResending] = useState(false);

  async function handleResend() {
    if (!email) return;
    setResending(true);
    const { error } = await resendEmailConfirmation(email);
    setResending(false);
    if (error) {
      Alert.alert("Error", error);
    } else {
      Alert.alert("Sent!", "A new verification email has been sent.");
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="mail-open-outline" size={48} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Check your email</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          We sent a verification link to{"\n"}
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
            {email}
          </Text>
          {"\n\n"}
          Click the link in the email to activate your account, then come back and sign in.
        </Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.replace("/auth/login")}
        >
          <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
            Go to Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.75}
          style={[styles.secondaryBtn, { borderColor: colors.border }]}
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>
              Resend verification email
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  back: { marginBottom: 24, alignSelf: "flex-start" },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  title: { fontSize: 26, fontFamily: "SpaceGrotesk_700Bold", textAlign: "center" },
  desc: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  secondaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
