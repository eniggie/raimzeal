import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  ChevronLeft, ChevronRight, Plus, Search, Scan, Utensils, 
  Beef, Wheat, Droplets, X, Camera, Loader2, CheckCircle2, AlertCircle, Minus,
  CalendarDays, Filter, Trash2
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatRing } from '@/components/StatRing';
import { cn } from '@/lib/utils';
import { quickFoods, type MealLog, type AppState } from '@/lib/store';
import { BottomNav } from '@/components/BottomNav';

// ─── Filter definitions (mirrors mobile nutrition.tsx) ────────────────────────

interface FilterDef {
  key: string;
  label: string;
  defaultThreshold: number;
  unit: string;
  direction: 'gte' | 'lte';
  nutrient: 'calories' | 'protein' | 'carbs' | 'fat';
}

const FILTER_DEFS: FilterDef[] = [
  { key: 'high_protein', label: 'High Protein', defaultThreshold: 15, unit: 'g', direction: 'gte', nutrient: 'protein' },
  { key: 'low_calorie',  label: 'Low Calorie',  defaultThreshold: 150, unit: 'kcal', direction: 'lte', nutrient: 'calories' },
  { key: 'low_fat',      label: 'Low Fat',      defaultThreshold: 5,   unit: 'g', direction: 'lte', nutrient: 'fat' },
  { key: 'low_carb',     label: 'Low Carb',     defaultThreshold: 10,  unit: 'g', direction: 'lte', nutrient: 'carbs' },
];

interface CustomFilterPreset {
  id: string;
  name: string;
  filterKeys: string[];
}

type FilterThresholds = Record<string, number>;

function getDefaultThresholds(): FilterThresholds {
  const out: FilterThresholds = {};
  for (const def of FILTER_DEFS) out[def.key] = def.defaultThreshold;
  return out;
}

const ACTIVE_FILTERS_LS_KEY  = 'raimzeal_nutrition_active_filters';
const THRESHOLDS_LS_KEY      = 'raimzeal_nutrition_filter_thresholds';
const CUSTOM_PRESETS_LS_KEY  = 'raimzeal_nutrition_custom_presets';

// Reads filter preferences from Supabase profiles.preferences
async function fetchFilterPrefs(userId: string): Promise<{
  activeFilters?: string[];
  customPresets?: CustomFilterPreset[];
  filterThresholds?: FilterThresholds;
} | null> {
  const { data } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', userId)
    .single();
  if (!data?.preferences || typeof data.preferences !== 'object') return null;
  return data.preferences as {
    activeFilters?: string[];
    customPresets?: CustomFilterPreset[];
    filterThresholds?: FilterThresholds;
  };
}

