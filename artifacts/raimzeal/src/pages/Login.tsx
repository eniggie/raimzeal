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

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/>
    </svg>
  );
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

export function Login({ onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('not confirmed')
        ) {
          setError('Please verify your email before signing in. Check your inbox for the confirmation link.');
        } else {
          setError('Incorrect email or password.');
        }
      }
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocial = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${BASE}/auth/callback`,
        },
      });
      if (error) {
        setError(`Could not sign in with ${provider === 'google' ? 'Google' : 'Apple'}. Please try again.`);
        setSocialLoading(null);
      }
      // On success the browser navigates away — no need to clear loading state
    } catch {
      setError(`Could not sign in with ${provider === 'google' ? 'Google' : 'Apple'}. Please try again.`);
      setSocialLoading(null);
    }
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

        {/* Social sign-in */}
        <div className="space-y-3 mb-6">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full gap-3 h-12"
            onClick={() => handleSocial('google')}
            disabled={!!socialLoading || isLoading}
          >
            {socialLoading === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full gap-3 h-12"
            onClick={() => handleSocial('apple')}
            disabled={!!socialLoading || isLoading}
          >
            {socialLoading === 'apple' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <AppleIcon />
            )}
            Continue with Apple
          </Button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or sign in with email</span>
          </div>
        </div>

        {/* Email / password form */}
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
            disabled={isLoading || !email || !password || !!socialLoading}
            data-testid="button-login"
            aria-busy={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Sign In'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{' '}
          <button
            type="button"
            className="text-primary font-medium hover:underline"
            onClick={() => setLocation('/signup')}
          >
            Create one
          </button>
        </p>
      </motion.div>
    </div>
  );
}
