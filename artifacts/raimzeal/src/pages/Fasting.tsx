import { useState, useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Play, StopCircle, Timer, Flame, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'raimzeal_fasting_v1';
const MS_PER_HOUR = 3_600_000;

interface Protocol { id: string; label: string; fastHours: number; blurb: string; }
const PROTOCOLS: Protocol[] = [
  { id: '16-8', label: '16:8', fastHours: 16, blurb: 'Beginner-friendly · fast 16h, eat within 8h' },
  { id: '18-6', label: '18:6', fastHours: 18, blurb: 'Fast 18h, eat within 6h' },
  { id: '20-4', label: '20:4', fastHours: 20, blurb: 'Warrior · fast 20h, eat within 4h' },
  { id: 'omad', label: 'OMAD', fastHours: 23, blurb: 'One meal a day · fast 23h' },
];

interface ActiveFast { startedAt: number; targetHours: number; protocolId: string; }
interface FastRecord { startedAt: number; endedAt: number; targetHours: number; protocolId: string; completed: boolean; }
interface FastingState { protocolId: string; active: ActiveFast | null; history: FastRecord[]; }

const DEFAULT_STATE: FastingState = { protocolId: '16-8', active: null, history: [] };

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
function calcStreak(history: FastRecord[]): number {
  const completedDays = new Set(history.filter(r => r.completed).map(r => dayKey(r.endedAt)));
  if (completedDays.size === 0) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (completedDays.has(key)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}
function fastingPhase(hours: number): { label: string; className: string } {
  if (hours < 4) return { label: 'Fed state — digesting', className: 'text-muted-foreground' };
  if (hours < 12) return { label: 'Blood sugar settling', className: 'text-blue-400' };
  if (hours < 16) return { label: 'Fat-burning begins', className: 'text-secondary' };
  if (hours < 18) return { label: 'Ketosis ramping up', className: 'text-primary' };
  if (hours < 24) return { label: 'Autophagy zone', className: 'text-accent' };
  return { label: 'Deep fast — listen to your body', className: 'text-destructive' };
}

export function Fasting() {
  const [state, setState] = useState<FastingState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FastingState>;
        setState({
          protocolId: parsed.protocolId ?? DEFAULT_STATE.protocolId,
          active: parsed.active ?? null,
          history: Array.isArray(parsed.history) ? parsed.history : [],
        });
      }
    } catch { /* keep default */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state, hydrated]);

  useEffect(() => {
    if (state.active) {
      setNow(Date.now());
      tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };
  }, [state.active]);

  const selectedProtocol = PROTOCOLS.find(p => p.id === state.protocolId) ?? PROTOCOLS[0];
  const active = state.active;
  const elapsedMs = active ? now - active.startedAt : 0;
  const targetMs = (active?.targetHours ?? selectedProtocol.fastHours) * MS_PER_HOUR;
  const progress = active ? Math.min(1, elapsedMs / targetMs) : 0;
  const remainingMs = targetMs - elapsedMs;
  const phase = fastingPhase(active ? elapsedMs / MS_PER_HOUR : 0);
  const streak = calcStreak(state.history);
  const completedCount = state.history.filter(r => r.completed).length;

  const startFast = () => setState(prev => {
    const proto = PROTOCOLS.find(p => p.id === prev.protocolId) ?? PROTOCOLS[0];
    return { ...prev, active: { startedAt: Date.now(), targetHours: proto.fastHours, protocolId: proto.id } };
  });
  const endFast = () => setState(prev => {
    if (!prev.active) return prev;
    const endedAt = Date.now();
    const durationH = (endedAt - prev.active.startedAt) / MS_PER_HOUR;
    const record: FastRecord = {
      startedAt: prev.active.startedAt, endedAt,
      targetHours: prev.active.targetHours, protocolId: prev.active.protocolId,
      completed: durationH >= prev.active.targetHours,
    };
    return { ...prev, active: null, history: [record, ...prev.history].slice(0, 60) };
  });

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/nutrition">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Intermittent Fasting</h1>
            <p className="text-sm text-muted-foreground">
              {active ? 'Fast in progress' : 'Choose a window and begin'}
            </p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-secondary/40 bg-secondary/10">
              <Flame className="w-3.5 h-3.5 text-secondary" />
              <span className="text-xs font-semibold text-secondary">{streak}d</span>
            </div>
          )}
        </div>

        {/* Timer card */}
        <Card className={cn('p-6 flex flex-col items-center text-center border', active ? 'border-primary/40' : 'border-border')}>
          {active ? (
            <>
              <div className={cn('text-5xl font-bold tabular-nums tracking-tight', phase.className)}>
                {formatDuration(elapsedMs)}
              </div>
              <p className="text-sm text-muted-foreground mt-1 mb-4">elapsed · target {active.targetHours}h</p>
              <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <p className={cn('text-sm font-semibold mt-3', phase.className)}>{phase.label}</p>
              <p className="text-sm text-muted-foreground mt-1 mb-5">
                {remainingMs > 0 ? `${formatDuration(remainingMs)} to goal` : `Goal reached — +${formatDuration(-remainingMs)} over 🎉`}
              </p>
              <Button variant="destructive" className="w-full gap-2" onClick={endFast}>
                <StopCircle className="w-5 h-5" /> End Fast
              </Button>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                <Timer className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Ready when you are</h2>
              <p className="text-sm text-muted-foreground mt-1 mb-5">{selectedProtocol.label} · {selectedProtocol.blurb}</p>
              <Button className="w-full gap-2" onClick={startFast}>
                <Play className="w-4 h-4" /> Start {selectedProtocol.label} Fast
              </Button>
            </>
          )}
        </Card>

        {/* Protocol picker */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Fasting window</h3>
          <div className="grid grid-cols-4 gap-2">
            {PROTOCOLS.map(p => {
              const selected = p.id === state.protocolId;
              return (
                <button
                  key={p.id}
                  disabled={!!active}
                  onClick={() => setState(prev => ({ ...prev, protocolId: p.id }))}
                  className={cn(
                    'rounded-xl border py-3 px-1 flex flex-col items-center transition-colors',
                    selected ? 'border-primary bg-primary/10' : 'border-border bg-card',
                    active && !selected && 'opacity-40 cursor-not-allowed',
                  )}
                >
                  <span className={cn('text-base font-bold', selected ? 'text-primary' : 'text-foreground')}>{p.label}</span>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{p.fastHours}h fast</span>
                </button>
              );
            })}
          </div>
          {active && <p className="text-xs text-muted-foreground mt-2">End your current fast to switch windows.</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-4 flex flex-col items-center"><span className="text-2xl font-bold text-primary">{streak}</span><span className="text-[11px] text-muted-foreground text-center mt-0.5">day streak</span></Card>
          <Card className="p-4 flex flex-col items-center"><span className="text-2xl font-bold text-secondary">{completedCount}</span><span className="text-[11px] text-muted-foreground text-center mt-0.5">completed</span></Card>
          <Card className="p-4 flex flex-col items-center"><span className="text-2xl font-bold text-accent">{state.history.length}</span><span className="text-[11px] text-muted-foreground text-center mt-0.5">total logged</span></Card>
        </div>

        {/* History */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Recent fasts</h3>
          {state.history.length === 0 ? (
            <Card className="p-6 flex flex-col items-center gap-2">
              <Clock className="w-7 h-7 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center">Your completed fasts will appear here.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {state.history.slice(0, 14).map((r, i) => {
                const durMs = r.endedAt - r.startedAt;
                const proto = PROTOCOLS.find(p => p.id === r.protocolId);
                return (
                  <Card key={`${r.startedAt}-${i}`} className="p-3 flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', r.completed ? 'bg-primary/10' : 'bg-muted')}>
                      {r.completed ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{proto?.label ?? `${r.targetHours}h`} · {formatDuration(durMs)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.endedAt).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {'  ·  '}{r.completed ? 'Goal met' : 'Ended early'}
                      </p>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <p className="text-[11px] leading-4 text-muted-foreground">
          Educational only. Intermittent fasting isn't for everyone — if you're pregnant, breastfeeding,
          diabetic, underweight, under 18, or have a history of disordered eating, talk to a healthcare
          professional first. Stay hydrated and break your fast gently.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
