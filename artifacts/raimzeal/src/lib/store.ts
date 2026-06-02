import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  appDataApi,
  workoutLogsApi,
  mealLogsApi,
  bodyMeasurementsApi,
  waterIntakeApi,
  scheduledWorkoutsApi,
  userProfileApi,
  type ApiAppData,
} from './apiClient';
import { supabaseConfigured } from './supabase';

const STORAGE_KEY_BASE = 'raimzeal_data';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  age: number;
  height: number;
  weight: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  goals: string[];
  units: 'imperial' | 'metric';
  createdAt: string;
  /** ABO blood group */
  bloodType?: 'A' | 'B' | 'AB' | 'O';
  /** Rhesus factor */
  rhFactor?: '+' | '-';
  /** Haemoglobin genotype (sickle-cell locus) */
  genotype?: 'AA' | 'AS' | 'AC' | 'SS' | 'SC';
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  workoutName: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  exercises: { name: string; sets: number; reps: number; weight?: number }[];
  notes?: string;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  weight: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
}

export interface MealLog {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface ScheduledWorkout {
  id: string;
  workoutId: string;
  workoutName: string;
  date: string;
  completed: boolean;
}

export interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  content: string;
  likes: number;
  comments: { id: string; userName: string; content: string; createdAt: string }[];
  createdAt: string;
  liked: boolean;
}

export interface AppState {
  isOnboarded: boolean;
  user: UserProfile | null;
  workoutLogs: WorkoutLog[];
  bodyMeasurements: BodyMeasurement[];
  mealLogs: MealLog[];
  scheduledWorkouts: ScheduledWorkout[];
  waterIntake: { date: string; glasses: number }[];
  streak: number;
  personalRecords: { exercise: string; weight: number; date: string }[];
  settings: {
    darkMode: boolean;
    textSize: 'small' | 'medium' | 'large';
    notifications: boolean;
    weightUnit: 'lbs' | 'kg';
  };
}

const defaultState: AppState = {
  isOnboarded: false,
  user: null,
  workoutLogs: [],
  bodyMeasurements: [],
  mealLogs: [],
  scheduledWorkouts: [],
  waterIntake: [],
  streak: 0,
  personalRecords: [],
  settings: {
    darkMode: true,
    textSize: 'medium',
    notifications: true,
    weightUnit: 'lbs',
  },
};

const generateSampleData = (user: UserProfile): Partial<AppState> => {
  const today = new Date();
  const dates = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });

  const workoutLogs: WorkoutLog[] = [
    {
      id: '1',
      workoutId: 'w1',
      workoutName: 'Full Body Strength',
      date: dates[0],
      duration: 45,
      caloriesBurned: 320,
      exercises: [
        { name: 'Squats', sets: 4, reps: 12, weight: 135 },
        { name: 'Bench Press', sets: 4, reps: 10, weight: 155 },
        { name: 'Deadlifts', sets: 3, reps: 8, weight: 185 },
      ],
    },
    {
      id: '2',
      workoutId: 'w2',
      workoutName: 'HIIT Cardio Blast',
      date: dates[2],
      duration: 30,
      caloriesBurned: 280,
      exercises: [
        { name: 'Burpees', sets: 4, reps: 15 },
        { name: 'Mountain Climbers', sets: 4, reps: 20 },
        { name: 'Jump Squats', sets: 4, reps: 15 },
      ],
    },
    {
      id: '3',
      workoutId: 'w3',
      workoutName: 'Upper Body Power',
      date: dates[4],
      duration: 50,
      caloriesBurned: 290,
      exercises: [
        { name: 'Pull-ups', sets: 4, reps: 8 },
        { name: 'Shoulder Press', sets: 4, reps: 10, weight: 95 },
        { name: 'Bicep Curls', sets: 3, reps: 12, weight: 35 },
      ],
    },
  ];

  const bodyMeasurements: BodyMeasurement[] = dates.filter((_, i) => i % 7 === 0).map((date, i) => ({
    id: `m${i}`,
    date,
    weight: user.weight - i * 0.5,
    chest: 40 - i * 0.1,
    waist: 34 - i * 0.2,
  }));

  const mealLogs: MealLog[] = [
    { id: 'ml1', date: dates[0], name: 'Protein Oatmeal', calories: 450, protein: 30, carbs: 55, fat: 12, mealType: 'breakfast' },
    { id: 'ml2', date: dates[0], name: 'Grilled Chicken Salad', calories: 520, protein: 45, carbs: 25, fat: 22, mealType: 'lunch' },
    { id: 'ml3', date: dates[0], name: 'Salmon with Quinoa', calories: 620, protein: 42, carbs: 45, fat: 28, mealType: 'dinner' },
    { id: 'ml4', date: dates[0], name: 'Greek Yogurt', calories: 180, protein: 18, carbs: 12, fat: 6, mealType: 'snack' },
  ];

  const scheduledWorkouts: ScheduledWorkout[] = [
    { id: 's1', workoutId: 'w1', workoutName: 'Full Body Strength', date: dates[0], completed: true },
    { id: 's2', workoutId: 'w4', workoutName: 'Yoga Flow', date: new Date(today.getTime() + 86400000).toISOString().split('T')[0], completed: false },
    { id: 's3', workoutId: 'w2', workoutName: 'HIIT Cardio Blast', date: new Date(today.getTime() + 86400000 * 2).toISOString().split('T')[0], completed: false },
  ];

  const waterIntake = dates.slice(0, 7).map(date => ({
    date,
    glasses: Math.floor(Math.random() * 4) + 5,
  }));

  const personalRecords = [
    { exercise: 'Bench Press', weight: 185, date: dates[5] },
    { exercise: 'Squat', weight: 225, date: dates[10] },
    { exercise: 'Deadlift', weight: 275, date: dates[15] },
  ];

  return {
    workoutLogs,
    bodyMeasurements,
    mealLogs,
    scheduledWorkouts,
    waterIntake,
    streak: 12,
    personalRecords,
  };
};

