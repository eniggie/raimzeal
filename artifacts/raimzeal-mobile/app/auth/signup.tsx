import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert("Missing fields", "Please fill in all required fields.");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (!termsAccepted) {
      Alert.alert(
        "Terms Required",
        "You must read and accept the Terms & Conditions and Health Disclaimer before creating an account."
      );
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim().toLowerCase(), password, name.trim());
    setLoading(false);
    if (error) {
      Alert.alert("Sign up failed", error);
    } else {
      router.push({ pathname: "/auth/verify-email", params: { email: email.trim() } });
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Start your transformation today — it's free
        </Text>

        <View style={styles.form}>
          <InputField
            label="Full name"
            value={name}
            onChange={setName}
            placeholder="Alex Johnson"
            colors={colors}
          />
          <InputField
            label="Email address"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            colors={colors}
          />

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Password</Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.muted, borderColor: colors.border },
              ]}
            >
              <View style={styles.pwRow}>
                <TextInput
                  style={[styles.input, { color: colors.foreground, flex: 1 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn}>
                  <Ionicons
                    name={showPw ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <InputField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Re-enter password"
            secureTextEntry
            autoCapitalize="none"
            colors={colors}
          />

          {/* Terms & Conditions Checkbox */}
          <View
            style={[
              styles.termsBox,
              {
                backgroundColor: termsAccepted ? colors.primary + "10" : colors.muted,
                borderColor: termsAccepted ? colors.primary + "50" : colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setTermsAccepted((v) => !v)}
              style={[
                styles.checkbox,
                {
                  backgroundColor: termsAccepted ? colors.primary : "transparent",
                  borderColor: termsAccepted ? colors.primary : colors.border,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {termsAccepted && (
                <Ionicons name="checkmark" size={14} color={colors.primaryForeground} />
              )}
            </TouchableOpacity>
            <View style={styles.termsTextBlock}>
              <Text style={[styles.termsText, { color: colors.foreground }]}>
                I have read and accept the{" "}
                <Text
                  style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}
                  onPress={() => router.push("/terms")}
                >
                  Terms & Conditions
                </Text>
                {" "}and{" "}
                <Text
                  style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}
                  onPress={() => router.push("/terms")}
                >
                  Health Disclaimer
                </Text>
                . I understand this app is not a substitute for medical advice.
              </Text>
            </View>
          </View>

          {!termsAccepted && (
            <View
              style={[
                styles.termsWarning,
                { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
              <Text style={[styles.termsWarningText, { color: colors.mutedForeground }]}>
                You must accept the Terms & Conditions to create an account.
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  loading || !termsAccepted
                    ? colors.primary + "60"
                    : colors.primary,
              },
            ]}
            onPress={handleSignup}
            disabled={loading || !termsAccepted}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
                I Agree &amp; Create Account
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/auth/login")}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "words" | "sentences";
  secureTextEntry?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: colors.muted, borderColor: colors.border },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.foreground }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          keyboardType={keyboardType ?? "default"}
          autoCapitalize={autoCapitalize ?? "words"}
          autoCorrect={false}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 0 },
  back: { marginBottom: 24, alignSelf: "flex-start" },
  title: { fontSize: 30, fontFamily: "SpaceGrotesk_700Bold", marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 32 },
  form: { gap: 14 },
  field: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  optionalBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  optionalText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 14,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
  },
  input: { fontSize: 15, fontFamily: "Inter_400Regular" },
  fieldHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  pwRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  eyeBtn: { padding: 4 },
  termsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  termsTextBlock: { flex: 1 },
  termsText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  termsWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  termsWarningText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular" },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
