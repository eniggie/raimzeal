import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

export default function VerifyEmailOTP() {
  const email = new URLSearchParams(window.location.search).get('email') ?? '';
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown > 0]);

  function handleDigit(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
    if (next.every((d) => d !== '') && digit) verify(next.join(''));
  }

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = [...digits];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    if (text.length === 6) verify(text);
    else inputRefs.current[text.length]?.focus();
  }

  async function verify(code?: string) {
    const otp = code ?? digits.join('');
    if (otp.length < 6) { setError('Please enter all 6 digits.'); return; }
    if (!email) { setError('Email address missing. Please restart signup.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/auth/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Invalid code.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setLoading(false);
        return;
      }
      setSuccess(true);
      // Auto sign-in using stored credentials
      const stored = sessionStorage.getItem('pending_auth');
      if (stored) {
        const { email: storedEmail, password } = JSON.parse(stored);
        sessionStorage.removeItem('pending_auth');
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: storedEmail, password });
        if (signInError) {
          // Sign-in failed — redirect to login page
          window.location.href = `${BASE}/`;
          return;
        }
      }
      // Navigate to verify-phone
      window.location.href = `${BASE}/verify-phone`;
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  async function resend() {
    if (!email) return;
    setResending(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/auth/send-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to resend.');
      } else {
        setCooldown(60);
      }
    } catch {
      setError('Network error.');
    } finally {
      setResending(false);
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
          <p className="text-muted-foreground mt-2 text-sm">
            We sent a 6-digit code to{' '}
            <span className="font-medium text-foreground">{email || 'your email'}</span>
          </p>
        </div>

        {/* OTP boxes */}
        <div className="flex gap-2.5 justify-center" onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(r) => { inputRefs.current[i] = r; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigit(e.target.value, i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={cn(
                'w-12 h-14 rounded-xl border-2 text-center text-2xl font-bold transition-colors bg-muted/40',
                'focus:outline-none focus:border-primary',
                d ? 'border-primary text-foreground' : 'border-border text-foreground',
                error && !d && 'border-destructive',
                success && 'border-[#2E8B57] bg-[#2E8B57]/10 text-[#2E8B57]'
              )}
              disabled={loading || success}
            />
          ))}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          size="lg"
          className="w-full h-12"
          onClick={() => verify()}
          disabled={loading || success || digits.join('').length < 6}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : success ? '✓ Verified!' : 'Verify email'}
        </Button>

        <div className="text-sm text-muted-foreground">
          {cooldown > 0 ? (
            <span>Resend available in {cooldown}s</span>
          ) : (
            <button
              type="button"
              disabled={resending}
              onClick={resend}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {resending ? 'Sending…' : "Didn't receive it? Resend"}
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Check your spam folder if you don't see it. The code expires in 10 minutes.
        </p>
      </motion.div>
    </div>
  );
}
