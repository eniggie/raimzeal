import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

function validatePassword(pw: string): string {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
  return '';
}

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Supabase puts the recovery token in the URL hash.
    // onAuthStateChange fires with event=PASSWORD_RECOVERY when the token is processed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validatePassword(password);
    if (validationError) { setError(validationError); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError('Failed to reset password. The link may have expired — request a new one.');
      } else {
        setDone(true);
        setTimeout(() => setLocation('/'), 3000);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Verifying reset link…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 max-w-md mx-auto w-full pt-12"
      >
        <div className="w-20 h-20 mb-8 rounded-2xl overflow-hidden">
          <img src="/favicon.png" alt="RAIMZEAL" className="w-full h-full object-cover" />
        </div>

        {done ? (
          <div className="text-center space-y-4 pt-8">
            <CheckCircle className="w-16 h-16 text-primary mx-auto" />
            <h1 className="text-2xl font-bold font-display">Password updated</h1>
            <p className="text-muted-foreground">Redirecting you to the app…</p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold font-display mb-2">New password</h1>
            <p className="text-muted-foreground mb-8">
              Choose a strong password for your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    className="h-12 text-lg pr-12"
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(v => !v)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <Input
                  id="confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(''); }}
                  className="h-12 text-lg"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full glow-sm"
                disabled={isLoading || !password || !confirm}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update password'}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
