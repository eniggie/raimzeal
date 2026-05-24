import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, CheckCircle2, Circle, Plus, X, Flame, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

type Habit = {
  id: string;
  name: string;
  emoji: string;
  custom?: boolean;
};

type HabitLog = {
  [habitId: string]: {
    [date: string]: boolean;
  };
};

const DEFAULT_HABITS: Habit[] = [
  { id: 'water', name: 'Drink 8 glasses of water', emoji: '💧' },
  { id: 'sleep', name: 'Sleep 7–9 hours', emoji: '😴' },
  { id: 'meals', name: 'Log my meals', emoji: '🥗' },
  { id: 'workout', name: 'Exercise or move body', emoji: '🏋️' },
  { id: 'meditate', name: 'Meditate or breathe', emoji: '🧘' },
  { id: 'vitamins', name: 'Take vitamins/supplements', emoji: '💊' },
  { id: 'nojunk', name: 'No junk food today', emoji: '🚫' },
  { id: 'steps', name: 'Walk 8,000+ steps', emoji: '👟' },
];

const STORAGE_KEY = 'raimzeal_habits';
const HABITS_KEY = 'raimzeal_habit_list';

function today() {
  return new Date().toISOString().split('T')[0];
}

function getLast7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
}

export function HabitTracker() {
  const [habits, setHabits] = useState<Habit[]>(DEFAULT_HABITS);
  const [logs, setLogs] = useState<HabitLog>({});
  const [newHabitName, setNewHabitName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem(STORAGE_KEY);
      if (savedLogs) setLogs(JSON.parse(savedLogs) as HabitLog);
      const savedHabits = localStorage.getItem(HABITS_KEY);
      if (savedHabits) {
        const custom = JSON.parse(savedHabits) as Habit[];
        setHabits([...DEFAULT_HABITS, ...custom]);
      }
    } catch { /* ignore */ }
  }, []);

  function saveLogs(newLogs: HabitLog) {
    setLogs(newLogs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs)); } catch { /* ignore */ }
  }

  function toggle(habitId: string) {
    const t = today();
    const newLogs = {
      ...logs,
      [habitId]: {
        ...(logs[habitId] ?? {}),
        [t]: !(logs[habitId]?.[t] ?? false),
      },
    };
    saveLogs(newLogs);
  }

  function addHabit() {
    const name = newHabitName.trim();
    if (!name) return;
    const newHabit: Habit = { id: `custom-${Date.now()}`, name, emoji: '⭐', custom: true };
    const customHabits = habits.filter(h => h.custom);
    const updated = [...DEFAULT_HABITS, ...customHabits, newHabit];
    setHabits(updated);
    try { localStorage.setItem(HABITS_KEY, JSON.stringify([...customHabits, newHabit])); } catch { /* ignore */ }
    setNewHabitName('');
    setShowAdd(false);
  }

  function removeHabit(id: string) {
    const updated = habits.filter(h => h.id !== id);
    setHabits(updated);
    const custom = updated.filter(h => h.custom);
    try { localStorage.setItem(HABITS_KEY, JSON.stringify(custom)); } catch { /* ignore */ }
  }

  function getStreak(habitId: string) {
    const days = getLast7Days().reverse();
    let streak = 0;
    for (const d of days) {
      if (logs[habitId]?.[d]) streak++;
      else break;
    }
    return streak;
  }

  const t = today();
  const completedToday = habits.filter(h => logs[h.id]?.[t]).length;
  const last7 = getLast7Days();

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2"><ListChecks className="w-6 h-6 text-green-400" />Habit Tracker</h1>
            <p className="text-xs text-muted-foreground">Build the daily habits that compound into results</p>
          </div>
        </motion.div>

        {/* Today's progress */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-muted-foreground">Today's Progress</p>
              <p className="text-2xl font-bold">{completedToday} <span className="text-sm font-normal text-muted-foreground">/ {habits.length}</span></p>
            </div>
            <div className="w-16 h-16 relative">
              <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
                <circle cx="28" cy="28" r="22" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                <circle
                  cx="28" cy="28" r="22" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - completedToday / habits.length)}`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold">{Math.round((completedToday / habits.length) * 100)}%</span>
              </div>
            </div>
          </div>

          {/* 7-day mini calendar */}
          <div className="flex gap-1">
            {last7.map(d => {
              const isToday = d === t;
              const dayDone = habits.filter(h => logs[h.id]?.[d]).length;
              const pct = dayDone / habits.length;
              return (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-muted-foreground">{new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</span>
                  <div className={cn('w-full h-1.5 rounded-full transition-all', pct >= 0.8 ? 'bg-primary' : pct >= 0.4 ? 'bg-primary/50' : 'bg-border')} />
                  {isToday && <span className="text-xs text-primary font-bold">•</span>}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Habit list */}
        <div className="space-y-2">
          {habits.map((habit, i) => {
            const done = logs[habit.id]?.[t] ?? false;
            const streak = getStreak(habit.id);
            return (
              <motion.div
                key={habit.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <Card
                  className={cn('p-3 cursor-pointer transition-all', done && 'border-primary/30 bg-primary/5')}
                  onClick={() => toggle(habit.id)}
                >
                  <div className="flex items-center gap-3">
                    <motion.div animate={done ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.3 }}>
                      {done
                        ? <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                        : <Circle className="w-6 h-6 text-muted-foreground/40 shrink-0" />}
                    </motion.div>
                    <span className="text-xl shrink-0">{habit.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium leading-tight', done && 'line-through text-muted-foreground')}>{habit.name}</p>
                      {streak > 0 && (
                        <p className="text-xs text-orange-400 flex items-center gap-1 mt-0.5">
                          <Flame className="w-3 h-3" />{streak}-day streak
                        </p>
                      )}
                    </div>
                    {habit.custom && (
                      <button
                        onClick={e => { e.stopPropagation(); removeHabit(habit.id); }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Add custom habit */}
        <AnimatePresence>
          {showAdd ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex gap-2">
              <Input
                placeholder="e.g. Read 20 pages…"
                value={newHabitName}
                onChange={e => setNewHabitName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHabit()}
                autoFocus
                className="flex-1"
              />
              <Button onClick={addHabit} disabled={!newHabitName.trim()}>Add</Button>
              <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}><X className="w-4 h-4" /></Button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-2" />Add Custom Habit
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground/50 text-center pb-2">Habits are stored on this device. Progress syncs when you log in.</p>
      </div>
      <BottomNav />
    </div>
  );
}
