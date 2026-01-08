import { motion } from 'framer-motion';
import { useRoute, Link } from 'wouter';
import { ChevronLeft, Target, Wrench, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import { exercises } from '@/lib/store';

const difficultyColors: Record<string, string> = {
  beginner: 'bg-success/20 text-success',
  intermediate: 'bg-warning/20 text-warning',
  advanced: 'bg-destructive/20 text-destructive',
};

export function ExerciseDetail() {
  const [, params] = useRoute('/exercise/:name');
  const exerciseName = decodeURIComponent(params?.name || '');
  const exercise = exercises.find(e => e.name.toLowerCase() === exerciseName);

  if (!exercise) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Exercise not found</p>
          <Link href="/exercises">
            <Button variant="outline" className="mt-4">Back to Exercises</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="px-4 py-4 max-w-lg mx-auto">
        <Link href="/exercises">
          <Button variant="ghost" size="icon" className="mb-4" data-testid="button-back">
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex items-start gap-4">
            <ExerciseAnimation exercise={exercise.name} size="lg" />
            <div className="flex-1">
              <Badge className={difficultyColors[exercise.difficulty]} data-testid="badge-difficulty">
                {exercise.difficulty}
              </Badge>
              <h1 className="text-2xl font-bold font-display mt-2" data-testid="text-exercise-name">
                {exercise.name}
              </h1>
            </div>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="font-semibold">Primary Muscles</h2>
            </div>
            <p className="text-muted-foreground" data-testid="text-muscles">{exercise.muscle}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Wrench className="w-5 h-5 text-secondary" />
              <h2 className="font-semibold">Equipment</h2>
            </div>
            <p className="text-muted-foreground" data-testid="text-equipment">{exercise.equipment}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-5 h-5 text-success" />
              <h2 className="font-semibold">Form Tips</h2>
            </div>
            <ul className="space-y-3">
              {exercise.tips.map((tip, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3"
                  data-testid={`tip-${i}`}
                >
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-medium text-primary">{i + 1}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tip}</p>
                </motion.li>
              ))}
            </ul>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}