import { useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface TierState {
  canWrite: boolean;
  tier: 'foundation' | 'rise' | 'reign' | 'legacy';
  status: string;
  currentPeriodEnd: string | null;
  loading: boolean;
}

/**
 * Fetches the current user's subscription tier and permissions from their Supabase profile.
 * canWrite === true  →  Rise / Reign / Legacy (subscription_status = "active")
 * canWrite === false →  Foundation (free) or unauthenticated
 */
export function useTier(): TierState {
  const { user } = useAuth();
  const [state, setState] = useState<TierState>({
    canWrite: false,
    tier: 'foundation',
    status: 'none',
    currentPeriodEnd: null,
    loading: true,
  });

  useEffect(() => {
    if (!supabaseConfigured || !user) {
      setState({ canWrite: false, tier: 'foundation', status: 'none', currentPeriodEnd: null, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('subscription_status, subscription_tier, current_period_end')
          .eq('id', user.id)
          .single();
        if (cancelled) return;
        const row = data as Record<string, unknown> | null;
        const status = (row?.['subscription_status'] as string | null) ?? 'none';
        const rawTier = (row?.['subscription_tier'] as string | null) ?? 'foundation';
        const tier: TierState['tier'] =
          rawTier === 'rise' || rawTier === 'reign' || rawTier === 'legacy'
            ? rawTier
            : 'foundation';
        const currentPeriodEnd = (row?.['current_period_end'] as string | null) ?? null;
        setState({ canWrite: status === 'active', tier, status, currentPeriodEnd, loading: false });
      } catch {
        if (!cancelled) setState({ canWrite: false, tier: 'foundation', status: 'none', currentPeriodEnd: null, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  return state;
}
