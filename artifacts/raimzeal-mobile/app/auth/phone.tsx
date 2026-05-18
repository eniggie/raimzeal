import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

const COUNTRY_CODES = ["+1", "+44", "+33", "+49", "+234", "+27", "+91", "+86", "+61"];

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sendPhoneOtp } = useAuth();

  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  const fullPhone = `${countryCode}${phone.replace(/\D/g, "")}`;

  async function handleSendOtp() {
    if (phone.replace(/\D/g, "").length < 7) {
      Alert.alert("Invalid number", "Please enter a valid phone number.");
      return;
    }
    setLoading(true);
    const { error } = await sendPhoneOtp(fullPhone);
    setLoading(false);
    if (error) {
      Alert.alert("Error", error);
    } else {
      router.push({ pathname: "/auth/verify-phone", params: { phone: fullPhone } });
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <View style={[styles.iconCircle, { backgroundColor: colors.primary + "20" }]}>
          <Ionicons name="phone-portrait-outline" size={32} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>Your phone number</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          We'll send a one-time code to verify your number
        </Text>

        <View style={styles.phoneRow}>
          <TouchableOpacity
            style={[
              styles.codeBtn,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
            onPress={() => setShowCodes((v) => !v)}
          >
            <Text style={[styles.codeText, { color: colors.foreground }]}>{countryCode}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>

          <View
            style={[
              styles.numberWrap,
              { backgroundColor: colors.muted, borderColor: colors.border },
            ]}
          >
            <TextInput
              style={[styles.numberInput, { color: colors.foreground }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 000-0000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {showCodes && (
          <View
            style={[
              styles.codeDropdown,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {COUNTRY_CODES.map((code) => (
              <TouchableOpacity
                key={code}
                style={[styles.codeOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setCountryCode(code);
                  setShowCodes(false);
                }}
              >
                <Text style={[styles.codeOptionText, { color: colors.foreground }]}>{code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.submitBtn,
            { backgroundColor: loading ? colors.primary + "80" : colors.primary },
          ]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
              Send Code
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/auth/login")} style={styles.altBtn}>
          <Text style={[styles.altText, { color: colors.mutedForeground }]}>
            Use email instead
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },
  back: { alignSelf: "flex-start" },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  title: { fontSize: 28, fontFamily: "SpaceGrotesk_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  phoneRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  codeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
  },
  codeText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  numberWrap: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  numberInput: { fontSize: 16, fontFamily: "Inter_400Regular" },
  codeDropdown: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 200,
  },
  codeOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  codeOptionText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  altBtn: { alignItems: "center", paddingVertical: 8 },
  altText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
