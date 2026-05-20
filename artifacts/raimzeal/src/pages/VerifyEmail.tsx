import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface VerifyEmailProps {
  email: string | undefined;
  onSignOut: () => Promise<void>;
}

export function VerifyEmail({ email, onSignOut }: VerifyEmailProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    await supabase.auth.resend({ type: 'signup', email });
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm w-full text-center space-y-6"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="w-10 h-10 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold font-display">Check your email</h1>
          <p className="text-muted-foreground">
            We sent a verification link to{' '}
            <span className="text-foreground font-medium">{email}</span>.
            Click it to activate your account.
          </p>
        </div>

        <div className="bg-muted/40 rounded-xl p-4 text-sm text-muted-foreground text-left space-y-1">
          <p>• Check your spam or junk folder</p>
          <p>• The link expires in 24 hours</p>
          <p>• Once verified, come back and sign in</p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={resending || resent}
        >
          {resending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : resent ? (
            'Email sent ✓'
          ) : (
            'Resend verification email'
          )}
        </Button>

        <button
          className="text-sm text-muted-foreground hover:text-foreground underline"
          onClick={onSignOut}
        >
          Use a different account
        </button>
      </motion.div>
    </div>
  );
}
