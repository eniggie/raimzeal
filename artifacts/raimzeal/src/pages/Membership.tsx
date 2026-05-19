import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Crown, Star, ChevronLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BottomNav } from '@/components/BottomNav';

interface Plan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  priceLabel: string;
  features: readonly string[];
  cta: string;
  highlighted: boolean;
  priceId: string | null;
}

const FALLBACK_PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Foundation',
    tagline: 'Start your journey',
    price: 0,
    priceLabel: 'Free forever',
    features: [
      '10 workouts from library',
      'Basic calorie & macro tracking',
      'Community (read-only)',
      '5 Ovia AI messages/day',
      'Basic progress charts',
      'Weight tracking',
    ],
    cta: 'Get started',
    highlighted: false,
    priceId: null,
  },
  {
    id: 'athlete',
    name: 'Athlete',
    tagline: 'For the dedicated',
    price: 9.99,
    priceLabel: '$9.99 / month',
    features: [
      'Full workout library & programs',
      'Unlimited nutrition logging',
      'Full body measurements',
      'Unlimited Ovia AI',
      'Community posting & comments',
      'Progress PDF export',
      'Activity tracker & reminders',
      'Progress card sharing',
      'Calendar scheduling',
    ],
    cta: 'Start Athlete',
    highlighted: true,
    priceId: null,
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Maximum performance',
    price: 19.99,
    priceLabel: '$19.99 / month',
    features: [
      'Everything in Athlete',
      'Priority Ovia AI (GPT-4.1 Turbo)',
      'AI-generated meal plans',
      'Weekly Ovia coaching digest',
      'Custom workout builder',
      'Early access to new features',
      'Exclusive Elite badge',
      'PDF coaching reports',
    ],
    cta: 'Go Elite',
    highlighted: false,
    priceId: null,
  },
];

const PLAN_ICONS = { free: Star, athlete: Zap, elite: Crown };
const PLAN_COLORS = {
  free:    { border: 'border-white/10', badge: '', icon: 'text-foreground/50', btn: 'bg-white/10 text-foreground hover:bg-white/20' },
  athlete: { border: 'border-primary/60', badge: 'bg-primary text-white', icon: 'text-primary', btn: 'bg-primary text-white hover:bg-primary/90' },
  elite:   { border: 'border-secondary/60', badge: 'bg-secondary text-black', icon: 'text-secondary', btn: 'bg-secondary text-black hover:bg-secondary/90' },
};

export function Membership() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stripe/plans')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.plans) setPlans(data.plans); })
      .catch(() => {/* keep fallback */});
  }, []);

  async function handleUpgrade(plan: Plan) {
    if (plan.id === 'free' || !plan.priceId) {
      // Prompt sign up or no-op for free
      return;
    }
    setCheckoutLoading(plan.id);
    setLoading(true);
    try {
      const base = window.location.origin;
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: plan.priceId,
          successUrl: `${base}/membership?success=1`,
          cancelUrl:  `${base}/membership`,
        }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
      setCheckoutLoading(null);
    }
  }

  const searchParams = new URLSearchParams(window.location.search);
  const success = searchParams.get('success') === '1';

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <ChevronLeft className="h-5 w-5 text-foreground/70" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Membership</h1>
            <p className="text-sm text-foreground/60">Choose the plan that fits your goals</p>
          </div>
        </div>

        {/* Success banner */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-2xl bg-primary/20 border border-primary/40 text-center"
          >
            <p className="font-semibold text-primary">Welcome to RAIMZEAL Premium!</p>
            <p className="text-sm text-foreground/70 mt-1">Your subscription is now active. Enjoy all the perks.</p>
          </motion.div>
        )}

        {/* Plans */}
        <div className="space-y-4">
          {plans.map((plan, i) => {
            const Icon = PLAN_ICONS[plan.id as keyof typeof PLAN_ICONS] ?? Star;
            const colors = PLAN_COLORS[plan.id as keyof typeof PLAN_COLORS] ?? PLAN_COLORS.free;
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className={cn(
                  'relative rounded-2xl border p-5 bg-white/5 backdrop-blur-sm',
                  colors.border,
                  plan.highlighted && 'ring-1 ring-primary/40'
                )}
              >
                {plan.highlighted && (
                  <span className={cn('absolute -top-3 left-5 px-3 py-0.5 rounded-full text-xs font-bold', colors.badge)}>
                    Most Popular
                  </span>
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-xl bg-white/10', colors.icon)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{plan.name}</h2>
                      <p className="text-xs text-foreground/50">{plan.tagline}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-foreground">{plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`}</p>
                    {plan.price > 0 && <p className="text-xs text-foreground/50">/ month</p>}
                  </div>
                </div>

                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>

                <Button
                  className={cn('w-full font-semibold', colors.btn)}
                  disabled={plan.id === 'free' || (!!checkoutLoading && checkoutLoading !== plan.id) || loading}
                  onClick={() => handleUpgrade(plan)}
                >
                  {checkoutLoading === plan.id ? 'Redirecting…' : plan.id === 'free' ? 'Current plan' : plan.cta}
                </Button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-center text-xs text-foreground/40 mt-6">
          Secure payment via Stripe · Cancel anytime
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
