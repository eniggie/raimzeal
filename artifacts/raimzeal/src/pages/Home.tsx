import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { 
  Flame, Droplets, Plus, Minus, ChevronRight, 
  Dumbbell, MessageCircle, Users, Trophy, Zap, Crown, Heart, Snowflake,
  Moon, Sun, Wind, BedDouble
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatRing } from '@/components/StatRing';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import type { AppState } from '@/lib/store';
import { workouts } from '@/lib/store';

import { STRIPE_DONATION_URL, DONATION_ACTIVE, RAIMZY_LINKTREE } from '@/lib/constants';

interface HomeProps {
  state: AppState;
  onUpdateWater: (glasses: number) => void;
  onUpdateSettings?: (s: Partial<AppState['settings']>) => void;
}

function calcDailyGoals(user: AppState['user']): { caloriesGoal: number; proteinGoal: number } {
  if (!user || !user.weight || !user.height) return { caloriesGoal: 2200, proteinGoal: 150 };
  const rawKg = user.units === 'imperial' ? user.weight * 0.453592 : user.weight;
  const rawCm = user.units === 'imperial' ? user.height * 2.54 : user.height;
  const weightKg = Math.min(Math.max(rawKg, 30), 250);
  const heightCm = Math.min(Math.max(rawCm, 120), 230);
  const age = Math.min(Math.max(user.age || 30, 13), 100);
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  const activityFactor = user.fitnessLevel === 'advanced' ? 1.725 : user.fitnessLevel === 'intermediate' ? 1.55 : 1.375;
  const tdee = Math.round((bmr * activityFactor) / 50) * 50;
  const protein = Math.round((weightKg * 1.8) / 5) * 5;
  return {
    caloriesGoal: Math.min(Math.max(tdee, 1500), 5000),
    proteinGoal: Math.min(Math.max(protein, 80), 300),
  };
}

