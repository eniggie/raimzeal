import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Plus, Trash2, Dumbbell, Save, Loader2, Clock, Check } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface DBExercise {
  id: string;
  name: string;
  muscle_group: string;
}

interface WorkoutExercise {
  exercise_name: string;
  sets: number;
  reps?: number;
  duration_sec?: number;
  weight_kg?: number;
  notes?: string;
  sort_order: number;
}

export function WorkoutCreator() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [exercises, setExercises] = useState<DBExercise[]>([]);
  const [workoutName, setWorkoutName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMin, setEstimatedMin] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [exercisesError, setExercisesError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/exercises')
      .then(r => r.json())
      .then((d: { exercises: DBExercise[] }) => setExercises(d.exercises))
      .catch(() => setExercisesError(true));
  }, []);

  function addExercise(ex: DBExercise) {
    setWorkoutExercises(prev => [
      ...prev,
      { exercise_name: ex.name, sets: 3, reps: 10, sort_order: prev.length },
    ]);
    setShowExercisePicker(false);
    setSearch('');
  }

  function removeExercise(i: number) {
    setWorkoutExercises(prev => prev.filter((_, idx) => idx !== i).map((e, idx) => ({ ...e, sort_order: idx })));
  }

  function updateExercise(i: number, key: keyof WorkoutExercise, value: string | number) {
    setWorkoutExercises(prev => prev.map((ex, idx) => idx === i ? { ...ex, [key]: value } : ex));
  }

  async function handleSave() {
    if (!workoutName.trim()) { toast({ title: 'Please give your workout a name', variant: 'destructive' }); return; }
    if (!workoutExercises.length) { toast({ title: 'Add at least one exercise', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: 'Please sign in', variant: 'destructive' }); return; }
      const res = await fetch('/api/user/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          name: workoutName,
          description: description || null,
          estimated_duration_min: estimatedMin ? Number(estimatedMin) : null,
          exercises: workoutExercises,
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }
      setSaved(true);
      toast({ title: 'Workout saved!' });
      setTimeout(() => navigate('/workouts'), 1500);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Could not save workout', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const filteredExercises = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.muscle_group.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/workouts">
              <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                <ChevronLeft className="h-5 w-5 text-muted-foreground" />
              </button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Create Workout</h1>
              <p className="text-sm text-muted-foreground">Build your own routine</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving || saved} size="sm">
            {saved ? <Check className="w-4 h-4 mr-1" /> : saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            {saved ? 'Saved' : 'Save'}
          </Button>
        </div>

        {/* Workout details */}
        <Card className="p-4 mb-4 space-y-3">
          <div>
            <Label className="text-xs mb-1">Workout name *</Label>
            <Input value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="e.g. Monday Push Day" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1">Description (optional)</Label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief notes…" />
            </div>
            <div>
              <Label className="text-xs mb-1">Est. duration (min)</Label>
              <Input type="number" value={estimatedMin} onChange={e => setEstimatedMin(e.target.value)} placeholder="45" />
            </div>
          </div>
        </Card>

        {/* Exercise list */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold">Exercises ({workoutExercises.length})</span>
          <Button size="sm" variant="outline" onClick={() => setShowExercisePicker(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Exercise
          </Button>
        </div>

        <AnimatePresence>
          {workoutExercises.map((ex, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <Card className="p-4 mb-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <span className="font-medium text-sm">{ex.exercise_name}</span>
                  </div>
                  <button onClick={() => removeExercise(i)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs mb-1">Sets</Label>
                    <Input type="number" value={ex.sets} onChange={e => updateExercise(i, 'sets', Number(e.target.value))} className="h-8 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Reps</Label>
                    <Input type="number" value={ex.reps ?? ''} onChange={e => updateExercise(i, 'reps', Number(e.target.value))} className="h-8 text-sm" placeholder="—" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1">Weight (kg)</Label>
                    <Input type="number" value={ex.weight_kg ?? ''} onChange={e => updateExercise(i, 'weight_kg', Number(e.target.value))} className="h-8 text-sm" placeholder="BW" />
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>

        {workoutExercises.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No exercises yet</p>
            <p className="text-sm mt-1">Tap "Add Exercise" to build your routine</p>
          </div>
        )}

        {estimatedMin && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <Clock className="w-3 h-3" />
            Estimated: {estimatedMin} minutes
          </div>
        )}
      </div>

      {/* Exercise picker modal */}
      <AnimatePresence>
        {showExercisePicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-end"
            onClick={e => { if (e.target === e.currentTarget) setShowExercisePicker(false); }}
          >
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30 }}
              className="w-full bg-background rounded-t-2xl p-4 max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">Pick an Exercise</h3>
                <button onClick={() => setShowExercisePicker(false)} className="text-muted-foreground hover:text-foreground text-sm">Close</button>
              </div>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or muscle…" className="mb-3" />
              <div className="overflow-y-auto flex-1 space-y-1">
                {exercisesError && (
                  <p className="text-center text-destructive text-sm py-6">
                    Could not load exercises. Please check your connection and try again.
                  </p>
                )}
                {!exercisesError && filteredExercises.map(ex => (
                  <button key={ex.id} onClick={() => addExercise(ex)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/40 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{ex.name}</div>
                      <div className="text-xs text-muted-foreground">{ex.muscle_group}</div>
                    </div>
                  </button>
                ))}
                {!exercisesError && filteredExercises.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">No exercises match your search</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