// Upserts filter preferences to Supabase profiles.preferences
async function pushFilterPrefs(userId: string, prefs: {
  activeFilters: string[];
  customPresets: CustomFilterPreset[];
  filterThresholds: FilterThresholds;
}): Promise<void> {
  await supabase
    .from('profiles')
    .upsert({ id: userId, preferences: prefs, updated_at: new Date().toISOString() });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NutritionProps {
  state: AppState;
  onAddMeal: (meal: MealLog) => void;
  onDeleteMeal: (id: string) => void;
  onUpdateWater: (glasses: number) => void;
}

export function Nutrition({ state, onAddMeal, onDeleteMeal, onUpdateWater }: NutritionProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualEntry, setManualEntry] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [dialogTab, setDialogTab] = useState<'search' | 'manual'>('search');
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [analyzedMeal, setAnalyzedMeal] = useState<{
    name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; confidence: string; notes?: string | null;
  } | null>(null);

  // ─── Filter state ───────────────────────────────────────────────────────────
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [filterThresholds, setFilterThresholds] = useState<FilterThresholds>(getDefaultThresholds);
  const [customPresets, setCustomPresets] = useState<CustomFilterPreset[]>([]);

  // Refs to break the push↔pull loop (same pattern as mobile)
  const filtersHydratedRef = useRef(false);
  const cloudSyncReadyRef  = useRef(false);
  const applyingRemoteRef  = useRef(false);
  const suppressRemoteRef  = useRef(false);
  const suppressTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load from localStorage on mount ────────────────────────────────────────
  useEffect(() => {
    try {
      const rawFilters = localStorage.getItem(ACTIVE_FILTERS_LS_KEY);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters) as unknown;
        if (Array.isArray(parsed)) {
          const validKeys = new Set(FILTER_DEFS.map(d => d.key));
          setActiveFilters(new Set((parsed as unknown[]).filter((k): k is string => typeof k === 'string' && validKeys.has(k))));
        }
      }
    } catch {}

    try {
      const rawThresholds = localStorage.getItem(THRESHOLDS_LS_KEY);
      if (rawThresholds) {
        const parsed = JSON.parse(rawThresholds) as unknown;
        if (parsed && typeof parsed === 'object') {
          const validated: FilterThresholds = {};
          for (const def of FILTER_DEFS) {
            const v = (parsed as Record<string, unknown>)[def.key];
            if (typeof v === 'number' && isFinite(v) && v >= 0) validated[def.key] = Math.round(v);
          }
          setFilterThresholds(prev => ({ ...prev, ...validated }));
        }
      }
    } catch {}

    try {
      const rawPresets = localStorage.getItem(CUSTOM_PRESETS_LS_KEY);
      if (rawPresets) {
        const parsed = JSON.parse(rawPresets) as unknown;
        if (Array.isArray(parsed)) {
          const valid = (parsed as unknown[]).filter(
            (item): item is CustomFilterPreset =>
              item !== null &&
              typeof item === 'object' &&
              typeof (item as CustomFilterPreset).id === 'string' &&
              typeof (item as CustomFilterPreset).name === 'string' &&
              Array.isArray((item as CustomFilterPreset).filterKeys)
          );
          setCustomPresets(valid);
        }
      }
    } catch {}

    filtersHydratedRef.current = true;
  }, []);

  // ── Hydrate from Supabase on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured) {
      cloudSyncReadyRef.current = true;
      return;
    }
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        cloudSyncReadyRef.current = true;
        return;
      }
      try {
        const prefs = await fetchFilterPrefs(session.user.id);
        if (!prefs) return;
        const validKeys = new Set(FILTER_DEFS.map(d => d.key));
        applyingRemoteRef.current = true;
        if (Array.isArray(prefs.activeFilters)) {
          setActiveFilters(new Set(prefs.activeFilters.filter(k => typeof k === 'string' && validKeys.has(k))));
        }
        if (Array.isArray(prefs.customPresets)) {
          const valid = prefs.customPresets.filter(
            (item): item is CustomFilterPreset =>
              item !== null &&
              typeof item === 'object' &&
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              Array.isArray(item.filterKeys)
          );
          setCustomPresets(valid);
        }
        if (prefs.filterThresholds && typeof prefs.filterThresholds === 'object') {
          const validated: FilterThresholds = {};
          for (const def of FILTER_DEFS) {
            const v = (prefs.filterThresholds as Record<string, unknown>)[def.key];
            if (typeof v === 'number' && isFinite(v) && v >= 0) validated[def.key] = Math.round(v);
          }
          setFilterThresholds(prev => ({ ...prev, ...validated }));
        }
        setTimeout(() => { applyingRemoteRef.current = false; }, 0);
      } catch {}
    }).finally(() => {
      cloudSyncReadyRef.current = true;
    });
  }, []);

  // ── Persist activeFilters to localStorage ───────────────────────────────────
  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    if (activeFilters.size === 0) {
      localStorage.removeItem(ACTIVE_FILTERS_LS_KEY);
    } else {
      localStorage.setItem(ACTIVE_FILTERS_LS_KEY, JSON.stringify(Array.from(activeFilters)));
    }
  }, [activeFilters]);

  // ── Persist thresholds + presets to localStorage ────────────────────────────
  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    localStorage.setItem(THRESHOLDS_LS_KEY, JSON.stringify(filterThresholds));
  }, [filterThresholds]);

  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    localStorage.setItem(CUSTOM_PRESETS_LS_KEY, JSON.stringify(customPresets));
  }, [customPresets]);

  // ── Push local filter changes to Supabase ───────────────────────────────────
  useEffect(() => {
    if (!filtersHydratedRef.current || !cloudSyncReadyRef.current) return;
    if (!supabaseConfigured) return;
    if (applyingRemoteRef.current) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
      suppressRemoteRef.current = true;
      suppressTimerRef.current = setTimeout(() => { suppressRemoteRef.current = false; }, 3000);
      pushFilterPrefs(session.user.id, {
        activeFilters: Array.from(activeFilters),
        customPresets,
        filterThresholds,
      }).catch(() => {});
    });
  }, [activeFilters, customPresets, filterThresholds]);

  // ── Supabase Realtime subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!supabaseConfigured) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const userId = session.user.id;
      channel = supabase
        .channel(`profiles_prefs_web:${userId}`)
        .on(
          'postgres_changes' as Parameters<ReturnType<typeof supabase.channel>['on']>[0],
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${userId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            if (suppressRemoteRef.current) return;
            const prefs = payload.new['preferences'];
            if (!prefs || typeof prefs !== 'object') return;
            const p = prefs as Record<string, unknown>;
            const validKeys = new Set(FILTER_DEFS.map(d => d.key));
            applyingRemoteRef.current = true;
            if (Array.isArray(p['activeFilters'])) {
              const restored = (p['activeFilters'] as unknown[]).filter(
                (k): k is string => typeof k === 'string' && validKeys.has(k)
              );
              setActiveFilters(new Set(restored));
            }
            if (Array.isArray(p['customPresets'])) {
              const valid = (p['customPresets'] as unknown[]).filter(
                (item): item is CustomFilterPreset =>
                  item !== null &&
                  typeof item === 'object' &&
                  typeof (item as CustomFilterPreset).id === 'string' &&
                  typeof (item as CustomFilterPreset).name === 'string' &&
                  Array.isArray((item as CustomFilterPreset).filterKeys)
              );
              setCustomPresets(valid);
            }
            if (p['filterThresholds'] && typeof p['filterThresholds'] === 'object') {
              const validated: FilterThresholds = {};
              for (const def of FILTER_DEFS) {
                const v = (p['filterThresholds'] as Record<string, unknown>)[def.key];
                if (typeof v === 'number' && isFinite(v) && v >= 0) {
                  validated[def.key] = Math.round(v);
                }
              }
              setFilterThresholds(prev => ({ ...prev, ...validated }));
            }
            setTimeout(() => { applyingRemoteRef.current = false; }, 0);
          }
        )
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel).catch(() => {});
      if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    };
  }, []);

  // ─── Toggle a filter ────────────────────────────────────────────────────────
  const toggleFilter = useCallback((key: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ─── Photo scan ─────────────────────────────────────────────────────────────
  async function handlePhotoScan(file: File) {
    setAnalyzeError('');
    setAnalyzedMeal(null);
    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch('/api/user/meal-photo/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const d = await res.json() as { name?: string; calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; confidence?: string; notes?: string | null; error?: string };
      if (!res.ok || d.error) { setAnalyzeError(d.error ?? 'Could not analyze photo.'); return; }
      setAnalyzedMeal({ name: d.name!, calories: d.calories!, protein_g: d.protein_g!, carbs_g: d.carbs_g!, fat_g: d.fat_g!, confidence: d.confidence!, notes: d.notes });
    } catch { setAnalyzeError('Could not analyze photo.'); }
    setIsAnalyzing(false);
  }

  function logAnalyzedMeal() {
    if (!analyzedMeal) return;
    const meal: MealLog = {
      id: crypto.randomUUID(),
      date: selectedDate,
      name: analyzedMeal.name,
      calories: analyzedMeal.calories,
      protein: analyzedMeal.protein_g,
      carbs: analyzedMeal.carbs_g,
      fat: analyzedMeal.fat_g,
      mealType: selectedMealType,
    };
    onAddMeal(meal);
    setAnalyzedMeal(null);
    setIsDialogOpen(false);
  }

  const today = new Date().toISOString().split('T')[0];
  const todayWater = state.waterIntake.find(w => w.date === today)?.glasses ?? 0;
  const waterGoal = 8;
  const mealsForDate = state.mealLogs.filter(m => m.date === selectedDate);
  
  const totals = mealsForDate.reduce((acc, meal) => ({
    calories: acc.calories + meal.calories,
    protein: acc.protein + meal.protein,
    carbs: acc.carbs + meal.carbs,
    fat: acc.fat + meal.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  const user = state.user;
  const goals = (() => {
    if (!user?.weight || !user?.height || !user?.age) {
      return { calories: 2200, protein: 150, carbs: 250, fat: 70 };
    }
    const weightKg = user.units === 'imperial' ? user.weight * 0.453592 : user.weight;
    const heightCm = user.units === 'imperial' ? user.height * 2.54 : user.height;
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * user.age + 5;
    const tdee = Math.round(bmr * 1.55);
    const protein = Math.round(weightKg * 2.2);
    const fat = Math.round(tdee * 0.25 / 9);
    const carbs = Math.max(Math.round((tdee - protein * 4 - fat * 9) / 4), 0);
    return { calories: tdee, protein, carbs, fat };
  })();

  // Apply active filters to the quick-food list
  const filteredFoods = quickFoods.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (activeFilters.size === 0) return true;
    return Array.from(activeFilters).every(key => {
      const def = FILTER_DEFS.find(d => d.key === key);
      if (!def) return true;
      const val: number = f[def.nutrient];
      const threshold = filterThresholds[key] ?? def.defaultThreshold;
      return def.direction === 'gte' ? val >= threshold : val <= threshold;
    });
  });

  const handleAddFood = (food: typeof quickFoods[0]) => {
    const meal: MealLog = {
      id: crypto.randomUUID(),
      date: selectedDate,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      mealType: selectedMealType,
    };
    onAddMeal(meal);
    setIsDialogOpen(false);
    setSearch('');
  };

  function handleManualEntry() {
    const cal = parseFloat(manualEntry.calories);
    const name = manualEntry.name.trim();
    if (!name || !cal) return;
    const meal: MealLog = {
      id: crypto.randomUUID(),
      date: selectedDate,
      name,
      calories: cal,
      protein: parseFloat(manualEntry.protein) || 0,
      carbs: parseFloat(manualEntry.carbs) || 0,
      fat: parseFloat(manualEntry.fat) || 0,
      mealType: selectedMealType,
    };
    onAddMeal(meal);
    setManualEntry({ name: '', calories: '', protein: '', carbs: '', fat: '' });
    setIsDialogOpen(false);
  }

  const last7DaysCalories = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    const dayMeals = state.mealLogs.filter(m => m.date === dateStr);
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      calories: dayMeals.reduce((s, m) => s + m.calories, 0),
    };
  });

  const mealsByType = {
    breakfast: mealsForDate.filter(m => m.mealType === 'breakfast'),
    lunch: mealsForDate.filter(m => m.mealType === 'lunch'),
    dinner: mealsForDate.filter(m => m.mealType === 'dinner'),
    snack: mealsForDate.filter(m => m.mealType === 'snack'),
  };

  function navigateDate(dir: -1 | 1) {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + dir);
    const next = d.toISOString().split('T')[0];
    if (next <= today) setSelectedDate(next);
  }

  return (
    <div className="min-h-screen bg-background pb-nav">
      <div className="px-4 pt-6 pb-4 space-y-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ChevronLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold font-display flex-1">Nutrition</h1>
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/50">
              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">
                {selectedDate === today ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)} disabled={selectedDate >= today}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Daily Summary</h2>
              <span className="text-sm text-muted-foreground">
                {selectedDate === today ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>

            <div className="flex justify-center mb-6">
              <StatRing value={totals.calories} max={goals.calories} size={120} strokeWidth={8}>
                <div className="text-center">
                  <div className="text-2xl font-bold">{totals.calories}</div>
                  <div className="text-xs text-muted-foreground">/ {goals.calories}</div>
                </div>
              </StatRing>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Beef className="w-4 h-4 text-destructive" />
                  <span className="text-sm font-medium">Protein</span>
                </div>
                <Progress value={(totals.protein / goals.protein) * 100} className="h-2 mb-1" />
                <span className="text-xs text-muted-foreground">{totals.protein}g / {goals.protein}g</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Wheat className="w-4 h-4 text-warning" />
                  <span className="text-sm font-medium">Carbs</span>
                </div>
                <Progress value={(totals.carbs / goals.carbs) * 100} className="h-2 mb-1" />
                <span className="text-xs text-muted-foreground">{totals.carbs}g / {goals.carbs}g</span>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Droplets className="w-4 h-4 text-secondary" />
                  <span className="text-sm font-medium">Fat</span>
                </div>
                <Progress value={(totals.fat / goals.fat) * 100} className="h-2 mb-1" />
                <span className="text-xs text-muted-foreground">{totals.fat}g / {goals.fat}g</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Water Tracking */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-cyan-400" />
                <h2 className="font-semibold">Water Intake</h2>
              </div>
              <span className="text-sm text-muted-foreground">{todayWater} / {waterGoal} glasses</span>
            </div>

            {/* Glass icons row */}
            <div className="flex items-center justify-between gap-1 mb-4">
              {Array.from({ length: waterGoal }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => onUpdateWater(i < todayWater ? i : i + 1)}
                  className="flex-1 flex flex-col items-center gap-0.5 group"
                  title={`Set to ${i + 1} glass${i + 1 > 1 ? 'es' : ''}`}
                >
                  <Droplets
                    className={cn(
                      'w-6 h-6 transition-all',
                      i < todayWater
                        ? 'text-cyan-400 scale-110'
                        : 'text-muted-foreground/30 group-hover:text-cyan-400/50'
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onUpdateWater(Math.max(0, todayWater - 1))}
                disabled={todayWater === 0}
                data-testid="button-water-minus"
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${(todayWater / waterGoal) * 100}%` }}
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onUpdateWater(Math.min(waterGoal, todayWater + 1))}
                disabled={todayWater >= waterGoal}
                data-testid="button-water-plus"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {todayWater >= waterGoal && (
              <p className="text-xs text-cyan-400 text-center mt-2 font-medium">💧 Daily goal reached! Great job!</p>
            )}
          </Card>
        </motion.div>

        {/* 7-day calorie trend chart */}
        {last7DaysCalories.some(d => d.calories > 0) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-3">7-Day Calorie Trend</h3>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={last7DaysCalories} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v} cal`, '']} />
                  <ReferenceLine y={goals.calories} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeWidth={1.5} />
                  <Bar dataKey="calories" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center mt-1">Dashed line = daily goal ({goals.calories} cal)</p>
            </Card>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2"
        >
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setDialogTab('search'); }}>
            <DialogTrigger asChild>
              <Button className="flex-1 glow-sm" data-testid="button-add-food">
                <Plus className="w-4 h-4 mr-2" />
                Add Food
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Add Food</DialogTitle>
              </DialogHeader>
              
              {/* Meal type selector */}
              <Tabs value={selectedMealType} onValueChange={(v) => setSelectedMealType(v as 'breakfast' | 'lunch' | 'dinner' | 'snack')} className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="breakfast" className="flex-1">Breakfast</TabsTrigger>
                  <TabsTrigger value="lunch" className="flex-1">Lunch</TabsTrigger>
                  <TabsTrigger value="dinner" className="flex-1">Dinner</TabsTrigger>
                  <TabsTrigger value="snack" className="flex-1">Snack</TabsTrigger>
                </TabsList>
              </Tabs>

              {/* Search vs Manual toggle */}
              <div className="flex gap-1.5 mt-3">
                {(['search', 'manual'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setDialogTab(t)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors border ${dialogTab === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border'}`}
                  >
                    {t === 'search' ? '🔍 Search / AI Scan' : '✏️ Manual Entry'}
                  </button>
                ))}
              </div>

              {dialogTab === 'manual' ? (
                <div className="mt-3 space-y-3 flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    <Input
                      placeholder="Food name *"
                      value={manualEntry.name}
                      onChange={e => setManualEntry(p => ({ ...p, name: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Calories *"
                        type="number"
                        value={manualEntry.calories}
                        onChange={e => setManualEntry(p => ({ ...p, calories: e.target.value }))}
                      />
                      <Input
                        placeholder="Protein (g)"
                        type="number"
                        value={manualEntry.protein}
                        onChange={e => setManualEntry(p => ({ ...p, protein: e.target.value }))}
                      />
                      <Input
                        placeholder="Carbs (g)"
                        type="number"
                        value={manualEntry.carbs}
                        onChange={e => setManualEntry(p => ({ ...p, carbs: e.target.value }))}
                      />
                      <Input
                        placeholder="Fat (g)"
                        type="number"
                        value={manualEntry.fat}
                        onChange={e => setManualEntry(p => ({ ...p, fat: e.target.value }))}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={handleManualEntry}
                      disabled={!manualEntry.name.trim() || !manualEntry.calories}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add to {selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)}
                    </Button>
                  </div>
                </div>
              ) : (
              <>
              {/* Photo Scan */}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { handlePhotoScan(f); e.target.value = ''; } }}
              />
              <button
                onClick={() => { setAnalyzedMeal(null); setAnalyzeError(''); photoInputRef.current?.click(); }}
                disabled={isAnalyzing}
                className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing photo…</> : <><Camera className="w-4 h-4" />Scan Food Photo (AI)</>}
              </button>
              {analyzeError && (
                <div className="flex items-center gap-2 text-xs text-destructive mt-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{analyzeError}
                </div>
              )}
              {analyzedMeal && (
                <div className="mt-2 rounded-xl bg-success/10 border border-success/20 p-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-success">
                    <CheckCircle2 className="w-4 h-4" />{analyzedMeal.name}
                    <span className="ml-auto text-xs text-muted-foreground capitalize">{analyzedMeal.confidence} confidence</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-center">
                    <div className="bg-background/60 rounded-lg py-1.5"><span className="font-bold text-foreground">{analyzedMeal.calories}</span><br />kcal</div>
                    <div className="bg-background/60 rounded-lg py-1.5"><span className="font-bold text-foreground">{analyzedMeal.protein_g}g</span><br />protein</div>
                    <div className="bg-background/60 rounded-lg py-1.5"><span className="font-bold text-foreground">{analyzedMeal.carbs_g}g</span><br />carbs</div>
                    <div className="bg-background/60 rounded-lg py-1.5"><span className="font-bold text-foreground">{analyzedMeal.fat_g}g</span><br />fat</div>
                  </div>
                  {analyzedMeal.notes && <p className="text-xs text-muted-foreground">{analyzedMeal.notes}</p>}
                  <button onClick={logAnalyzedMeal} className="w-full mt-1 rounded-lg bg-success/20 text-success text-sm font-medium py-2 hover:bg-success/30 transition-colors">
                    Log this meal →
                  </button>
                </div>
              )}

              {/* Nutrient filter chips */}
              <div className="mt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Filter by nutrient</span>
                  {activeFilters.size > 0 && (
                    <button
                      onClick={() => setActiveFilters(new Set())}
                      className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                    >
                      <X className="w-3 h-3" />Clear
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FILTER_DEFS.map(def => {
                    const active = activeFilters.has(def.key);
                    const threshold = filterThresholds[def.key] ?? def.defaultThreshold;
                    const symbol = def.direction === 'gte' ? '≥' : '≤';
                    return (
                      <button
                        key={def.key}
                        onClick={() => toggleFilter(def.key)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-muted/40 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                        )}
                        data-testid={`filter-chip-${def.key}`}
                      >
                        {def.label} {symbol}{threshold}{def.unit}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search foods..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-food"
                />
              </div>

              <div className="flex-1 overflow-y-auto mt-4 space-y-2">
                {filteredFoods.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm font-medium">
                      {activeFilters.size > 0 && !search
                        ? 'No foods match the active filters'
                        : search
                        ? `No foods match "${search}"`
                        : 'No foods available'}
                    </p>
                    <p className="text-xs mt-1">
                      {activeFilters.size > 0 ? 'Try clearing some filters or adjusting thresholds.' : 'Try a different name or clear the search.'}
                    </p>
                  </div>
                )}
                {filteredFoods.map((food, i) => (
                  <Card
                    key={i}
                    className="p-3 cursor-pointer hover:border-primary/30 glass-hover"
                    onClick={() => handleAddFood(food)}
                    data-testid={`food-${i}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{food.name}</div>
                        <div className="text-sm text-muted-foreground">
                          P: {food.protein}g · C: {food.carbs}g · F: {food.fat}g
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">{food.calories}</div>
                        <div className="text-xs text-muted-foreground">cal</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              </>
              )}
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            className="px-4"
            data-testid="button-scan"
            onClick={() => {
              setAnalyzedMeal(null);
              setAnalyzeError('');
              setIsDialogOpen(true);
              setTimeout(() => photoInputRef.current?.click(), 120);
            }}
          >
            <Scan className="w-4 h-4 mr-2" />
            Scan
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
            <div key={mealType}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold capitalize">{mealType}</h3>
                <span className="text-sm text-muted-foreground">
                  {mealsByType[mealType].reduce((sum, m) => sum + m.calories, 0)} cal
                </span>
              </div>
              {mealsByType[mealType].length > 0 ? (
                <div className="space-y-2">
                  {mealsByType[mealType].map((meal, i) => (
                    <Card key={meal.id} className="p-3" data-testid={`meal-${mealType}-${i}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Utensils className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{meal.name}</div>
                            <div className="text-xs text-muted-foreground">
                              P: {meal.protein}g · C: {meal.carbs}g · F: {meal.fat}g
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="font-medium">{meal.calories}</span>
                          <button
                            onClick={() => onDeleteMeal(meal.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                            aria-label={`Delete ${meal.name}`}
                            data-testid={`delete-meal-${mealType}-${i}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="p-3 border-dashed">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Plus className="w-4 h-4" />
                    <span>Add {mealType}</span>
                  </div>
                </Card>
              )}
            </div>
          ))}
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
