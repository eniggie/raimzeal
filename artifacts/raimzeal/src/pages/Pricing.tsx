import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Star, Zap, Crown, Shield, ChevronLeft, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BottomNav } from '@/components/BottomNav';
import { useTier } from '@/hooks/useTier';
import { useAuth } from '@/contexts/AuthContext';

type Interval = 'monthly' | 'yearly';
type PaidTier = 'rise' | 'reign' | 'legacy';

const PRICES: Record<PaidTier, { monthly: number; yearly: number; yearlyPerMonth: number }> = {
  rise:   { monthly: 9.99,  yearly: 99,  yearlyPerMonth: 8.25  },
  reign:  { monthly: 19.99, yearly: 199, yearlyPerMonth: 16.58 },
  legacy: { monthly: 49.99, yearly: 499, yearlyPerMonth: 41.58 },
};

const TIER_ORDER = ['foundation', 'rise', 'reign', 'legacy'] as const;
type AnyTier = typeof TIER_ORDER[number];

function tierRank(t: AnyTier): number {
  return TIER_ORDER.indexOf(t);
}

interface TierDef {
  id: AnyTier;
  name: string;
  label: string;
  badge?: string;
  badgeStyle?: string;
  icon: React.ReactNode;
  cardStyle: string;
  btnStyle: string;
  features: { text: string; soon?: boolean }[];
}

const TIERS: TierDef[] = [
  {
    id: 'foundation',
    name: 'Foundation',
    label: 'Free Forever',
    icon: <Shield className="h-5 w-5" />,
    cardStyle: 'border-border/40 bg-card/50',
    btnStyle: 'bg-muted text-muted-foreground cursor-default',
    features: [
      { text: 'Ovia AI: 15 messages/day' },
      { text: 'Basic workout library' },
      { text: 'Community: view & like posts' },
      { text: 'Nutrition & meal logging' },
      { text: 'Body measurements & weight tracking' },
      { text: 'Progress charts' },
      { text: 'Calendar scheduling' },
    ],
  },
  {
    id: 'rise',
    name: 'Rise',
    label: '$0/mo',
    badge: 'Most Popular',
    badgeStyle: 'bg-primary text-primary-foreground',
    icon: <Star className="h-5 w-5" />,
    cardStyle: 'border-primary/70 bg-primary/5 ring-1 ring-primary/40',
    btnStyle: 'bg-primary text-primary-foreground hover:bg-primary/90',
    features: [
      { text: 'Everything in Foundation' },
      { text: 'Unlimited Ovia AI (gpt-4o)' },
      { text: 'Full community: post, comment & reply' },
      { text: 'Full workout library & all programs' },
      { text: 'Macro tracking' },
      { text: 'Progress card sharing' },
      { text: 'All nutrition tools' },
    ],
  },
  {
    id: 'reign',
    name: 'Reign',
    label: '$0/mo',
    badge: 'Best Value',
    badgeStyle: 'bg-[#C9A84C] text-black',
    icon: <Zap className="h-5 w-5" />,
    cardStyle: 'border-[#C9A84C]/60 bg-[#C9A84C]/5 ring-1 ring-[#C9A84C]/40',
    btnStyle: 'bg-[#C9A84C] text-black hover:bg-[#C9A84C]/90',
    features: [
      { text: 'Everything in Rise' },
      { text: 'Priority Ovia responses' },
      { text: 'AI-powered meal plans' },
      { text: 'Custom workout builder' },
      { text: 'Weekly Ovia coaching digest' },
      { text: 'Advanced progress analytics' },
    ],
  },
  {
    id: 'legacy',
    name: 'Legacy',
    label: '$0/mo',
    icon: <Crown className="h-5 w-5" />,
    cardStyle: 'border-purple-500/40 bg-purple-500/5',
    btnStyle: 'bg-purple-600 text-white hover:bg-purple-500',
    features: [
      { text: 'Everything in Reign' },
      { text: 'Adaptive training programs', soon: true },
      { text: 'Wearable integration', soon: true },
      { text: 'Quarterly photo body analysis', soon: true },
      { text: "Founder's Circle access" },
    ],
  },
];

