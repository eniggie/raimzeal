import { supabaseAdmin } from "./supabaseAdmin";

export type Tier = "foundation" | "rise" | "reign" | "legacy";

const TIER_LEVELS: Record<Tier, number> = {
  foundation: 0,
  rise: 1,
  reign: 2,
  legacy: 3,
};

export function tierLevel(tier: Tier): number {
  return TIER_LEVELS[tier] ?? 0;
}

export function canAccess(userTier: Tier, requiredTier: Tier): boolean {
  return (TIER_LEVELS[userTier] ?? 0) >= (TIER_LEVELS[requiredTier] ?? 0);
}

/**
 * Returns the canonical Tier for a userId by querying their Supabase profile.
 * Falls back to "foundation" on any error or missing/inactive subscription.
 */
export async function getUserTier(userId: string): Promise<Tier> {
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("subscription_status, subscription_tier")
      .eq("id", userId)
      .single();
    if (!data) return "foundation";
    const row = data as Record<string, unknown>;
    const status = row["subscription_status"] as string | null;
    if (status !== "active") return "foundation";
    const tier = row["subscription_tier"] as string | null;
    if (tier === "rise" || tier === "reign" || tier === "legacy") return tier;
    return "foundation";
  } catch {
    return "foundation";
  }
}

/**
 * Normalises a raw Stripe-metadata tier string to a canonical Tier.
 * Maps any unrecognised or deprecated metadata values to "rise" as a safe fallback.
 */
export function normaliseTier(raw: string | null | undefined): Tier {
  if (!raw) return "rise";
  const s = raw.toLowerCase().trim();
  if (s === "rise" || s === "reign" || s === "legacy") return s;
  return "rise";
}

/**
 * Maps a tier + interval combination to a Stripe price ID from env vars.
 * Env var naming: STRIPE_PRICE_RISE_MONTHLY, STRIPE_PRICE_RISE_YEARLY, etc.
 * Returns null if the price is not yet configured.
 */
export function getPriceId(
  tier: "rise" | "reign" | "legacy",
  interval: "monthly" | "yearly"
): string | null {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[key] ?? null;
}

/**
 * Resolves a canonical Tier from a Stripe price ID by matching against the
 * 6 configured price-ID env vars. Returns null when the price ID is unknown
 * or no env vars are set yet.
 *
 * Env vars checked (in order):
 *   STRIPE_PRICE_RISE_MONTHLY, STRIPE_PRICE_RISE_YEARLY
 *   STRIPE_PRICE_REIGN_MONTHLY, STRIPE_PRICE_REIGN_YEARLY
 *   STRIPE_PRICE_LEGACY_MONTHLY, STRIPE_PRICE_LEGACY_YEARLY
 */
export function tierFromPriceId(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;
  const candidates: Array<[string, Tier]> = [
    ["STRIPE_PRICE_RISE_MONTHLY",   "rise"],
    ["STRIPE_PRICE_RISE_YEARLY",    "rise"],
    ["STRIPE_PRICE_REIGN_MONTHLY",  "reign"],
    ["STRIPE_PRICE_REIGN_YEARLY",   "reign"],
    ["STRIPE_PRICE_LEGACY_MONTHLY", "legacy"],
    ["STRIPE_PRICE_LEGACY_YEARLY",  "legacy"],
  ];
  for (const [envKey, tier] of candidates) {
    const configured = process.env[envKey];
    if (configured && configured === priceId) return tier;
  }
  return null;
}
