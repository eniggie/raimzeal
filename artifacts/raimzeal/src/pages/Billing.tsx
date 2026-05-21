import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Heart, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';

const STRIPE_DONATION_URL = 'https://donate.stripe.com/aFa6oH7GE50z37Xdmh6kg00';
const DONATION_ACTIVE = Boolean(
  STRIPE_DONATION_URL &&
  STRIPE_DONATION_URL.startsWith('https://donate.stripe.com/') &&
  !STRIPE_DONATION_URL.includes('PLACEHOLDER')
);
const RAIMZY_LINKTREE = 'https://linktr.ee/Raimzy';

export function Billing() {
  const [donationError, setDonationError] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Billing</h1>
            <p className="text-muted-foreground text-sm">RAIMZEAL is free forever</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-primary/5 p-6 mb-4 text-center"
        >
          <p className="text-lg font-bold text-primary mb-2">No subscription required</p>
          <p className="text-sm text-foreground/70 leading-relaxed">
            RAIMZEAL is completely free. Every feature is available to every user — no payment, no tiers, no limits.
          </p>
        </motion.div>

        {DONATION_ACTIVE && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="p-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between gap-4 mb-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Support the mission</p>
              <p className="text-xs text-foreground/60 mt-0.5">Optional donation to help keep RAIMZEAL free.</p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <button
                onClick={() => {
                  try {
                    const w = window.open(STRIPE_DONATION_URL, '_blank', 'noopener,noreferrer');
                    if (!w) throw new Error('blocked');
                    setDonationError(false);
                  } catch {
                    setDonationError(true);
                    setTimeout(() => setDonationError(false), 5000);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-current" />
                Donate
              </button>
              {donationError && (
                <p className="text-xs text-destructive text-right">Temporarily unavailable — try again shortly.</p>
              )}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="p-4 rounded-2xl border border-secondary/20 bg-secondary/5"
        >
          <p className="text-sm font-semibold mb-1">Resources from RAIMZY</p>
          <p className="text-xs text-foreground/60 leading-relaxed mb-2">
            Books, music, courses, and coaching to complement your fitness journey.
          </p>
          <a
            href={RAIMZY_LINKTREE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-secondary font-semibold hover:underline"
          >
            Visit linktr.ee/Raimzy
            <ExternalLink className="w-3 h-3" />
          </a>
        </motion.div>
      </div>
    </div>
  );
}
