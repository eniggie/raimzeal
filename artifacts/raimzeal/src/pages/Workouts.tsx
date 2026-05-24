import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { Search, Clock, Flame, Filter, Dumbbell, Zap, Heart, Wind, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { workouts } from '@/lib/store';

const categories = [
  { id: 'all', label: 'All', icon: null },
  { id: 'strength', label: 'Strength', icon: Dumbbell },
  { id: 'hiit', label: 'HIIT', icon: Zap },
  { id: 'cardio', label: 'Cardio', icon: Heart },
  { id: 'yoga', label: 'Yoga', icon: Wind },
  { id: 'mobility', label: 'Mobility', icon: Wind },
];

const difficultyColors: Record<string, string> = {
  beginner: 'bg-success/20 text-success',
  intermediate: 'bg-warning/20 text-warning',
  advanced: 'bg-destructive/20 text-destructive',
};

export function Workouts() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredWorkouts = workouts.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || w.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold font-display mb-4">Workouts</h1>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search workouts..."
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
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-filter"
            >
              <Filter className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 overflow-x-auto hide-scrollbar pb-2"
        >
          {categories.map((cat) => (
            <Button
              key={cat.id}
              variant={category === cat.id ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'shrink-0',
                category === cat.id && 'glow-sm'
              )}
              onClick={() => setCategory(cat.id)}
              data-testid={`filter-${cat.id}`}
            >
              {cat.icon && <cat.icon className="w-4 h-4 mr-1" />}
              {cat.label}
            </Button>
          ))}
        </motion.div>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/exercises">
            <Card className="p-4 cursor-pointer hover:border-primary/30 glass-hover h-full" data-testid="card-exercise-library">
              <div className="flex flex-col items-start gap-2">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Search className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Exercise Library</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Browse all with form tips</div>
                </div>
              </div>
            </Card>
          </Link>
          <Link href="/workouts/create">
            <Card className="p-4 cursor-pointer hover:border-primary/30 glass-hover h-full" data-testid="card-create-workout">
              <div className="flex flex-col items-start gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Create Workout</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Build your own routine</div>
                </div>
              </div>
            </Card>
          </Link>
        </div>

        <div className="space-y-3">
          {filteredWorkouts.map((workout, i) => (
            <motion.div
              key={workout.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link href={`/workout/${workout.id}`}>
                <Card 
                  className="overflow-hidden cursor-pointer group hover:border-primary/30 glass-card"
                  data-testid={`card-workout-${workout.id}`}
                >
                  <div className="relative h-24 bg-gradient-to-br from-primary/20 via-secondary/10 to-transparent">
                    <div className="absolute inset-0 p-4 flex flex-col justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={difficultyColors[workout.difficulty]}>
                          {workout.difficulty}
                        </Badge>
                        <Badge variant="outline" className="capitalize">
                          {workout.category}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="font-bold font-display text-lg group-hover:text-primary transition-colors">
                          {workout.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {workout.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 pt-3 flex items-center gap-4 border-t border-border/50">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {workout.duration} min
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Flame className="w-4 h-4" />
                      {workout.calories} cal
                    </div>
                    <div className="flex-1 text-right text-sm text-muted-foreground">
                      {workout.equipment.length === 1 && workout.equipment[0] === 'none' 
                        ? 'No equipment' 
                        : `${workout.equipment.length} items`}
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        {filteredWorkouts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No workouts found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}