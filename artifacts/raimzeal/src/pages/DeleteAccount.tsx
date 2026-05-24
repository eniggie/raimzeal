import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const CONFIRM_PHRASE = 'delete my account';

export function DeleteAccount() {
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const [, navigate] = useLocation();
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const canConfirm = confirm.toLowerCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    if (!canConfirm) return;
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'Not signed in', variant: 'destructive' }); return; }
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      setDone(true);
      toast({ title: 'Account deletion scheduled' });
      setTimeout(() => {
        signOut();
        navigate('/');
      }, 3000);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not delete account', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-sm">
          <div className="text-4xl mb-4">🗑️</div>
          <h2 className="text-xl font-bold mb-2">Account deletion scheduled</h2>
          <p className="text-muted-foreground text-sm">Your data will be permanently removed within 30 days. Signing you out now…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-destructive">Delete Account</h1>
            <p className="text-sm text-muted-foreground">This action cannot be undone</p>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 mb-4 border-destructive/30 bg-destructive/5">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm text-destructive mb-1">What will be deleted</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Your profile and all personal data</li>
                  <li>All community posts and comments</li>
                  <li>Sleep logs and personal records</li>
                  <li>All workout and nutrition history</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-2">
                  Data is permanently purged within <span className="font-semibold text-foreground">30 days</span> of this request.
                  Export your data first if you want a copy.
                </p>
              </div>
            </div>
          </Card>

          {user && (
            <Card className="p-4 mb-4 bg-muted/10">
              <p className="text-xs text-muted-foreground mb-1">Signed in as</p>
              <p className="text-sm font-medium">{user.email}</p>
            </Card>
          )}

          <Card className="p-4">
            <p className="text-sm mb-3">
              Type <span className="font-mono font-bold text-destructive">{CONFIRM_PHRASE}</span> to confirm:
            </p>
            <Input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              className="mb-4 border-destructive/30 focus:border-destructive"
            />
            <Button
              variant="destructive"
              className="w-full"
              disabled={!canConfirm || deleting}
              onClick={handleDelete}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Permanently Delete Account
            </Button>
          </Card>

          <p className="text-xs text-center text-muted-foreground mt-4">
            Changed your mind?{' '}
            <Link href="/settings" className="text-primary hover:underline">Go back to settings</Link>
          </p>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
