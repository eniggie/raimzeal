import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TierState {
  canWrite: boolean;
  tier: string;
  loading: boolean;
}

/**
 * Fetches the current user's community write permission from their Supabase profile.
 * canWrite === true  →  Rise / Reign / Legacy (subscription_status = "active")
 * canWrite === false →  Foundation (free) or unauthenticated
 */
export function useTier(): TierState {
  const { user } = useAuth();
  const [state, setState] = useState<TierState>({ canWrite: false, tier: 'free', loading: true });

  useEffect(() => {
    if (!supabaseConfigured || !user) {
      setState({ canWrite: false, tier: 'free', loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_tier')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        const row = data as Record<string, unknown> | null;
        const status = row?.['subscription_status'] as string | null;
        const tier = (row?.['subscription_tier'] as string | null) ?? 'free';
        setState({ canWrite: status === 'active', tier, loading: false });
      } catch {
        if (!cancelled) setState({ canWrite: false, tier: 'free', loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return state;
}
