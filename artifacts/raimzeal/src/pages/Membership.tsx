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
            <p className="text-sm font-semibold">Support the mission</p>
            <p className="text-xs text-foreground/60 mt-0.5">Any amount helps keep RAIMZEAL free for everyone.</p>
          </div>
          {DONATION_ACTIVE ? (
            <a
              href={STRIPE_DONATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:opacity-80"
              aria-label="Make a donation"
            >
              <Heart className="w-4 h-4 fill-current" />
              Donate
            </a>
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
          <p className="text-sm font-semibold mb-1">Resources from RAIMZY</p>
          <p className="text-xs text-foreground/60 leading-relaxed mb-2">
            RAIMZY is one of RAIMZEAL's biggest supporters. Find books, music, courses, and coaching to complement your fitness journey.
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
      <BottomNav />
    </div>
  );
}