export function Pricing() {
  const [interval, setInterval] = useState<Interval>('monthly');
  const [loadingTier, setLoadingTier] = useState<PaidTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user, session } = useAuth();
  const { tier: currentTier, loading: tierLoading } = useTier();
  const [, navigate] = useLocation();

  async function handleSubscribe(tier: PaidTier) {
    if (!user || !session) {
      navigate('/login');
      return;
    }
    setError(null);
    setLoadingTier(tier);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
      const r = await fetch(`${base}/api/billing/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await r.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Could not start checkout. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoadingTier(null);
    }
  }

  function btnLabel(tierDef: TierDef): string {
    if (tierDef.id === 'foundation') {
      return currentTier === 'foundation' ? 'Current Plan' : 'Downgrade to Free';
    }
    if (tierLoading) return '...';
    if (currentTier === tierDef.id) return 'Current Plan';
    if (tierRank(currentTier) < tierRank(tierDef.id)) return `Upgrade to ${tierDef.name}`;
    return `Switch to ${tierDef.name}`;
  }

  function price(tier: TierDef): string {
    if (tier.id === 'foundation') return 'Free';
    const p = PRICES[tier.id as PaidTier]!;
    if (interval === 'yearly') return `$${p.yearlyPerMonth.toFixed(2)}/mo`;
    return `$${p.monthly}/mo`;
  }

  function yearlyNote(tier: TierDef): string | null {
    if (tier.id === 'foundation' || interval === 'monthly') return null;
    const p = PRICES[tier.id as PaidTier]!;
    return `$${p.yearly}/yr`;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-3xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/membership">
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <ChevronLeft className="h-5 w-5 text-foreground/70" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Choose Your Plan</h1>
            <p className="text-sm text-foreground/60">Invest in your health. Cancel anytime.</p>
          </div>
        </div>

        {/* Monthly / Yearly toggle */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1">
            <button
              onClick={() => setInterval('monthly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                interval === 'monthly' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('yearly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
                interval === 'yearly' ? 'bg-background text-foreground shadow-sm' : 'text-foreground/50'
              }`}
            >
              Yearly
              <span className="text-xs font-bold text-primary">Save 17%</span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30"
          >
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </motion.div>
        )}

        {/* Tier cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {TIERS.map((tierDef, i) => {
            const isCurrent = currentTier === tierDef.id && !tierLoading;
            const isPaid = tierDef.id !== 'foundation';
            const isLoading = loadingTier === tierDef.id;

            return (
              <motion.div
                key={tierDef.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-2xl border p-5 flex flex-col ${tierDef.cardStyle} ${isCurrent ? 'ring-2' : ''}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-foreground/5">
                      {tierDef.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-foreground">{tierDef.name}</h2>
                        {tierDef.badge && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tierDef.badgeStyle}`}>
                            {tierDef.badge}
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/70">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-foreground">{price(tierDef)}</p>
                    {yearlyNote(tierDef) && (
                      <p className="text-xs text-foreground/50">{yearlyNote(tierDef)}</p>
                    )}
                    {tierDef.id === 'foundation' && (
                      <p className="text-xs text-foreground/50">forever</p>
                    )}
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-1.5 mb-4 flex-1">
                  {tierDef.features.map((f) => (
                    <li key={f.text} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      <span>
                        {f.text}
                        {f.soon && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-foreground/40">
                            <Clock className="h-3 w-3" />
                            Coming Soon
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA button */}
                {tierDef.id === 'foundation' ? (
                  <div className={`w-full rounded-xl py-2.5 text-center text-sm font-semibold ${isCurrent ? 'bg-white/10 text-foreground/50' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}>
                    {isCurrent ? 'Your current plan' : 'No subscription needed'}
                  </div>
                ) : isCurrent ? (
                  <div className="w-full rounded-xl py-2.5 text-center text-sm font-semibold bg-white/10 text-foreground/50">
                    Current Plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tierDef.id as PaidTier)}
                    disabled={!!loadingTier}
                    className={`w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 ${tierDef.btnStyle}`}
                  >
                    {isLoading ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Starting checkout…</>
                    ) : (
                      btnLabel(tierDef)
                    )}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-xs text-center text-foreground/40 mb-2 leading-relaxed"
        >
          Cancel anytime — your access is preserved until the end of the billing period, then automatically downgraded to Foundation.{' '}
          No data is ever deleted. Annual billing is charged upfront.
        </motion.p>

        {!user && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-xs text-center text-foreground/50 mb-4"
          >
            <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
            {' '}or{' '}
            <Link href="/signup" className="text-primary font-semibold hover:underline">create an account</Link>
            {' '}to subscribe.
          </motion.p>
        )}

      </div>
      <BottomNav />
    </div>
  );
}
