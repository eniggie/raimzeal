import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

interface Props {
  onVerified?: () => void;
}

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export default function VerifyPhone({ onVerified }: Props) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Send SMS code on mount
  useEffect(() => {
    sendCode();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [cooldown > 0]);

  async function sendCode() {
    setSending(true);
    setError('');
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/auth/send-sms-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to send code. You can skip this step for now.');
      } else {
        setCooldown(60);
      }
    } catch {
      setError('Network error. You can skip this step for now.');
    } finally {
      setSending(false);
    }
  }

  function handleDigit(value: string, index: number) {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError('');
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== '') && digit) {
      verify(next.join(''));
    }
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
    const token = await getToken();
    if (!token) { setError('Session expired. Please sign in again.'); return; }
    const otp = code ?? digits.join('');
    if (otp.length < 6) { setError('Please enter all 6 digits.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/auth/verify-sms-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Invalid code.');
        setDigits(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setSuccess(true);
        setTimeout(() => onVerified?.(), 800);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center space-y-6"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto">
          <Smartphone className="w-9 h-9 text-[#C9A84C]" />
        </div>

        <div>
          <h1 className="text-2xl font-bold font-display">Verify your phone</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            We sent a 6-digit code to your phone number. Enter it below.
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

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <Button
          size="lg"
          className="w-full h-12"
          onClick={() => verify()}
          disabled={loading || sending || success || digits.join('').length < 6}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : success ? '✓ Verified!' : 'Verify phone'}
        </Button>

        <div className="text-sm text-muted-foreground">
          {cooldown > 0 ? (
            <span>Resend available in {cooldown}s</span>
          ) : (
            <button
              type="button"
              disabled={sending}
              onClick={sendCode}
              className="text-primary font-medium hover:underline disabled:opacity-50"
            >
              {sending ? 'Sending…' : "Didn't receive it? Resend"}
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Phone verification helps secure your account. Standard SMS rates may apply.
        </p>

        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
          onClick={() => onVerified?.()}
        >
          Skip for now
        </button>
      </motion.div>
    </div>
  );
}
