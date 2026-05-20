import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, CreditCard, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface BillingInfo {
  subscription_status: string | null;
  subscription_tier: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1.5 text-emerald-500 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4" /> Active
      </span>
    );
  }
  if (status === 'past_due') {
    return (
      <span className="flex items-center gap-1.5 text-amber-500 text-sm font-medium">
        <AlertCircle className="w-4 h-4" /> Past due
      </span>
    );
  }
  if (status === 'canceled') {
    return (
      <span className="flex items-center gap-1.5 text-destructive text-sm font-medium">
        <XCircle className="w-4 h-4" /> Canceled
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
      <Clock className="w-4 h-4" /> Free plan
    </span>
  );
}

export function Billing() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      navigate('/login');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      setSuccessMsg('Subscription activated! Welcome to RAIMZEAL Premium.');
    }

    fetch('/api/stripe/subscription', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then((data: any) => {
        setInfo({
          subscription_status: data.subscription?.status ?? null,
          subscription_tier: data.tier ?? 'free',
          current_period_end: data.subscription?.current_period_end
            ? new Date(data.subscription.current_period_end * 1000).toISOString()
            : null,
          stripe_customer_id: data.subscription?.customer ?? null,
        });
      })
      .catch(() => setError('Could not load billing information.'))
      .finally(() => setLoading(false));
  }, [session]);

  async function handleManage() {
    if (!session) return;
    setError(null);
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error ?? 'Could not open billing portal.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }

  const tierLabel = (tier: string | null) => {
    if (tier === 'athlete') return 'Athlete';
    if (tier === 'elite') return 'Elite';
    return 'Foundation (Free)';
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-8 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link href="/">
            <button className="p-2 rounded-full hover:bg-muted transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Billing</h1>
            <p className="text-muted-foreground text-sm">Manage your subscription</p>
          </div>
        </div>

        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm"
          >
            {successMsg}
          </motion.div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Billing card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6 mb-4"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Current plan</h2>
          </div>

          {loading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-4 bg-muted rounded w-2/3" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Plan</span>
                <span className="font-medium">{tierLabel(info?.subscription_tier ?? null)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Status</span>
                <StatusBadge status={info?.subscription_status ?? null} />
              </div>
              {info?.current_period_end && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Renews</span>
                  <span className="font-medium text-sm">
                    {new Date(info.current_period_end).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <div className="space-y-3">
          {info?.stripe_customer_id || info?.subscription_status ? (
            <Button
              className="w-full"
              onClick={handleManage}
              disabled={portalLoading}
            >
              {portalLoading ? 'Opening portal…' : 'Manage subscription'}
            </Button>
          ) : null}

          <Button variant="outline" className="w-full" asChild>
            <Link href="/pricing">View all plans</Link>
          </Button>
        </div>

        <p className="text-center text-muted-foreground text-xs mt-6">
          Billing is handled securely by Stripe. RAIMZEAL does not store your card details.
        </p>
      </div>
    </div>
  );
}
