import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronLeft, Heart, ExternalLink, Shield, Zap, Star, Crown, Bell, X, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/lib/supabase';

import { STRIPE_DONATION_URL, DONATION_ACTIVE, RAIMZY_LINKTREE } from '@/lib/constants';

const FOUNDATION_FEATURES = [
  'Full workout library & custom workouts',
  'Ovia AI coaching — 15 messages/day',
  'Full community: post, comment, like',
  'Nutrition & meal logging with macros',
  'Body measurements & weight tracking',
  'Progress charts & personal records',
  'Sleep tracking & streak tracking',
  'Workout calendar scheduling',
  'Data export (JSON / CSV)',
  'Public profile with shareable link',
  'Macro target calculator',
];

const RISE_FEATURES = [
  'Everything in Foundation',
  'Ovia AI coaching — 200 messages/day',
  'Priority community badge',
  'Advanced nutrition analytics',
  'Extended workout history (unlimited)',
  'Weekly Ovia AI coaching digest email',
];

const REIGN_FEATURES = [
  'Everything in Rise',
  'Ovia AI coaching — 500 messages/day',
  'AI-powered meal plan suggestions',
  'Advanced body composition analytics',
  'Custom macro goal recommendations',
  'Reign supporter badge',
  'Early access to all new features',
];

const LEGACY_FEATURES = [
  'Everything in Reign',
  'Ovia AI coaching — unlimited messages',
  '1-on-1 coaching session access',
  'Dedicated priority support',
  'Legacy founder badge',
  'Lifetime recognition in the RAIMZEAL community',
];

const PAID_PLANS = [
  {
    key: 'rise',
    name: 'Rise',
    icon: Zap,
    color: 'text-blue-400',
    border: 'border-blue-400/30',
    bg: 'bg-blue-400/5',
    badge: 'bg-blue-400/20 text-blue-400',
    monthly: 9.99,
    yearly: 99.00,
    yearlyEquiv: 8.25,
    popular: false,
    hasPrice: true,
    features: RISE_FEATURES,
  },
  {
    key: 'reign',
    name: 'Reign',
    icon: Star,
    color: 'text-purple-400',
    border: 'border-purple-400/30',
    bg: 'bg-purple-400/5',
    badge: 'bg-purple-400/20 text-purple-400',
    monthly: 19.99,
    yearly: 199.00,
    yearlyEquiv: 16.58,
    popular: true,
    hasPrice: true,
    features: REIGN_FEATURES,
  },
  {
    key: 'legacy',
    name: 'Legacy',
    icon: Crown,
    color: 'text-yellow-400',
    border: 'border-yellow-400/30',
    bg: 'bg-yellow-400/5',
    badge: 'bg-yellow-400/20 text-yellow-400',
    monthly: 49.99,
    yearly: 499.00,
    yearlyEquiv: 41.58,
    popular: false,
    hasPrice: false,
    features: LEGACY_FEATURES,
  },
];

