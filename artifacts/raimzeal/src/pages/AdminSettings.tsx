import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Mail, Loader2, ShieldAlert, Check, AlertCircle, Shield,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

/** Shape returned by GET /api/admin/alert-settings */
interface AlertSettings {
  alertEmail: string | null;
  source: 'database' | 'env' | 'unset';
}

/** Error response shape */
interface ApiError {
  error?: string;
}

/**
 * AdminSettings — web page at /settings/admin
 *
 * Lets users with app_metadata.role === "admin" view and update the
 * alert-email recipient via GET/PUT /api/admin/alert-settings.
 * Non-admin users see an access-denied screen.
 */
export function AdminSettings() {
  const { user, session } = useAuth();

  /* ── Admin role check ───────────────────────────────────────────────────── */
  const isAdmin =
    (user?.app_metadata as Record<string, unknown> | undefined)?.role === 'admin';

  /* ── State ──────────────────────────────────────────────────────────────── */
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [currentSource, setCurrentSource] = useState<AlertSettings['source'] | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState('');

  /* ── Load current settings on mount (admin only) ────────────────────────── */
  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;

    setLoading(true);
    setLoadError('');

    fetch('/api/admin/alert-settings', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as ApiError;
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json() as Promise<AlertSettings>;
      })
      .then((data) => {
        setCurrentEmail(data.alertEmail);
        setCurrentSource(data.source);
        setEmailInput(data.alertEmail ?? '');
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load alert settings.',
        );
      })
      .finally(() => setLoading(false));
  }, [isAdmin, session?.access_token]);

  /* ── Save handler ───────────────────────────────────────────────────────── */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !isAdmin) return;

    setSaving(true);
    setSaveStatus('idle');
    setSaveMessage('');

    try {
      const res = await fetch('/api/admin/alert-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ alertEmail: emailInput.trim() }),
      });

      const body = (await res.json()) as AlertSettings & ApiError;

      if (!res.ok) {
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }

      setCurrentEmail(body.alertEmail);
      setCurrentSource(body.source);
      setSaveStatus('success');
      setSaveMessage('Alert email saved successfully.');
    } catch (err: unknown) {
      setSaveStatus('error');
      setSaveMessage(
        err instanceof Error ? err.message : 'Save failed — please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  /* ── Access denied ──────────────────────────────────────────────────────── */
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 gap-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold">Admin Access Required</h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          This page is restricted to users with the admin role. Contact the site
          administrator if you believe you should have access.
        </p>
        <Link href="/settings">
          <Button variant="outline" className="mt-2">
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Settings
          </Button>
        </Link>
      </div>
    );
  }

  /* ── Admin view ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <Link href="/settings">
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
            aria-label="Back to Settings"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Admin Settings</h1>
          <p className="text-xs text-muted-foreground">Site-wide configuration</p>
        </div>
        <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10">
          <Shield className="w-3 h-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">Admin</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4 max-w-lg mx-auto w-full">

        {/* Alert Email card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="p-4 space-y-4">
            {/* Card header */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Alert Email</p>
                <p className="text-xs text-muted-foreground">
                  Recipient for system health-alert emails
                </p>
              </div>
            </div>

            {/* Current value badge */}
            {loading && (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {loadError && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                {loadError}
              </p>
            )}
            {!loading && !loadError && currentEmail !== null && (
              <div className="text-xs bg-muted/40 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Current:</span>
                <span className="font-medium truncate">{currentEmail}</span>
                {currentSource && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary shrink-0">
                    {currentSource}
                  </span>
                )}
              </div>
            )}
            {!loading && !loadError && currentEmail === null && currentSource === 'unset' && (
              <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                No alert email is configured. Falling back to environment defaults.
              </p>
            )}

            {/* Edit form */}
            <form onSubmit={handleSave} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="alert-email">New alert email</Label>
                <Input
                  id="alert-email"
                  type="email"
                  placeholder="alerts@example.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    /* Clear previous feedback when user starts typing again */
                    if (saveStatus !== 'idle') setSaveStatus('idle');
                  }}
                  required
                  disabled={saving || loading}
                  className="h-11"
                />
              </div>

              {/* Inline save feedback */}
              {saveStatus === 'success' && (
                <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 rounded-lg px-3 py-2">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  {saveMessage}
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {saveMessage}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={saving || loading || !emailInput.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save Alert Email'
                )}
              </Button>
            </form>
          </Card>
        </motion.div>

        {/* Explanatory note */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground leading-relaxed">
              The alert email is the address that receives automated system notifications —
              for example, health-check failures or payment webhook errors. It is stored in
              the{' '}
              <code className="font-mono bg-muted px-1 py-0.5 rounded text-[10px]">
                app_config
              </code>{' '}
              table and overrides any environment-variable default while set.{' '}
              <span className="font-medium text-foreground">
                Only users with the admin role can view or change this value.
              </span>
            </p>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