export function Home({ state, onUpdateWater, onUpdateSettings }: HomeProps) {
  const [streakFreezes, setStreakFreezes] = useState(0);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeMsg, setFreezeMsg] = useState('');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await fetch('/api/user/streak', { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) {
          const d = await res.json() as { streak_freezes_available: number };
          setStreakFreezes(d.streak_freezes_available ?? 0);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  async function handleUseFreeze() {
    setFreezeLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/user/streak/freeze', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
      const d = await res.json() as { success?: boolean; streak_freezes_available?: number; message?: string; error?: string };
      if (d.success) {
        setStreakFreezes(d.streak_freezes_available ?? 0);
        setFreezeMsg(d.message ?? 'Streak protected!');
      } else {
        setFreezeMsg(d.error ?? 'No freezes available.');
      }
    } catch { setFreezeMsg('Could not apply freeze.'); }
    setFreezeLoading(false);
    setTimeout(() => setFreezeMsg(''), 3500);
  }
  const todayWater = (state.waterIntake ?? []).find(w => w.date === today)?.glasses || 0;
  const todayMeals = (state.mealLogs ?? []).filter(m => m.date === today);
  const todayCalories = todayMeals.reduce((sum, m) => sum + m.calories, 0);
  const todayProtein = todayMeals.reduce((sum, m) => sum + m.protein, 0);
  
  const scheduledToday = (state.scheduledWorkouts ?? []).find(s => s.date === today);
  const scheduledWorkout = scheduledToday 
    ? workouts.find(w => w.id === scheduledToday.workoutId) 
    : null;

  const { caloriesGoal, proteinGoal } = calcDailyGoals(state.user);
  const waterGoal = 8;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayMeals = (state.mealLogs ?? []).filter(m => m.date === dateStr);
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: dayMeals.reduce((sum, m) => sum + m.calories, 0),
      isToday: dateStr === today,
    };
  });

  const quickActions = [
    { icon: Dumbbell, label: 'Workout', href: '/workouts', color: 'bg-primary/20 text-primary' },
    { icon: MessageCircle, label: 'Ovia AI', href: '/coach', color: 'bg-secondary/20 text-secondary' },
    { icon: Users, label: 'Community', href: '/community', color: 'bg-accent/20 text-accent' },
    { icon: Zap, label: 'Programs', href: '/programs', color: 'bg-warning/20 text-warning' },
    { icon: Wind, label: 'Breathe', href: '/breathing', color: 'bg-cyan-500/20 text-cyan-400' },
    { icon: BedDouble, label: 'Sleep', href: '/sleep', color: 'bg-indigo-500/20 text-indigo-400' },
  ];

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <p className="text-muted-foreground text-sm">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'},</p>
            <h1 className="text-2xl font-bold font-display truncate max-w-[180px]" data-testid="text-username">
              {(state.user?.name?.split(' ')[0] || 'Champion').slice(0, 20)}
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            {onUpdateSettings && (
              <button
                onClick={() => onUpdateSettings({ darkMode: !(state.settings?.darkMode ?? true) })}
                className="mb-1 p-1.5 rounded-full bg-muted/50 hover:bg-muted transition-colors"
                title={(state.settings?.darkMode ?? true) ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {(state.settings?.darkMode ?? true)
                  ? <Sun className="w-4 h-4 text-yellow-400" />
                  : <Moon className="w-4 h-4 text-muted-foreground" />}
              </button>
            )}
            <motion.div
              className="flex items-center gap-2 px-3 py-1.5 glass-pill"
              whileHover={{ scale: 1.05 }}
            >
              <Flame className="w-4 h-4 text-primary" />
              <span className="font-semibold text-primary" data-testid="text-streak">{state.streak}</span>
              <span className="text-xs text-muted-foreground">day streak</span>
            </motion.div>
            {streakFreezes > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={handleUseFreeze}
                disabled={freezeLoading}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                title="Use a streak freeze to protect your streak for one missed day"
              >
                <Snowflake className="w-3 h-3" />
                {streakFreezes} freeze{streakFreezes !== 1 ? 's' : ''}
              </motion.button>
            )}
          </div>
        </motion.div>

        <AnimatePresence>
          {freezeMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2 text-sm text-blue-300 text-center font-medium"
            >
              <Snowflake className="w-4 h-4 inline mr-1.5 align-middle" />
              {freezeMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Free Forever Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl glass-emerald shimmer px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Foundation — Free forever. Rise, Reign & Legacy are optional.</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              The Foundation Plan is free forever. Rise, Reign, and Legacy are optional support/donation identities — never required. A voluntary donation keeps the staff and platform running for everyone. <a href="https://linktr.ee/Raimzy" target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">linktr.ee/Raimzy</a>
            </p>
          </div>
          {DONATION_ACTIVE ? (
            <div className="shrink-0 flex flex-col items-end gap-1">
              <motion.a
                href={STRIPE_DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold whitespace-nowrap cursor-pointer"
                animate={{ scale: [1, 1.07, 1, 1.07, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 4 }}
                aria-label="Donate to support RAIMZEAL"
              >
                <Heart className="w-3.5 h-3.5 fill-current" />
                Donate
              </motion.a>
            </div>
          ) : (
            <p className="shrink-0 text-xs text-muted-foreground italic whitespace-nowrap">Donation link coming soon.</p>
          )}
        </motion.div>

        {/* Membership Upgrade Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Link href="/membership">
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-yellow-500/10 transition-colors group">
              <div className="w-9 h-9 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Rise · Reign · Legacy 👑</p>
                <p className="text-xs text-muted-foreground leading-relaxed">Optional support plans from $9.99/mo — Foundation is always free</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-yellow-400 transition-colors shrink-0" />
            </div>
          </Link>
        </motion.div>

        {scheduledWorkout && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Link href={`/workout/${scheduledWorkout.id}`}>
              <Card className="overflow-hidden cursor-pointer group glass-card" data-testid="card-today-workout">
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
          <Card className="p-4 text-center glass-card" data-testid="card-calories">
            <StatRing value={todayCalories} max={caloriesGoal} size={64} strokeWidth={5}>
              <Flame className="w-5 h-5 text-primary" />
            </StatRing>
            <div className="mt-2">
              <div className="text-lg font-bold">{todayCalories}</div>
              <div className="text-xs text-muted-foreground">/ {caloriesGoal} cal</div>
            </div>
          </Card>

          <Card className="p-4 text-center glass-card" data-testid="card-protein">
            <StatRing value={todayProtein} max={proteinGoal} size={64} strokeWidth={5} color="hsl(var(--secondary))">
              <Trophy className="w-5 h-5 text-secondary" />
            </StatRing>
            <div className="mt-2">
              <div className="text-lg font-bold">{todayProtein}g</div>
              <div className="text-xs text-muted-foreground">/ {proteinGoal}g protein</div>
            </div>
          </Card>

          <Card className="p-4 text-center glass-card" data-testid="card-water">
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

        {/* 7-day calorie trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="p-4 glass-card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold">7-Day Calorie Trend</h2>
              <span className="text-xs text-muted-foreground">{caloriesGoal} kcal goal</span>
            </div>
            <ResponsiveContainer width="100%" height={72}>
              <BarChart data={last7Days} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }}
                  formatter={(v: number) => [`${v} kcal`, 'Calories']}
                />
                <ReferenceLine y={caloriesGoal} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Bar dataKey="calories" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-lg font-semibold font-display mb-3">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action, i) => (
              <Link key={action.label} href={action.href}>
                <motion.div
                  className="flex flex-col items-center gap-2 p-3 rounded-xl glass glass-hover cursor-pointer"
                  whileTap={{ scale: 0.95 }}
                  data-testid={`action-${action.label.toLowerCase().replace(' ', '-')}`}
                >
                  <div className={cn('p-2 rounded-lg', action.color)}>
                    <action.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs text-center leading-tight">{action.label}</span>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Donation CTA — dark psychology */}
        {DONATION_ACTIVE && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-secondary/5 px-5 py-5"
          >
            {/* Ambient glow blobs */}
            <div className="pointer-events-none absolute -top-8 -left-8 w-32 h-32 rounded-full bg-primary/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-secondary/15 blur-2xl" />

            {/* Badge */}
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest text-primary uppercase">Support the Mission</span>
            </div>

            {/* Headline */}
            <p className="text-base font-bold leading-snug text-foreground mb-1">
              Someone funded this session.<br />
              <span className="text-primary">It wasn't you.</span>
            </p>

            {/* Body */}
            <p className="text-xs text-muted-foreground leading-relaxed mb-1">
              Every ad deal, every investor pitch, every sponsorship — we said no. All of it.
              To keep this completely free for you.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              RAIMZEAL runs on voluntary donations from the few who decide the mission is worth
              protecting. Most people never give. The ones who do are the reason everyone else can.
            </p>

            {/* Identity challenge */}
            <p className="text-xs font-semibold text-foreground/80 mb-2 italic">
              "You've already used it. Now you know what it's worth to you."
            </p>

            {/* Linktree — Books, Music, Courses by Dr. Oviawe */}
            <p className="text-xs text-muted-foreground mb-4">
              Books · Music · Courses · Coaching by Dr. Ephraim Oviawe:{' '}
              <a
                href={RAIMZY_LINKTREE}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-secondary hover:underline"
              >
                linktr.ee/Raimzy
              </a>
            </p>

            {/* CTA */}
            <motion.a
              href={STRIPE_DONATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="relative flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 overflow-hidden"
              animate={{ boxShadow: ['0 0 0px #2E8B57', '0 0 22px #2E8B5788', '0 0 0px #2E8B57'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-label="Donate to support RAIMZEAL"
            >
              <Heart className="w-4 h-4 fill-current shrink-0" />
              I'll support the mission — any amount
              <motion.span
                className="pointer-events-none absolute inset-0 bg-white/10"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
              />
            </motion.a>

            {/* Trust line */}
            <p className="mt-2.5 text-center text-[10px] text-muted-foreground/60">
              Secure · No account required · Any amount helps · 100% goes to the team
            </p>
          </motion.div>
        )}

        {(state.workoutLogs ?? []).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
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
                <Card key={log.id} className="p-3 glass-hover" data-testid={`card-activity-${i}`}>
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

        {(state.personalRecords ?? []).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <h2 className="text-lg font-semibold font-display mb-3">Personal Records</h2>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
              {state.personalRecords.map((pr, i) => (
                <Card key={i} className="p-3 min-w-[140px] shrink-0 glass-hover" data-testid={`card-pr-${i}`}>
                  <Trophy className="w-5 h-5 text-warning mb-2" />
                  <div className="font-bold">{pr.weight} lbs</div>
                  <div className="text-sm text-muted-foreground">{pr.exercise}</div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        <p className="text-xs text-muted-foreground/50 text-center px-2 pt-4 pb-2 leading-relaxed">
          RAIMZEAL is not here to replace any doctor, dietitian, or healthcare professional — we exist to complement their work and spread health awareness.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
