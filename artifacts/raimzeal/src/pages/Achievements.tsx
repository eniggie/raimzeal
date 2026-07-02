import { useState, useMemo } from 'react';
import { Link } from 'wouter';
import {
  ChevronLeft, Footprints, Flame, Shield, Dumbbell, Trophy, Clock, CalendarCheck,
  Utensils, Salad, Droplets, Ruler, TrendingDown, Medal, Lock, type LucideIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';

type Category = 'Workouts' | 'Nutrition' | 'Progress';

interface BadgeDef {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  category: Category;
  unlocked: (s: AppState) => boolean;
}

function weeklyMax(workoutLogs: AppState['workoutLogs']): number {
  const weeks: Record<string, number> = {};
  for (const w of workoutLogs) {
    const d = new Date(w.date);
    const weekNum = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86400000));
    const key = `${d.getFullYear()}-${weekNum}`;
    weeks[key] = (weeks[key] ?? 0) + 1;
  }
  return Object.values(weeks).reduce((m, c) => Math.max(m, c), 0);
}

const BADGES: BadgeDef[] = [
  // Workouts
  { id: 'first_step', name: 'First Step', desc: 'Complete your first workout', icon: Footprints, color: '#10b981', category: 'Workouts', unlocked: (s) => s.workoutLogs.length >= 1 },
  { id: 'week_warrior', name: 'Week Warrior', desc: 'Reach a 7-day workout streak', icon: Flame, color: '#f59e0b', category: 'Workouts', unlocked: (s) => s.streak >= 7 },
  { id: 'iron_will', name: 'Iron Will', desc: 'Reach a 30-day workout streak', icon: Shield, color: '#ef4444', category: 'Workouts', unlocked: (s) => s.streak >= 30 },
  { id: 'dedicated', name: 'Dedicated', desc: 'Complete 10 workouts', icon: Dumbbell, color: '#3b82f6', category: 'Workouts', unlocked: (s) => s.workoutLogs.length >= 10 },
  { id: 'committed', name: 'Committed', desc: 'Complete 25 workouts', icon: Dumbbell, color: '#6366f1', category: 'Workouts', unlocked: (s) => s.workoutLogs.length >= 25 },
  { id: 'century', name: 'Century Club', desc: 'Complete 100 workouts', icon: Trophy, color: '#eab308', category: 'Workouts', unlocked: (s) => s.workoutLogs.length >= 100 },
  { id: 'calorie_crusher', name: 'Calorie Crusher', desc: 'Burn 5,000 calories across workouts', icon: Flame, color: '#f97316', category: 'Workouts', unlocked: (s) => s.workoutLogs.reduce((t, w) => t + (w.caloriesBurned ?? 0), 0) >= 5000 },
  { id: 'time_lord', name: 'Time Lord', desc: 'Train for 1,000 minutes total', icon: Clock, color: '#8b5cf6', category: 'Workouts', unlocked: (s) => s.workoutLogs.reduce((t, w) => t + (w.duration ?? 0), 0) >= 1000 },
  { id: 'weekly_three', name: 'Triple Threat', desc: 'Complete 3 workouts in one week', icon: CalendarCheck, color: '#06b6d4', category: 'Workouts', unlocked: (s) => weeklyMax(s.workoutLogs) >= 3 },
  // Nutrition
  { id: 'first_meal', name: 'Logged In', desc: 'Log your first meal', icon: Utensils, color: '#10b981', category: 'Nutrition', unlocked: (s) => s.mealLogs.length >= 1 },
  { id: 'nutrition_nerd', name: 'Nutrition Nerd', desc: 'Log 50 meals', icon: Salad, color: '#84cc16', category: 'Nutrition', unlocked: (s) => s.mealLogs.length >= 50 },
  { id: 'macro_master', name: 'Macro Master', desc: 'Log 100 meals', icon: Salad, color: '#22c55e', category: 'Nutrition', unlocked: (s) => s.mealLogs.length >= 100 },
  { id: 'hydrated', name: 'Stay Hydrated', desc: 'Log 8 glasses of water in a day', icon: Droplets, color: '#3b82f6', category: 'Nutrition', unlocked: (s) => s.waterIntake.some((w) => w.glasses >= 8) },
  // Progress
  { id: 'measure_up', name: 'Measure Up', desc: 'Log your first body measurement', icon: Ruler, color: '#f59e0b', category: 'Progress', unlocked: (s) => s.bodyMeasurements.length >= 1 },
  { id: 'transformation', name: 'Transformation', desc: 'Log 10 body measurements', icon: TrendingDown, color: '#ec4899', category: 'Progress', unlocked: (s) => s.bodyMeasurements.length >= 10 },
  { id: 'record_breaker', name: 'Record Breaker', desc: 'Set your first personal record', icon: Medal, color: '#eab308', category: 'Progress', unlocked: (s) => s.personalRecords.length >= 1 },
  { id: 'pr_legend', name: 'PR Legend', desc: 'Set 5 personal records', icon: Medal, color: '#f59e0b', category: 'Progress', unlocked: (s) => s.personalRecords.length >= 5 },
];

const CATEGORIES: Category[] = ['Workouts', 'Nutrition', 'Progress'];

export function Achievements({ state }: { state: AppState }) {
  const [activeCat, setActiveCat] = useState<Category>('Workouts');

  const unlockedMap = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const b of BADGES) {
      try { m[b.id] = b.unlocked(state); } catch { m[b.id] = false; }
    }
    return m;
  }, [state]);

  const totalUnlocked = BADGES.filter((b) => unlockedMap[b.id]).length;
  const catBadges = BADGES.filter((b) => b.category === activeCat);
  const catUnlocked = catBadges.filter((b) => unlockedMap[b.id]).length;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/settings"><Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Achievements</h1>
            <p className="text-sm text-muted-foreground">{totalUnlocked} of {BADGES.length} badges earned</p>
          </div>
          <Trophy className="w-6 h-6 text-secondary" />
        </div>

        {/* Overall progress */}
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Your collection</span>
            <span className="text-muted-foreground">{Math.round((totalUnlocked / BADGES.length) * 100)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(totalUnlocked / BADGES.length) * 100}%` }} />
          </div>
        </Card>

        {/* Category tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted">
          {CATEGORIES.map((c) => {
            const active = activeCat === c;
            return (
              <button key={c} onClick={() => setActiveCat(c)} className={cn('flex-1 py-2 rounded-lg text-sm transition-colors', active ? 'bg-card font-semibold' : 'text-muted-foreground')}>
                {c}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">{catUnlocked} of {catBadges.length} {activeCat.toLowerCase()} badges</p>

        {/* Badge grid */}
        <div className="grid grid-cols-2 gap-3">
          {catBadges.map((b) => {
            const unlocked = unlockedMap[b.id];
            const Icon = b.icon;
            return (
              <Card key={b.id} className={cn('p-4 flex flex-col items-center text-center gap-2', !unlocked && 'opacity-55')}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: unlocked ? b.color + '22' : 'hsl(var(--muted))' }}>
                  {unlocked ? <Icon className="w-7 h-7" style={{ color: b.color }} /> : <Lock className="w-6 h-6 text-muted-foreground" />}
                </div>
                <div>
                  <div className="font-semibold text-sm">{b.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{b.desc}</div>
                </div>
                {unlocked && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: b.color, backgroundColor: b.color + '1a' }}>EARNED</span>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
