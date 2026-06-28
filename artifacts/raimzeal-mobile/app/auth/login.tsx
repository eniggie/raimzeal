import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import * as AppleAuthentication from "expo-apple-authentication";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import Constants from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

const BIOMETRIC_EMAIL_KEY = "raimzeal_bio_email";
const BIOMETRIC_PW_KEY = "raimzeal_bio_pw";
const BIOMETRIC_ENABLED_KEY = "raimzeal_bio_enabled";

function getBiometricLabel(type: LocalAuthentication.AuthenticationType[]): string {
  if (type.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "Face ID";
  if (type.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "Touch ID";
  return "Biometrics";
}

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, signInWithApple, signInWithGoogleToken, resetPassword } = useAuth();

  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
  const [request, , promptAsync] = Google.useAuthRequest({
    webClientId: extra.googleWebClientId,
    iosClientId: extra.googleIosClientId,
    androidClientId: extra.googleAndroidClientId,
    scopes: ["openid", "profile", "email"],
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    checkBiometric();
  }, []);

  async function checkBiometric() {
    if (Platform.OS === "web") return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const isEnabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
      if (hasHardware && isEnrolled && isEnabled === "true") {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        setBiometricLabel(getBiometricLabel(types));
      }
    } catch {
      // biometric not available on this device — silent fallback
    }
  }

  async function handleLogin() {
    if (!termsAccepted) {
      Alert.alert("Terms required", "Please accept the Terms of Use and Community Guidelines before signing in.");
      return;
    }
    if (!email.trim() || !password.trim()) {
      Alert.alert("Missing fields", "Please enter your email and password.");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      const msg = error.toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        router.push({ pathname: "/auth/verify-email", params: { email: email.trim().toLowerCase() } });
        return;
      }
      Alert.alert("Sign in failed", error);
      return;
    }
    // Offer to enable biometric on successful login (native only)
    if (Platform.OS !== "web") {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        const alreadyEnabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        if (hasHardware && isEnrolled && alreadyEnabled !== "true") {
          const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
          const label = getBiometricLabel(types);
          Alert.alert(
            `Enable ${label}?`,
            `Sign in faster next time with ${label}.`,
            [
              { text: "Not now", style: "cancel" },
              {
                text: `Enable ${label}`,
                onPress: async () => {
                  await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email.trim().toLowerCase());
                  await SecureStore.setItemAsync(BIOMETRIC_PW_KEY, password);
                  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
                },
              },
            ]
          );
        }
      } catch {
        // non-fatal
      }
    }
    // On success, AuthContext updates session → _layout redirects to tabs
  }

  async function handleAppleLogin() {
    if (!termsAccepted) {
      Alert.alert("Terms required", "Please accept the Terms of Use and Community Guidelines before signing in with Apple.");
      return;
    }
    setAppleLoading(true);
    const { error } = await signInWithApple();
    setAppleLoading(false);
    if (error) Alert.alert("Apple sign-in failed", error);
  }

  async function handleGoogleLogin() {
    if (!termsAccepted) {
      Alert.alert("Terms required", "Please accept the Terms of Use and Community Guidelines before signing in with Google.");
      return;
    }
    if (!request) return;
    setGoogleLoading(true);
    try {
      const result = await promptAsync();
      if (result.type === "success") {
        const idToken =
          result.authentication?.idToken ??
          (result.params as Record<string, string> | undefined)?.["id_token"];
        if (!idToken) throw new Error("Google did not return an identity token");
        const { error } = await signInWithGoogleToken(idToken);
        if (error) Alert.alert("Google sign-in failed", error);
      }
      // type "cancel" or "dismiss" = user backed out, no error
    } catch (e) {
      Alert.alert("Google sign-in failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleBiometricLogin() {
    if (!termsAccepted) {
      Alert.alert("Terms required", "Please accept the Terms of Use and Community Guidelines before using biometric sign-in.");
      return;
    }
    if (!biometricLabel) return;
    setBiometricLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Sign in with ${biometricLabel}`,
        cancelLabel: "Use password",
        disableDeviceFallback: false,
      });
      if (!result.success) {
        setBiometricLoading(false);
        return;
      }
      const storedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const storedPw = await SecureStore.getItemAsync(BIOMETRIC_PW_KEY);
      if (!storedEmail || !storedPw) {
        Alert.alert("Setup required", "Please sign in with your password first.");
        setBiometricLoading(false);
        return;
      }
      const { error } = await signIn(storedEmail, storedPw);
      if (error) {
        Alert.alert("Sign in failed", "Please sign in with your password instead.");
      }
    } catch {
      Alert.alert("Biometric unavailable", "Please sign in with your password.");
    } finally {
      setBiometricLoading(false);
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
        {/* Back */}
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={[styles.title, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Sign in to continue your fitness journey
        </Text>

        <View style={styles.form}>
          <Field label="Email address" colors={colors}>
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Password" colors={colors}>
            <View style={styles.pwRow}>
              <TextInput
                style={[styles.input, styles.pwInput, { color: colors.foreground }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
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
          </Field>

          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={async () => {
              const emailToUse = email.trim().toLowerCase();
              if (Platform.OS === "ios") {
                Alert.prompt(
                  "Reset Password",
                  "Enter your email address and we'll send you a reset link.",
                  async (inputEmail) => {
                    if (!inputEmail?.trim()) return;
                    const { error } = await resetPassword(inputEmail.trim().toLowerCase());
                    if (error) {
                      Alert.alert("Error", error);
                    } else {
                      Alert.alert("Email sent", "Check your inbox for a password reset link.");
                    }
                  },
                  "plain-text",
                  emailToUse,
                  "email-address"
                );
              } else {
                if (!emailToUse) {
                  Alert.alert(
                    "Enter your email",
                    "Type your email address in the email field above, then tap Forgot password? again."
                  );
                  return;
                }
                const { error } = await resetPassword(emailToUse);
                if (error) {
                  Alert.alert("Error", error);
                } else {
                  Alert.alert("Email sent", "Check your inbox for a password reset link.");
                }
              }
            }}
          >
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.submitBtn, { backgroundColor: loading ? colors.primary + "80" : colors.primary }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>

          {/* Biometric sign-in */}
          {biometricLabel && Platform.OS !== "web" && (
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.biometricBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={handleBiometricLogin}
              disabled={biometricLoading}
            >
              {biometricLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons
                    name={biometricLabel === "Face ID" ? "scan-outline" : "finger-print-outline"}
                    size={20}
                    color={colors.primary}
                  />
                  <Text style={[styles.biometricBtnText, { color: colors.primary }]}>
                    Sign in with {biometricLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Sign in with Apple — iOS only */}
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
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                  cornerRadius={14}
                  style={styles.appleBtn}
                  onPress={handleAppleLogin}
                />
              )}
            </>
          )}

          {/* Sign in with Google — iOS + Android */}
          {Platform.OS !== "ios" && (
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>
          )}
          {googleLoading ? (
            <View style={styles.appleLoadingWrap}>
              <ActivityIndicator size="small" color={colors.foreground} />
            </View>
          ) : (
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={18} color="#1f1f1f" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.termsBox,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
          onPress={() => setTermsAccepted((accepted) => !accepted)}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsAccepted }}
          accessibilityLabel="Accept the Terms of Use and Community Guidelines"
        >
          <View style={[styles.checkbox, { borderColor: termsAccepted ? colors.primary : colors.border, backgroundColor: termsAccepted ? colors.primary : "transparent" }]}>
            {termsAccepted && <Ionicons name="checkmark" size={16} color={colors.primaryForeground} />}
          </View>
          <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
            I accept the RAIMZEAL{" "}
            <Text
              style={{ color: colors.primary }}
              onPress={() => router.push("/terms" as never)}
            >
              Terms of Use and Community Guidelines
            </Text>
            . RAIMZEAL has zero tolerance for objectionable community content or
            abusive users, and content may be filtered, reported, blocked,
            removed, and escalated to moderation.
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/auth/signup")}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  children,
  colors,
}: {
  label: string;
  children: React.ReactNode;
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
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24, gap: 0 },
  back: { marginBottom: 24, alignSelf: "flex-start" },
  title: { fontSize: 30, fontFamily: "SpaceGrotesk_700Bold", marginBottom: 8 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 32 },
  form: { gap: 16 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  input: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  pwRow: { flexDirection: "row", alignItems: "center" },
  pwInput: { flex: 1 },
  eyeBtn: { padding: 4 },
  forgotBtn: { alignSelf: "flex-end" },
  forgotText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  submitBtn: {
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitBtnText: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  biometricBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  biometricBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
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
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dadce0",
    marginTop: 12,
  },
  googleButtonText: { fontSize: 16, fontWeight: "600", color: "#1f1f1f" },
  termsBox: {
    flexDirection: "row",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  termsText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footerLink: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
