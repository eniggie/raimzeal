import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ExerciseAnimationProps {
  exercise: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const exerciseColors: Record<string, { bg: string; accent: string }> = {
  squats: { bg: 'from-primary/20 to-primary/5', accent: 'bg-primary' },
  'bench press': { bg: 'from-secondary/20 to-secondary/5', accent: 'bg-secondary' },
  deadlifts: { bg: 'from-accent/20 to-accent/5', accent: 'bg-accent' },
  'pull-ups': { bg: 'from-chart-4/20 to-chart-4/5', accent: 'bg-warning' },
  burpees: { bg: 'from-destructive/20 to-destructive/5', accent: 'bg-destructive' },
  lunges: { bg: 'from-primary/20 to-primary/5', accent: 'bg-primary' },
  'mountain climbers': { bg: 'from-secondary/20 to-secondary/5', accent: 'bg-secondary' },
  'shoulder press': { bg: 'from-accent/20 to-accent/5', accent: 'bg-accent' },
  default: { bg: 'from-muted/40 to-muted/10', accent: 'bg-muted-foreground' },
};

const sizeClasses = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
};

export function ExerciseAnimation({ exercise, size = 'md', className }: ExerciseAnimationProps) {
  const normalizedExercise = exercise.toLowerCase();
  const colors = exerciseColors[normalizedExercise] || exerciseColors.default;

  return (
    <div
      className={cn(
        'relative rounded-2xl bg-gradient-to-br flex items-center justify-center overflow-hidden',
        colors.bg,
        sizeClasses[size],
        className
      )}
    >
      <motion.div
        className={cn('w-3 h-3 rounded-full', colors.accent)}
        animate={{
          y: [0, -8, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className={cn('absolute w-8 h-1 rounded-full opacity-30', colors.accent)}
        animate={{
          scaleX: [1, 1.5, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.2,
        }}
        style={{ bottom: '30%' }}
      />
      <motion.div
        className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10"
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}