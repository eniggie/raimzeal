import { motion } from 'framer-motion';
import { useRoute, Link } from 'wouter';
import { ChevronLeft, Clock, Flame, Play, Dumbbell, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import { workouts } from '@/lib/store';

export function WorkoutDetail() {
  const [, params] = useRoute('/workout/:id');
  const workout = workouts.find(w => w.id === params?.id);

  if (!workout) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Workout not found</p>
          <Link href="/workouts">
            <Button variant="outline" className="mt-4">Back to Workouts</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalExercises = workout.main.length;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="relative h-48 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/10">
        <Link href="/workouts">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 bg-background/50 backdrop-blur"
            data-testid="button-back"
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        </Link>
        <div className="absolute bottom-4 left-4 right-4">
          <Badge className="mb-2 capitalize">{workout.category}</Badge>
          <h1 className="text-2xl font-bold font-display" data-testid="text-workout-name">{workout.name}</h1>
          <p className="text-muted-foreground text-sm mt-1">{workout.description}</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4"
        >
          <Card className="flex-1 p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="font-bold">{workout.duration}</div>
            <div className="text-xs text-muted-foreground">minutes</div>
          </Card>
          <Card className="flex-1 p-4 text-center">
            <Flame className="w-5 h-5 mx-auto mb-1 text-primary" />
            <div className="font-bold">{workout.calories}</div>
            <div className="text-xs text-muted-foreground">calories</div>
          </Card>
          <Card className="flex-1 p-4 text-center">
            <Dumbbell className="w-5 h-5 mx-auto mb-1 text-secondary" />
            <div className="font-bold">{totalExercises}</div>
            <div className="text-xs text-muted-foreground">exercises</div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="font-semibold mb-2">Equipment Needed</h2>
          <div className="flex flex-wrap gap-2">
            {workout.equipment.map((eq) => (
              <Badge key={eq} variant="outline" className="capitalize">
                {eq === 'none' ? 'No equipment' : eq}
              </Badge>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="main" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="warmup" className="flex-1">Warmup</TabsTrigger>
              <TabsTrigger value="main" className="flex-1">Main</TabsTrigger>
              <TabsTrigger value="cooldown" className="flex-1">Cooldown</TabsTrigger>
            </TabsList>

            <TabsContent value="warmup" className="space-y-2 mt-4">
              {workout.warmup.map((ex, i) => (
                <Card key={i} className="p-3" data-testid={`card-warmup-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {ex.duration} seconds
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="main" className="space-y-2 mt-4">
              {workout.main.map((ex, i) => (
                <Card key={i} className="p-3" data-testid={`card-exercise-${i}`}>
                  <div className="flex items-center gap-3">
                    <ExerciseAnimation exercise={ex.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {ex.sets} sets × {ex.reps} reps · {ex.rest}s rest
                      </div>
                      <Badge variant="outline" className="mt-1 text-xs capitalize">
                        {ex.muscle}
                      </Badge>
                    </div>
                    <Link href={`/exercise/${encodeURIComponent(ex.name.toLowerCase())}`}>
                      <Button variant="ghost" size="icon">
                        <Info className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="cooldown" className="space-y-2 mt-4">
              {workout.cooldown.map((ex, i) => (
                <Card key={i} className="p-3" data-testid={`card-cooldown-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{ex.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {ex.duration} seconds
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 p-4 glass-strong safe-area-inset-bottom"
        >
          <Link href={`/workout/${workout.id}/play`}>
            <Button size="lg" className="w-full max-w-lg mx-auto block glow" data-testid="button-start-workout">
              <Play className="w-5 h-5 mr-2" />
              Start Workout
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}