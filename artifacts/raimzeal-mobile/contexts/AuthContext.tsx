import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getApiBase } from "@/lib/db";

async function triggerWelcomeEmail(email: string, name: string, accessToken?: string): Promise<void> {
  try {
    const base = getApiBase();
    const jsonHeaders = { "Content-Type": "application/json" };
    const authHeaders = accessToken
      ? { ...jsonHeaders, "Authorization": `Bearer ${accessToken}` }
      : jsonHeaders;

    await fetch(`${base}/auth/welcome-email`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ email, name }),
    });

    if (accessToken) {
      await fetch(`${base}/email/digest/subscribe`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ email, userName: name }),
      });
    }
  } catch {
    // Non-fatal — welcome email failure should never block signup
  }
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogleToken: (idToken: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  resendEmailConfirmation: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateUserProfile: (data: Record<string, unknown>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let active = true;

    // Safety net: supabase-js v2's getSession() can stall indefinitely when its
    // internal auth lock never settles (e.g. a wedged token refresh or a slow
    // auth endpoint). If that happened the app would sit on the splash/boot
    // screen forever. Force loading to resolve after a few seconds so the
    // AuthGate can route the user; onAuthStateChange still fills in the session
    // when it eventually arrives.
    const loadingFallback = setTimeout(() => {
      if (active) setLoading(false);
    }, 4000);

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        clearTimeout(loadingFallback);
        setSession(data.session);
        setUser(data.session?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        clearTimeout(loadingFallback);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      clearTimeout(loadingFallback);
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(loadingFallback);
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (!error) {
      triggerWelcomeEmail(email, name, data.session?.access_token ?? undefined);
    }
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signInWithApple = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    if (Platform.OS !== "ios") return { error: "Apple sign-in is only available on iOS" };
    try {
      const AppleAuthentication = await import("expo-apple-authentication");
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) return { error: "Apple sign-in is not available on this device" };
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) return { error: "Apple did not return an identity token" };
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: rawNonce,
      });
      if (!error && credential.fullName) {
        const first = credential.fullName.givenName ?? "";
        const last = credential.fullName.familyName ?? "";
        const fullName = [first, last].filter(Boolean).join(" ");
        if (fullName) {
          await supabase.auth.updateUser({ data: { name: fullName } });
        }
      }
      return { error: error?.message ?? null };
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "ERR_REQUEST_CANCELED") {
        return { error: null };
      }
      return { error: e instanceof Error ? e.message : "Apple sign-in failed" };
    }
  }, []);

  const signInWithGoogleToken = useCallback(async (idToken: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    // Attempt a normal (global) sign-out, which revokes the refresh token
    // server-side. If that network call fails (offline, slow endpoint), fall
    // back to a local-only sign-out so the user is always signed out on-device
    // and the UI returns to the welcome screen — logout must never get stuck.
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // Last resort — ignore; onAuthStateChange/local state reset still runs.
      }
    }
  }, []);

  const sendPhoneOtp = useCallback(async (phone: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error?.message ?? null };
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
    return { error: error?.message ?? null };
  }, []);

  const resendEmailConfirmation = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const siteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? "https://raimzeal.com";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    return { error: error?.message ?? null };
  }, []);

  const updateUserProfile = useCallback(async (data: Record<string, unknown>) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.updateUser({ data });
    return { error: error?.message ?? null };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signUp,
        signIn,
        signInWithApple,
        signInWithGoogleToken,
        signOut,
        sendPhoneOtp,
        verifyPhoneOtp,
        resendEmailConfirmation,
        resetPassword,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
