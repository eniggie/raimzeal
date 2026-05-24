import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Wind, Play, Square, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

type Phase = { name: string; duration: number; expand: boolean };
type Exercise = { id: string; name: string; tagline: string; benefit: string; phases: Phase[]; emoji: string };

const exercises: Exercise[] = [
  {
    id: 'box',
    name: 'Box Breathing',
    tagline: '4-4-4-4 rhythm — used by Navy SEALs',
    benefit: 'Reduces stress · Improves focus · Calms the nervous system',
    emoji: '📦',
    phases: [
      { name: 'Inhale', duration: 4, expand: true },
      { name: 'Hold', duration: 4, expand: true },
      { name: 'Exhale', duration: 4, expand: false },
      { name: 'Hold', duration: 4, expand: false },
    ],
  },
  {
    id: '478',
    name: '4-7-8 Breathing',
    tagline: '4s inhale · 7s hold · 8s exhale',
    benefit: 'Promotes deep sleep · Reduces anxiety · Lowers heart rate',
    emoji: '😴',
    phases: [
      { name: 'Inhale', duration: 4, expand: true },
      { name: 'Hold', duration: 7, expand: true },
      { name: 'Exhale', duration: 8, expand: false },
    ],
  },
  {
    id: 'deep',
    name: 'Deep Breathing',
    tagline: '5s in · 5s out — simple diaphragmatic breathing',
    benefit: 'Lowers blood pressure · Improves oxygen · Energises the body',
    emoji: '🌬️',
    phases: [
      { name: 'Inhale', duration: 5, expand: true },
      { name: 'Exhale', duration: 5, expand: false },
    ],
  },
  {
    id: 'energise',
    name: 'Energising Breath',
    tagline: '2s in · 1s out — short burst breathing',
    benefit: 'Boosts energy · Clears brain fog · Great before workouts',
    emoji: '⚡',
    phases: [
      { name: 'Inhale', duration: 2, expand: true },
      { name: 'Exhale', duration: 1, expand: false },
    ],
  },
];

const phaseColors: Record<string, string> = {
  Inhale: 'hsl(var(--primary))',
  Exhale: 'hsl(var(--secondary))',
  Hold: 'hsl(var(--accent))',
};

export function Breathing() {
  const [selected, setSelected] = useState<Exercise>(exercises[0]);
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [tick, setTick] = useState(0);
  const [cycles, setCycles] = useState(0);

  const currentPhase = selected.phases[phaseIdx];

  const reset = useCallback(() => {
    setRunning(false);
    setPhaseIdx(0);
    setTick(0);
    setCycles(0);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTick(t => {
        if (t + 1 >= currentPhase.duration) {
          setPhaseIdx(p => {
            const next = (p + 1) % selected.phases.length;
            if (next === 0) setCycles(c => c + 1);
            return next;
          });
          return 0;
        }
        return t + 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, currentPhase.duration, selected.phases.length]);

  useEffect(() => {
    reset();
  }, [selected, reset]);

  const progress = (tick / currentPhase.duration) * 100;
  const scale = running ? (currentPhase.expand ? 1.35 : 0.85) : 1;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-5 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Wind className="w-6 h-6 text-cyan-400" />Breathing</h1>
            <p className="text-xs text-muted-foreground">Guided exercises for calm, focus, and sleep</p>
          </div>
        </motion.div>

        {/* Exercise selector */}
        <div className="grid grid-cols-2 gap-2">
          {exercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => setSelected(ex)}
              className={cn(
                'rounded-2xl p-3 text-left transition-all border',
                selected.id === ex.id
                  ? 'border-primary/60 bg-primary/10'
                  : 'border-border bg-card hover:border-primary/30'
              )}
            >
              <span className="text-xl">{ex.emoji}</span>
              <p className="text-sm font-semibold mt-1 leading-tight">{ex.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{ex.tagline}</p>
            </button>
          ))}
        </div>

        {/* Benefit */}
        <Card className="px-4 py-2.5">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">{selected.benefit}</p>
        </Card>

        {/* Animated circle */}
        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
            {/* Outer ring progress */}
            <svg className="absolute inset-0" width="200" height="200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
              <circle
                cx="100" cy="100" r="90"
                fill="none"
                stroke={phaseColors[currentPhase.name] ?? 'hsl(var(--primary))'}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 90}`}
                strokeDashoffset={`${2 * Math.PI * 90 * (1 - progress / 100)}`}
                style={{ transform: 'rotate(-90deg)', transformOrigin: '100px 100px', transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
              />
            </svg>

            {/* Animated inner circle */}
            <motion.div
              animate={{ scale }}
              transition={{ duration: currentPhase.duration - 0.1, ease: 'easeInOut' }}
              className="w-28 h-28 rounded-full flex flex-col items-center justify-center"
              style={{ background: `radial-gradient(circle, ${phaseColors[currentPhase.name] ?? 'hsl(var(--primary))'}30, ${phaseColors[currentPhase.name] ?? 'hsl(var(--primary))'}10)`, border: `2px solid ${phaseColors[currentPhase.name] ?? 'hsl(var(--primary))'}50` }}
            >
              <AnimatePresence mode="wait">
                <motion.div key={`${phaseIdx}-${tick}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-center">
                  <p className="text-lg font-bold" style={{ color: phaseColors[currentPhase.name] }}>
                    {running ? currentPhase.name : 'Ready'}
                  </p>
                  {running && (
                    <p className="text-2xl font-bold text-foreground">{currentPhase.duration - tick}</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Phase steps */}
          <div className="flex items-center gap-2">
            {selected.phases.map((p, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div
                  className={cn('w-8 h-1.5 rounded-full transition-all', running && phaseIdx === i ? 'scale-y-150' : '')}
                  style={{ background: running && phaseIdx === i ? (phaseColors[p.name] ?? 'hsl(var(--primary))') : 'hsl(var(--border))' }}
                />
                <span className="text-xs text-muted-foreground">{p.name}</span>
              </div>
            ))}
          </div>

          {cycles > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-primary font-medium">
              🔄 {cycles} cycle{cycles !== 1 ? 's' : ''} completed
            </motion.p>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <Button
            className="flex-1 glow-sm"
            onClick={() => setRunning(r => !r)}
          >
            {running ? <><Square className="w-4 h-4 mr-2" />Pause</> : <><Play className="w-4 h-4 mr-2" />Start</>}
          </Button>
          <Button variant="outline" size="icon" onClick={reset} title="Reset">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        <p className="text-xs text-muted-foreground/50 text-center leading-relaxed px-2">
          Breathing exercises complement medical care — not a substitute. Stop if you feel dizzy or uncomfortable.
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
