import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Flame, Dumbbell, Wind, Sparkles, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface OnboardingProps {
  onLogin: () => void;
}

const goals = [
  { id: 'fat_loss', label: 'Fat Loss', icon: Flame, color: 'text-destructive' },
  { id: 'muscle_gain', label: 'Muscle Gain', icon: Dumbbell, color: 'text-primary' },
  { id: 'endurance', label: 'Endurance', icon: Wind, color: 'text-secondary' },
  { id: 'flexibility', label: 'Flexibility', icon: Sparkles, color: 'text-accent' },
];

function validatePassword(pw: string): string {
  if (pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one number.';
  return '';
}

export function Onboarding({ onLogin }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpDone, setSignUpDone] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    fitnessLevel: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    goals: [] as string[],
    email: '',
    password: '',
  });

  const steps = [
    { title: 'Welcome', subtitle: 'Free fitness, food therapy & health awareness — powered by AI.' },
    { title: 'About You', subtitle: 'Tell us a bit about yourself' },
    { title: 'Your Stats', subtitle: 'Help us personalise your experience' },
    { title: 'Fitness Level', subtitle: 'Where are you in your journey?' },
    { title: 'Your Goals', subtitle: 'What do you want to achieve?' },
    { title: 'Create Account', subtitle: 'Almost there!' },
  ];

  const passwordError = step === 5 ? validatePassword(formData.password) : '';

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return formData.name.length >= 2 && formData.age;
      case 2: return formData.height && formData.weight;
      case 3: return !!formData.fitnessLevel;
      case 4: return formData.goals.length > 0;
      case 5: return !!formData.email && !validatePassword(formData.password);
      default: return false;
    }
  };

  const handleNext = async () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }

    // Step 5 — create real Supabase account
    setError('');
    setIsLoading(true);

    const redirectTo = `${window.location.origin}/auth/callback`;

    try {
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            name: formData.name,
            age: parseInt(formData.age),
            height: parseInt(formData.height),
            weight: parseInt(formData.weight),
            fitnessLevel: formData.fitnessLevel,
            goals: formData.goals,
          },
        },
      });
      if (error) {
        if (error.message.toLowerCase().includes('already registered') ||
            error.message.toLowerCase().includes('already been registered') ||
            error.message.toLowerCase().includes('user already exists')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(error.message);
        }
        return;
      }
      setSignUpDone(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGoal = (goalId: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goalId)
        ? prev.goals.filter(g => g !== goalId)
        : [...prev.goals, goalId],
    }));
  };

  if (signUpDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full text-center space-y-6"
        >
          <CheckCircle className="w-20 h-20 text-primary mx-auto" />
          <h1 className="text-2xl font-bold font-display">Check your inbox!</h1>
          <p className="text-muted-foreground">
            We sent a verification link to{' '}
            <span className="text-foreground font-medium">{formData.email}</span>.
            Click it to activate your RAIMZEAL account.
          </p>
          <div className="bg-muted/40 rounded-xl p-4 text-sm text-muted-foreground text-left space-y-1">
            <p>• Check your spam or junk folder</p>
            <p>• The link expires in 24 hours</p>
            <p>• Once verified, come back and sign in</p>
          </div>
          <Button variant="outline" className="w-full" onClick={onLogin}>
            Back to Sign In
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        <div className="flex items-center gap-2 mb-8">
          {steps.map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                'h-1 rounded-full flex-1 transition-colors',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i <= step ? 1 : 0.5 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col"
          >
            <h1 className="text-3xl font-bold font-display mb-2">{steps[step].title}</h1>
            <p className="text-muted-foreground mb-8">{steps[step].subtitle}</p>

            <div className="flex-1">
              {step === 0 && (
                <div className="space-y-5">
                  <div className="w-28 h-28 mx-auto rounded-3xl overflow-hidden">
                    <img src="/favicon.png" alt="RAIMZEAL" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-center space-y-2">
                    <h2 className="text-xl font-semibold">Welcome to RAIMZEAL</h2>
                    <p className="text-muted-foreground text-sm">
                      Fitness · Food Therapy · Health Awareness — free, forever.
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={onLogin}
                    data-testid="button-login"
                  >
                    Already have an account? Sign in
                  </Button>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">What's your name?</Label>
                    <Input
                      id="name"
                      data-testid="input-name"
                      placeholder="Enter your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">How old are you?</Label>
                    <Input
                      id="age"
                      data-testid="input-age"
                      type="number"
                      placeholder="Age"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (inches)</Label>
                    <Input
                      id="height"
                      data-testid="input-height"
                      type="number"
                      placeholder="e.g., 70"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (lbs)</Label>
                    <Input
                      id="weight"
                      data-testid="input-weight"
                      type="number"
                      placeholder="e.g., 175"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <RadioGroup
                  value={formData.fitnessLevel}
                  onValueChange={(v) => setFormData({ ...formData, fitnessLevel: v as 'beginner' | 'intermediate' | 'advanced' })}
                  className="space-y-3"
                >
                  {[
                    { value: 'beginner', label: 'Beginner', desc: 'New to fitness or returning after a break' },
                    { value: 'intermediate', label: 'Intermediate', desc: 'Training consistently for 6+ months' },
                    { value: 'advanced', label: 'Advanced', desc: 'Training for 2+ years with solid technique' },
                  ].map((level) => (
                    <Label
                      key={level.value}
                      htmlFor={level.value}
                      className={cn(
                        'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                        formData.fitnessLevel === level.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <RadioGroupItem value={level.value} id={level.value} className="mt-1" data-testid={`radio-${level.value}`} />
                      <div>
                        <div className="font-medium">{level.label}</div>
                        <div className="text-sm text-muted-foreground">{level.desc}</div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              )}

              {step === 4 && (
                <div className="grid grid-cols-2 gap-3">
                  {goals.map((goal) => (
                    <motion.button
                      key={goal.id}
                      data-testid={`goal-${goal.id}`}
                      onClick={() => toggleGoal(goal.id)}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        formData.goals.includes(goal.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      )}
                      whileTap={{ scale: 0.98 }}
                    >
                      <goal.icon className={cn('w-8 h-8 mb-2', goal.color)} />
                      <div className="font-medium">{goal.label}</div>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 5 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => { setFormData({ ...formData, email: e.target.value }); setError(''); }}
                      className="h-12 text-lg"
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
                        placeholder="Min. 8 chars, 1 uppercase, 1 number"
                        value={formData.password}
                        onChange={(e) => { setFormData({ ...formData, password: e.target.value }); setError(''); }}
                        className="h-12 text-lg pr-12"
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
                    {formData.password && passwordError && (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    )}
                  </div>

                  {error && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <p className="text-xs text-muted-foreground">
                    By creating an account you agree to our{' '}
                    <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setStep(step - 1)}
              disabled={isLoading}
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 glow-sm"
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
            data-testid="button-next"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {step === steps.length - 1 ? 'Create Account' : 'Continue'}
                {step < steps.length - 1 && <ChevronRight className="w-5 h-5 ml-2" />}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
