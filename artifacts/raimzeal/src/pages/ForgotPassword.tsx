import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  const redirectTo = `${window.location.origin}${BASE}/auth/callback`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        console.error('[RAIMZEAL] resetPasswordForEmail error:', error.status, error.message);
        const msg = error.message ?? '';
        if (error.status === 429 || msg.toLowerCase().includes('rate limit')) {
          setError('Too many requests — please wait a few minutes and try again.');
        } else if (msg.toLowerCase().includes('email') && msg.toLowerCase().includes('send')) {
          setError('Email delivery is temporarily unavailable. Please try again shortly.');
        } else if (msg.toLowerCase().includes('redirect')) {
          setError('Configuration error. Please contact support.');
        } else {
          setError(msg || 'Something went wrong. Please try again.');
        }
      } else {
        setSent(true);
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setLocation('/')}
        className="self-start mb-4"
      >
        <ChevronLeft className="w-6 h-6" />
      </Button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 max-w-md mx-auto w-full"
      >
        <div className="w-20 h-20 mb-8 rounded-2xl overflow-hidden">
          <img src="/favicon.png" alt="RAIMZEAL" className="w-full h-full object-cover" />
        </div>

        {sent ? (
          <div className="text-center space-y-4 pt-8">
            <CheckCircle className="w-16 h-16 text-primary mx-auto" />
            <h1 className="text-2xl font-bold font-display">Check your inbox</h1>
            <p className="text-muted-foreground">
              We sent a password reset link to <span className="text-foreground font-medium">{email}</span>.
              The link expires in 1 hour.
            </p>
            <p className="text-sm text-muted-foreground mt-4">
              Didn't receive it? Check your spam folder or{' '}
              <button className="text-primary hover:underline" onClick={() => setSent(false)}>
                try again
              </button>.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold font-display mb-2">Reset password</h1>
            <p className="text-muted-foreground mb-8">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="h-12 text-lg"
                  required
                  autoComplete="email"
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
                disabled={isLoading || !email}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send reset link'}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
