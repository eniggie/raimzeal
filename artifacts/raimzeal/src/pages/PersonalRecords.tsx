import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Trophy, Plus, Trash2, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { supabase, supabaseConfigured } from '@/lib/supabase';

interface PR {
  id: string;
  exercise_name: string;
  value_type: 'weight' | 'reps' | 'time';
  value: number;
  achieved_at: string;
}

const VALUE_TYPE_LABELS = { weight: 'kg', reps: 'reps', time: 'sec' };

export function PersonalRecords() {
  const { toast } = useToast();
  const [records, setRecords] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ exercise_name: '', value_type: 'weight' as PR['value_type'], value: '', achieved_at: new Date().toISOString().split('T')[0] });

  const loadRecords = useCallback(async () => {
    if (!supabaseConfigured) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch('/api/user/personal-records', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { records: PR[] };
      setRecords(data.records);
    } catch {
      toast({ title: 'Could not load records', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  async function handleSave() {
    if (!form.exercise_name.trim() || !form.value) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/user/personal-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, value: Number(form.value), achieved_at: new Date(form.achieved_at).toISOString() }),
      });
      if (!res.ok) throw new Error('Failed');
      await loadRecords();
      setShowForm(false);
      setForm({ exercise_name: '', value_type: 'weight', value: '', achieved_at: new Date().toISOString().split('T')[0] });
      toast({ title: 'Personal record saved 🏆' });
    } catch {
      toast({ title: 'Could not save record', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/user/personal-records/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
      setRecords(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Record deleted' });
    } catch {
      toast({ title: 'Could not delete', variant: 'destructive' });
    }
  }

  // Group by exercise
  const grouped = records.reduce<Record<string, PR[]>>((acc, r) => {
    (acc[r.exercise_name] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Personal Records</h1>
              <p className="text-sm text-muted-foreground">{records.length} record{records.length !== 1 ? 's' : ''} logged</p>
            </div>
          </div>
          <Button size="sm" onClick={() => setShowForm(v => !v)}>
            <Plus className="w-4 h-4 mr-1" /> Add PR
          </Button>
        </div>

        {showForm && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4 mb-4 border-primary/20">
              <h3 className="font-semibold mb-3">Log a Personal Record</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <Label className="text-xs mb-1">Exercise name</Label>
                  <Input value={form.exercise_name} onChange={e => setForm(p => ({ ...p, exercise_name: e.target.value }))} placeholder="e.g. Bench Press" className="h-9" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1">Type</Label>
                    <select
                      value={form.value_type}
                      onChange={e => setForm(p => ({ ...p, value_type: e.target.value as PR['value_type'] }))}
                      className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="weight">Weight (kg)</option>
                      <option value="reps">Reps</option>
                      <option value="time">Time (sec)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Value</Label>
                    <Input type="number" value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))} className="h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1">Date achieved</Label>
                  <Input type="date" value={form.achieved_at} onChange={e => setForm(p => ({ ...p, achieved_at: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || !form.exercise_name.trim() || !form.value} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Save PR
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </Card>
          </motion.div>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No personal records yet</p>
            <p className="text-sm mt-1">Log your first PR and track your progress over time</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([exercise, prs]) => (
              <motion.div key={exercise} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 px-1">{exercise}</h3>
                <div className="space-y-2">
                  {prs.map(pr => (
                    <Card key={pr.id} className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-bold">{pr.value} <span className="font-normal text-muted-foreground text-xs">{VALUE_TYPE_LABELS[pr.value_type]}</span></div>
                        <div className="text-xs text-muted-foreground">{new Date(pr.achieved_at).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => handleDelete(pr.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </Card>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
