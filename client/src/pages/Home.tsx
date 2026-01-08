import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  Flame, Droplets, Plus, Minus, ChevronRight, 
  Dumbbell, MessageCircle, Users, Trophy, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatRing } from '@/components/StatRing';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';
import { workouts } from '@/lib/store';

interface HomeProps {
  state: AppState;
  onUpdateWater: (glasses: number) => void;
}

export function Home({ state, onUpdateWater }: HomeProps) {
  const today = new Date().toISOString().split('T')[0];
  const todayWater = state.waterIntake.find(w => w.date === today)?.glasses || 0;
  const todayMeals = state.mealLogs.filter(m => m.date === today);
  const todayCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0);
  const todayProtein = todayMeals.reduce((sum, m) => sum + m.protein, 0);
  
  const scheduledToday = state.scheduledWorkouts.find(s => s.date === today);
  const scheduledWorkout = scheduledToday 
    ? workouts.find(w => w.id === scheduledToday.workoutId) 
    : null;

  const caloriesGoal = 2200;
  const proteinGoal = 150;
  const waterGoal = 8;

  const quickActions = [
    { icon: Dumbbell, label: 'Start Workout', href: '/workouts', color: 'bg-primary/20 text-primary' },
    { icon: MessageCircle, label: 'Ask Coach', href: '/coach', color: 'bg-secondary/20 text-secondary' },
    { icon: Users, label: 'Community', href: '/community', color: 'bg-accent/20 text-accent' },
    { icon: Zap, label: 'Programs', href: '/programs', color: 'bg-warning/20 text-warning' },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-muted-foreground text-sm">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},</p>
            <h1 className="text-2xl font-bold font-display" data-testid="text-username">{state.user?.name?.split(' ')[0] || 'Athlete'}</h1>
          </div>
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
            whileHover={{ scale: 1.05 }}
          >
            <Flame className="w-4 h-4 text-primary" />
            <span className="font-semibold text-primary" data-testid="text-streak">{state.streak}</span>
            <span className="text-xs text-muted-foreground">day streak</span>
          </motion.div>
        </motion.div>

        {scheduledWorkout && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Link href={`/workout/${scheduledWorkout.id}`}>
              <Card className="overflow-hidden cursor-pointer group" data-testid="card-today-workout">
                <div className="relative h-32 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/10">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
                  <div className="absolute inset-0 p-4 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div className="px-2 py-1 rounded-full bg-background/80 backdrop-blur text-xs font-medium">
                        Today's Workout
                      </div>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <h3 className="text-xl font-bold font-display">{scheduledWorkout.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {scheduledWorkout.duration} min · {scheduledWorkout.calories} cal
                        </p>
                      </div>
                      <Button size="sm" className="glow-sm group-hover:glow">
                        Start
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-3 gap-3"
        >
          <Card className="p-4 text-center" data-testid="card-calories">
            <StatRing value={todayCalories} max={caloriesGoal} size={64} strokeWidth={5}>
              <Flame className="w-5 h-5 text-primary" />
            </StatRing>
            <div className="mt-2">
              <div className="text-lg font-bold">{todayCalories}</div>
              <div className="text-xs text-muted-foreground">/ {caloriesGoal} cal</div>
            </div>
          </Card>

          <Card className="p-4 text-center" data-testid="card-protein">
            <StatRing value={todayProtein} max={proteinGoal} size={64} strokeWidth={5} color="hsl(var(--secondary))">
              <Trophy className="w-5 h-5 text-secondary" />
            </StatRing>
            <div className="mt-2">
              <div className="text-lg font-bold">{todayProtein}g</div>
              <div className="text-xs text-muted-foreground">/ {proteinGoal}g protein</div>
            </div>
          </Card>

          <Card className="p-4 text-center" data-testid="card-water">
            <StatRing value={todayWater} max={waterGoal} size={64} strokeWidth={5} color="hsl(186 100% 42%)">
              <Droplets className="w-5 h-5 text-secondary" />
            </StatRing>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onUpdateWater(Math.max(0, todayWater - 1))}
                data-testid="button-water-minus"
              >
                <Minus className="w-3 h-3" />
              </Button>
              <div className="text-lg font-bold">{todayWater}</div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => onUpdateWater(todayWater + 1)}
                data-testid="button-water-plus"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">/ {waterGoal} glasses</div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold font-display mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {quickActions.map((action, i) => (
              <Link key={action.label} href={action.href}>
                <motion.div
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors cursor-pointer"
                  whileTap={{ scale: 0.95 }}
                  data-testid={`action-${action.label.toLowerCase().replace(' ', '-')}`}
                >
                  <div className={cn('p-2 rounded-lg', action.color)}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-center">{action.label}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {state.workoutLogs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold font-display">Recent Activity</h2>
              <Link href="/tracking">
                <Button variant="ghost" size="sm">
                  See all
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {state.workoutLogs.slice(0, 3).map((log, i) => (
                <Card key={log.id} className="p-3" data-testid={`card-activity-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{log.workoutName}</div>
                      <div className="text-sm text-muted-foreground">
                        {log.duration} min · {log.caloriesBurned} cal burned
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(log.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {state.personalRecords.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-lg font-semibold font-display mb-3">Personal Records</h2>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {state.personalRecords.map((pr, i) => (
                <Card key={i} className="p-3 min-w-[140px] shrink-0" data-testid={`card-pr-${i}`}>
                  <Trophy className="w-5 h-5 text-warning mb-2" />
                  <div className="font-bold">{pr.weight} lbs</div>
                  <div className="text-sm text-muted-foreground">{pr.exercise}</div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}