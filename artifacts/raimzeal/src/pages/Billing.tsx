import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Heart, ExternalLink, Star, Zap, Crown, Shield, Loader2, Settings, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { useTier } from '@/hooks/useTier';
import { useAuth } from '@/contexts/AuthContext';

import { STRIPE_DONATION_URL, DONATION_ACTIVE, RAIMZY_LINKTREE } from '@/lib/constants';

const TIER_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  foundation: { label: 'Foundation', icon: <Shield className="h-4 w-4" />, color: 'text-foreground/70' },
  rise:       { label: 'Rise',       icon: <Star   className="h-4 w-4" />, color: 'text-primary' },
  reign:      { label: 'Reign',      icon: <Zap    className="h-4 w-4" />, color: 'text-[#C9A84C]' },
  legacy:     { label: 'Legacy',     icon: <Crown  className="h-4 w-4" />, color: 'text-purple-400' },
};

export function Billing() {
  const [donationError, setDonationError] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const { tier, status, currentPeriodEnd, loading: tierLoading } = useTier();
  const { session } = useAuth();
  const showSuccess = new URLSearchParams(window.location.search).get('success') === '1';

  const isPaid = status === 'active';
  const isPastDue = status === 'past_due';
  const meta = TIER_META[tier] ?? TIER_META['foundation']!;

  async function openPortal() {
    if (!session) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
      const r = await fetch(`${base}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await r.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalError(data.error ?? 'Could not open billing portal. Please try again.');
      }
    } catch {
      setPortalError('Something went wrong. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 pb-24">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Billing</h1>
            <p className="text-muted-foreground text-sm">Manage your subscription.</p>
          </div>
        </div>

        {/* Success banner */}
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-start gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30"
          >
            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-primary">Subscription activated!</p>
              <p className="text-xs text-foreground/60 mt-0.5">Welcome to {meta.label}. Your plan is now active.</p>
            </div>
          </motion.div>
        )}

        {/* Current plan */}
        {!tierLoading && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-primary/30 bg-primary/5 p-5 mb-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={meta.color}>{meta.icon}</span>
                <div>
                  <p className="font-bold text-foreground">
                    {meta.label}{' '}
                    <span className="text-xs font-normal text-foreground/50">plan</span>
                  </p>
                  {isPaid && currentPeriodEnd && (
                    <p className="text-xs text-foreground/40">
                      Renews {new Date(currentPeriodEnd).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {isPastDue && (
                    <p className="text-xs text-yellow-400">Payment past due — please update your payment method.</p>
                  )}
                </div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isPaid ? 'bg-primary/20 text-primary' : isPastDue ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-foreground/50'}`}>
                {isPaid ? 'Active' : isPastDue ? 'Past Due' : 'Free'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {isPaid || isPastDue ? (
                <>
                  <button
                    onClick={openPortal}
                    disabled={portalLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Settings className="h-3.5 w-3.5" />}
                    Manage Subscription
                  </button>
                  <Link href="/pricing">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-foreground/60 text-xs font-semibold transition-colors">
                      Change Plan <ArrowRight className="h-3 w-3" />
                    </button>
                  </Link>
                </>
              ) : (
                <Link href="/pricing">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors">
                    Upgrade Plan <ArrowRight className="h-3 w-3" />
                  </button>
                </Link>
              )}
            </div>

            {portalError && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {portalError}
              </div>
            )}

            {(isPaid || isPastDue) && (
              <p className="mt-3 text-xs text-foreground/40 leading-relaxed">
                Cancel anytime via the billing portal. Access is preserved until the end of the billing period, then reverts to Foundation. No data is ever deleted.
              </p>
            )}
          </motion.div>
        )}

        {/* Foundation note */}
        {!tierLoading && tier === 'foundation' && !isPaid && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-2xl border border-border/30 bg-muted/20 p-4 mb-4 text-center"
          >
            <p className="text-sm font-semibold text-foreground mb-1">Core features always free</p>
            <p className="text-xs text-foreground/50 leading-relaxed">
              Workouts, tracking, and basic Ovia AI are free forever. Upgrade to Rise or above for unlimited Ovia and full community access.
            </p>
          </motion.div>
        )}

        {/* Donation section */}
        {DONATION_ACTIVE && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="p-4 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-transparent flex items-center justify-between gap-4 mb-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Support the mission</p>
              <p className="text-xs text-foreground/60 mt-1 leading-relaxed">Core features are free forever. A donation keeps RAIMZEAL alive for everyone who needs it.</p>
            </div>
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
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                animate={{ scale: [1, 1.07, 1, 1.07, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
              >
                <Heart className="w-4 h-4 fill-current" />
                Donate
              </motion.button>
              {donationError && (
                <p className="text-xs text-destructive text-right">Donation link temporarily unavailable — please try again shortly.</p>
              )}
            </div>
          </motion.div>
        )}

        {/* RAIMZY resources */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="p-4 rounded-2xl border border-secondary/20 bg-secondary/5"
        >
          <p className="text-sm font-semibold mb-1">RAIMZY — Dr. Ephraim Oviawe</p>
          <p className="text-xs text-foreground/60 leading-relaxed mb-3">
            Author, music artist, strategist, and the mind behind RAIMZEAL. Explore his books, music, courses, and coaching — built around leadership, wellness, creativity, and business execution. Created and powered by <span className="font-semibold text-foreground/80">ECONTEUR LLC</span> · <a href="https://www.econteur.com" target="_blank" rel="noopener noreferrer" className="hover:underline">www.econteur.com</a>
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
    </div>
  );
}
