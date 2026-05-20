import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

interface LoginProps {
  onBack: () => void;
}

export function Login({ onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setIsLoading(false);

    if (error) {
      if (
        error.message.toLowerCase().includes('email not confirmed') ||
        error.message.toLowerCase().includes('not confirmed')
      ) {
        setError('Please verify your email before signing in. Check your inbox for the confirmation link.');
      } else if (
        error.message.toLowerCase().includes('invalid login') ||
        error.message.toLowerCase().includes('invalid credentials') ||
        error.message.toLowerCase().includes('wrong password') ||
        error.message.toLowerCase().includes('user not found') ||
        error.message.toLowerCase().includes('no user found')
      ) {
        setError('Incorrect email or password.');
      } else {
        setError('Incorrect email or password.');
      }
    }
    // On success, onAuthStateChange in AuthContext fires and re-renders the app
  };

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="self-start mb-4"
        data-testid="button-back"
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

        <h1 className="text-3xl font-bold font-display mb-2">Welcome back</h1>
        <p className="text-muted-foreground mb-8">Sign in to continue your journey</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="input-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="h-12 text-lg"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                data-testid="input-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                className="h-12 text-lg pr-12"
                required
                autoComplete="current-password"
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

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="text-right">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => setLocation('/forgot-password')}
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full glow-sm"
            disabled={isLoading || !email || !password}
            data-testid="button-login"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
