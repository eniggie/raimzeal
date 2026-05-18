import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { ChevronLeft, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExerciseAnimation } from '@/components/ExerciseAnimation';
import { exercises } from '@/lib/store';

const difficultyColors: Record<string, string> = {
  beginner: 'bg-success/20 text-success',
  intermediate: 'bg-warning/20 text-warning',
  advanced: 'bg-destructive/20 text-destructive',
};

export function Exercises() {
  const [search, setSearch] = useState('');

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="px-4 py-4 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <Link href="/workouts">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ChevronLeft className="w-6 h-6" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold font-display">Exercise Library</h1>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setSearch('')}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {filteredExercises.map((exercise, i) => (
          <motion.div
            key={exercise.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Link href={`/exercise/${encodeURIComponent(exercise.name.toLowerCase())}`}>
              <Card
                className="p-4 cursor-pointer hover:border-primary/30 transition-colors"
                data-testid={`card-exercise-${exercise.id}`}
              >
                <div className="flex items-start gap-4">
                  <ExerciseAnimation exercise={exercise.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{exercise.name}</h3>
                      <Badge className={difficultyColors[exercise.difficulty]}>
                        {exercise.difficulty}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{exercise.muscle}</p>
                    <p className="text-xs text-muted-foreground">{exercise.equipment}</p>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}

        {filteredExercises.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No exercises found</p>
          </div>
        )}
      </div>
    </div>
  );
}