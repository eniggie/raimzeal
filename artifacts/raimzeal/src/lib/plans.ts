export type PlanKey = 'foundation' | 'rise' | 'reign' | 'legacy';

export type Plan = {
  key: PlanKey;
  name: string;
  monthly: number;
  yearly: number;
  yearlyEquiv: number;
  popular: boolean;
  badgeLabel: string | null;
  foundingOffer: string | null;
};

export const PLANS: Record<PlanKey, Plan> = {
  foundation: {
    key: 'foundation',
    name: 'Foundation',
    monthly: 0,
    yearly: 0,
    yearlyEquiv: 0,
    popular: false,
    badgeLabel: null,
    foundingOffer: null,
  },
  rise: {
    key: 'rise',
    name: 'Rise',
    monthly: 9.99,
    yearly: 99.00,
    yearlyEquiv: 8.25,
    popular: false,
    badgeLabel: null,
    foundingOffer: null,
  },
  reign: {
    key: 'reign',
    name: 'Reign',
    monthly: 19.99,
    yearly: 199.00,
    yearlyEquiv: 16.58,
    popular: true,
    badgeLabel: 'Best Value',
    foundingOffer: null,
  },
  legacy: {
    key: 'legacy',
    name: 'Legacy',
    monthly: 49.99,
    yearly: 499.00,
    yearlyEquiv: 41.58,
    popular: false,
    badgeLabel: null,
    foundingOffer: null,
  },
};

export const PAID_PLAN_KEYS: PlanKey[] = ['rise', 'reign', 'legacy'];

export const ENTRY_PRICE_MONTHLY = PLANS.rise.monthly;

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
