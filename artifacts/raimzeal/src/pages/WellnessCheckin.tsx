import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { ChevronLeft, Heart, Save, CheckCircle2, Sparkles, Phone, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const STORAGE_PREFIX = 'raimzeal_wellness_v1_';
const DISCLAIMER_KEY = 'raimzeal_wellness_disclaimer_seen';

const CRISIS_KEYWORDS = [
  'suicide', 'suicidal', 'kill myself', 'end my life', "can't go on",
  'want to die', 'hurt myself', 'self harm', 'self-harm', 'no reason to live',
  'hopeless', 'give up on life',
];

type Scale = 1 | 2 | 3 | 4 | 5;
interface WellnessEntry { mood: Scale; energy: Scale; stress: Scale; recovery: Scale; notes: string; timestamp: string; }

function todayKey() { return new Date().toISOString().split('T')[0]; }
function last7Days() {
  const days: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ key: d.toISOString().split('T')[0], label: i === 0 ? 'Today' : d.toLocaleDateString('en', { weekday: 'short' }) });
  }
  return days;
}
function calcReadiness(e: Pick<WellnessEntry, 'mood' | 'energy' | 'stress' | 'recovery'>): number {
  return Math.round(((e.mood + e.energy + (6 - e.stress) + e.recovery) / 4) * 20);
}
function readinessLabel(score: number): { label: string; color: string; tip: string } {
  if (score >= 80) return { label: 'Push', color: '#10b981', tip: 'Great day to train hard and chase goals.' };
  if (score >= 60) return { label: 'Maintain', color: '#3b82f6', tip: 'Moderate activity — keep your routine steady.' };
  if (score >= 40) return { label: 'Recover', color: '#f59e0b', tip: 'Light movement only — your body needs care.' };
  return { label: 'Rest', color: '#ef4444', tip: 'Full rest day recommended — prioritise sleep.' };
}

const MOOD_OPTS = [{ v: 1, e: '😫', l: 'Awful' }, { v: 2, e: '😞', l: 'Low' }, { v: 3, e: '😐', l: 'Okay' }, { v: 4, e: '🙂', l: 'Good' }, { v: 5, e: '😄', l: 'Great' }] as const;
const ENERGY_OPTS = [{ v: 1, e: '🪫', l: 'Drained' }, { v: 2, e: '😴', l: 'Tired' }, { v: 3, e: '😐', l: 'Neutral' }, { v: 4, e: '⚡', l: 'Energised' }, { v: 5, e: '🚀', l: 'Fired up' }] as const;
const STRESS_OPTS = [{ v: 1, e: '😌', l: 'Calm' }, { v: 2, e: '🙂', l: 'Low' }, { v: 3, e: '😐', l: 'Moderate' }, { v: 4, e: '😤', l: 'High' }, { v: 5, e: '🤯', l: 'Overwhelmed' }] as const;
const RECOVERY_OPTS = [{ v: 1, e: '🤕', l: 'Very sore' }, { v: 2, e: '😬', l: 'Sore' }, { v: 3, e: '😐', l: 'Some ache' }, { v: 4, e: '💪', l: 'Good' }, { v: 5, e: '✨', l: 'Fresh' }] as const;

function EmojiPicker({ options, value, onChange }: { options: readonly { v: number; e: string; l: string }[]; value: Scale; onChange: (v: Scale) => void }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {options.map((opt) => {
        const selected = value === opt.v;
        return (
          <button
            key={opt.v}
            onClick={() => onChange(opt.v as Scale)}
            className={cn('flex flex-col items-center gap-1 py-2 rounded-xl border transition-colors', selected ? 'border-primary bg-primary/10' : 'border-transparent bg-muted')}
          >
            <span className="text-xl">{opt.e}</span>
            <span className={cn('text-[10px] font-medium', selected ? 'text-primary' : 'text-muted-foreground')}>{opt.l}</span>
          </button>
        );
      })}
    </div>
  );
}

