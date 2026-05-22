import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Moon, Plus, Trash2, Loader2, Star } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseConfigured } from '@/lib/supabase';

interface SleepLog {
  id: string;
  slept_at: string;
  hours: number;
  quality: number;
  notes?: string;
}

const QUALITY_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Perfect'];

export function SleepTracking() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    slept_at: new Date().toISOString().split('T')[0],
    hours: '7',
    quality: 3,
    notes: '',
  });

  const loadLogs = useCallback(async () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch('/api/user/sleep-logs?limit=30', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json() as { logs: SleepLog[] };
      setLogs(data.logs);
    } catch {
      toast({ title: 'Could not load sleep logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/user/sleep-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, hours: Number(form.hours) }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      await loadLogs();
      setShowForm(false);
      setForm({ slept_at: new Date().toISOString().split('T')[0], hours: '7', quality: 3, notes: '' });
      toast({ title: 'Sleep logged' });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(date: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/user/sleep-logs/${date}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setLogs(prev => prev.filter(l => l.slept_at !== date));
      toast({ title: 'Entry deleted' });
    } catch {
      toast({ title: 'Could not delete', variant: 'destructive' });
    }
  }

  const avgHours = logs.length ? (logs.reduce((s, l) => s + l.hours, 0) / logs.length).toFixed(1) : '—';
  const avgQuality = logs.length ? (logs.reduce((s, l) => s + l.quality, 0) / logs.length).toFixed(1) : '—';

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Sleep Tracking</h1>
              <p className="text-sm text-muted-foreground">Log your rest, improve your recovery</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowForm(v => !v)}>
            <Plus className="w-4 h-4 mr-1" /> Log
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="p-4 text-center">
            <Moon className="w-5 h-5 text-primary mx-auto mb-1" />
            <div className="text-2xl font-bold">{avgHours}h</div>
            <div className="text-xs text-muted-foreground">Avg duration</div>
          </Card>
          <Card className="p-4 text-center">
            <Star className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <div className="text-2xl font-bold">{avgQuality}/5</div>
            <div className="text-xs text-muted-foreground">Avg quality</div>
          </Card>
        </div>

        {/* Log form */}
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 mb-4 border-primary/20">
              <h3 className="font-semibold mb-3">Log Sleep</h3>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <Label className="text-xs mb-1">Date</Label>
                  <Input type="date" value={form.slept_at} onChange={e => setForm(p => ({ ...p, slept_at: e.target.value }))} className="h-9" />
                </div>
                <div>
                  <Label className="text-xs mb-1">Hours slept</Label>
                  <Input type="number" min="0" max="24" step="0.5" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="mb-3">
                <Label className="text-xs mb-2 block">Quality: {QUALITY_LABELS[form.quality]}</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(q => (
                    <button key={q} onClick={() => setForm(p => ({ ...p, quality: q }))}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${form.quality === q ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <Label className="text-xs mb-1">Notes (optional)</Label>
                <Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="How did you feel?" className="h-9" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Log list */}
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Moon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No sleep logs yet</p>
            <p className="text-sm mt-1">Tap "Log" to start tracking your rest</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Card className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Moon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{log.slept_at}</span>
                      <span className="text-xs text-muted-foreground">{log.hours}h</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: log.quality }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                      ))}
                      {Array.from({ length: 5 - log.quality }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-muted-foreground/30" />
                      ))}
                      {log.notes && <span className="text-xs text-muted-foreground ml-1 truncate">{log.notes}</span>}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(log.slept_at)} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
