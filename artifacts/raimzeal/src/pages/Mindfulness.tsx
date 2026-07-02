import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, BookOpen, Timer as TimerIcon, CalendarDays, Save, CheckCircle2, Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

const STORAGE_PREFIX = 'raimzeal_mindfulness_v1_';
const TIMER_DURATION = 5 * 60;
const ACCENT = '#a78bfa';

interface DailyEntry {
  gratitude: [string, string, string];
  reflection: string;
  intention: string;
  savedAt: string;
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}
function last7Days() {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().split('T')[0], label: i === 0 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' }) });
  }
  return days;
}

const GRAT_PLACEHOLDERS = [
  "e.g. A good night's sleep",
  'e.g. A kind message from a friend',
  'e.g. Sunlight this morning',
];

export function Mindfulness() {
  const [entry, setEntry] = useState<DailyEntry>({ gratitude: ['', '', ''], reflection: '', intention: '', savedAt: '' });
  const [saved, setSaved] = useState(false);
  const [streak, setStreak] = useState(0);
  const [historyDays, setHistoryDays] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'journal' | 'timer' | 'history'>('journal');

  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const days = last7Days();
    const hist: Record<string, boolean> = {};
    const today = todayKey();
    for (const d of days) {
      const val = (() => { try { return localStorage.getItem(STORAGE_PREFIX + d.key); } catch { return null; } })();
      hist[d.key] = !!val;
      if (val && d.key === today) {
        try { setEntry(JSON.parse(val)); } catch { /* ignore */ }
      }
    }
    setHistoryDays(hist);
    let s = 0;
    for (let i = 6; i >= 0; i--) {
      if (hist[days[i].key]) s++;
      else if (i < 6) break;
    }
    setStreak(s);
  }, []);

  useEffect(() => {
    if (!timerRunning) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { setTimerRunning(false); return TIMER_DURATION; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const handleSave = useCallback(() => {
    const toSave: DailyEntry = { ...entry, savedAt: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(toSave)); } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setHistoryDays((prev) => ({ ...prev, [todayKey()]: true }));
    setStreak((s) => (historyDays[todayKey()] ? s : s + 1));
  }, [entry, historyDays]);

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0');
  const secs = (timeLeft % 60).toString().padStart(2, '0');
  const days = last7Days();
  const TABS = [
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'timer', label: 'Timer', icon: TimerIcon },
    { id: 'history', label: 'History', icon: CalendarDays },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <style>{`@keyframes rz-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }`}</style>
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/settings"><Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Mindfulness &amp; Gratitude</h1>
            <p className="text-sm text-muted-foreground">Daily practice</p>
          </div>
          {streak > 0 && (
            <div className="px-2.5 py-1 rounded-full border text-sm font-bold" style={{ color: ACCENT, borderColor: ACCENT + '66', backgroundColor: ACCENT + '1a' }}>
              🔥 {streak}d
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted">
          {TABS.map((t) => {
            const active = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-colors', active ? 'bg-card font-semibold' : 'text-muted-foreground')}
              >
                <Icon className="w-4 h-4" style={active ? { color: ACCENT } : undefined} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Journal */}
        {activeTab === 'journal' && (
          <>
            <Card className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">Today I am grateful for…</h3>
                <p className="text-sm text-muted-foreground">3 things, no matter how small</p>
              </div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: ACCENT + '33', color: ACCENT }}>{i + 1}</span>
                  <Input
                    value={entry.gratitude[i]}
                    onChange={(e) => setEntry((prev) => { const g = [...prev.gratitude] as [string, string, string]; g[i] = e.target.value; return { ...prev, gratitude: g }; })}
                    placeholder={GRAT_PLACEHOLDERS[i]}
                  />
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-2">
              <div>
                <h3 className="font-semibold">Today's intention</h3>
                <p className="text-sm text-muted-foreground">One word or phrase for your day</p>
              </div>
              <Input value={entry.intention} onChange={(e) => setEntry((p) => ({ ...p, intention: e.target.value }))} placeholder="e.g. Patience, Focus, Rest, Joy…" />
            </Card>

            <Card className="p-4 space-y-2">
              <div>
                <h3 className="font-semibold">Evening reflection</h3>
                <p className="text-sm text-muted-foreground">How did today go? What will you take forward?</p>
              </div>
              <Textarea value={entry.reflection} onChange={(e) => setEntry((p) => ({ ...p, reflection: e.target.value }))} placeholder="Today I felt… Tomorrow I want to…" rows={4} />
            </Card>

            <Button onClick={handleSave} className="w-full gap-2 text-white" style={{ backgroundColor: saved ? '#10b981' : ACCENT }}>
              {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              {saved ? 'Saved!' : "Save Today's Journal"}
            </Button>
          </>
        )}

        {/* Timer */}
        {activeTab === 'timer' && (
          <Card className="p-6 flex flex-col items-center gap-4">
            <h3 className="font-semibold text-lg">Mindfulness Timer</h3>
            <p className="text-sm text-muted-foreground text-center">5-minute breathing &amp; awareness session</p>
            <div
              className="w-44 h-44 rounded-full border-2 flex flex-col items-center justify-center gap-1"
              style={{ borderColor: ACCENT + '80', backgroundColor: ACCENT + '15', animation: timerRunning ? 'rz-breathe 8s ease-in-out infinite' : undefined }}
            >
              <span className="text-4xl font-bold tabular-nums" style={{ color: ACCENT }}>{mins}:{secs}</span>
              <span className="text-sm text-muted-foreground">{timerRunning ? (timeLeft % 8 < 4 ? 'Breathe in…' : 'Breathe out…') : 'Tap to begin'}</span>
            </div>
            <Button
              onClick={() => { if (timerRunning) { setTimerRunning(false); setTimeLeft(TIMER_DURATION); } else setTimerRunning(true); }}
              className="gap-2"
              variant={timerRunning ? 'outline' : 'default'}
              style={timerRunning ? { color: '#ef4444', borderColor: '#ef444455' } : { backgroundColor: ACCENT, color: '#fff' }}
            >
              {timerRunning ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              {timerRunning ? 'Stop Session' : 'Start 5-Minute Session'}
            </Button>
          </Card>
        )}

        {/* History */}
        {activeTab === 'history' && (
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">7-Day Streak</h3>
            <div className="flex justify-between gap-1.5">
              {days.map((d) => {
                const done = historyDays[d.key];
                const isToday = d.key === todayKey();
                return (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: done ? ACCENT : 'hsl(var(--muted))', border: isToday ? `2px solid ${ACCENT}` : 'none' }}
                    >
                      {done && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </div>
                    <span className="text-[10px]" style={{ color: isToday ? ACCENT : 'hsl(var(--muted-foreground))', fontWeight: isToday ? 700 : 400 }}>
                      {d.label.slice(0, 3)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {streak === 7 ? '🔥 Perfect week! Keep going!' : streak > 0 ? `${streak} day${streak === 1 ? '' : 's'} this week — great progress!` : 'Start your streak today!'}
            </p>
          </Card>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