function CrisisBanner() {
  return (
    <Card className="p-4 border-destructive/40 bg-destructive/5 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-destructive" />
        <h3 className="font-semibold text-destructive">You're not alone</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        If you're struggling, please reach out right now — help is free, confidential, and available 24/7.
      </p>
      <div className="flex flex-col gap-2 pt-1">
        <a href="tel:988" className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-destructive text-destructive-foreground font-semibold text-sm">
          <Phone className="w-4 h-4" /> Call or Text 988 — Crisis Lifeline
        </a>
        <a href="sms:741741" className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border text-sm font-medium">
          Text HOME to Crisis Text Line (741741)
        </a>
      </div>
    </Card>
  );
}

export function WellnessCheckin() {
  const [mood, setMood] = useState<Scale>(3);
  const [energy, setEnergy] = useState<Scale>(3);
  const [stress, setStress] = useState<Scale>(3);
  const [recovery, setRecovery] = useState<Scale>(3);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [history, setHistory] = useState<Record<string, WellnessEntry>>({});
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISCLAIMER_KEY) !== '1') setShowDisclaimer(true);
      const today = localStorage.getItem(STORAGE_PREFIX + todayKey());
      if (today) {
        const e = JSON.parse(today) as WellnessEntry;
        setMood(e.mood); setEnergy(e.energy); setStress(e.stress); setRecovery(e.recovery); setNotes(e.notes ?? '');
      }
      const hist: Record<string, WellnessEntry> = {};
      for (const d of last7Days()) {
        const raw = localStorage.getItem(STORAGE_PREFIX + d.key);
        if (raw) { try { hist[d.key] = JSON.parse(raw); } catch { /* ignore */ } }
      }
      setHistory(hist);
    } catch { /* ignore */ }
  }, []);

  const readiness = calcReadiness({ mood, energy, stress, recovery });
  const readInfo = readinessLabel(readiness);

  const handleNotesChange = useCallback((text: string) => {
    setNotes(text);
    const lower = text.toLowerCase();
    if (CRISIS_KEYWORDS.some((kw) => lower.includes(kw))) setShowCrisis(true);
  }, []);

  const dismissDisclaimer = () => { try { localStorage.setItem(DISCLAIMER_KEY, '1'); } catch { /* ignore */ } setShowDisclaimer(false); };

  const handleSave = useCallback(() => {
    const entry: WellnessEntry = { mood, energy, stress, recovery, notes: notes.trim(), timestamp: new Date().toISOString() };
    try { localStorage.setItem(STORAGE_PREFIX + todayKey(), JSON.stringify(entry)); } catch { /* ignore */ }
    setHistory((prev) => ({ ...prev, [todayKey()]: entry }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }, [mood, energy, stress, recovery, notes]);

  const fetchInsight = useCallback(async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiInsight(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { setAiInsight('Sign in to unlock AI life-balance coaching. 🔐'); return; }
      const hist = Object.values(history);
      const n = hist.length;
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          type: 'balance',
          data: {
            todayMood: mood, todayEnergy: energy, todayStress: stress, todayRecovery: recovery,
            readinessScore: readiness, readinessLabel: readInfo.label, historyCount: n,
            avgMood7d: n ? hist.reduce((s, e) => s + e.mood, 0) / n : null,
            avgEnergy7d: n ? hist.reduce((s, e) => s + e.energy, 0) / n : null,
            avgStress7d: n ? hist.reduce((s, e) => s + e.stress, 0) / n : null,
            notes: notes.trim(),
          },
        }),
      });
      if (res.status === 429) { setAiInsight('Daily AI limit reached — come back tomorrow! ⏰'); return; }
      if (!res.ok) throw new Error('API error');
      const json = (await res.json()) as { insight: string };
      setAiInsight(json.insight);
    } catch {
      setAiInsight("Couldn't load insight right now — try again shortly. 🔄");
    } finally {
      setAiLoading(false);
    }
  }, [aiLoading, history, mood, energy, stress, recovery, readiness, readInfo.label, notes]);

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Link href="/settings"><Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button></Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Wellness Check-in</h1>
            <p className="text-sm text-muted-foreground">Mood · Energy · Stress · Recovery</p>
          </div>
          <Heart className="w-5 h-5 text-primary" />
        </div>

        {showDisclaimer && (
          <Card className="p-4 space-y-2 border-primary/30 bg-primary/5">
            <h3 className="font-semibold">A note before you start</h3>
            <p className="text-sm text-muted-foreground">
              This check-in is for self-reflection, not a substitute for advice from a licensed healthcare provider.
              If you're experiencing a medical emergency, call <span className="text-primary font-semibold">911</span>.
              If you're struggling with your mental health, the <span className="text-primary font-semibold">988 Suicide &amp; Crisis Lifeline</span> is available 24/7 — call or text <span className="text-primary font-semibold">988</span>.
            </p>
            <Button size="sm" onClick={dismissDisclaimer}>I understand</Button>
          </Card>
        )}

        {showCrisis && <CrisisBanner />}

        {/* Readiness */}
        <Card className="p-5 flex flex-col items-center text-center">
          <span className="text-5xl font-bold tabular-nums" style={{ color: readInfo.color }}>{readiness}</span>
          <span className="text-sm text-muted-foreground mt-1">Readiness score</span>
          <span className="mt-2 px-3 py-1 rounded-full text-sm font-semibold" style={{ color: readInfo.color, backgroundColor: readInfo.color + '1a' }}>{readInfo.label}</span>
          <p className="text-sm text-muted-foreground mt-2">{readInfo.tip}</p>
        </Card>

        {/* Scales */}
        <Card className="p-4 space-y-2"><h3 className="font-semibold text-sm">How's your mood?</h3><EmojiPicker options={MOOD_OPTS} value={mood} onChange={setMood} /></Card>
        <Card className="p-4 space-y-2"><h3 className="font-semibold text-sm">Energy level?</h3><EmojiPicker options={ENERGY_OPTS} value={energy} onChange={setEnergy} /></Card>
        <Card className="p-4 space-y-2"><h3 className="font-semibold text-sm">Stress level?</h3><EmojiPicker options={STRESS_OPTS} value={stress} onChange={setStress} /></Card>
        <Card className="p-4 space-y-2"><h3 className="font-semibold text-sm">Physical recovery?</h3><EmojiPicker options={RECOVERY_OPTS} value={recovery} onChange={setRecovery} /></Card>

        {/* Notes */}
        <Card className="p-4 space-y-2">
          <h3 className="font-semibold text-sm">Anything on your mind?</h3>
          <Textarea value={notes} onChange={(e) => handleNotesChange(e.target.value)} placeholder="Optional — jot down how you're really doing." rows={3} />
        </Card>

        <Button onClick={handleSave} className="w-full gap-2" style={{ backgroundColor: saved ? '#10b981' : undefined }}>
          {saved ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? 'Saved!' : 'Save Check-in'}
        </Button>

        {/* AI insight */}
        <Button variant="outline" onClick={fetchInsight} disabled={aiLoading} className="w-full gap-2">
          <Sparkles className="w-4 h-4 text-accent" /> {aiLoading ? 'Thinking…' : 'Ask Ovia for a balance insight'}
        </Button>
        {aiInsight && <Card className="p-4 text-sm leading-relaxed">{aiInsight}</Card>}

        {/* 7-day history */}
        <Card className="p-4 space-y-3">
          <h3 className="font-semibold text-sm">Last 7 days</h3>
          <div className="flex justify-between gap-1.5">
            {last7Days().map((d) => {
              const e = history[d.key];
              const score = e ? calcReadiness(e) : null;
              const info = score != null ? readinessLabel(score) : null;
              const isToday = d.key === todayKey();
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: info ? info.color : 'hsl(var(--muted))', color: info ? '#fff' : 'hsl(var(--muted-foreground))', border: isToday ? '2px solid hsl(var(--primary))' : 'none' }}>
                    {score ?? '–'}
                  </div>
                  <span className="text-[10px]" style={{ color: isToday ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))', fontWeight: isToday ? 700 : 400 }}>{d.label.slice(0, 3)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Persistent crisis resource */}
        <a href="tel:988" className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
          <Phone className="w-4 h-4" /> Mental health support · 988 Lifeline · 24/7
        </a>
      </div>
      <BottomNav />
    </div>
  );
}
