import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getApiBase } from "@/lib/db";

async function triggerWelcomeEmail(email: string, name: string, accessToken: string): Promise<void> {
  try {
    const base = getApiBase();
    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    };
    await fetch(`${base}/email/send`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ to: email, userName: name, type: "welcome" }),
    });
    await fetch(`${base}/email/digest/subscribe`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email, userName: name }),
    });
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
  signOut: () => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
  resendEmailConfirmation: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updateUserProfile: (data: Record<string, unknown>) => Promise<{ error: string | null }>;
  deleteAccount: () => Promise<{ error: string | null }>;
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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (!error && data.session?.access_token) {
      // Fire welcome email + digest subscription (non-blocking, non-fatal).
      // Only runs when a session token is immediately available (i.e. email
      // confirmation is disabled). When confirmation is required, the session
      // is null here and the welcome email is skipped — it can be triggered
      // after the user confirms and logs in.
      triggerWelcomeEmail(email, name, data.session.access_token);
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
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) return { error: "Apple did not return an identity token" };
      const { error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
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

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
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

  // Permanently deletes the user's account and all associated data.
  // Calls the trusted API server (service-role) which erases every user row
  // across all tables, removes storage files, and deletes the Supabase auth
  // user, then clears the local session. Required by App Store Guideline 5.1.1(v).
  const deleteAccount = useCallback(async () => {
    if (!isSupabaseConfigured) return { error: "Supabase not configured" };
    try {
      const { data: { session: current } } = await supabase.auth.getSession();
      const token = current?.access_token;
      if (!token) return { error: "You must be signed in to delete your account." };
      const res = await fetch(`${getApiBase()}/user/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        return { error: body.error ?? "Could not delete account. Please try again." };
      }
      // Server confirmed deletion — clear the local session so the app returns
      // to the signed-out state.
      await supabase.auth.signOut();
      return { error: null };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Could not delete account." };
    }
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
        signOut,
        sendPhoneOtp,
        verifyPhoneOtp,
        resendEmailConfirmation,
        resetPassword,
        updateUserProfile,
        deleteAccount,
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
