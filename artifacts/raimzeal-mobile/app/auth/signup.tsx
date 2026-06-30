import { useRouter } from "expo-router";
import React, { useState } from "react";
import { signInWithGoogleNative } from "@/lib/googleSignIn";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
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
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const MIN_AGE = 18;

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, signInWithApple, signInWithGoogleToken } = useAuth();

  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [age, setAge] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [responsibilityAccepted, setResponsibilityAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const parsedAge = parseInt(age, 10);
  const ageIsValid = !isNaN(parsedAge) && parsedAge > 0 && parsedAge <= 120;
  const ageBlocked = ageIsValid && parsedAge < MIN_AGE;

  async function handleAppleSignup() {
    if (!responsibilityAccepted || !termsAccepted) {
      Alert.alert(
        "Accept terms first",
        "Please read and accept the Personal Responsibility Waiver and Terms & Conditions before continuing with Apple."
      );
      return;
    }
    setAppleLoading(true);
    const { error } = await signInWithApple();
    setAppleLoading(false);
    if (error) Alert.alert("Apple sign-in failed", error);
  }

  async function handleGoogleSignup() {
    if (!termsAccepted || !responsibilityAccepted) {
      Alert.alert(
        "Accept terms first",
        "Please read and accept the Personal Responsibility Waiver and Terms & Conditions before continuing with Google."
      );
      return;
    }
    setGoogleLoading(true);
    try {
      const { idToken, error: gErr } = await signInWithGoogleNative();
      if (gErr) {
        Alert.alert("Google sign-in failed", gErr);
        return;
      }
      if (!idToken) return; // user cancelled
      const { error } = await signInWithGoogleToken(idToken);
      if (error) Alert.alert("Google sign-in failed", error);
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert("Missing fields", "Please fill in your name, email, and password.");
      return;
    }
    if (!age.trim()) {
      Alert.alert("Age required", "Please enter your age to continue.");
      return;
    }
    if (!ageIsValid) {
      Alert.alert("Invalid age", "Please enter a valid age.");
      return;
    }
    if (parsedAge < MIN_AGE) {
      Alert.alert(
        "Age Restriction",
        `RAIMZEAL is only available to users aged ${MIN_AGE} and older. You must be at least 18 years old to create an account.`
      );
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
    if (!responsibilityAccepted) {
      Alert.alert(
        "Responsibility Required",
        "You must accept full personal responsibility for your health and fitness decisions before creating an account."
      );
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
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const { error } = await signUp(cleanEmail, password, cleanName);
    if (error) {
      setLoading(false);
      Alert.alert("Sign up failed", error);
    } else {
      setLoading(false);
      router.push({ pathname: "/auth/verify-email", params: { email: cleanEmail } });
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

        {/* Age Policy Banner */}
        <View style={[styles.policyBanner, { backgroundColor: colors.primary + "12", borderColor: colors.primary + "30" }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          <Text style={[styles.policyText, { color: colors.mutedForeground }]}>
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>18+ only. </Text>
            RAIMZEAL is a health & fitness platform available exclusively to adults aged 18 and over.
          </Text>
        </View>

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
          <InputField
            label="Phone number"
            value={phone}
            onChange={setPhone}
            placeholder="+1 555 000 0000"
            keyboardType="phone-pad"
            autoCapitalize="none"
            colors={colors}
            optional
          />

          {/* Age field with validation */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Age</Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: colors.muted,
                  borderColor: ageBlocked
                    ? colors.destructive + "80"
                    : age && ageIsValid
                    ? colors.primary + "60"
                    : colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: colors.foreground, flex: 1 }]}
                value={age}
                onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 25"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                maxLength={3}
              />
              {ageBlocked && (
                <Ionicons name="close-circle" size={20} color={colors.destructive} />
              )}
              {age && ageIsValid && !ageBlocked && (
                <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              )}
            </View>
            {ageBlocked && (
              <View style={[styles.ageError, { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" }]}>
                <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
                <Text style={[styles.ageErrorText, { color: colors.destructive }]}>
                  You must be at least 18 years old to use RAIMZEAL.
                </Text>
              </View>
            )}
          </View>

          <InputField
            label="Country / Location"
            value={country}
            onChange={setCountry}
            placeholder="e.g. United States"
            autoCapitalize="words"
            colors={colors}
            optional
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

          {/* Personal Responsibility Checkbox */}
          <View
            style={[
              styles.termsBox,
              {
                backgroundColor: responsibilityAccepted ? "#ef4444" + "10" : colors.muted,
                borderColor: responsibilityAccepted ? "#ef4444" + "50" : colors.border,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setResponsibilityAccepted((v) => !v)}
              style={[
                styles.checkbox,
                {
                  backgroundColor: responsibilityAccepted ? "#ef4444" : "transparent",
                  borderColor: responsibilityAccepted ? "#ef4444" : colors.border,
                },
              ]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {responsibilityAccepted && (
                <Ionicons name="checkmark" size={14} color="#fff" />
              )}
            </TouchableOpacity>
            <View style={styles.termsTextBlock}>
              <Text style={[styles.termsLabel, { color: "#ef4444" }]}>
                Personal Responsibility Waiver *
              </Text>
              <Text style={[styles.termsText, { color: colors.foreground }]}>
                I accept FULL PERSONAL RESPONSIBILITY for every action, decision, and outcome resulting from my use of RAIMZEAL. I understand RAIMZEAL is a non-profit awareness platform — NOT a medical service — and does NOT replace any healthcare professional or facility. RAIMZEAL and ECONTEUR LLC accept NO LIABILITY for any injury, illness, or adverse outcome. I will always consult a qualified professional before making health changes.
              </Text>
            </View>
          </View>

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
              <Text style={[styles.termsLabel, { color: colors.primary }]}>
                Terms & Conditions *
              </Text>
              <Text style={[styles.termsText, { color: colors.foreground }]}>
                I have read and accept the{" "}
                <Text
                  style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}
                  onPress={() => router.push("/terms")}
                >
                  Terms, Conditions & Full Disclaimer
                </Text>
                . I confirm I am 18+ years old. I understand RAIMZEAL is a free, non-profit platform and is not a substitute for professional medical advice, diagnosis, or treatment. I am solely responsible for any decisions or actions I take based on information in this app.
              </Text>
            </View>
          </View>

          {(!termsAccepted || !responsibilityAccepted) && (
            <View
              style={[
                styles.termsWarning,
                { backgroundColor: colors.destructive + "12", borderColor: colors.destructive + "30" },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
              <Text style={[styles.termsWarningText, { color: colors.mutedForeground }]}>
                {!responsibilityAccepted
                  ? "You must accept the Personal Responsibility waiver."
                  : "You must accept the Terms & Conditions."}
              </Text>
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.submitBtn,
              {
                backgroundColor:
                  loading || !termsAccepted || !responsibilityAccepted || ageBlocked
                    ? colors.primary + "60"
                    : colors.primary,
              },
            ]}
            onPress={handleSignup}
            disabled={loading || !termsAccepted || !responsibilityAccepted || ageBlocked}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
                I Agree &amp; Create Account
              </Text>
            )}
          </TouchableOpacity>

          {/* Continue with Apple — iOS only, gated behind T&C */}
          {Platform.OS === "ios" && (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
              {appleLoading ? (
                <View style={styles.appleLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.foreground} />
                </View>
              ) : (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={14}
                  style={[
                    styles.appleBtn,
                    { opacity: termsAccepted && responsibilityAccepted ? 1 : 0.4 },
                  ]}
                  onPress={handleAppleSignup}
                />
              )}
              {(!termsAccepted || !responsibilityAccepted) && (
                <Text style={[styles.appleHint, { color: colors.mutedForeground }]}>
                  Accept the terms above to use Apple sign-in
                </Text>
              )}
            </>
          )}

          {/* Continue with Google — iOS + Android, gated behind T&C */}
          {Platform.OS !== "web" && (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>
              {googleLoading ? (
                <View style={styles.appleLoadingWrap}>
                  <ActivityIndicator size="small" color={colors.foreground} />
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.googleButton,
                    { opacity: termsAccepted && responsibilityAccepted ? 1 : 0.4 },
                  ]}
                  onPress={handleGoogleSignup}
                  disabled={!termsAccepted || !responsibilityAccepted}
                  activeOpacity={0.8}
                >
                  <Ionicons name="logo-google" size={18} color="#1f1f1f" />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>
              )}
              {(!termsAccepted || !responsibilityAccepted) && (
                <Text style={[styles.appleHint, { color: colors.mutedForeground }]}>
                  Accept the terms above to use Google sign-in
                </Text>
              )}
            </>
          )}
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
  optional,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad";
  autoCapitalize?: "none" | "words" | "sentences";
  secureTextEntry?: boolean;
  optional?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        {optional && (
          <View style={[styles.optionalBadge, { backgroundColor: colors.muted }]}>
            <Text style={[styles.optionalText, { color: colors.mutedForeground }]}>optional</Text>
          </View>
        )}
      </View>
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
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 16 },
  policyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  policyText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  form: { gap: 14 },
  field: { gap: 6 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  optionalBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
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
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  pwRow: { flexDirection: "row", alignItems: "center", flex: 1 },
  eyeBtn: { padding: 4 },
  ageError: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  ageErrorText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
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
  termsLabel: { fontSize: 12, fontFamily: "Inter_700Bold", marginBottom: 4 },
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
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  appleBtn: { width: "100%", height: 52 },
  appleLoadingWrap: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  appleHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: -4 },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dadce0",
    width: "100%",
  },
  googleButtonText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#1f1f1f" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 28 },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
