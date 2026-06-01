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
    monthly: 4.99,
    yearly: 39.99,
    yearlyEquiv: 3.33,
    popular: false,
    badgeLabel: null,
    foundingOffer: null,
  },
  reign: {
    key: 'reign',
    name: 'Reign',
    monthly: 9.99,
    yearly: 79.99,
    yearlyEquiv: 6.67,
    popular: true,
    badgeLabel: 'Best Value',
    foundingOffer: 'Founding Member Price: $4.99/mo for the first 1,000 members.',
  },
  legacy: {
    key: 'legacy',
    name: 'Legacy',
    monthly: 19.99,
    yearly: 149.99,
    yearlyEquiv: 12.50,
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
