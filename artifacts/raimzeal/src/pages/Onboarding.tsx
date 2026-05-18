import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Flame, Dumbbell, Wind, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/lib/store';

interface OnboardingProps {
  onComplete: (user: UserProfile) => void;
  onLogin: () => void;
}

const goals = [
  { id: 'fat_loss', label: 'Fat Loss', icon: Flame, color: 'text-destructive' },
  { id: 'muscle_gain', label: 'Muscle Gain', icon: Dumbbell, color: 'text-primary' },
  { id: 'endurance', label: 'Endurance', icon: Wind, color: 'text-secondary' },
  { id: 'flexibility', label: 'Flexibility', icon: Sparkles, color: 'text-accent' },
];

export function Onboarding({ onComplete, onLogin }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    height: '',
    weight: '',
    fitnessLevel: 'beginner' as const,
    goals: [] as string[],
    email: '',
    password: '',
  });

  const steps = [
    { title: 'Welcome', subtitle: 'Your fitness journey starts here' },
    { title: 'About You', subtitle: 'Tell us a bit about yourself' },
    { title: 'Your Stats', subtitle: 'Help us personalize your experience' },
    { title: 'Fitness Level', subtitle: 'Where are you in your journey?' },
    { title: 'Your Goals', subtitle: 'What do you want to achieve?' },
    { title: 'Create Account', subtitle: 'Almost there!' },
  ];

  const canProceed = () => {
    switch (step) {
      case 0: return true;
      case 1: return formData.name.length >= 2 && formData.age;
      case 2: return formData.height && formData.weight;
      case 3: return formData.fitnessLevel;
      case 4: return formData.goals.length > 0;
      case 5: return formData.email && formData.password.length >= 6;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      const user: UserProfile = {
        id: crypto.randomUUID(),
        name: formData.name,
        email: formData.email,
        age: parseInt(formData.age),
        height: parseInt(formData.height),
        weight: parseInt(formData.weight),
        fitnessLevel: formData.fitnessLevel,
        goals: formData.goals,
        units: 'imperial',
        createdAt: new Date().toISOString(),
      };
      onComplete(user);
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
                <div className="space-y-6">
                  <div className="w-32 h-32 mx-auto mb-8 rounded-3xl overflow-hidden">
                    <img src="/favicon.png" alt="RAIMZEAL" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-center space-y-4">
                    <h2 className="text-xl font-semibold">Welcome to RAIMZEAL</h2>
                    <p className="text-muted-foreground">
                      Your premium AI-powered fitness companion. Track workouts, nutrition, and achieve your goals.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full mt-8"
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
                  onValueChange={(v) => setFormData({ ...formData, fitnessLevel: v as any })}
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
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      data-testid="input-email"
                      type="email"
                      placeholder="you@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      data-testid="input-password"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="h-12 text-lg"
                    />
                  </div>
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
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <Button
            size="lg"
            className="flex-1 glow-sm"
            onClick={handleNext}
            disabled={!canProceed()}
            data-testid="button-next"
          >
            {step === steps.length - 1 ? 'Create Account' : 'Continue'}
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}