export function Membership() {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');
  const [notifyPlan, setNotifyPlan] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<Record<string, boolean>>({});
  const [checkoutError, setCheckoutError] = useState<Record<string, string>>({});
  const [checkoutUrl, setCheckoutUrl] = useState<Record<string, string>>({});

  async function handleCheckout(tier: string, interval: 'monthly' | 'yearly') {
    // Open a blank tab immediately — must be synchronous inside the click handler
    // so popup blockers don't intervene. We navigate it to Stripe after the fetch.
    let stripeTab: Window | null = null;
    try { stripeTab = window.open('', '_blank'); } catch { /* sandbox blocks open */ }

    setCheckoutLoading((prev) => ({ ...prev, [tier]: true }));
    setCheckoutError((prev) => ({ ...prev, [tier]: '' }));
    setCheckoutUrl((prev) => ({ ...prev, [tier]: '' }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers,
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json() as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        stripeTab?.close();
        setCheckoutError((prev) => ({
          ...prev,
          [tier]: data.error ?? 'Could not start checkout. Please try again.',
        }));
        return;
      }

      if (stripeTab && !stripeTab.closed) {
        // Navigate the pre-opened tab to Stripe checkout.
        stripeTab.location.href = data.url;
      } else {
        // Tab was blocked — surface a clickable link as fallback.
        setCheckoutUrl((prev) => ({ ...prev, [tier]: data.url! }));
      }
    } catch {
      stripeTab?.close();
      setCheckoutError((prev) => ({
        ...prev,
        [tier]: 'Network error. Please check your connection and try again.',
      }));
    } finally {
      setCheckoutLoading((prev) => ({ ...prev, [tier]: false }));
    }
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-2xl mx-auto px-4 pt-6">

        <div className="flex items-center gap-3 mb-4">
          <Link href="/settings">
            <button className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <ChevronLeft className="h-5 w-5 text-foreground/70" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Membership</h1>
            <p className="text-sm text-foreground/60">The Foundation Plan is free forever. No subscription. No catch.</p>
          </div>
        </div>

        {/* Foundation — Free Forever */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl glass-emerald shimmer p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-primary" />
            <p className="font-bold text-foreground">RAIMZEAL — Foundation Plan</p>
            <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-primary/20 text-primary">
              Free Forever
            </span>
          </div>
          <p className="text-xs text-foreground/60 mb-3">
            Everything below is included at no cost. Your health data belongs to you, not to advertisers or investors.
          </p>
          <ul className="space-y-1.5">
            {FOUNDATION_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="flex items-center justify-center mb-4"
        >
          <div className="inline-flex items-center gap-1 p-1 rounded-xl glass">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${billing === 'yearly' ? 'bg-primary text-primary-foreground' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Yearly
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${billing === 'yearly' ? 'bg-white/20 text-primary-foreground' : 'bg-primary/20 text-primary'}`}>
                Save 17%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Paid plan cards */}
        <div className="space-y-3 mb-6">
          {PAID_PLANS.map((plan, i) => {
            const Icon = plan.icon;
            const price = billing === 'monthly' ? plan.monthly : plan.yearly;
            const period = billing === 'monthly' ? '/mo' : '/yr';
            const isLoading = checkoutLoading[plan.key] ?? false;
            const error = checkoutError[plan.key] ?? '';
            const stripeUrl = checkoutUrl[plan.key] ?? '';

            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + i * 0.04 }}
                className={`relative rounded-2xl glass p-5 border ${plan.border} ${!plan.hasPrice ? 'opacity-80' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-purple-500 text-white shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-5 w-5 ${plan.color}`} />
                  <p className="font-bold text-foreground">{plan.name}</p>
                  {!plan.hasPrice && (
                    <span className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full bg-foreground/10 text-foreground/50">
                      Coming Soon
                    </span>
                  )}
                </div>
                <div className="mb-3">
                  <span className={`text-2xl font-extrabold ${plan.color}`}>${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}</span>
                  <span className="text-sm text-foreground/50 ml-1">{period}</span>
                  {billing === 'yearly' && (
                    <span className="ml-2 text-xs text-foreground/40">(${plan.yearlyEquiv.toFixed(2)}/mo equivalent)</span>
                  )}
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/70">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.color} opacity-60`} />
                      {f}
                    </li>
                  ))}
                </ul>

                {plan.hasPrice ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleCheckout(plan.key, billing)}
                      disabled={isLoading}
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                        ${plan.key === 'rise'
                          ? 'bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-60'
                          : 'bg-purple-500 hover:bg-purple-400 text-white disabled:opacity-60'
                        }`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Opening Stripe checkout…
                        </>
                      ) : (
                        `Subscribe ${billing === 'monthly' ? 'Monthly' : 'Yearly'} — $${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}${period}`
                      )}
                    </button>
                    {error && (
                      <p className="text-xs text-destructive text-center leading-relaxed">{error}</p>
                    )}
                    {stripeUrl && (
                      <a
                        href={stripeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-center text-white transition-opacity hover:opacity-90
                          ${plan.key === 'rise' ? 'bg-blue-500' : 'bg-purple-500'}`}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Continue to Stripe Checkout
                      </a>
                    )}
                    <p className="text-[10px] text-foreground/40 text-center">
                      Secure checkout via Stripe · Cancel anytime
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setNotifyPlan(plan.key)}
                    className="w-full py-2.5 rounded-xl border border-foreground/20 text-sm font-semibold text-foreground/60 bg-foreground/5 hover:bg-foreground/10 transition-colors flex items-center justify-center gap-2"
                  >
                    <Bell className="w-4 h-4" />
                    Notify Me When Available
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Donation CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          className="mb-6 p-4 rounded-2xl glass-emerald shimmer flex items-center justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Support the mission — keep RAIMZEAL free for everyone.</p>
            <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
              RAIMZEAL is free forever, built for fitness, food therapy, wellness, and healthcare support. Your health was never up for sale. Donations help keep the platform and team running.
            </p>
          </div>
          {DONATION_ACTIVE ? (
            <div className="shrink-0">
              <a
                href={STRIPE_DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                aria-label="Make a donation"
              >
                <Heart className="w-4 h-4 fill-current" />
                Donate
              </a>
            </div>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground italic text-right">Donation link<br />coming soon.</p>
          )}
        </motion.div>

        {/* RAIMZY Resources */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.26 }}
          className="p-4 rounded-2xl glass-royal"
        >
          <p className="text-sm font-semibold mb-1">RAIMZY — Dr. Ephraim Oviawe PHD, MBA, MTS, CST, AMA, DMIPRO, CSM, PMP</p>
          <p className="text-xs text-foreground/60 leading-relaxed mb-3">
            Author, music artist, strategist, and the mind behind RAIMZEAL. Explore his books, music, courses, and coaching — built around leadership, wellness, creativity, and business execution. Created and powered by <span className="font-semibold text-foreground/80">ECONTEUR LLC</span> ·{' '}
            <a href="https://www.econteur.com" target="_blank" rel="noopener noreferrer" className="hover:underline">www.econteur.com</a>
          </p>
          <div className="flex flex-col gap-1.5">
            <a href={RAIMZY_LINKTREE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline">
              linktr.ee/Raimzy — all resources <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://www.raimzy.com" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline">
              www.raimzy.com — official site <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://unitedmasters.com/raimzy" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline">
              unitedmasters.com/raimzy — music <ExternalLink className="w-3 h-3" />
            </a>
            <a href="https://www.amazon.com/author/dr.ephraim-oviawe" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline">
              amazon.com — books by Dr. Oviawe <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

      </div>

      {/* Notify Me modal — only for plans without a price (Legacy) */}
      <AnimatePresence>
        {notifyPlan && (() => {
          const plan = PAID_PLANS.find(p => p.key === notifyPlan);
          if (!plan) return null;
          return (
            <motion.div
              key="notify-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8"
              onClick={() => setNotifyPlan(null)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                className="w-full max-w-sm rounded-2xl glass p-6 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base">{plan.name} — Coming Soon</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {plan.name} subscriptions are not yet live. Send us an email and we'll notify you the moment they launch.
                    </p>
                  </div>
                  <button onClick={() => setNotifyPlan(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <a
                  href={`mailto:support@raimzeal.com?subject=Notify me about the RAIMZEAL ${plan.name} plan&body=Hi, I'd like to be notified when the ${plan.name} plan launches. Thank you!`}
                  className="block w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold text-center"
                >
                  Email Me When It Launches
                </a>
                <button
                  onClick={() => setNotifyPlan(null)}
                  className="block w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground"
                >
                  Not Now
                </button>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
