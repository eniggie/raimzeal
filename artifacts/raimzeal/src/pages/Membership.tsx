import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Heart, ExternalLink, Shield, Zap, Star, Crown } from 'lucide-react';
import { Link } from 'wouter';
import { BottomNav } from '@/components/BottomNav';

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
  'Ovia AI coaching — 50 messages/day',
  'Priority community badge',
  'Advanced nutrition analytics',
  'Extended workout history (unlimited)',
  'Weekly Ovia AI coaching digest email',
];

const REIGN_FEATURES = [
  'Everything in Rise',
  'Ovia AI coaching — unlimited messages',
  'AI-powered meal plan suggestions',
  'Advanced body composition analytics',
  'Custom macro goal recommendations',
  'Reign supporter badge',
];

const LEGACY_FEATURES = [
  'Everything in Reign',
  'Lifetime Legacy supporter badge',
  'Early access to all new features',
  '1-on-1 coaching session access',
  'Dedicated support channel',
  'RAIMZEAL Hall of Fame listing',
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
    yearly: 95.99,
    popular: false,
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
    monthly: 14.99,
    yearly: 143.99,
    popular: true,
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
    monthly: 19.99,
    yearly: 191.99,
    popular: false,
    features: LEGACY_FEATURES,
  },
] as const;

export function Membership() {
  const [donationError, setDonationError] = useState(false);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div className="min-h-screen bg-background pb-28">
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

        {/* Free Forever card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-5"
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

        {/* Paid plans billing toggle */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="flex items-center justify-center mb-4"
        >
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
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
                Save 20%
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
            return (
              <motion.div
                key={plan.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + i * 0.04 }}
                className={`relative rounded-2xl border ${plan.border} ${plan.bg} p-5`}
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
                  <p className={`font-bold text-foreground`}>{plan.name}</p>
                  <span className={`ml-auto text-xs font-bold px-2.5 py-1 rounded-full ${plan.badge}`}>
                    Coming Soon
                  </span>
                </div>
                <div className="mb-3">
                  <span className={`text-2xl font-extrabold ${plan.color}`}>${price.toFixed(2)}</span>
                  <span className="text-sm text-foreground/50 ml-1">{period}</span>
                  {billing === 'yearly' && (
                    <span className="ml-2 text-xs text-foreground/40">(${plan.monthly.toFixed(2)}/mo equivalent)</span>
                  )}
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                      <Check className={`h-4 w-4 mt-0.5 shrink-0 ${plan.color}`} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  disabled
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-semibold text-foreground/40 cursor-not-allowed"
                >
                  Coming Soon
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Donation CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="mb-6 p-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">The Foundation Plan is free forever — no subscription, no catch.</p>
            <p className="text-xs text-foreground/60 mt-1 leading-relaxed">
              RAIMZEAL is free forever, built for fitness, food therapy, wellness, and healthcare support. Your health was never up for sale. Donations keep the staff and platform running for everyone.
            </p>
          </div>
          {DONATION_ACTIVE ? (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <motion.button
                onClick={async () => {
                  const popup = window.open('about:blank', '_blank');
                  if (!popup) {
                    setDonationError(true);
                    setTimeout(() => setDonationError(false), 5000);
                    return;
                  }
                  try {
                    const r = await fetch('/api/stripe/donation-health');
                    const { ok } = await r.json() as { ok: boolean };
                    if (!ok) throw new Error('unhealthy');
                    popup.location.href = STRIPE_DONATION_URL;
                    setDonationError(false);
                  } catch {
                    popup.close();
                    setDonationError(true);
                    setTimeout(() => setDonationError(false), 5000);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:opacity-80 cursor-pointer"
                animate={{ scale: [1, 1.07, 1, 1.07, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
                aria-label="Make a donation"
              >
                <Heart className="w-4 h-4 fill-current" />
                Donate
              </motion.button>
              {donationError && (
                <p className="text-xs text-destructive text-right">Donation link temporarily unavailable — please try again shortly.</p>
              )}
            </div>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground italic text-right">Donation link<br />coming soon.</p>
          )}
        </motion.div>

        {/* RAIMZY Resources */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.22 }}
          className="p-4 rounded-2xl border border-secondary/20 bg-secondary/5"
        >
          <p className="text-sm font-semibold mb-1">RAIMZY — Dr. Ephraim Oviawe</p>
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
      <BottomNav />
    </div>
  );
}
