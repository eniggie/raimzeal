import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, CheckCircle2, Circle, Plus, X, Pill, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BottomNav } from '@/components/BottomNav';
import { cn } from '@/lib/utils';

type Supplement = {
  id: string;
  name: string;
  emoji: string;
  benefit: string;
  dose?: string;
  custom?: boolean;
};

const DEFAULT_SUPPLEMENTS: Supplement[] = [
  { id: 'vitc', name: 'Vitamin C', emoji: '🍊', benefit: 'Immune support, collagen synthesis, antioxidant', dose: '500–1000mg daily' },
  { id: 'vitd', name: 'Vitamin D3', emoji: '☀️', benefit: 'Bone health, immunity, mood regulation', dose: '1000–2000 IU daily' },
  { id: 'omega', name: 'Omega-3 Fish Oil', emoji: '🐟', benefit: 'Heart health, brain function, anti-inflammatory', dose: '1000–3000mg EPA+DHA daily' },
  { id: 'mag', name: 'Magnesium', emoji: '⚡', benefit: 'Muscle recovery, sleep quality, stress reduction', dose: '200–400mg daily (before bed)' },
  { id: 'zinc', name: 'Zinc', emoji: '🔩', benefit: 'Immune function, testosterone, wound healing', dose: '15–30mg daily' },
  { id: 'b12', name: 'Vitamin B12', emoji: '🧠', benefit: 'Energy metabolism, nerve function, red blood cell formation', dose: '500–1000mcg daily' },
  { id: 'iron', name: 'Iron', emoji: '🩸', benefit: 'Haemoglobin production, oxygen transport, energy', dose: 'As prescribed — check levels first' },
  { id: 'folate', name: 'Folate (B9)', emoji: '🌿', benefit: 'Cell division, DNA synthesis, essential in pregnancy', dose: '400–800mcg daily' },
  { id: 'probio', name: 'Probiotics', emoji: '🦠', benefit: 'Gut health, digestion, immune regulation', dose: '10–50 billion CFU daily' },
  { id: 'creatine', name: 'Creatine Monohydrate', emoji: '💪', benefit: 'Strength, power output, muscle recovery', dose: '3–5g daily (no loading needed)' },
];

type SupLog = { [suppId: string]: { [date: string]: boolean } };

const STORAGE_KEY = 'raimzeal_supplements';
const SUPP_LIST_KEY = 'raimzeal_supp_list';

function today() { return new Date().toISOString().split('T')[0]; }

export function Supplements() {
  const [supps, setSupps] = useState<Supplement[]>(DEFAULT_SUPPLEMENTS);
  const [logs, setLogs] = useState<SupLog>({});
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [info, setInfo] = useState<Supplement | null>(null);

  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem(STORAGE_KEY);
      if (savedLogs) setLogs(JSON.parse(savedLogs) as SupLog);
      const savedList = localStorage.getItem(SUPP_LIST_KEY);
      if (savedList) {
        const custom = JSON.parse(savedList) as Supplement[];
        setSupps([...DEFAULT_SUPPLEMENTS, ...custom]);
      }
    } catch { /* ignore */ }
  }, []);

  function saveLogs(newLogs: SupLog) {
    setLogs(newLogs);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(newLogs)); } catch { /* ignore */ }
  }

  function toggle(suppId: string) {
    const t = today();
    saveLogs({ ...logs, [suppId]: { ...(logs[suppId] ?? {}), [t]: !(logs[suppId]?.[t] ?? false) } });
  }

  function addSupp() {
    const name = newName.trim();
    if (!name) return;
    const newSupp: Supplement = { id: `custom-${Date.now()}`, name, emoji: '💊', benefit: 'Custom supplement', custom: true };
    const custom = supps.filter(s => s.custom);
    const updated = [...DEFAULT_SUPPLEMENTS, ...custom, newSupp];
    setSupps(updated);
    try { localStorage.setItem(SUPP_LIST_KEY, JSON.stringify([...custom, newSupp])); } catch { /* ignore */ }
    setNewName('');
    setShowAdd(false);
  }

  function removeSupp(id: string) {
    const updated = supps.filter(s => s.id !== id);
    setSupps(updated);
    try { localStorage.setItem(SUPP_LIST_KEY, JSON.stringify(updated.filter(s => s.custom))); } catch { /* ignore */ }
  }

  const t = today();
  const takenToday = supps.filter(s => logs[s.id]?.[t]).length;

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-4 max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <Link href="/settings">
            <Button variant="ghost" size="icon"><ChevronLeft className="w-6 h-6" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display flex items-center gap-2"><Pill className="w-6 h-6 text-purple-400" />Supplements</h1>
            <p className="text-xs text-muted-foreground">Track your daily vitamins and supplements</p>
          </div>
        </motion.div>

        {/* Summary */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Taken today</p>
              <p className="text-3xl font-bold">{takenToday} <span className="text-sm text-muted-foreground font-normal">/ {supps.length}</span></p>
            </div>
            <div className="flex gap-1">
              {supps.slice(0, 10).map(s => (
                <div
                  key={s.id}
                  className={cn('w-2 h-8 rounded-full transition-all', logs[s.id]?.[t] ? 'bg-primary' : 'bg-border')}
                  title={s.name}
                />
              ))}
            </div>
          </div>
          {takenToday === supps.length && supps.length > 0 && (
            <p className="text-xs text-primary font-medium mt-2">✅ All supplements logged for today!</p>
          )}
        </Card>

        {/* Supplement list */}
        <div className="space-y-2">
          {supps.map((supp, i) => {
            const done = logs[supp.id]?.[t] ?? false;
            return (
              <motion.div key={supp.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                <Card className={cn('p-3 transition-all', done && 'border-primary/30 bg-primary/5')}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggle(supp.id)} className="shrink-0">
                      {done
                        ? <CheckCircle2 className="w-6 h-6 text-primary" />
                        : <Circle className="w-6 h-6 text-muted-foreground/40" />}
                    </button>
                    <span className="text-xl shrink-0">{supp.emoji}</span>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(supp.id)}>
                      <p className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>{supp.name}</p>
                      {supp.dose && <p className="text-xs text-muted-foreground">{supp.dose}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!supp.custom && (
                        <button onClick={() => setInfo(supp)} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {supp.custom && (
                        <button onClick={() => removeSupp(supp.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Add custom */}
        <AnimatePresence>
          {showAdd ? (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex gap-2">
              <Input placeholder="e.g. CoQ10, Ashwagandha…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSupp()} autoFocus className="flex-1" />
              <Button onClick={addSupp} disabled={!newName.trim()}>Add</Button>
              <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}><X className="w-4 h-4" /></Button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
                <Plus className="w-4 h-4 mr-2" />Add Custom Supplement
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-xs text-amber-400 font-semibold mb-1">⚠️ Important Disclaimer</p>
          <p className="text-xs text-muted-foreground leading-relaxed">Always consult a doctor or pharmacist before starting any supplement. Some supplements interact with medications or medical conditions. RAIMZEAL is for awareness only — not medical advice.</p>
        </div>
      </div>

      {/* Info dialog */}
      <Dialog open={!!info} onOpenChange={() => setInfo(null)}>
        <DialogContent>
          {info && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{info.emoji} {info.name}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground leading-relaxed">{info.benefit}</p>
              {info.dose && (
                <div className="rounded-xl bg-primary/10 p-3">
                  <p className="text-xs text-primary font-semibold mb-1">💡 Suggested Dose</p>
                  <p className="text-xs text-muted-foreground">{info.dose}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Consult your doctor for personalised dosage based on your blood tests and health status.</p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
