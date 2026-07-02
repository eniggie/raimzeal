import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronDown, Target, RotateCcw, Save, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BottomNav } from '@/components/BottomNav';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/lib/store';

interface MacroData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  auto: boolean;
  source: 'computed' | 'manual';
}

const MACRO_COLORS = {
  calories: 'bg-primary/20 text-primary border-primary/30',
  protein: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  carbs: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  fat: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
};

function computeMacrosFromProfile(user: UserProfile): { calories: number; protein: number; carbs: number; fat: number } {
  let weightKg = user.weight || 70;
  let heightCm = user.height || 170;
  const age = user.age || 25;

  if (user.units !== 'metric') {
    weightKg = weightKg * 0.453592;
    heightCm = heightCm * 2.54;
  }

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 78;

  const level = user.fitnessLevel ?? 'beginner';
  const activityMultiplier = level === 'advanced' ? 1.8 : level === 'intermediate' ? 1.6 : 1.4;

  const tdee = bmr * activityMultiplier;

  const goals = user.goals ?? [];
  const wantsLose = goals.includes('fat_loss') || goals.includes('lose_weight');
  const wantsGain = goals.includes('muscle_gain') || goals.includes('build_muscle') || goals.includes('gain_weight');
  const calorieMultiplier = wantsLose ? 0.85 : wantsGain ? 1.15 : 1.0;

  const calories = Math.round(tdee * calorieMultiplier);
  const protein = Math.round(weightKg * 2.0);
  const fat = Math.round(weightKg * 0.8);
  const carbCals = calories - protein * 4 - fat * 9;
  const carbs = Math.max(0, Math.round(carbCals / 4));

  return { calories, protein, carbs, fat };
}

interface MacroBreakdown {
  bmr: number;
  activityMultiplier: number;
  activityLabel: string;
  tdee: number;
  calorieMultiplier: number;
  adjustmentLabel: string;
  targetCalories: number;
}

function computeBreakdownFromProfile(user: UserProfile): MacroBreakdown {
  let weightKg = user.weight || 70;
  let heightCm = user.height || 170;
  const age = user.age || 25;

  if (user.units !== 'metric') {
    weightKg = weightKg * 0.453592;
    heightCm = heightCm * 2.54;
  }

  const bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 78);

  const level = user.fitnessLevel ?? 'beginner';
  const activityMultiplier = level === 'advanced' ? 1.8 : level === 'intermediate' ? 1.6 : 1.4;
  const activityLabel = level === 'advanced' ? 'Advanced' : level === 'intermediate' ? 'Intermediate' : 'Beginner';

  const tdee = Math.round(bmr * activityMultiplier);

  const goals = user.goals ?? [];
  const wantsLose = goals.includes('fat_loss') || goals.includes('lose_weight');
  const wantsGain = goals.includes('muscle_gain') || goals.includes('build_muscle') || goals.includes('gain_weight');
  const calorieMultiplier = wantsLose ? 0.85 : wantsGain ? 1.15 : 1.0;
  const adjustmentLabel = wantsLose ? 'Weight loss (−15%)' : wantsGain ? 'Muscle gain (+15%)' : 'Maintain weight';

  const targetCalories = Math.round(tdee * calorieMultiplier);

  return { bmr, activityMultiplier, activityLabel, tdee, calorieMultiplier, adjustmentLabel, targetCalories };
}

interface MacroTargetsProps {
  user?: UserProfile | null;
}

