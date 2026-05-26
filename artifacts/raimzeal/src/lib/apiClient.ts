import { supabase, supabaseConfigured } from './supabase';

async function getAuthToken(): Promise<string | null> {
  if (!supabaseConfigured) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}

async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json() as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error && body.error !== 'UPGRADE_REQUIRED') message = body.error;
      else if (body.error) message = body.message ?? body.error;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ─── Workout Logs ────────────────────────────────────────────────────────────

export interface ApiWorkoutLog {
  id: string;
  workout_id: string;
  workout_name: string;
  date: string;
  duration: number;
  calories_burned: number;
  exercises: { name: string; sets: number; reps: number; weight?: number }[];
}

export const workoutLogsApi = {
  list: () =>
    apiFetch<{ logs: ApiWorkoutLog[] }>('/api/user/workout-logs'),

  create: (log: Omit<ApiWorkoutLog, 'id'> & { id?: string }) =>
    apiFetch<{ log: ApiWorkoutLog }>('/api/user/workout-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/user/workout-logs/${id}`, { method: 'DELETE' }),
};

// ─── Meal Logs ───────────────────────────────────────────────────────────────

export interface ApiMealLog {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export const mealLogsApi = {
  list: () =>
    apiFetch<{ logs: ApiMealLog[] }>('/api/user/meal-logs'),

  create: (log: Omit<ApiMealLog, 'id'> & { id?: string }) =>
    apiFetch<{ log: ApiMealLog }>('/api/user/meal-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    }),

  update: (id: string, log: Partial<Omit<ApiMealLog, 'id'>>) =>
    apiFetch<{ log: ApiMealLog }>(`/api/user/meal-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(log),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/user/meal-logs/${id}`, { method: 'DELETE' }),
};

// ─── Body Measurements ───────────────────────────────────────────────────────

export interface ApiBodyMeasurement {
  id: string;
  date: string;
  weight: number;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  arms?: number | null;
  thighs?: number | null;
}

export const bodyMeasurementsApi = {
  list: () =>
    apiFetch<{ measurements: ApiBodyMeasurement[] }>('/api/user/body-measurements'),

  create: (m: Omit<ApiBodyMeasurement, 'id'> & { id?: string }) =>
    apiFetch<{ measurement: ApiBodyMeasurement }>('/api/user/body-measurements', {
      method: 'POST',
      body: JSON.stringify(m),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/user/body-measurements/${id}`, { method: 'DELETE' }),
};

// ─── Water Intake ────────────────────────────────────────────────────────────

export interface ApiWaterIntake {
  date: string;
  glasses: number;
}

export const waterIntakeApi = {
  list: () =>
    apiFetch<{ intake: ApiWaterIntake[] }>('/api/user/water-intake'),

  upsert: (date: string, glasses: number) =>
    apiFetch<{ intake: ApiWaterIntake }>(`/api/user/water-intake/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ glasses }),
    }),
};

// ─── Scheduled Workouts ──────────────────────────────────────────────────────

export interface ApiScheduledWorkout {
  id: string;
  workout_id: string;
  workout_name: string;
  date: string;
  completed: boolean;
}

export const scheduledWorkoutsApi = {
  list: () =>
    apiFetch<{ workouts: ApiScheduledWorkout[] }>('/api/user/scheduled-workouts'),

  create: (w: Omit<ApiScheduledWorkout, 'id'> & { id?: string }) =>
    apiFetch<{ workout: ApiScheduledWorkout }>('/api/user/scheduled-workouts', {
      method: 'POST',
      body: JSON.stringify(w),
    }),

  update: (id: string, w: Partial<Omit<ApiScheduledWorkout, 'id'>>) =>
    apiFetch<{ workout: ApiScheduledWorkout }>(`/api/user/scheduled-workouts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(w),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/user/scheduled-workouts/${id}`, { method: 'DELETE' }),
};

// ─── User Profile & Settings ─────────────────────────────────────────────────

export interface ApiProfile {
  id: string;
  name?: string | null;
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  fitness_level?: string | null;
  goals?: string[] | null;
  units?: string | null;
  blood_type?: string | null;
  rh_factor?: string | null;
  genotype?: string | null;
  app_settings?: {
    dark_mode?: boolean;
    text_size?: 'small' | 'medium' | 'large';
    notifications?: boolean;
    weight_unit?: 'lbs' | 'kg';
  } | null;
  streak?: number | null;
  created_at?: string | null;
}

export const userProfileApi = {
  get: () =>
    apiFetch<{ profile: ApiProfile }>('/api/user/profile'),

  update: (updates: Partial<Omit<ApiProfile, 'id' | 'created_at'>>) =>
    apiFetch<{ profile: ApiProfile }>('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),
};

// ─── Coach Messages ───────────────────────────────────────────────────────────

export interface ApiCoachMessage {
  id: string;
  role: 'user' | 'coach';
  content: string;
  is_weekly: boolean;
  created_at: string;
}

export const coachMessagesApi = {
  list: (limit = 60) =>
    apiFetch<{ messages: ApiCoachMessage[] }>(`/api/user/coach-messages?limit=${limit}`),

  saveBatch: (messages: Array<{ role: 'user' | 'coach'; content: string; is_weekly?: boolean }>) =>
    apiFetch<{ messages: ApiCoachMessage[] }>('/api/user/coach-messages/batch', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),
};

// ─── Bulk Load ───────────────────────────────────────────────────────────────

export interface ApiAppData {
  profile: ApiProfile | null;
  workout_logs: ApiWorkoutLog[];
  meal_logs: ApiMealLog[];
  body_measurements: ApiBodyMeasurement[];
  water_intake: ApiWaterIntake[];
  scheduled_workouts: ApiScheduledWorkout[];
  coach_messages: ApiCoachMessage[];
}

export const appDataApi = {
  loadAll: () =>
    apiFetch<ApiAppData>('/api/user/app-data'),
};