// ─── API ↔ Local format converters ────────────────────────────────────────────

function apiToLocalAppState(data: ApiAppData, email: string): Partial<AppState> {
  const profile = data.profile;

  const user: UserProfile | null = profile
    ? {
        id: profile.id,
        name: profile.name ?? '',
        email,
        age: profile.age ?? 25,
        height: profile.height ?? 68,
        weight: profile.weight ?? 160,
        fitnessLevel: (profile.fitness_level as UserProfile['fitnessLevel']) ?? 'beginner',
        goals: profile.goals ?? [],
        units: (profile.units as UserProfile['units']) ?? 'imperial',
        createdAt: profile.created_at ?? new Date().toISOString(),
        bloodType: (profile.blood_type as UserProfile['bloodType']) ?? undefined,
        rhFactor: (profile.rh_factor as UserProfile['rhFactor']) ?? undefined,
        genotype: (profile.genotype as UserProfile['genotype']) ?? undefined,
      }
    : null;

  const settings = profile?.app_settings
    ? {
        darkMode: profile.app_settings.dark_mode ?? defaultState.settings.darkMode,
        textSize: (profile.app_settings.text_size as AppState['settings']['textSize']) ?? defaultState.settings.textSize,
        notifications: profile.app_settings.notifications ?? defaultState.settings.notifications,
        weightUnit: (profile.app_settings.weight_unit as AppState['settings']['weightUnit']) ?? defaultState.settings.weightUnit,
      }
    : undefined;

  const workoutLogs: WorkoutLog[] = (data.workout_logs ?? []).map(l => ({
    id: l.id,
    workoutId: l.workout_id,
    workoutName: l.workout_name,
    date: l.date,
    duration: l.duration,
    caloriesBurned: l.calories_burned,
    exercises: l.exercises,
  }));

  const mealLogs: MealLog[] = (data.meal_logs ?? []).map(m => ({
    id: m.id,
    date: m.date,
    name: m.name,
    calories: m.calories,
    protein: m.protein,
    carbs: m.carbs,
    fat: m.fat,
    mealType: m.meal_type,
  }));

  const bodyMeasurements: BodyMeasurement[] = (data.body_measurements ?? []).map(m => ({
    id: m.id,
    date: m.date,
    weight: m.weight,
    chest: m.chest ?? undefined,
    waist: m.waist ?? undefined,
    hips: m.hips ?? undefined,
    arms: m.arms ?? undefined,
    thighs: m.thighs ?? undefined,
  }));

  const waterIntake = (data.water_intake ?? []).map(w => ({ date: w.date, glasses: w.glasses }));

  const scheduledWorkouts: ScheduledWorkout[] = (data.scheduled_workouts ?? []).map(s => ({
    id: s.id,
    workoutId: s.workout_id,
    workoutName: s.workout_name,
    date: s.date,
    completed: s.completed,
  }));

  return {
    ...(user ? { user, isOnboarded: true } : {}),
    ...(settings ? { settings } : {}),
    workoutLogs,
    mealLogs,
    bodyMeasurements,
    waterIntake,
    scheduledWorkouts,
    streak: profile?.streak ?? 0,
  };
}

// ─── useAppState ──────────────────────────────────────────────────────────────

