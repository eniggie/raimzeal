import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Zap, Crown } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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
      'Priority Ovia AI (GPT-4o)',
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

function PlanIcon({ id }: { id: string }) {
  if (id === 'athlete') return <Zap className="w-5 h-5" />;
  if (id === 'elite') return <Crown className="w-5 h-5" />;
  return null;
}

export function Pricing() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/stripe/plans')
      .then(r => r.json())
      .then(({ plans: live }) => {
        if (Array.isArray(live)) setPlans(live as Plan[]);
      })
      .catch(() => {});
  }, []);

  async function handleSubscribe(plan: Plan) {
    if (plan.id === 'free') return;
    if (!session) {
      navigate('/signup');
      return;
    }
    if (!plan.priceId) {
      setError('This plan is not yet available for purchase. Please try again later.');
      return;
    }
    setError(null);
    setCheckoutLoading(plan.id);
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Something went wrong.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 pb-24">
      {/* Header */}
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Choose your plan</h1>
            <p className="text-muted-foreground text-sm">Unlock your full potential with RAIMZEAL</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={cn(
                'relative rounded-2xl border p-6 flex flex-col',
                plan.highlighted
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border bg-card'
              )}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}

              <div className="flex items-center gap-2 mb-1">
                {plan.highlighted && (
                  <span className="text-primary">
                    <PlanIcon id={plan.id} />
                  </span>
                )}
                <h2 className="text-lg font-bold">{plan.name}</h2>
              </div>
              <p className="text-muted-foreground text-sm mb-4">{plan.tagline}</p>

              <div className="mb-6">
                <span className="text-3xl font-bold">
                  {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`}
                </span>
                {plan.price > 0 && (
                  <span className="text-muted-foreground text-sm ml-1">/ month</span>
                )}
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={cn(
                  'w-full',
                  plan.highlighted
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'variant-outline'
                )}
                variant={plan.highlighted ? 'default' : 'outline'}
                disabled={plan.id === 'free' || checkoutLoading !== null}
                onClick={() => handleSubscribe(plan)}
              >
                {checkoutLoading === plan.id
                  ? 'Redirecting…'
                  : plan.id === 'free'
                  ? 'Current plan'
                  : plan.cta}
              </Button>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Cancel anytime. Billed monthly. Secure checkout powered by Stripe.
        </p>
      </div>
    </div>
  );
}
