import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Flame, Dumbbell, Wind, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/store';

interface OAuthSetupProps {
  user: User;
  onComplete: (profile: UserProfile) => void;
}

const goals = [
  { id: 'fat_loss', label: 'Fat Loss', icon: Flame, color: 'text-destructive' },
  { id: 'muscle_gain', label: 'Muscle Gain', icon: Dumbbell, color: 'text-primary' },
  { id: 'endurance', label: 'Endurance', icon: Wind, color: 'text-secondary' },
  { id: 'flexibility', label: 'Flexibility', icon: Sparkles, color: 'text-accent' },
];

const fitnessLevels = [
  { value: 'beginner', label: 'Beginner', desc: 'New to fitness or returning after a break' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Training consistently for 6+ months' },
  { value: 'advanced', label: 'Advanced', desc: 'Training for 2+ years with solid technique' },
] as const;

export function OAuthSetup({ user, onComplete }: OAuthSetupProps) {
  const meta = user.user_metadata ?? {};
  const displayName = (meta.full_name ?? meta.name ?? user.email ?? 'there') as string;
  const firstName = displayName.split(' ')[0];
  const avatar = (meta.avatar_url ?? meta.picture ?? '') as string;

  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [fitnessLevel, setFitnessLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const toggleGoal = (id: string) =>
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );

  const handleFinish = async () => {
    setIsLoading(true);
    const profile: UserProfile = {
      id: user.id,
      name: displayName,
      email: user.email ?? '',
      age: parseInt(age) || 25,
      height: parseInt(height) || 68,
      weight: parseInt(weight) || 160,
      fitnessLevel,
      goals: selectedGoals,
      units: 'imperial',
      createdAt: user.created_at,
    };
    onComplete(profile);
  };

  const steps = ['Your Goals', 'Fitness Level', 'Quick Stats'];

  return (
    <div className="min-h-screen bg-background flex flex-col px-6 py-8">
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 rounded-full flex-1 transition-colors duration-300',
                i <= step ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        {/* Avatar + greeting */}
        <div className="flex items-center gap-3 mb-8">
          {avatar ? (
            <img
              src={avatar}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary/30"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-lg font-bold text-primary">
              {firstName[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold">{displayName}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1 flex flex-col"
          >
            {step === 0 && (
              <>
                <h1 className="text-3xl font-bold font-display mb-2">
                  Welcome, {firstName}!
                </h1>
                <p className="text-muted-foreground mb-8">
                  Just two quick questions and you are in. What are your fitness goals?
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {goals.map((goal) => (
                    <motion.button
                      key={goal.id}
                      onClick={() => toggleGoal(goal.id)}
                      className={cn(
                        'p-4 rounded-xl border-2 text-left transition-all',
                        selectedGoals.includes(goal.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      )}
                      whileTap={{ scale: 0.97 }}
                    >
                      <goal.icon className={cn('w-8 h-8 mb-2', goal.color)} />
                      <div className="font-medium text-sm">{goal.label}</div>
                    </motion.button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <h1 className="text-3xl font-bold font-display mb-2">Fitness Level</h1>
                <p className="text-muted-foreground mb-8">Where are you in your journey?</p>
                <div className="space-y-3">
                  {fitnessLevels.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setFitnessLevel(level.value)}
                      className={cn(
                        'w-full flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                        fitnessLevel === level.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground'
                      )}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors',
                          fitnessLevel === level.value
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground'
                        )}
                      />
                      <div>
                        <div className="font-medium">{level.label}</div>
                        <div className="text-sm text-muted-foreground">{level.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1 className="text-3xl font-bold font-display mb-2">Quick Stats</h1>
                <p className="text-muted-foreground mb-8">
                  Optional — helps Ovia AI give you more accurate targets. You can update these anytime in Settings.
                </p>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="e.g., 28"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height (inches)</Label>
                    <Input
                      id="height"
                      type="number"
                      placeholder="e.g., 70"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight (lbs)</Label>
                    <Input
                      id="weight"
                      type="number"
                      placeholder="e.g., 175"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="h-12 text-lg"
                    />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 space-y-3">
          <Button
            size="lg"
            className="w-full glow-sm"
            disabled={
              (step === 0 && selectedGoals.length === 0) ||
              isLoading
            }
            onClick={() => {
              if (step < steps.length - 1) setStep(step + 1);
              else handleFinish();
            }}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : step < steps.length - 1 ? (
              <>
                Continue
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            ) : (
              "Let's go!"
            )}
          </Button>
          {step === 2 && (
            <Button
              variant="ghost"
              size="lg"
              className="w-full text-muted-foreground"
              onClick={handleFinish}
              disabled={isLoading}
            >
              Skip for now
            </Button>
          )}
          {step > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setStep(step - 1)}
              disabled={isLoading}
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
