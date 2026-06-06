import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type TierName = "foundation" | "rise" | "reign" | "legacy";

export interface TierState {
  canWrite: boolean;
  tier: TierName;
  status: string;
  currentPeriodEnd: string | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Fetches the given user's subscription tier and permissions from their Supabase profile.
 * canWrite === true  →  Rise / Reign / Legacy (subscription_status = "active")
 * canWrite === false →  Foundation (free) or unauthenticated
 *
 * Auto-refetches when the app comes back to the foreground so the tier badge
 * stays current after a web checkout without requiring an app restart.
 * Exposes a `refetch()` callback for screens to trigger on focus.
 */
export function useTier(userId: string | null): TierState {
  const [refetchTick, setRefetchTick] = useState(0);
  const [state, setState] = useState<Omit<TierState, "refetch">>({
    canWrite: false,
    tier: "foundation",
    status: "none",
    currentPeriodEnd: null,
    loading: true,
  });

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      setState({ canWrite: false, tier: "foundation", status: "none", currentPeriodEnd: null, loading: false });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("subscription_status, subscription_tier, current_period_end")
          .eq("id", userId)
          .single();
        if (cancelled) return;
        const row = data as Record<string, unknown> | null;
        const status = (row?.["subscription_status"] as string | null) ?? "none";
        const rawTier = (row?.["subscription_tier"] as string | null) ?? "foundation";
        const tier: TierName =
          rawTier === "rise" || rawTier === "reign" || rawTier === "legacy"
            ? rawTier
            : "foundation";
        const currentPeriodEnd = (row?.["current_period_end"] as string | null) ?? null;
        setState({ canWrite: status === "active", tier, status, currentPeriodEnd, loading: false });
      } catch {
        if (!cancelled) setState({ canWrite: false, tier: "foundation", status: "none", currentPeriodEnd: null, loading: false });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, refetchTick]);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (appStateRef.current !== "active" && nextState === "active") {
        setRefetchTick((t) => t + 1);
      }
      appStateRef.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  return { ...state, refetch };
}
