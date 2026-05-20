import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Flame, Dumbbell, Wind, Sparkles, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

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
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [socialError, setSocialError] = useState('');
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
    { title: 'Welcome', subtitle: 'Your fitness journey starts here' },
    { title: 'About You', subtitle: 'Tell us a bit about yourself' },
    { title: 'Your Stats', subtitle: 'Help us personalise your experience' },
    { title: 'Fitness Level', subtitle: 'Where are you in your journey?' },
    { title: 'Your Goals', subtitle: 'What do you want to achieve?' },
    { title: 'Create Account', subtitle: 'Almost there!' },
  ];

  const handleSocial = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    setSocialError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setSocialError(`Could not sign in with ${provider === 'google' ? 'Google' : 'Apple'}. Please try again.`);
      setSocialLoading(null);
    }
  };

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

    setIsLoading(false);

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
                      Your premium AI-powered fitness companion.
                    </p>
                  </div>

                  {/* Social sign-up */}
                  <div className="space-y-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full gap-3 h-12"
                      onClick={() => handleSocial('google')}
                      disabled={!!socialLoading}
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
                      disabled={!!socialLoading}
                    >
                      {socialLoading === 'apple' ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <AppleIcon />
                      )}
                      Continue with Apple
                    </Button>
                  </div>

                  {socialError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center">
                      {socialError}
                    </p>
                  )}

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-3 text-muted-foreground">or create account with email</span>
                    </div>
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