export function useAppState(userId?: string | null, userEmail?: string | null) {
  const storageKey = userId ? `${STORAGE_KEY_BASE}_${userId}` : null;

  const [state, setState] = useState<AppState>(defaultState);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [writeSyncStatus, setWriteSyncStatus] = useState<'idle' | 'syncing' | 'saved' | 'offline'>('idle');

  const cloudSyncedRef = useRef(false);
  const userIdRef = useRef<string | null | undefined>(undefined);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerWriteSync = useMemo(() => (promise: Promise<unknown>) => {
    if (!supabaseConfigured) return;
    setWriteSyncStatus('syncing');
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    promise.then(() => {
      setWriteSyncStatus('saved');
      syncTimerRef.current = setTimeout(() => setWriteSyncStatus('idle'), 2500);
    }).catch(() => {
      setWriteSyncStatus('offline');
      syncTimerRef.current = setTimeout(() => setWriteSyncStatus('idle'), 4000);
    });
  }, []);

  // Re-load state from localStorage whenever the user changes (login/logout)
  useEffect(() => {
    if (!storageKey) {
      setState(defaultState);
      setCloudSynced(false);
      cloudSyncedRef.current = false;
      return;
    }
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState({
          ...defaultState,
          ...parsed,
          // Guard every array field — old localStorage snapshots (or a partial
          // cloud-write race) may have stored null/object instead of an array,
          // which causes a crash on .length/.map() calls in render.
          workoutLogs: Array.isArray(parsed.workoutLogs) ? parsed.workoutLogs : defaultState.workoutLogs,
          mealLogs: Array.isArray(parsed.mealLogs) ? parsed.mealLogs : defaultState.mealLogs,
          bodyMeasurements: Array.isArray(parsed.bodyMeasurements) ? parsed.bodyMeasurements : defaultState.bodyMeasurements,
          waterIntake: Array.isArray(parsed.waterIntake) ? parsed.waterIntake : defaultState.waterIntake,
          scheduledWorkouts: Array.isArray(parsed.scheduledWorkouts) ? parsed.scheduledWorkouts : defaultState.scheduledWorkouts,
          personalRecords: Array.isArray(parsed.personalRecords) ? parsed.personalRecords : defaultState.personalRecords,
          settings: { ...defaultState.settings, ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}) },
        });
      } catch {
        setState(defaultState);
      }
    } else {
      setState(defaultState);
    }
    setCloudSynced(false);
    cloudSyncedRef.current = false;
  }, [storageKey]);

  // Load data from the cloud when the user logs in
  useEffect(() => {
    if (!userId || !supabaseConfigured) return;
    if (cloudSyncedRef.current && userIdRef.current === userId) return;
    userIdRef.current = userId;
    cloudSyncedRef.current = true;

    appDataApi.loadAll().then(data => {
      const fromCloud = apiToLocalAppState(data, userEmail ?? '');
      setState(prev => ({
        ...prev,
        ...fromCloud,
        settings: fromCloud.settings
          ? { ...prev.settings, ...fromCloud.settings }
          : prev.settings,
        // Keep isOnboarded true if already true locally (safe guard for first-ever load)
        isOnboarded: prev.isOnboarded || (fromCloud.isOnboarded ?? false),
      }));
      setCloudSynced(true);
      setSyncError(false);
    }).catch(() => {
      // Mark cloud sync as settled but flag the error so the UI can surface it
      setCloudSynced(true);
      setSyncError(true);
    });
  }, [userId, userEmail]);

  // Persist state to localStorage for the current user
  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(state));
    }
  }, [state, storageKey]);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const completeOnboarding = useCallback((user: UserProfile) => {
    const sampleData = generateSampleData(user);
    setState(prev => ({
      ...prev,
      isOnboarded: true,
      user,
      ...sampleData,
    }));

    // Persist profile & initial data to API
    if (supabaseConfigured) {
      userProfileApi.update({
        name: user.name,
        age: user.age,
        height: user.height,
        weight: user.weight,
        fitness_level: user.fitnessLevel,
        goals: user.goals,
        units: user.units,
        blood_type: user.bloodType ?? null,
        rh_factor: user.rhFactor ?? null,
        genotype: user.genotype ?? null,
      }).catch(() => { /* best-effort */ });
    }
  }, []);

  const addWorkoutLog = (log: WorkoutLog) => {
    setState(prev => ({
      ...prev,
      workoutLogs: [log, ...prev.workoutLogs],
      streak: prev.streak + 1,
    }));

    if (supabaseConfigured) {
      triggerWriteSync(workoutLogsApi.create({
        id: log.id,
        workout_id: log.workoutId,
        workout_name: log.workoutName,
        date: log.date,
        duration: log.duration,
        calories_burned: log.caloriesBurned,
        exercises: log.exercises,
      }));
    }
  };

  const removeWorkoutLog = (id: string) => {
    setState(prev => ({
      ...prev,
      workoutLogs: prev.workoutLogs.filter(l => l.id !== id),
    }));

    if (supabaseConfigured) {
      triggerWriteSync(workoutLogsApi.remove(id));
    }
  };

  /** Removes the workout from local state immediately without touching the server. */
  const removeWorkoutLogOptimistic = (id: string) => {
    setState(prev => ({
      ...prev,
      workoutLogs: prev.workoutLogs.filter(l => l.id !== id),
    }));
  };

  /** Re-inserts a workout that was optimistically removed (undo path). */
  const restoreWorkoutLog = (log: WorkoutLog) => {
    setState(prev => ({
      ...prev,
      workoutLogs: [log, ...prev.workoutLogs],
    }));
  };

  /** Fires the server-side delete for a workout that was already removed from local state. */
  const confirmWorkoutRemoval = (id: string) => {
    if (supabaseConfigured) {
      triggerWriteSync(workoutLogsApi.remove(id));
    }
  };

  const addMealLog = (meal: MealLog) => {
    setState(prev => ({
      ...prev,
      mealLogs: [meal, ...prev.mealLogs],
    }));

    if (supabaseConfigured) {
      triggerWriteSync(mealLogsApi.create({
        id: meal.id,
        date: meal.date,
        name: meal.name,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
        meal_type: meal.mealType,
      }));
    }
  };

  const removeMealLog = (id: string) => {
    setState(prev => ({
      ...prev,
      mealLogs: prev.mealLogs.filter(m => m.id !== id),
    }));

    if (supabaseConfigured) {
      triggerWriteSync(mealLogsApi.remove(id));
    }
  };

  /** Removes the meal from local state immediately without touching the server. */
  const removeMealLogOptimistic = (id: string) => {
    setState(prev => ({
      ...prev,
      mealLogs: prev.mealLogs.filter(m => m.id !== id),
    }));
  };

  /** Re-inserts a meal that was optimistically removed (undo path). */
  const restoreMealLog = (meal: MealLog) => {
    setState(prev => ({
      ...prev,
      mealLogs: [meal, ...prev.mealLogs],
    }));
  };

  /** Fires the server-side delete for a meal that was already removed from local state. */
  const confirmMealRemoval = (id: string) => {
    if (supabaseConfigured) {
      triggerWriteSync(mealLogsApi.remove(id));
    }
  };

  const updateWaterIntake = (glasses: number) => {
    const today = new Date().toISOString().split('T')[0];
    setState(prev => {
      const existing = prev.waterIntake.find(w => w.date === today);
      if (existing) {
        return {
          ...prev,
          waterIntake: prev.waterIntake.map(w =>
            w.date === today ? { ...w, glasses } : w
          ),
        };
      }
      return {
        ...prev,
        waterIntake: [{ date: today, glasses }, ...prev.waterIntake],
      };
    });

    if (supabaseConfigured) {
      triggerWriteSync(waterIntakeApi.upsert(today, glasses));
    }
  };

  const scheduleWorkout = (workout: ScheduledWorkout) => {
    setState(prev => ({
      ...prev,
      scheduledWorkouts: [...prev.scheduledWorkouts, workout],
    }));

    if (supabaseConfigured) {
      triggerWriteSync(scheduledWorkoutsApi.create({
        id: workout.id,
        workout_id: workout.workoutId,
        workout_name: workout.workoutName,
        date: workout.date,
        completed: workout.completed,
      }));
    }
  };

  const addBodyMeasurement = (measurement: BodyMeasurement) => {
    setState(prev => ({
      ...prev,
      bodyMeasurements: [measurement, ...prev.bodyMeasurements],
    }));

    if (supabaseConfigured) {
      triggerWriteSync(bodyMeasurementsApi.create({
        id: measurement.id,
        date: measurement.date,
        weight: measurement.weight,
        chest: measurement.chest ?? null,
        waist: measurement.waist ?? null,
        hips: measurement.hips ?? null,
        arms: measurement.arms ?? null,
        thighs: measurement.thighs ?? null,
      }));
    }
  };

  const updateSettings = (settings: Partial<AppState['settings']>) => {
    // Merge against current state (not defaultState) so partial updates
    // don't silently reset other settings fields in the database.
    const nextSettings = { ...state.settings, ...settings };

    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));

    if (supabaseConfigured) {
      triggerWriteSync(userProfileApi.update({
        app_settings: {
          dark_mode: nextSettings.darkMode,
          text_size: nextSettings.textSize,
          notifications: nextSettings.notifications,
          weight_unit: nextSettings.weightUnit,
        },
      }));
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setState(prev => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));

    if (supabaseConfigured) {
      const apiUpdates: Parameters<typeof userProfileApi.update>[0] = {};
      if (updates.name !== undefined) apiUpdates.name = updates.name;
      if (updates.age !== undefined) apiUpdates.age = updates.age;
      if (updates.height !== undefined) apiUpdates.height = updates.height;
      if (updates.weight !== undefined) apiUpdates.weight = updates.weight;
      if (updates.fitnessLevel !== undefined) apiUpdates.fitness_level = updates.fitnessLevel;
      if (updates.goals !== undefined) apiUpdates.goals = updates.goals;
      if (updates.units !== undefined) apiUpdates.units = updates.units;
      if (updates.bloodType !== undefined) apiUpdates.blood_type = updates.bloodType ?? null;
      if (updates.rhFactor !== undefined) apiUpdates.rh_factor = updates.rhFactor ?? null;
      if (updates.genotype !== undefined) apiUpdates.genotype = updates.genotype ?? null;
      triggerWriteSync(userProfileApi.update(apiUpdates));
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raimzeal_export.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfReport = async () => {
    const { user, workoutLogs, bodyMeasurements, mealLogs, personalRecords, streak } = state;

    // Embed logo as base64 so the blob-URL report window can display it
    let logoDataUrl = '';
    try {
      const resp = await fetch('/images/logo.png');
      if (resp.ok) {
        const blob = await resp.blob();
        logoDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // logo failed to load — fall back to text heading
    }
    const generatedAt = new Date().toLocaleString();
    const unit = state.settings.weightUnit;

    const totalCaloriesBurned = workoutLogs.reduce((s, l) => s + l.caloriesBurned, 0);
    const totalWorkoutMinutes = workoutLogs.reduce((s, l) => s + l.duration, 0);
    const uniqueDays = [...new Set(mealLogs.map(m => m.date))].length;
    const avgCalories = uniqueDays > 0
      ? Math.round(mealLogs.reduce((s, m) => s + m.calories, 0) / uniqueDays)
      : 0;
    const latestWeight = bodyMeasurements[0]?.weight ?? user?.weight ?? 0;

    const workoutRows = workoutLogs.map(log => {
      const exerciseSummary = log.exercises.map(e =>
        `${e.name} ${e.sets}x${e.reps}${e.weight ? ' @ ' + e.weight + unit : ''}`
      ).join(', ');
      return `<tr>
        <td>${new Date(log.date).toLocaleDateString()}</td>
        <td>${log.workoutName}</td>
        <td>${log.duration} min</td>
        <td>${log.caloriesBurned} cal</td>
        <td style="font-size:11px">${exerciseSummary || '—'}</td>
      </tr>`;
    }).join('');

    const measurementRows = bodyMeasurements.map(m => `<tr>
      <td>${new Date(m.date).toLocaleDateString()}</td>
      <td>${m.weight} ${unit}</td>
      <td>${m.chest ?? '—'}</td>
      <td>${m.waist ?? '—'}</td>
      <td>${m.hips ?? '—'}</td>
      <td>${m.arms ?? '—'}</td>
      <td>${m.thighs ?? '—'}</td>
    </tr>`).join('');

    const prRows = personalRecords.map(pr => `<tr>
      <td>${pr.exercise}</td>
      <td>${pr.weight} ${unit}</td>
      <td>${new Date(pr.date).toLocaleDateString()}</td>
    </tr>`).join('');

    const mealRows = mealLogs.slice(0, 60).map(m => `<tr>
      <td>${new Date(m.date).toLocaleDateString()}</td>
      <td>${m.name}</td>
      <td style="text-transform:capitalize">${m.mealType}</td>
      <td>${m.calories}</td>
      <td>${m.protein}g</td>
      <td>${m.carbs}g</td>
      <td>${m.fat}g</td>
    </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RAIMZEAL Health and Fitness Report</title>
<style>
  body { font-family: Arial, sans-serif; color: #1a1a1a; max-width: 960px; margin: 0 auto; padding: 32px; }
  h1 { color: #7c3aed; margin-bottom: 4px; font-size: 28px; }
  h2 { color: #4c1d95; border-bottom: 2px solid #ede9fe; padding-bottom: 6px; margin-top: 36px; font-size: 18px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 28px; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin: 20px 0; }
  .stat-box { background: #f5f3ff; border-radius: 10px; padding: 16px; text-align: center; }
  .stat-box .value { font-size: 26px; font-weight: bold; color: #7c3aed; }
  .stat-box .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  th { background: #7c3aed; color: white; padding: 8px 10px; text-align: left; font-size: 12px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) td { background: #faf5ff; }
  .profile-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
  .profile-item { background: #f5f3ff; border-radius: 8px; padding: 10px 14px; }
  .profile-item .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .profile-item .value { font-size: 15px; font-weight: 600; margin-top: 2px; }
  .notice { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-top: 32px; border-radius: 4px; font-size: 13px; color: #92400e; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
${logoDataUrl
  ? `<img src="${logoDataUrl}" alt="RAIMZEAL" style="height:60px;margin-bottom:8px;display:block;" />`
  : `<h1 style="color:#7c3aed;margin-bottom:4px;font-size:28px;">RAIMZEAL</h1>`}
<p style="font-size:20px;font-weight:bold;color:#7c3aed;margin:0 0 4px 0;">Health and Fitness Report</p>
<p class="meta">Generated: ${generatedAt} &nbsp;|&nbsp; Member since: ${user ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>

<h2>Member Profile</h2>
<div class="profile-grid">
  <div class="profile-item"><div class="label">Full Name</div><div class="value">${user?.name ?? '—'}</div></div>
  <div class="profile-item"><div class="label">Email</div><div class="value">${user?.email ?? '—'}</div></div>
  <div class="profile-item"><div class="label">Age</div><div class="value">${user?.age ?? '—'} years</div></div>
  <div class="profile-item"><div class="label">Height</div><div class="value">${user?.height ?? '—'} ${user?.units === 'metric' ? 'cm' : 'in'}</div></div>
  <div class="profile-item"><div class="label">Current Weight</div><div class="value">${latestWeight} ${unit}</div></div>
  <div class="profile-item"><div class="label">Fitness Level</div><div class="value" style="text-transform:capitalize">${user?.fitnessLevel ?? '—'}</div></div>
  <div class="profile-item"><div class="label">Goals</div><div class="value">${user?.goals?.map(g => g.replace('_', ' ')).join(', ') ?? '—'}</div></div>
  <div class="profile-item"><div class="label">Current Streak</div><div class="value">${streak} days</div></div>
</div>

<h2>Activity Summary</h2>
<div class="summary-grid">
  <div class="stat-box"><div class="value">${workoutLogs.length}</div><div class="label">Total Workouts</div></div>
  <div class="stat-box"><div class="value">${totalCaloriesBurned.toLocaleString()}</div><div class="label">Calories Burned</div></div>
  <div class="stat-box"><div class="value">${totalWorkoutMinutes}</div><div class="label">Minutes Trained</div></div>
  <div class="stat-box"><div class="value">${avgCalories}</div><div class="label">Avg Daily Calories</div></div>
</div>

<h2>Workout History</h2>
${workoutLogs.length > 0 ? `<table>
  <thead><tr><th>Date</th><th>Workout</th><th>Duration</th><th>Calories</th><th>Exercises</th></tr></thead>
  <tbody>${workoutRows}</tbody>
</table>` : '<p style="color:#6b7280">No workouts logged yet.</p>'}

<h2>Personal Records</h2>
${personalRecords.length > 0 ? `<table>
  <thead><tr><th>Exercise</th><th>Weight</th><th>Date Achieved</th></tr></thead>
  <tbody>${prRows}</tbody>
</table>` : '<p style="color:#6b7280">No personal records yet.</p>'}

<h2>Body Measurements</h2>
${bodyMeasurements.length > 0 ? `<table>
  <thead><tr><th>Date</th><th>Weight</th><th>Chest</th><th>Waist</th><th>Hips</th><th>Arms</th><th>Thighs</th></tr></thead>
  <tbody>${measurementRows}</tbody>
</table>` : '<p style="color:#6b7280">No body measurements logged yet.</p>'}

<h2>Nutrition Log</h2>
${mealLogs.length > 0 ? `<table>
  <thead><tr><th>Date</th><th>Food</th><th>Meal</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr></thead>
  <tbody>${mealRows}</tbody>
</table>` : '<p style="color:#6b7280">No meals logged yet.</p>'}

<div class="notice">
  This report contains your personal fitness data as logged by you in the RAIMZEAL app. It is for personal reference only and does not constitute medical advice, diagnosis, or treatment of any kind. RAIMZEAL is a free, non-profit fitness, food therapy, and healthcare awareness platform — it does not replace any doctor, dietitian, therapist, or healthcare facility. Always consult a qualified healthcare professional before making changes to your diet, exercise, or health management. You are fully and solely responsible for any action or decision you make based on this information. RAIMZEAL and ECONTEUR LLC accept no liability for any injury or adverse outcome arising from your use of this platform.
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `RAIMZEAL_Health_Report_${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return {
    state,
    cloudSynced,
    syncError,
    writeSyncStatus,
    updateState,
    completeOnboarding,
    addWorkoutLog,
    removeWorkoutLog,
    removeWorkoutLogOptimistic,
    restoreWorkoutLog,
    confirmWorkoutRemoval,
    addMealLog,
    removeMealLog,
    removeMealLogOptimistic,
    restoreMealLog,
    confirmMealRemoval,
    updateWaterIntake,
    scheduleWorkout,
    addBodyMeasurement,
    updateSettings,
    updateProfile,
    exportData,
    exportPdfReport,
  };
}

export const workouts = [
  {
    id: 'w1',
    name: 'Full Body Strength',
    category: 'strength',
    duration: 45,
    difficulty: 'intermediate',
    calories: 320,
    equipment: ['dumbbells', 'barbell', 'bench'],
    description: 'Build total body strength with compound movements',
    warmup: [
      { name: 'Jumping Jacks', duration: 60, type: 'time' },
      { name: 'Arm Circles', duration: 30, type: 'time' },
      { name: 'Leg Swings', duration: 30, type: 'time' },
    ],
    main: [
      { name: 'Squats', sets: 4, reps: 12, rest: 60, muscle: 'legs' },
      { name: 'Bench Press', sets: 4, reps: 10, rest: 90, muscle: 'chest' },
      { name: 'Bent Over Rows', sets: 4, reps: 10, rest: 60, muscle: 'back' },
      { name: 'Shoulder Press', sets: 3, reps: 12, rest: 60, muscle: 'shoulders' },
      { name: 'Deadlifts', sets: 3, reps: 8, rest: 120, muscle: 'full body' },
    ],
    cooldown: [
      { name: 'Quad Stretch', duration: 30, type: 'time' },
      { name: 'Hamstring Stretch', duration: 30, type: 'time' },
      { name: 'Chest Stretch', duration: 30, type: 'time' },
    ],
  },
  {
    id: 'w2',
    name: 'HIIT Cardio Blast',
    category: 'hiit',
    duration: 30,
    difficulty: 'advanced',
    calories: 400,
    equipment: ['none'],
    description: 'High-intensity intervals to torch calories',
    warmup: [
      { name: 'High Knees', duration: 45, type: 'time' },
      { name: 'Butt Kicks', duration: 45, type: 'time' },
    ],
    main: [
      { name: 'Burpees', sets: 4, reps: 15, rest: 30, muscle: 'full body' },
      { name: 'Mountain Climbers', sets: 4, reps: 20, rest: 20, muscle: 'core' },
      { name: 'Jump Squats', sets: 4, reps: 15, rest: 30, muscle: 'legs' },
      { name: 'Push-up to Plank', sets: 4, reps: 12, rest: 30, muscle: 'chest' },
      { name: 'Box Jumps', sets: 3, reps: 10, rest: 45, muscle: 'legs' },
    ],
    cooldown: [
      { name: 'Walking', duration: 60, type: 'time' },
      { name: 'Deep Breathing', duration: 60, type: 'time' },
    ],
  },
  {
    id: 'w3',
    name: 'Upper Body Power',
    category: 'strength',
    duration: 50,
    difficulty: 'intermediate',
    calories: 290,
    equipment: ['dumbbells', 'pull-up bar'],
    description: 'Sculpt your upper body with focused exercises',
    warmup: [
      { name: 'Arm Circles', duration: 30, type: 'time' },
      { name: 'Band Pull Aparts', duration: 30, type: 'time' },
    ],
    main: [
      { name: 'Pull-ups', sets: 4, reps: 8, rest: 90, muscle: 'back' },
      { name: 'Incline Dumbbell Press', sets: 4, reps: 10, rest: 60, muscle: 'chest' },
      { name: 'Lateral Raises', sets: 3, reps: 15, rest: 45, muscle: 'shoulders' },
      { name: 'Tricep Dips', sets: 3, reps: 12, rest: 60, muscle: 'triceps' },
      { name: 'Bicep Curls', sets: 3, reps: 12, rest: 45, muscle: 'biceps' },
    ],
    cooldown: [
      { name: 'Tricep Stretch', duration: 30, type: 'time' },
      { name: 'Shoulder Stretch', duration: 30, type: 'time' },
    ],
  },
  {
    id: 'w4',
    name: 'Yoga Flow',
    category: 'yoga',
    duration: 40,
    difficulty: 'beginner',
    calories: 150,
    equipment: ['yoga mat'],
    description: 'Restore flexibility and calm your mind',
    warmup: [
      { name: 'Child\'s Pose', duration: 60, type: 'time' },
      { name: 'Cat-Cow', duration: 60, type: 'time' },
    ],
    main: [
      { name: 'Sun Salutation A', sets: 3, reps: 1, rest: 0, muscle: 'full body' },
      { name: 'Warrior I', sets: 2, reps: 1, rest: 0, muscle: 'legs' },
      { name: 'Warrior II', sets: 2, reps: 1, rest: 0, muscle: 'legs' },
      { name: 'Triangle Pose', sets: 2, reps: 1, rest: 0, muscle: 'core' },
      { name: 'Tree Pose', sets: 2, reps: 1, rest: 0, muscle: 'balance' },
    ],
    cooldown: [
      { name: 'Savasana', duration: 300, type: 'time' },
    ],
  },
  {
    id: 'w5',
    name: 'Mobility & Recovery',
    category: 'mobility',
    duration: 25,
    difficulty: 'beginner',
    calories: 80,
    equipment: ['foam roller'],
    description: 'Essential recovery for muscle health',
    warmup: [
      { name: 'Light Walking', duration: 60, type: 'time' },
    ],
    main: [
      { name: 'Foam Roll Quads', sets: 1, reps: 1, rest: 0, muscle: 'legs' },
      { name: 'Foam Roll IT Band', sets: 1, reps: 1, rest: 0, muscle: 'legs' },
      { name: 'Hip Flexor Stretch', sets: 2, reps: 1, rest: 0, muscle: 'hips' },
      { name: 'Pigeon Pose', sets: 2, reps: 1, rest: 0, muscle: 'hips' },
      { name: '90/90 Stretch', sets: 2, reps: 1, rest: 0, muscle: 'hips' },
    ],
    cooldown: [
      { name: 'Deep Breathing', duration: 120, type: 'time' },
    ],
  },
  {
    id: 'w6',
    name: 'Cardio Endurance',
    category: 'cardio',
    duration: 35,
    difficulty: 'intermediate',
    calories: 350,
    equipment: ['none'],
    description: 'Build stamina with steady-state cardio',
    warmup: [
      { name: 'Light Jog', duration: 180, type: 'time' },
    ],
    main: [
      { name: 'Running', sets: 1, reps: 1, rest: 0, muscle: 'cardio' },
      { name: 'Jump Rope', sets: 4, reps: 100, rest: 30, muscle: 'cardio' },
      { name: 'Stair Climbing', sets: 3, reps: 1, rest: 60, muscle: 'legs' },
    ],
    cooldown: [
      { name: 'Walking', duration: 180, type: 'time' },
      { name: 'Calf Stretch', duration: 30, type: 'time' },
    ],
  },
];

export const exercises = [
  {
    id: 'e1',
    name: 'Squats',
    muscle: 'Quadriceps, Glutes, Hamstrings',
    equipment: 'Barbell, Dumbbells, or Bodyweight',
    difficulty: 'intermediate',
    tips: [
      'Keep your chest up and core tight',
      'Push your knees out over your toes',
      'Go as deep as your mobility allows',
      'Drive through your heels to stand',
    ],
  },
  {
    id: 'e2',
    name: 'Bench Press',
    muscle: 'Chest, Triceps, Shoulders',
    equipment: 'Barbell, Bench',
    difficulty: 'intermediate',
    tips: [
      'Arch your back slightly and squeeze shoulder blades',
      'Lower the bar to mid-chest',
      'Keep wrists straight and elbows at 45 degrees',
      'Press explosively through the sticking point',
    ],
  },
  {
    id: 'e3',
    name: 'Deadlifts',
    muscle: 'Back, Glutes, Hamstrings, Core',
    equipment: 'Barbell',
    difficulty: 'advanced',
    tips: [
      'Keep the bar close to your body',
      'Hinge at hips, not lower back',
      'Engage lats before lifting',
      'Lock out with glutes, not by leaning back',
    ],
  },
  {
    id: 'e4',
    name: 'Pull-ups',
    muscle: 'Back, Biceps, Core',
    equipment: 'Pull-up Bar',
    difficulty: 'intermediate',
    tips: [
      'Start from a dead hang',
      'Pull shoulder blades down and back',
      'Lead with your chest to the bar',
      'Control the descent',
    ],
  },
  {
    id: 'e5',
    name: 'Burpees',
    muscle: 'Full Body',
    equipment: 'None',
    difficulty: 'intermediate',
    tips: [
      'Move explosively but maintain form',
      'Land softly on the jump',
      'Keep core engaged throughout',
      'Scale by stepping instead of jumping',
    ],
  },
  {
    id: 'e6',
    name: 'Mountain Climbers',
    muscle: 'Core, Shoulders, Legs',
    equipment: 'None',
    difficulty: 'beginner',
    tips: [
      'Keep hips level with shoulders',
      'Drive knees toward chest quickly',
      'Maintain plank position throughout',
      'Breathe rhythmically',
    ],
  },
  {
    id: 'e7',
    name: 'Shoulder Press',
    muscle: 'Shoulders, Triceps',
    equipment: 'Dumbbells or Barbell',
    difficulty: 'intermediate',
    tips: [
      'Keep core tight to protect lower back',
      'Press straight up, not forward',
      'Lower with control',
      'Full lockout at the top',
    ],
  },
  {
    id: 'e8',
    name: 'Lunges',
    muscle: 'Quadriceps, Glutes, Hamstrings',
    equipment: 'Dumbbells or Bodyweight',
    difficulty: 'beginner',
    tips: [
      'Take a big enough step forward',
      'Keep front knee over ankle',
      'Lower until back knee nearly touches ground',
      'Push through front heel to return',
    ],
  },
];

export const programs = [
  {
    id: 'p1',
    name: '4-Week Beginner Foundation',
    duration: '4 weeks',
    difficulty: 'beginner',
    goal: 'Build base fitness',
    description: 'Perfect for those new to fitness. Build strength, endurance, and healthy habits.',
    weeks: [
      { week: 1, focus: 'Movement Patterns', workouts: ['w4', 'w5', 'w4'] },
      { week: 2, focus: 'Building Strength', workouts: ['w1', 'w4', 'w5', 'w1'] },
      { week: 3, focus: 'Adding Intensity', workouts: ['w1', 'w6', 'w4', 'w1'] },
      { week: 4, focus: 'Full Integration', workouts: ['w1', 'w2', 'w4', 'w1', 'w5'] },
    ],
  },
  {
    id: 'p2',
    name: '8-Week Hypertrophy',
    duration: '8 weeks',
    difficulty: 'intermediate',
    goal: 'Build muscle mass',
    description: 'Designed for muscle growth with progressive overload and volume.',
    weeks: [
      { week: 1, focus: 'Foundation', workouts: ['w1', 'w3', 'w1', 'w3'] },
      { week: 2, focus: 'Volume Build', workouts: ['w1', 'w3', 'w5', 'w1', 'w3'] },
      { week: 3, focus: 'Intensity', workouts: ['w1', 'w3', 'w1', 'w3', 'w5'] },
      { week: 4, focus: 'Deload', workouts: ['w1', 'w4', 'w3'] },
      { week: 5, focus: 'Progressive Overload', workouts: ['w1', 'w3', 'w1', 'w3', 'w5'] },
      { week: 6, focus: 'Peak Volume', workouts: ['w1', 'w3', 'w2', 'w1', 'w3'] },
      { week: 7, focus: 'Intensity Peak', workouts: ['w1', 'w3', 'w1', 'w3', 'w5'] },
      { week: 8, focus: 'Final Push', workouts: ['w1', 'w3', 'w2', 'w1', 'w3', 'w4'] },
    ],
  },
  {
    id: 'p3',
    name: 'Fat Loss Accelerator',
    duration: '6 weeks',
    difficulty: 'intermediate',
    goal: 'Lose fat, maintain muscle',
    description: 'High-intensity training combined with strength to maximize fat burning.',
    weeks: [
      { week: 1, focus: 'Metabolic Boost', workouts: ['w2', 'w1', 'w6', 'w2'] },
      { week: 2, focus: 'HIIT Focus', workouts: ['w2', 'w1', 'w2', 'w6', 'w4'] },
      { week: 3, focus: 'Strength + Cardio', workouts: ['w1', 'w2', 'w6', 'w1', 'w2'] },
      { week: 4, focus: 'Active Recovery', workouts: ['w2', 'w4', 'w5', 'w2'] },
      { week: 5, focus: 'Final Push', workouts: ['w2', 'w1', 'w2', 'w6', 'w2'] },
      { week: 6, focus: 'Peak Week', workouts: ['w2', 'w1', 'w2', 'w1', 'w2', 'w4'] },
    ],
  },
  {
    id: 'p4',
    name: 'Mobility Master',
    duration: '4 weeks',
    difficulty: 'beginner',
    goal: 'Improve flexibility',
    description: 'Unlock your body\'s potential with dedicated mobility and yoga sessions.',
    weeks: [
      { week: 1, focus: 'Assessment', workouts: ['w4', 'w5', 'w4', 'w5'] },
      { week: 2, focus: 'Hip Focus', workouts: ['w4', 'w5', 'w4', 'w5', 'w4'] },
      { week: 3, focus: 'Spine & Shoulders', workouts: ['w5', 'w4', 'w5', 'w4', 'w5'] },
      { week: 4, focus: 'Full Integration', workouts: ['w4', 'w5', 'w4', 'w5', 'w4', 'w5'] },
    ],
  },
];

export const communityPosts: CommunityPost[] = [
  {
    id: 'cp1',
    userId: 'u1',
    userName: 'Sarah M.',
    content: 'Just finished week 4 of the hypertrophy program! Already seeing gains in my shoulders. This program is no joke! 💪',
    likes: 24,
    liked: false,
    comments: [
      { id: 'c1', userName: 'Mike R.', content: 'Keep it up! Week 5 is where it gets real.', createdAt: '2026-01-07T10:30:00Z' },
      { id: 'c2', userName: 'Coach', content: 'Amazing progress! Remember to prioritize sleep for recovery.', createdAt: '2026-01-07T11:00:00Z' },
    ],
    createdAt: '2026-01-07T09:00:00Z',
  },
  {
    id: 'cp2',
    userId: 'u2',
    userName: 'James K.',
    content: 'New PR on deadlifts today - 315 lbs! Been stuck at 295 for months. The progressive overload approach finally paid off.',
    likes: 45,
    liked: false,
    comments: [
      { id: 'c3', userName: 'Lisa T.', content: 'Congrats! That\'s amazing!', createdAt: '2026-01-06T15:00:00Z' },
    ],
    createdAt: '2026-01-06T14:30:00Z',
  },
  {
    id: 'cp3',
    userId: 'u3',
    userName: 'Emma L.',
    content: 'Day 1 of my fitness journey starts today! Nervous but excited. Any tips for a complete beginner?',
    likes: 32,
    liked: false,
    comments: [
      { id: 'c4', userName: 'Coach', content: 'Welcome! Start with the 4-Week Beginner program. Focus on form over weight.', createdAt: '2026-01-05T10:00:00Z' },
      { id: 'c5', userName: 'David P.', content: 'Consistency is key! Even 15 minutes is better than nothing.', createdAt: '2026-01-05T10:30:00Z' },
      { id: 'c6', userName: 'Sarah M.', content: 'You got this! We all started somewhere.', createdAt: '2026-01-05T11:00:00Z' },
    ],
    createdAt: '2026-01-05T09:00:00Z',
  },
];

export const quickFoods = [
  { name: 'Chicken Breast (4oz)', calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: 'Brown Rice (1 cup)', calories: 216, protein: 5, carbs: 45, fat: 1.8 },
  { name: 'Broccoli (1 cup)', calories: 55, protein: 3.7, carbs: 11, fat: 0.6 },
  { name: 'Salmon (4oz)', calories: 233, protein: 25, carbs: 0, fat: 14 },
  { name: 'Eggs (2 large)', calories: 156, protein: 12, carbs: 1.2, fat: 10 },
  { name: 'Greek Yogurt (1 cup)', calories: 130, protein: 17, carbs: 8, fat: 4 },
  { name: 'Oatmeal (1 cup)', calories: 158, protein: 6, carbs: 27, fat: 3 },
  { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: 'Almonds (1oz)', calories: 164, protein: 6, carbs: 6, fat: 14 },
  { name: 'Protein Shake', calories: 150, protein: 25, carbs: 5, fat: 2 },
  { name: 'Sweet Potato (medium)', calories: 103, protein: 2.3, carbs: 24, fat: 0.1 },
  { name: 'Avocado (half)', calories: 161, protein: 2, carbs: 8.5, fat: 15 },
];
