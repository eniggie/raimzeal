import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyPhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyPhoneOtp, sendPhoneOtp } = useAuth();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  function handleDigit(val: string, index: number) {
    const digit = val.replace(/\D/g, "").slice(-1);
    const next = [...code];
    next[index] = digit;
    setCode(next);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "") && digit) {
      handleVerify(next.join(""));
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify(otp?: string) {
    const token = otp ?? code.join("");
    if (token.length < 6) {
      Alert.alert("Incomplete code", "Please enter all 6 digits.");
      return;
    }
    setLoading(true);
    const { error } = await verifyPhoneOtp(phone ?? "", token);
    setLoading(false);
    if (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Invalid code", error);
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Auth state updates → redirects to tabs
    }
  }

  async function handleResend() {
    if (!phone) return;
    const { error } = await sendPhoneOtp(phone);
    if (error) {
      Alert.alert("Error", error);
    } else {
      Alert.alert("Sent!", "A new code has been sent to your phone.");
    }
  }

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: colors.background, paddingTop: insets.top + 24 },
      ]}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.foreground} />
      </TouchableOpacity>

      <View style={styles.body}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary + "20" }]}>
          <Ionicons name="chatbubble-outline" size={36} color={colors.secondary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Enter the code</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          We sent a 6-digit code to{"\n"}
          <Text style={{ color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>
            {phone}
          </Text>
        </Text>

        <View style={styles.otpRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={[
                styles.otpBox,
                {
                  backgroundColor: colors.muted,
                  borderColor: digit ? colors.primary : colors.border,
                  color: colors.foreground,
                },
              ]}
              value={digit}
              onChangeText={(v) => handleDigit(v, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.verifyBtn,
            { backgroundColor: loading ? colors.primary + "80" : colors.primary },
          ]}
          onPress={() => handleVerify()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.verifyBtnText, { color: colors.primaryForeground }]}>
              Verify
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} style={styles.resendBtn}>
          <Text style={[styles.resendText, { color: colors.mutedForeground }]}>
            Didn't receive it?{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Resend</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  back: { marginBottom: 24, alignSelf: "flex-start" },
  body: { flex: 1, alignItems: "center", gap: 20 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 26, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 24 },
  otpRow: { flexDirection: "row", gap: 10, marginVertical: 8 },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  verifyBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  resendBtn: { paddingVertical: 8 },
  resendText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
