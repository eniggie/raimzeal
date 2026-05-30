import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

export default function VerifyEmailOTP() {
  const email = new URLSearchParams(window.location.search).get('email') ?? '';
  const { resendConfirmation } = useAuth();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  async function handleResend() {
    if (!email || cooldown > 0) return;
    setResending(true);
    setError('');
    const { error: resendError } = await resendConfirmation(email);
    setResending(false);
    if (resendError) {
      if (resendError.toLowerCase().includes('rate limit') || resendError.toLowerCase().includes('too many')) {
        setError('Too many requests — please wait a minute before trying again.');
      } else {
        setError(resendError);
      }
    } else {
      setResent(true);
      setCooldown(60);
      const interval = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(interval); return 0; }
          return c - 1;
        });
      }, 1000);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        {/* Logo */}
        <img src={`${BASE}/favicon.png`} alt="RAIMZEAL" className="w-14 h-14 rounded-2xl mx-auto" />

        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="w-9 h-9 text-primary" />
        </div>

        <div>
          <h1 className="text-2xl font-bold font-display">Check your email</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
            We sent a confirmation link to{' '}
            <span className="font-medium text-foreground">{email || 'your email'}</span>.
            {' '}Click it to activate your account.
          </p>
        </div>

        {/* Instructions card */}
        <div className="bg-muted/40 rounded-xl p-4 text-sm text-muted-foreground text-left space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary shrink-0" />
            <span>Check your spam or junk folder</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary shrink-0" />
            <span>The link expires in 24 hours</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary shrink-0" />
            <span>After clicking, come back and sign in</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Resend button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={resending || cooldown > 0}
        >
          {resending ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Sending…</>
          ) : resent && cooldown > 0 ? (
            `Email sent ✓ — resend in ${cooldown}s`
          ) : (
            'Resend confirmation email'
          )}
        </Button>

        <Button
          size="lg"
          className="w-full"
          onClick={() => { window.location.href = `${BASE}/`; }}
        >
          Go to Sign In
        </Button>

        <p className="text-xs text-muted-foreground">
          Wrong email?{' '}
          <a href={`${BASE}/signup`} className="text-primary hover:underline font-medium">
            Sign up again
          </a>
        </p>
      </motion.div>
    </div>
  );
}