export function MacroTargets({ user }: MacroTargetsProps) {
  const { toast } = useToast();
  const [macros, setMacros] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isManual, setIsManual] = useState(false);
  const [form, setForm] = useState({ calories: '', protein: '', carbs: '', fat: '' });
  const [showBreakdown, setShowBreakdown] = useState(false);
  const hasUserEdited = useRef(false);

  useEffect(() => {
    loadMacros();
  }, []);

  async function loadMacros() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/user/macros', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json() as MacroData;
      setMacros(data);
      const manual = data.auto === false;
      setIsManual(manual);
      // In auto mode, seed from the live computed suggestion (same formula as
      // liveComputed) so the form never shows stale server values.
      // In manual mode, always show what the user explicitly saved.
      const liveValues = !manual && user ? computeMacrosFromProfile(user) : null;
      setForm({
        calories: String(liveValues?.calories ?? data.calories),
        protein: String(liveValues?.protein ?? data.protein),
        carbs: String(liveValues?.carbs ?? data.carbs),
        fat: String(liveValues?.fat ?? data.fat),
      });
    } catch {
      toast({ title: 'Could not load macro targets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const body = {
        calories: Number(form.calories),
        protein: Number(form.protein),
        carbs: Number(form.carbs),
        fat: Number(form.fat),
        auto: false,
      };
      const res = await fetch('/api/user/macros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json() as MacroData;
      setMacros(data);
      setIsManual(true);
      toast({ title: 'Macro targets saved' });
    } catch {
      toast({ title: 'Could not save targets', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch('/api/user/macros', { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } });
      setIsManual(false);
      hasUserEdited.current = false;
      await loadMacros();
      toast({ title: 'Reverted to auto-computed targets' });
    } catch {
      toast({ title: 'Could not reset', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const liveComputed = useMemo(
    () => (user ? computeMacrosFromProfile(user) : null),
    [user?.age, user?.weight, user?.height, user?.fitnessLevel, user?.units, user?.goals],
  );

  const liveBreakdown = useMemo(
    () => (user ? computeBreakdownFromProfile(user) : null),
    [user?.age, user?.weight, user?.height, user?.fitnessLevel, user?.units, user?.goals],
  );

  // Re-seed form whenever the live suggestion changes, but only when in auto mode
  // and the user hasn't started typing their own values yet.
  useEffect(() => {
    if (!liveComputed || isManual || hasUserEdited.current) return;
    setForm({
      calories: String(liveComputed.calories),
      protein: String(liveComputed.protein),
      carbs: String(liveComputed.carbs),
      fat: String(liveComputed.fat),
    });
  }, [liveComputed, isManual]);

  const displayMacros = useMemo(() => {
    if (!macros) return null;
    if (macros.source === 'manual') return macros;
    if (liveComputed) return { ...macros, ...liveComputed };
    return macros;
  }, [macros, liveComputed]);

  const macroList = displayMacros ? [
    { key: 'calories', label: 'Calories', value: displayMacros.calories, unit: 'kcal', color: MACRO_COLORS.calories },
    { key: 'protein', label: 'Protein', value: displayMacros.protein, unit: 'g', color: MACRO_COLORS.protein },
    { key: 'carbs', label: 'Carbs', value: displayMacros.carbs, unit: 'g', color: MACRO_COLORS.carbs },
    { key: 'fat', label: 'Fat', value: displayMacros.fat, unit: 'g', color: MACRO_COLORS.fat },
  ] : [];

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/settings">
            <button className="p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
              <ChevronLeft className="h-5 w-5 text-muted-foreground" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Macro Targets</h1>
            <p className="text-sm text-muted-foreground">Auto-calculated from your profile</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Current target cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {macroList.map(m => (
                <motion.div key={m.key} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                  <Card className={`p-4 border ${m.color}`}>
                    <div className="text-xs font-medium mb-1 opacity-70">{m.label}</div>
                    <div className="text-2xl font-bold">{m.value}</div>
                    <div className="text-xs opacity-60">{m.unit} / day</div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {displayMacros && (
              <Card className="p-4 mb-4 border-muted/30 bg-muted/10">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">
                    {displayMacros.source === 'computed' ? 'Suggested for you' : 'Manually set'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {displayMacros.source === 'computed'
                    ? 'Calculated from your profile using the Mifflin-St Jeor formula. Updates live as you change your profile.'
                    : 'You have manually set these targets. Reset to auto-compute from your profile.'}
                </p>

                {displayMacros.source === 'computed' && liveBreakdown && (
                  <>
                    <button
                      onClick={() => setShowBreakdown(v => !v)}
                      className="mt-3 flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showBreakdown ? 'rotate-180' : ''}`} />
                      {showBreakdown ? 'Hide' : 'Show'} how this was calculated
                    </button>

                    <AnimatePresence initial={false}>
                      {showBreakdown && (
                        <motion.div
                          key="breakdown"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 rounded-lg border border-muted/40 overflow-hidden text-xs">
                            <div className="flex justify-between items-center px-3 py-2 border-b border-muted/30">
                              <span className="text-muted-foreground">BMR (Mifflin-St Jeor)</span>
                              <span className="font-semibold tabular-nums">{liveBreakdown.bmr.toLocaleString()} kcal</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 border-b border-muted/30">
                              <span className="text-muted-foreground">Activity — {liveBreakdown.activityLabel}</span>
                              <span className="font-semibold tabular-nums">×{liveBreakdown.activityMultiplier}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 border-b border-muted/30 bg-muted/20">
                              <span className="font-medium">TDEE</span>
                              <span className="font-bold tabular-nums">{liveBreakdown.tdee.toLocaleString()} kcal</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 border-b border-muted/30">
                              <span className="text-muted-foreground">Goal — {liveBreakdown.adjustmentLabel}</span>
                              <span className="font-semibold tabular-nums">×{liveBreakdown.calorieMultiplier}</span>
                            </div>
                            <div className="flex justify-between items-center px-3 py-2 bg-primary/10">
                              <span className="font-semibold text-primary">Target calories</span>
                              <span className="font-bold text-primary tabular-nums">{liveBreakdown.targetCalories.toLocaleString()} kcal</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </Card>
            )}

            {/* Manual override form */}
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-3">Override Targets</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {(['calories', 'protein', 'carbs', 'fat'] as const).map(key => (
                  <div key={key}>
                    <Label className="text-xs capitalize mb-1">{key} {key === 'calories' ? '(kcal)' : '(g)'}</Label>
                    <Input
                      type="number"
                      value={form[key]}
                      onChange={e => {
                        hasUserEdited.current = true;
                        setForm(prev => ({ ...prev, [key]: e.target.value }));
                      }}
                      className="h-9"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save
                </Button>
                {isManual && (
                  <Button variant="outline" onClick={handleReset} disabled={saving}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Auto
                  </Button>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
