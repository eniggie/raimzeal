import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LoginProps {
  onLogin: (email: string, password: string) => void;
  onBack: () => void;
}

export function Login({ onLogin, onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    onLogin(email, password);
  };

  const handleDemoLogin = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 500));
    onLogin('demo@apex.fit', 'demo123');
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
        <div className="relative w-20 h-20 mb-8">
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-accent rounded-2xl"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <div className="absolute inset-1 bg-background rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-display font-bold text-gradient">A</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold font-display mb-2">Welcome back</h1>
        <p className="text-muted-foreground mb-8">Sign in to continue your journey</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              data-testid="input-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 text-lg"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              data-testid="input-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 text-lg"
              required
            />
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

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleDemoLogin}
          disabled={isLoading}
          data-testid="button-demo"
        >
          Try Demo Mode
        </Button>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Demo mode loads sample data so you can explore all features
        </p>
      </motion.div>
    </div>
  );
}