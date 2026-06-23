import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export type SubscriptionTier = 'foundation' | 'rise' | 'reign' | 'legacy';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  subscriptionTier: SubscriptionTier;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  refreshTier: () => Promise<void>;
  signUp: (email: string, password: string, metadata: Record<string, string>) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

function parseTier(raw: unknown): SubscriptionTier {
  if (raw === 'rise' || raw === 'reign' || raw === 'legacy') return raw;
  return 'foundation';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>('foundation');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);

  const fetchTier = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier, current_period_end, cancel_at_period_end')
        .eq('id', userId)
        .single();
      const row = data as Record<string, unknown> | null;
      setSubscriptionTier(parseTier(row?.['subscription_tier']));
      setCurrentPeriodEnd((row?.['current_period_end'] as string | null) ?? null);
      setCancelAtPeriodEnd(Boolean(row?.['cancel_at_period_end']));
    } catch {
      // non-fatal — stay on foundation
    }
  }, []);

  const refreshTier = useCallback(async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.user?.id) await fetchTier(s.user.id);
  }, [fetchTier]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
        if (session?.user?.id) fetchTier(session.user.id);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setLoading(false);

      if (session?.user?.id) {
        fetchTier(session.user.id);
      } else {
        setSubscriptionTier('foundation');
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
      }

      // Sync profile to DB on every new sign-in (upserts name, phone, country, city from metadata)
      if (event === 'SIGNED_IN' && session) {
        const token = session.access_token;
        fetch(`${BASE}/api/auth/sync-profile`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {
          // Non-fatal — profile data is also in user_metadata
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchTier]);

  const signUp = useCallback(async (email: string, password: string, metadata: Record<string, string>) => {
    if (!supabaseConfigured) return { error: 'Auth not configured' };
    const redirectTo = `${window.location.origin}${BASE}/auth/callback`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata, emailRedirectTo: redirectTo },
    });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseConfigured) return { error: 'Auth not configured' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabaseConfigured) return { error: 'Auth not configured' };
    const redirectTo = `${window.location.origin}${BASE}/auth/callback`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return { error: error?.message ?? null };
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    if (!supabaseConfigured) return { error: 'Auth not configured' };
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      loading,
      subscriptionTier,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      refreshTier,
      signUp,
      signIn,
      resetPassword,
      resendConfirmation,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
