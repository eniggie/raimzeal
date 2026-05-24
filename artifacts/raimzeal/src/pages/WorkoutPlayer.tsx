import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRoute, useLocation } from 'wouter';
import { 
  Pause, Play, SkipForward, 
  Volume2, VolumeX, X, CheckCircle, Clock, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import { workouts, type WorkoutLog } from '@/lib/store';

interface WorkoutPlayerProps {
  onComplete: (log: WorkoutLog) => void;
}

type Phase = 'warmup' | 'main' | 'cooldown' | 'rest' | 'complete';

interface ExerciseStep {
  name: string;
  phase: 'warmup' | 'main' | 'cooldown';
  duration?: number;
  sets?: number;
  reps?: number;
  rest?: number;
  muscle?: string;
  currentSet?: number;
  isRest?: boolean;
  restDuration?: number;
}

export function WorkoutPlayer({ onComplete }: WorkoutPlayerProps) {
  const [, params] = useRoute('/workout/:id/play');
  const [, navigate] = useLocation();
  const workout = workouts.find(w => w.id === params?.id);

  const [phase, setPhase] = useState<Phase>('warmup');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [startTime] = useState(Date.now());
  const [pendingLog, setPendingLog] = useState<WorkoutLog | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    const active = isRunning && phase !== 'complete';
    if (!('wakeLock' in navigator)) return;
    if (active) {
      navigator.wakeLock.request('screen').then(lock => {
        wakeLockRef.current = lock;
      }).catch(() => {});
    } else {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    }
    return () => {
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [isRunning, phase]);

  const allExercises: ExerciseStep[] = workout ? [
    ...workout.warmup.map(e => ({ 
      name: e.name, 
      duration: e.duration, 
      phase: 'warmup' as const 
    })),
    ...workout.main.flatMap(e => 
      Array.from({ length: e.sets }, (_, setIdx) => ({
        name: e.name,
        phase: 'main' as const,
        sets: e.sets,
        reps: e.reps,
        rest: e.rest,
        muscle: e.muscle,
        currentSet: setIdx + 1,
        isRest: false,
      })).flatMap((set, idx, arr) => 
        idx < arr.length - 1 
          ? [set, { ...set, isRest: true, restDuration: e.rest }]
          : [set]
      )
    ),
    ...workout.cooldown.map(e => ({ 
      name: e.name, 
      duration: e.duration, 
      phase: 'cooldown' as const 
    })),
  ] : [];

  const currentExercise = allExercises[exerciseIndex];
  const totalSteps = allExercises.length;
  const progress = totalSteps > 0 ? ((exerciseIndex + 1) / totalSteps) * 100 : 0;

  const speak = useCallback((text: string) => {
    if (voiceEnabled && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      speechSynthesis.speak(utterance);
    }
  }, [voiceEnabled]);

  const handleNext = useCallback(() => {
    if (exerciseIndex < allExercises.length - 1) {
      const nextExercise = allExercises[exerciseIndex + 1];
      if (!nextExercise.isRest) {
        speak(nextExercise.name);
      } else {
        speak('Rest');
      }
      setExerciseIndex(exerciseIndex + 1);
      setTimer(0);
    } else {
      setPhase('complete');
      setIsRunning(false);
      
      const duration = Math.round((Date.now() - startTime) / 60000);
      const log: WorkoutLog = {
        id: crypto.randomUUID(),
        workoutId: workout!.id,
        workoutName: workout!.name,
        date: new Date().toISOString().split('T')[0],
        duration: Math.max(duration, 1),
        caloriesBurned: workout!.calories,
        exercises: workout!.main.map(e => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
        })),
      };
      setPendingLog(log);
    }
  }, [exerciseIndex, allExercises, speak, startTime, workout, onComplete]);

  useEffect(() => {
    if (!isRunning || phase === 'complete' || !currentExercise) return;

    const interval = setInterval(() => {
      setTimer(prev => {
        if (currentExercise.isRest) {
          const restTime = currentExercise.restDuration || 30;
          if (prev >= restTime) {
            handleNext();
            return 0;
          }
          if (prev === restTime - 3) speak('3');
          if (prev === restTime - 2) speak('2');
          if (prev === restTime - 1) speak('1');
          return prev + 1;
        }
        if (currentExercise.duration) {
          if (prev >= currentExercise.duration) {
            handleNext();
            return 0;
          }
          return prev + 1;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, phase, currentExercise, handleNext, speak]);

  const handlePrev = () => {
    if (exerciseIndex > 0) {
      setExerciseIndex(exerciseIndex - 1);
      setTimer(0);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleExit = () => {
    if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
      navigate(`/workout/${workout?.id}`);
    }
  };

  if (!workout) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Workout not found</p>
      </div>
    );
  }

  if (phase === 'complete') {
    const duration = Math.round((Date.now() - startTime) / 60000);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-primary" />
          </motion.div>
          <h1 className="text-3xl font-bold font-display mb-2">Workout Complete!</h1>
          <p className="text-muted-foreground mb-6">Great job finishing {workout.name}</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <div className="text-2xl font-bold">{Math.max(duration, 1)}</div>
              <div className="text-sm text-muted-foreground">minutes</div>
            </Card>
            <Card className="p-4 text-center">
              <Flame className="w-6 h-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{workout.calories}</div>
              <div className="text-sm text-muted-foreground">calories</div>
            </Card>
          </div>

          {/* RPE Score */}
          <Card className="p-4 mb-6 text-left">
            <p className="text-sm font-semibold mb-1">Rate of Perceived Exertion (RPE)</p>
            <p className="text-xs text-muted-foreground mb-3">How hard did this feel? 1 = very easy · 10 = max effort</p>
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setRpe(n)}
                  className={`rounded-xl py-2 text-sm font-bold transition-all ${
                    rpe === n
                      ? 'bg-primary text-primary-foreground scale-110'
                      : 'bg-muted text-muted-foreground hover:bg-primary/20'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {rpe && (
              <p className="text-xs text-center text-primary font-medium">
                {rpe <= 3 ? '😊 Light effort' : rpe <= 5 ? '💪 Moderate effort' : rpe <= 7 ? '🔥 Hard effort' : '🥵 Maximum effort'}
              </p>
            )}
          </Card>

          <Button
            size="lg"
            className="w-full glow"
            onClick={() => {
              if (pendingLog) {
                onComplete({ ...pendingLog, ...(rpe ? { notes: `RPE: ${rpe}/10` } : {}) });
              }
              navigate('/');
            }}
            data-testid="button-finish"
          >
            {rpe ? `Save & Finish (RPE ${rpe})` : 'Skip & Finish'}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" onClick={handleExit} data-testid="button-exit">
          <X className="w-6 h-6" />
        </Button>
        <div className="text-center">
          <div className="text-sm text-muted-foreground">{workout.name}</div>
          <div className="text-xs text-muted-foreground">
            {exerciseIndex + 1} / {totalSteps}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          data-testid="button-voice"
        >
          {voiceEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      <Progress value={progress} className="h-1 rounded-none" />

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={exerciseIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="text-center w-full max-w-sm"
          >
            {currentExercise?.isRest ? (
              <>
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-secondary/20 flex items-center justify-center">
                  <motion.div
                    className="text-4xl font-bold text-secondary"
                    key={timer}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                  >
                    {(currentExercise.restDuration || 30) - timer}
                  </motion.div>
                </div>
                <h2 className="text-2xl font-bold font-display mb-2">Rest</h2>
                <p className="text-muted-foreground">
                  Next: {allExercises[exerciseIndex + 1]?.name}
                </p>
              </>
            ) : (
              <>
                <ExerciseAnimation
                  exercise={currentExercise?.name || ''}
                  size="lg"
                  className="mx-auto mb-6"
                />
                <h2 className="text-2xl font-bold font-display mb-2" data-testid="text-exercise-name">
                  {currentExercise?.name}
                </h2>
                {currentExercise?.sets && (
                  <p className="text-lg text-muted-foreground mb-4">
                    Set {currentExercise.currentSet} of {currentExercise.sets} · {currentExercise.reps} reps
                  </p>
                )}
                {currentExercise?.duration && (
                  <div className="text-4xl font-bold text-primary mb-4">
                    {currentExercise.duration - timer}s
                  </div>
                )}
                <div className="text-6xl font-bold font-display text-primary mb-4">
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-4 pb-8 flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full"
          onClick={handlePrev}
          disabled={exerciseIndex === 0}
          data-testid="button-prev"
        >
          <SkipForward className="w-6 h-6 rotate-180" />
        </Button>

        <Button
          size="icon"
          className="w-20 h-20 rounded-full glow"
          onClick={() => setIsRunning(!isRunning)}
          data-testid="button-play-pause"
        >
          {isRunning ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="w-14 h-14 rounded-full"
          onClick={handleSkip}
          data-testid="button-skip"
        >
          <SkipForward className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
}