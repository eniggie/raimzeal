import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'wouter';
import { 
  ChevronLeft, ChevronRight, Plus, Search, Scan, Utensils, 
  Beef, Wheat, Droplets, X, Camera, Loader2, CheckCircle2, AlertCircle, Minus,
  CalendarDays, Filter, Trash2, Bookmark, BookmarkCheck, GripVertical, Pencil
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
  /** Threshold snapshot captured at save time, keyed by filterKey. */
  thresholds?: Record<string, number>;
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
  onUpdateWater: (glasses: number) => void;
  onRemoveMealLogOptimistic: (id: string) => void;
  onRestoreMealLog: (meal: MealLog) => void;
  onConfirmMealRemoval: (id: string) => void;
}

interface PendingMealDelete {
  meal: MealLog;
  timerId: ReturnType<typeof setTimeout>;
}

export function Nutrition({ state, onAddMeal, onUpdateWater, onRemoveMealLogOptimistic, onRestoreMealLog, onConfirmMealRemoval }: NutritionProps) {
  const [pendingMealDelete, setPendingMealDelete] = useState<PendingMealDelete | null>(null);
  const pendingMealDeleteRef = useRef<PendingMealDelete | null>(null);
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
  const [dragPresetId, setDragPresetId] = useState<string | null>(null);
  const [dragOverPresetId, setDragOverPresetId] = useState<string | null>(null);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

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
    try {
      if (activeFilters.size === 0) {
        localStorage.removeItem(ACTIVE_FILTERS_LS_KEY);
      } else {
        localStorage.setItem(ACTIVE_FILTERS_LS_KEY, JSON.stringify(Array.from(activeFilters)));
      }
    } catch { /* storage blocked or full — non-fatal */ }
  }, [activeFilters]);

  // ── Persist thresholds + presets to localStorage ────────────────────────────
  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    try { localStorage.setItem(THRESHOLDS_LS_KEY, JSON.stringify(filterThresholds)); } catch { /* non-fatal */ }
  }, [filterThresholds]);

  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    try { localStorage.setItem(CUSTOM_PRESETS_LS_KEY, JSON.stringify(customPresets)); } catch { /* non-fatal */ }
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

  // ── Cross-tab filter sync ─────────────────────────────────────────────────────
  // Primary: BroadcastChannel (all modern browsers).
  // Fallback: localStorage + "storage" event (older Safari / mobile WebKit).
  // The "storage" event only fires in *other* tabs, so there is no echo loop.
  const LS_FILTER_SYNC_KEY = 'raimzeal_filter_sync_v1';

  // Shared helper — applies a validated filter payload received from another tab.
  // Must only be called after checking suppressRemoteRef.
  function applyFilterPayload(p: Record<string, unknown>) {
    if (!p || typeof p !== 'object') return;
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

  // ── Broadcast: send local filter changes to other tabs ───────────────────────
  useEffect(() => {
    if (!filtersHydratedRef.current || !cloudSyncReadyRef.current) return;
    if (supabaseConfigured) return;
    if (applyingRemoteRef.current) return;
    const payload = {
      activeFilters: Array.from(activeFilters),
      customPresets,
      filterThresholds,
    };
    let usedBroadcastChannel = false;
    try {
      const bc = new BroadcastChannel('raimzeal_filters');
      bc.postMessage(payload);
      bc.close();
      usedBroadcastChannel = true;
    } catch { /* BroadcastChannel not supported */ }
    if (!usedBroadcastChannel) {
      // localStorage fallback: writing a new value triggers the "storage" event
      // in every other tab that has the listener registered below.
      try {
        localStorage.setItem(LS_FILTER_SYNC_KEY, JSON.stringify(payload));
      } catch { /* non-fatal — e.g. private-browsing quota exceeded */ }
    }
  }, [activeFilters, customPresets, filterThresholds]);

  // ── Receive: apply filter changes arriving from other tabs ───────────────────
  useEffect(() => {
    if (supabaseConfigured) return;
    let bc: BroadcastChannel | null = null;
    let usedBroadcastChannel = false;
    try {
      bc = new BroadcastChannel('raimzeal_filters');
      bc.onmessage = (event: MessageEvent) => {
        if (suppressRemoteRef.current) return;
        applyFilterPayload(event.data as Record<string, unknown>);
      };
      usedBroadcastChannel = true;
    } catch { /* BroadcastChannel not supported */ }

    // "storage" event fires only in tabs that did NOT write the key, making it
    // a perfect cross-tab signal with no echo. Attach when BroadcastChannel is
    // unavailable (older Safari on iOS, some embedded WebViews).
    function handleStorage(e: StorageEvent) {
      if (e.key !== LS_FILTER_SYNC_KEY || !e.newValue) return;
      if (suppressRemoteRef.current) return;
      try {
        applyFilterPayload(JSON.parse(e.newValue) as Record<string, unknown>);
      } catch { /* non-fatal — malformed JSON */ }
    }

    if (!usedBroadcastChannel) {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      try { bc?.close(); } catch { /* non-fatal */ }
      if (!usedBroadcastChannel) {
        window.removeEventListener('storage', handleStorage);
      }
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

  function openThresholdEdit(key: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (editingFilter === key) {
      setEditingFilter(null);
      return;
    }
    const def = FILTER_DEFS.find(d => d.key === key);
    const current = filterThresholds[key] ?? def?.defaultThreshold ?? 0;
    setEditingFilter(key);
    setEditingValue(String(current));
  }

  function closeThresholdEdit() {
    setEditingFilter(null);
  }

  function adjustThreshold(delta: number) {
    const parsed = parseInt(editingValue, 10) || 0;
    setEditingValue(String(Math.max(0, parsed + delta)));
  }

  function saveThreshold() {
    if (!editingFilter) return;
    const parsed = parseInt(editingValue, 10);
    if (isNaN(parsed) || parsed < 0) return;
    setFilterThresholds(prev => ({ ...prev, [editingFilter]: parsed }));
    setEditingFilter(null);
  }

  function resetThreshold(key: string) {
    const def = FILTER_DEFS.find(d => d.key === key);
    if (!def) return;
    setFilterThresholds(prev => ({ ...prev, [key]: def.defaultThreshold }));
    if (editingFilter === key) setEditingFilter(null);
  }

  // ─── Custom presets ──────────────────────────────────────────────────────────
  function savePreset() {
    const name = presetName.trim();
    if (!name || activeFilters.size === 0) return;
    // Snapshot the current threshold for every filter in this preset so the
    // tooltip can show the saved values, not the current global thresholds.
    const snapshotThresholds: Record<string, number> = {};
    for (const key of activeFilters) {
      const def = FILTER_DEFS.find(d => d.key === key);
      snapshotThresholds[key] = filterThresholds[key] ?? def?.defaultThreshold ?? 0;
    }
    const preset: CustomFilterPreset = {
      id: crypto.randomUUID(),
      name,
      filterKeys: Array.from(activeFilters),
      thresholds: snapshotThresholds,
    };
    setCustomPresets(prev => [...prev, preset]);
    setPresetName('');
    setIsSavingPreset(false);
  }

  function deletePreset(id: string) {
    setCustomPresets(prev => prev.filter(p => p.id !== id));
  }

  function startRename(preset: CustomFilterPreset) {
    setRenamingPresetId(preset.id);
    setRenameValue(preset.name);
  }

  function commitRename(id: string) {
    const trimmed = renameValue.trim();
    if (trimmed) {
      setCustomPresets(prev => prev.map(p => p.id === id ? { ...p, name: trimmed } : p));
    }
    setRenamingPresetId(null);
  }

  function cancelRename() {
    setRenamingPresetId(null);
  }

  function applyPreset(preset: CustomFilterPreset) {
    const validKeys = new Set(FILTER_DEFS.map(d => d.key));
    setActiveFilters(new Set(preset.filterKeys.filter(k => validKeys.has(k))));
  }

  // Keep ref in sync so unmount cleanup can access latest pending state
  useEffect(() => {
    pendingMealDeleteRef.current = pendingMealDelete;
  }, [pendingMealDelete]);

  // Cancel any pending delete timer on unmount (commit the deletion)
  useEffect(() => {
    return () => {
      const pending = pendingMealDeleteRef.current;
      if (pending) {
        clearTimeout(pending.timerId);
        onConfirmMealRemoval(pending.meal.id);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Undo-delete (meal) ──────────────────────────────────────────────────────
  function handleDeleteMeal(id: string) {
    const meal = state.mealLogs.find(m => m.id === id);
    if (!meal) return;

    // If there's already a pending delete, commit it immediately before starting the new one
    if (pendingMealDeleteRef.current) {
      clearTimeout(pendingMealDeleteRef.current.timerId);
      onConfirmMealRemoval(pendingMealDeleteRef.current.meal.id);
    }

    onRemoveMealLogOptimistic(id);

    const timerId = setTimeout(() => {
      onConfirmMealRemoval(id);
      setPendingMealDelete(null);
    }, 5000);

    setPendingMealDelete({ meal, timerId });
  }

  function handleUndoMealDelete() {
    if (!pendingMealDeleteRef.current) return;
    clearTimeout(pendingMealDeleteRef.current.timerId);
    onRestoreMealLog(pendingMealDeleteRef.current.meal);
    setPendingMealDelete(null);
  }

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
    finally { setIsAnalyzing(false); }
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

  // Use local calendar date so the boundary never flips at midnight UTC for
  // users in UTC+ timezones (e.g. a user at UTC+5 at 10 pm sees their own "today").
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const todayWater = (state.waterIntake ?? []).find(w => w.date === today)?.glasses ?? 0;
  const waterGoal = 8;
  const mealsForDate = (state.mealLogs ?? []).filter(m => m.date === selectedDate);
  
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
    // Gender-neutral Mifflin-St Jeor: average of +5 (male) and -161 (female) → -78
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * user.age - 78;
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
    const dayMeals = (state.mealLogs ?? []).filter(m => m.date === dateStr);
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
                {/* Saved preset chips */}
                {customPresets.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <BookmarkCheck className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground">Saved presets</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {customPresets.map(preset => {
                        const isActive = preset.filterKeys.length > 0 &&
                          preset.filterKeys.every(k => activeFilters.has(k)) &&
                          activeFilters.size === preset.filterKeys.length;
                        const isDragging = dragPresetId === preset.id;
                        const isDragOver = dragOverPresetId === preset.id && !isDragging;
                        const isRenaming = renamingPresetId === preset.id;
                        return (
                          <div
                            key={preset.id}
                            draggable={!isRenaming}
                            onDragStart={() => { if (!isRenaming) setDragPresetId(preset.id); }}
                            onDragOver={(e) => { e.preventDefault(); if (!isRenaming) setDragOverPresetId(preset.id); }}
                            onDragLeave={() => setDragOverPresetId(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (dragPresetId && dragPresetId !== preset.id) {
                                setCustomPresets(prev => {
                                  const next = [...prev];
                                  const fromIdx = next.findIndex(p => p.id === dragPresetId);
                                  const toIdx = next.findIndex(p => p.id === preset.id);
                                  if (fromIdx === -1 || toIdx === -1) return prev;
                                  const [removed] = next.splice(fromIdx, 1);
                                  next.splice(toIdx, 0, removed);
                                  return next;
                                });
                              }
                              setDragPresetId(null);
                              setDragOverPresetId(null);
                            }}
                            onDragEnd={() => { setDragPresetId(null); setDragOverPresetId(null); }}
                            className={cn(
                              'relative group flex items-center gap-0.5 rounded-full border text-xs font-medium transition-all select-none',
                              isRenaming
                                ? 'cursor-text ring-2 ring-primary/60 border-primary/50 bg-background'
                                : 'cursor-grab active:cursor-grabbing',
                              !isRenaming && (isActive
                                ? 'bg-primary/15 text-primary border-primary/40'
                                : 'bg-muted/30 text-muted-foreground border-border hover:border-primary/30'),
                              isDragging && 'opacity-40 scale-95',
                              isDragOver && 'ring-2 ring-primary/50 border-primary/50'
                            )}
                            data-testid={`preset-chip-${preset.id}`}
                          >
                            {!isRenaming && (
                              <span
                                className="pl-2 pr-0.5 py-1 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                                aria-hidden
                              >
                                <GripVertical className="w-3 h-3" />
                              </span>
                            )}
                            {isRenaming ? (
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.preventDefault(); commitRename(preset.id); }
                                  if (e.key === 'Escape') cancelRename();
                                }}
                                onBlur={() => commitRename(preset.id)}
                                className="px-2 py-1 w-28 bg-transparent text-foreground text-xs outline-none"
                                aria-label="Rename preset"
                              />
                            ) : (
                              <button
                                onClick={() => applyPreset(preset)}
                                onDoubleClick={(e) => { e.preventDefault(); startRename(preset); }}
                                className="px-1.5 py-1 hover:opacity-80 transition-opacity"
                              >
                                {preset.name}
                              </button>
                            )}
                            {!isRenaming && (
                              <button
                                onClick={() => startRename(preset)}
                                className="pl-0.5 py-1 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                aria-label={`Rename preset ${preset.name}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => { if (isRenaming) cancelRename(); else deletePreset(preset.id); }}
                              className={cn(
                                'pr-2 pl-0.5 py-1 transition-colors rounded-r-full',
                                isRenaming
                                  ? 'text-muted-foreground hover:text-foreground'
                                  : 'hover:text-destructive'
                              )}
                              aria-label={isRenaming ? 'Cancel rename' : `Delete preset ${preset.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {/* Hover popover — lists each filter + its saved threshold; hidden while renaming */}
                            {!isRenaming && <div
                              role="tooltip"
                              className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 hidden group-hover:block group-focus-within:block"
                            >
                              <div className="rounded-lg border bg-popover px-2.5 py-2 shadow-md text-popover-foreground min-w-max">
                                {preset.filterKeys.length === 0 ? (
                                  <span className="text-muted-foreground italic">No filters</span>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {preset.filterKeys.map(key => {
                                      const def = FILTER_DEFS.find(d => d.key === key);
                                      if (!def) return null;
                                      // Use the threshold snapshotted at save time; fall back to
                                      // the default for presets saved before this field existed.
                                      const threshold = preset.thresholds?.[key] ?? def.defaultThreshold;
                                      const symbol = def.direction === 'gte' ? '≥' : '≤';
                                      return (
                                        <li key={key} className="flex items-center gap-1.5 text-xs">
                                          <span className="font-medium">{def.label}</span>
                                          <span className="text-muted-foreground">{symbol}{threshold}{def.unit}</span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                )}
                              </div>
                            </div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    const isEditing = editingFilter === def.key;
                    const isNonDefault = threshold !== def.defaultThreshold;
                    return (
                      <div
                        key={def.key}
                        className={cn(
                          'flex items-center rounded-full border text-xs font-medium transition-all overflow-hidden',
                          active
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-muted/40 text-muted-foreground border-border'
                        )}
                        data-testid={`filter-chip-${def.key}`}
                      >
                        <button
                          onClick={() => toggleFilter(def.key)}
                          className="pl-2.5 pr-1.5 py-1 hover:opacity-80 transition-opacity"
                        >
                          {def.label}
                        </button>
                        <button
                          onClick={(e) => openThresholdEdit(def.key, e)}
                          title="Adjust threshold"
                          className={cn(
                            'pr-2.5 pl-1 py-1 rounded-r-full transition-all',
                            isEditing
                              ? 'bg-white/20 underline underline-offset-2'
                              : 'hover:bg-white/10 opacity-80 hover:opacity-100'
                          )}
                        >
                          {isNonDefault && (
                            <span
                              className={cn(
                                'inline-block w-1.5 h-1.5 rounded-full mr-0.5 align-middle',
                                active ? 'bg-primary-foreground/70' : 'bg-amber-400'
                              )}
                            />
                          )}
                          {symbol}{threshold}{def.unit}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Inline threshold editor */}
                {editingFilter && (() => {
                  const def = FILTER_DEFS.find(d => d.key === editingFilter);
                  if (!def) return null;
                  const symbol = def.direction === 'gte' ? '≥' : '≤';
                  const isDefault = (filterThresholds[def.key] ?? def.defaultThreshold) === def.defaultThreshold;
                  return (
                    <div className="mt-2 flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm animate-in fade-in slide-in-from-top-1 duration-150">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        {def.label} {symbol}
                      </span>
                      <button
                        onClick={() => adjustThreshold(-1)}
                        className="w-6 h-6 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
                        aria-label="Decrease"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveThreshold(); if (e.key === 'Escape') closeThresholdEdit(); }}
                        className="w-16 text-center text-sm font-semibold bg-background border border-border rounded-lg py-0.5 focus:outline-none focus:border-primary transition-colors"
                        autoFocus
                      />
                      <button
                        onClick={() => adjustThreshold(1)}
                        className="w-6 h-6 rounded-full border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors shrink-0"
                        aria-label="Increase"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-xs text-muted-foreground shrink-0">{def.unit}</span>
                      <button
                        onClick={saveThreshold}
                        className="ml-auto px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0"
                      >
                        Set
                      </button>
                      {!isDefault && (
                        <button
                          onClick={() => resetThreshold(def.key)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          title="Reset to default"
                        >
                          Reset
                        </button>
                      )}
                      <button
                        onClick={closeThresholdEdit}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()}

                {/* Save as preset */}
                {activeFilters.size > 0 && !isSavingPreset && (
                  <button
                    onClick={() => { setIsSavingPreset(true); setPresetName(''); }}
                    className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    data-testid="button-save-preset"
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    Save as preset
                  </button>
                )}
                {isSavingPreset && (
                  <div className="mt-2 flex items-center gap-2 bg-muted/50 border border-border rounded-xl px-3 py-2 animate-in fade-in slide-in-from-top-1 duration-150">
                    <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
                    <input
                      type="text"
                      placeholder="Preset name…"
                      value={presetName}
                      onChange={e => setPresetName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') savePreset(); if (e.key === 'Escape') setIsSavingPreset(false); }}
                      className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1 focus:outline-none focus:border-primary transition-colors"
                      autoFocus
                      maxLength={40}
                    />
                    <button
                      onClick={savePreset}
                      disabled={!presetName.trim()}
                      className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsSavingPreset(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      aria-label="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
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
                            onClick={() => handleDeleteMeal(meal.id)}
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

      {/* Undo toast */}
      {pendingMealDelete && (
        <motion.div
          key={pendingMealDelete.meal.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-foreground text-background shadow-lg px-4 py-3 max-w-xs w-[calc(100%-2rem)]"
          role="status"
          aria-live="polite"
        >
          <span className="text-sm flex-1 truncate">
            <span className="font-medium">Meal removed</span>
          </span>
          <button
            onClick={handleUndoMealDelete}
            className="text-sm font-semibold shrink-0 text-primary-foreground underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Undo
          </button>
        </motion.div>
      )}
    </div>
  );
}
