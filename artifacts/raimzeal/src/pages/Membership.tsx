import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Heart, ExternalLink, Star } from 'lucide-react';
import { Link } from 'wouter';
import { BottomNav } from '@/components/BottomNav';

const STRIPE_DONATION_URL = 'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00';
const DONATION_ACTIVE = Boolean(
  STRIPE_DONATION_URL &&
  STRIPE_DONATION_URL.startsWith('https://donate.stripe.com/') &&
  !STRIPE_DONATION_URL.includes('PLACEHOLDER')
);
const RAIMZY_LINKTREE = 'https://linktr.ee/Raimzy';

const ALL_FEATURES = [
  'Full workout library & programs',
  'Unlimited nutrition logging',
  'Full body measurements',
  'Unlimited Ovia AI coaching',
  'Community posting & comments',
  'Activity tracker & reminders',
  'Progress card sharing',
  'Calendar scheduling',
  'Weekly Ovia coaching digest',
  'Custom workout builder',
  'Basic progress charts',
  'Weight tracking',
];

export function Membership() {
  const [donationError, setDonationError] = useState(false);
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
            <p className="text-sm text-foreground/60">Everything included, forever.</p>
          </div>
        </div>

        {/* Free Forever card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-primary/60 bg-primary/5 p-5 ring-1 ring-primary/40"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Star className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">RAIMZEAL</h2>
                <p className="text-xs text-foreground/50">All features included</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-foreground">Free</p>
              <p className="text-xs text-foreground/50">forever</p>
            </div>
          </div>

          <ul className="space-y-1.5 mb-4">
            {ALL_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground/80">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                {f}
              </li>
            ))}
          </ul>

          <div className="w-full rounded-xl bg-white/10 py-3 text-center text-sm font-semibold text-foreground/50">
            You're all set — no subscription needed
          </div>
        </motion.div>

        {/* Donation CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-6 p-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between gap-4"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Non-profit organization · RAIMZEAL is free forever</p>
            <p className="text-xs text-foreground/60 mt-1 leading-relaxed">We said no to investors, subscription tiers, and ad deals — because your health isn't a product. Every feature, forever, for everyone. If this platform has played even a small role in your journey, a donation keeps the lights on for you and the next person who finds us. You're not supporting an app. You're part of a movement.</p>
          </div>
          {DONATION_ACTIVE ? (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <button
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
                aria-label="Make a donation"
              >
                <Heart className="w-4 h-4 fill-current" />
                Donate
              </button>
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
          transition={{ delay: 0.1 }}
          className="p-4 rounded-2xl border border-secondary/20 bg-secondary/5"
        >
          <p className="text-sm font-semibold mb-1">Books, Courses, Music &amp; Coaching — RAIMZY</p>
          <p className="text-xs text-foreground/60 leading-relaxed mb-3">
            Explore everything RAIMZY has created — books, music, online courses, and 1-on-1 coaching — built to complement your fitness and wellness journey. Created and powered by <span className="font-semibold text-foreground/80">ECONTEUR LLC</span> · <a href="https://www.econteur.com" target="_blank" rel="noopener noreferrer" className="hover:underline">www.econteur.com</a>
          </p>
          <div className="flex flex-col gap-1.5">
            <a
              href={RAIMZY_LINKTREE}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline"
            >
              linktr.ee/Raimzy <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.raimzy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline"
            >
              www.raimzy.com <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>

      </div>
      <BottomNav />
    </div>
  );
}
