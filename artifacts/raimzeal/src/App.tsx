import { useState, useEffect, lazy, Suspense } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppState, type UserProfile } from '@/lib/store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncStatusProvider } from '@/contexts/SyncStatusContext';
import { supabaseConfigured } from '@/lib/supabase';
import { SyncIndicator } from '@/components/SyncIndicator';
import { BrandedLoader } from '@/components/BrandedLoader';

// Wraps React.lazy() so a failed dynamic import — which after a new deploy
// usually means the chunk's content hash changed and the old file is gone (the
// classic "ChunkLoadError" that leaves an already-open tab blank) — triggers a
// single full reload to fetch the fresh index.html and chunk map. The flag is
// cleared on any successful load so each deploy gets its own one-shot retry.
const CHUNK_RELOAD_KEY = 'raimzeal_chunk_reloaded';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory()
      .then((m) => {
        try { sessionStorage.removeItem(CHUNK_RELOAD_KEY); } catch { /* ignore */ }
        return m;
      })
      .catch((err) => {
        let alreadyReloaded = false;
        try { alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1'; } catch { /* ignore */ }
        if (!alreadyReloaded) {
          try { sessionStorage.setItem(CHUNK_RELOAD_KEY, '1'); } catch { /* ignore */ }
          window.location.reload();
          // Never resolve — the page is reloading; avoids flashing the error UI.
          return new Promise<{ default: T }>(() => {});
        }
        throw err;
      }),
  );
}

// Every route below is code-split with lazyWithRetry() so a first-time visitor
// only downloads the JS for the page they land on, instead of the whole app.
const Onboarding = lazyWithRetry(() => import('@/pages/Onboarding').then(m => ({ default: m.Onboarding })));
const Login = lazyWithRetry(() => import('@/pages/Login').then(m => ({ default: m.Login })));
const OAuthSetup = lazyWithRetry(() => import('@/pages/OAuthSetup').then(m => ({ default: m.OAuthSetup })));
const ForgotPassword = lazyWithRetry(() => import('@/pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazyWithRetry(() => import('@/pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const VerifyEmail = lazyWithRetry(() => import('@/pages/VerifyEmail').then(m => ({ default: m.VerifyEmail })));
const AuthCallback = lazyWithRetry(() => import('@/pages/AuthCallback').then(m => ({ default: m.AuthCallback })));
const Signup = lazyWithRetry(() => import('@/pages/Signup'));
const VerifyEmailOTP = lazyWithRetry(() => import('@/pages/VerifyEmailOTP'));
const VerifyPhone = lazyWithRetry(() => import('@/pages/VerifyPhone'));
const Home = lazyWithRetry(() => import('@/pages/Home').then(m => ({ default: m.Home })));
const Workouts = lazyWithRetry(() => import('@/pages/Workouts').then(m => ({ default: m.Workouts })));
const WorkoutDetail = lazyWithRetry(() => import('@/pages/WorkoutDetail').then(m => ({ default: m.WorkoutDetail })));
const WorkoutPlayer = lazyWithRetry(() => import('@/pages/WorkoutPlayer').then(m => ({ default: m.WorkoutPlayer })));
const Exercises = lazyWithRetry(() => import('@/pages/Exercises').then(m => ({ default: m.Exercises })));
const ExerciseDetail = lazyWithRetry(() => import('@/pages/ExerciseDetail').then(m => ({ default: m.ExerciseDetail })));
const Tracking = lazyWithRetry(() => import('@/pages/Tracking').then(m => ({ default: m.Tracking })));
const Calendar = lazyWithRetry(() => import('@/pages/Calendar').then(m => ({ default: m.Calendar })));
const Nutrition = lazyWithRetry(() => import('@/pages/Nutrition').then(m => ({ default: m.Nutrition })));
const Programs = lazyWithRetry(() => import('@/pages/Programs').then(m => ({ default: m.Programs })));
const Coach = lazyWithRetry(() => import('@/pages/Coach').then(m => ({ default: m.Coach })));
const Community = lazyWithRetry(() => import('@/pages/Community').then(m => ({ default: m.Community })));
const Legacy = lazyWithRetry(() => import('@/pages/Legacy').then(m => ({ default: m.Legacy })));
const Settings = lazyWithRetry(() => import('@/pages/Settings').then(m => ({ default: m.Settings })));
const Membership = lazyWithRetry(() => import('@/pages/Membership').then(m => ({ default: m.Membership })));
const WorkoutCreator = lazyWithRetry(() => import('@/pages/WorkoutCreator').then(m => ({ default: m.WorkoutCreator })));
const ProgressPhotos = lazyWithRetry(() => import('@/pages/ProgressPhotos').then(m => ({ default: m.ProgressPhotos })));
const MacroTargets = lazyWithRetry(() => import('@/pages/MacroTargets').then(m => ({ default: m.MacroTargets })));
const DeleteAccount = lazyWithRetry(() => import('@/pages/DeleteAccount').then(m => ({ default: m.DeleteAccount })));
const SleepTracking = lazyWithRetry(() => import('@/pages/SleepTracking').then(m => ({ default: m.SleepTracking })));
const PersonalRecords = lazyWithRetry(() => import('@/pages/PersonalRecords').then(m => ({ default: m.PersonalRecords })));
const PublicProfile = lazyWithRetry(() => import('@/pages/PublicProfile').then(m => ({ default: m.PublicProfile })));
const PublicProfileSettings = lazyWithRetry(() => import('@/pages/PublicProfileSettings').then(m => ({ default: m.PublicProfileSettings })));
const Privacy = lazyWithRetry(() => import('@/pages/Privacy').then(m => ({ default: m.Privacy })));
const TermsOfService = lazyWithRetry(() => import('@/pages/TermsOfService').then(m => ({ default: m.TermsOfService })));
const Support = lazyWithRetry(() => import('@/pages/Support').then(m => ({ default: m.Support })));
const Download = lazyWithRetry(() => import('@/pages/Download').then(m => ({ default: m.Download })));
const Welcome = lazyWithRetry(() => import('@/pages/Welcome').then(m => ({ default: m.Welcome })));
const Breathing = lazyWithRetry(() => import('@/pages/Breathing').then(m => ({ default: m.Breathing })));
const Calculators = lazyWithRetry(() => import('@/pages/Calculators').then(m => ({ default: m.Calculators })));
const Recipes = lazyWithRetry(() => import('@/pages/Recipes').then(m => ({ default: m.Recipes })));
const HabitTracker = lazyWithRetry(() => import('@/pages/HabitTracker').then(m => ({ default: m.HabitTracker })));
const Supplements = lazyWithRetry(() => import('@/pages/Supplements').then(m => ({ default: m.Supplements })));
const AdminSettings = lazyWithRetry(() => import('@/pages/AdminSettings').then(m => ({ default: m.AdminSettings })));
const NotFound = lazyWithRetry(() => import('@/pages/not-found'));

// ─── Route-level loading fallback ──────────────────────────────────────────────

function RouteFallback() {
  // Shown while a route's code-split chunk downloads (including the very first
  // paint), so use the branded loader for a cohesive first impression.
  return <BrandedLoader />;
}

// ─── Redirect helper ──────────────────────────────────────────────────────────

function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(to, { replace: true }); }, [navigate, to]);
  return null;
}

// ─── Route wrappers (rendered inside WouterRouter so hooks work) ─────────────

function SignupRoute() {
  const [, navigate] = useLocation();
  return <Signup onLogin={() => navigate('/login')} />;
}

function LoginRoute() {
  const [, navigate] = useLocation();
  return <Login onBack={() => navigate('/')} />;
}

function MembershipRoute() {
  return <Membership />;
}

function VerifyPhoneRoute() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
  return (
    <VerifyPhone
      onVerified={() => { window.location.href = base || '/'; }}
    />
  );
}

// ─── AppContent ───────────────────────────────────────────────────────────────

function AppContent() {
  const { session, user, loading, signOut } = useAuth();
  const {
    state,
    cloudSynced,
    syncError,
    writeSyncStatus,
    lastSyncedAt,
    completeOnboarding,
    addWorkoutLog,
    removeWorkoutLog,
    removeWorkoutLogOptimistic,
    restoreWorkoutLog,
    confirmWorkoutRemoval,
    addMealLog,
    updateMealLog,
    removeMealLog,
    removeMealLogOptimistic,
    restoreMealLog,
    confirmMealRemoval,
    updateWaterIntake,
    scheduleWorkout,
    addBodyMeasurement,
    updateSettings,
    updateProfile,
    exportPdfReport,
  } = useAppState(user?.id, user?.email);

  const [showLogin, setShowLogin] = useState(false);

  // Sync theme
  useEffect(() => {
    if (state.settings?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings?.darkMode]);

  useEffect(() => {
    document.documentElement.classList.remove('text-size-small', 'text-size-medium', 'text-size-large');
    document.documentElement.classList.add(`text-size-${state.settings?.textSize ?? 'medium'}`);
  }, [state.settings?.textSize]);

  // Auto-complete onboarding from metadata saved during Onboarding signup flow.
  // Only runs when the user has full fitness data (age/height/weight/goals) stored in metadata.
  // Users from the quick /signup form will go through OAuthSetup for fitness data collection.
  useEffect(() => {
    // Wait for the cloud profile to load before deciding the user needs
    // onboarding. `state.isOnboarded` is false on every fresh device until the
    // cloud load completes, so acting earlier would overwrite the user's real
    // cloud profile with stale signup-time metadata (and inject sample data).
    if (!cloudSynced) return;
    if (user && user.email_confirmed_at && !state.isOnboarded) {
      const provider = (user.app_metadata as Record<string, unknown>)?.provider as string | undefined;
      const isOAuth = provider && provider !== 'email';
      if (isOAuth) return;

      const meta = user.user_metadata ?? {};
      const hasFullFitnessData =
        meta.name && meta.age && meta.height && meta.weight && (meta.goals as string[])?.length > 0;
      if (hasFullFitnessData) {
        const profile: UserProfile = {
          id: user.id,
          name: meta.name as string,
          email: user.email ?? '',
          age: Number(meta.age) || 25,
          height: Number(meta.height) || 68,
          weight: Number(meta.weight) || 160,
          fitnessLevel: (meta.fitnessLevel as UserProfile['fitnessLevel']) ?? 'beginner',
          goals: (meta.goals as string[]) ?? [],
          units: (meta.units as 'metric' | 'imperial' | undefined) ?? 'imperial',
          bloodType: (meta.bloodType as UserProfile['bloodType']) ?? undefined,
          rhFactor: (meta.rhFactor as UserProfile['rhFactor']) ?? undefined,
          genotype: (meta.genotype as UserProfile['genotype']) ?? undefined,
          createdAt: user.created_at,
        };
        completeOnboarding(profile);
      }
    }
  }, [user, state.isOnboarded, completeOnboarding, cloudSynced]);

  // Loading — waiting for Supabase to restore session
  if (loading) {
    return <BrandedLoader label="Restoring your session…" />;
  }

  // Not authenticated
  if (!session) {
    if (showLogin) {
      return <Login onBack={() => setShowLogin(false)} />;
    }
    return <Onboarding onLogin={() => setShowLogin(true)} />;
  }

  // Authenticated but email not verified (legacy link-based flow)
  if (!user?.email_confirmed_at) {
    return <VerifyEmail email={user?.email} onSignOut={signOut} />;
  }

  // Profile setup for users without fitness data:
  // - All OAuth users (Google/Apple)
  // - Email users created via /signup (quick form — no fitness data in metadata)
  // Wait for the cloud load first: an existing user signing in on a fresh
  // browser has isOnboarded=false until their cloud profile arrives, and
  // rendering OAuthSetup before then lets them overwrite a real profile with
  // defaults. While the cloud load is in flight, show the loader instead.
  if (!state.isOnboarded) {
    if (!cloudSynced) {
      return <BrandedLoader label="Syncing your data…" />;
    }
    const meta = user?.user_metadata ?? {};
    const hasFullFitnessData =
      !!(meta.age && meta.height && meta.weight && (meta.goals as string[])?.length > 0);
    if (!hasFullFitnessData) {
      return <OAuthSetup user={user} onComplete={completeOnboarding} />;
    }
  }

  // Authenticated + verified — show the app
  return (
    <SyncStatusProvider lastSyncedAt={lastSyncedAt} loggedIn={!!session} syncConfigured={supabaseConfigured}>
    <>
      {/* Top loading bar — visible while initial cloud data is being fetched */}
      {session && !cloudSynced && (
        <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-primary/20 overflow-hidden">
          <div
            className="h-full bg-primary animate-[shimmer_1.4s_ease-in-out_infinite]"
            style={{ width: '40%', animation: 'cloudload 1.4s ease-in-out infinite' }}
          />
          <style>{`
            @keyframes cloudload {
              0%   { transform: translateX(-100%); }
              100% { transform: translateX(350%); }
            }
          `}</style>
        </div>
      )}

      {/* Error banner — shown when initial cloud load failed */}
      {syncError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500/90 text-yellow-950 text-center text-xs py-1.5 px-4 font-medium">
          Cloud sync unavailable — your data is saved locally and will sync when the connection is restored.
        </div>
      )}

      {/* Per-write sync indicator — bottom-right pill */}
      <SyncIndicator status={writeSyncStatus} />

    <Suspense fallback={<RouteFallback />}>
    <Switch>
      <Route path="/">
        <Home state={state} onUpdateWater={updateWaterIntake} onUpdateSettings={updateSettings} />
      </Route>
      <Route path="/workouts">
        <Workouts />
      </Route>
      <Route path="/workout/:id">
        <WorkoutDetail />
      </Route>
      <Route path="/workout/:id/play">
        <WorkoutPlayer onComplete={addWorkoutLog} />
      </Route>
      <Route path="/exercises">
        <Exercises />
      </Route>
      <Route path="/exercise/:name">
        <ExerciseDetail />
      </Route>
      <Route path="/tracking">
        <Tracking
          state={state}
          onAddMeasurement={addBodyMeasurement}
          onRemoveWorkoutLogOptimistic={removeWorkoutLogOptimistic}
          onRestoreWorkoutLog={restoreWorkoutLog}
          onConfirmWorkoutRemoval={confirmWorkoutRemoval}
        />
      </Route>
      <Route path="/calendar">
        <Calendar state={state} onScheduleWorkout={scheduleWorkout} />
      </Route>
      <Route path="/nutrition">
        <Nutrition
          state={state}
          onAddMeal={addMealLog}
          onUpdateMeal={updateMealLog}
          onUpdateWater={updateWaterIntake}
          onRemoveMealLogOptimistic={removeMealLogOptimistic}
          onRestoreMealLog={restoreMealLog}
          onConfirmMealRemoval={confirmMealRemoval}
        />
      </Route>
      <Route path="/programs">
        <Programs />
      </Route>
      <Route path="/coach">
        <Coach state={state} onUpdateProfile={updateProfile} />
      </Route>
      <Route path="/community">
        <Community />
      </Route>
      <Route path="/legacy">
        <Legacy />
      </Route>
      <Route path="/settings">
        <Settings
          state={state}
          onUpdateSettings={updateSettings}
          onUpdateProfile={updateProfile}
          onLogout={signOut}
          lastSyncedAt={lastSyncedAt}
        />
      </Route>
      <Route path="/membership">
        <Membership />
      </Route>
      <Route path="/workouts/create">
        <WorkoutCreator />
      </Route>
      <Route path="/progress/photos">
        <ProgressPhotos />
      </Route>
      <Route path="/sleep">
        <SleepTracking />
      </Route>
      <Route path="/progress/prs">
        <PersonalRecords />
      </Route>
      <Route path="/settings/macros">
        <MacroTargets user={state.user} />
      </Route>
      <Route path="/settings/delete-account">
        <DeleteAccount />
      </Route>
      <Route path="/settings/public-profile">
        <PublicProfileSettings />
      </Route>
      <Route path="/u/:handle">
        <PublicProfile />
      </Route>
      <Route path="/breathing">
        <Breathing />
      </Route>
      <Route path="/calculators">
        <Calculators />
      </Route>
      <Route path="/recipes">
        <Recipes />
      </Route>
      <Route path="/habits">
        <HabitTracker />
      </Route>
      <Route path="/supplements">
        <Supplements />
      </Route>
      <Route path="/settings/admin">
        <AdminSettings />
      </Route>
      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </>
    </SyncStatusProvider>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Toaster />
            <Suspense fallback={<RouteFallback />}>
            <Switch>
              {/* Public / pre-auth routes */}
              <Route path="/signup"><SignupRoute /></Route>
              <Route path="/login"><LoginRoute /></Route>
              <Route path="/verify-email"><VerifyEmailOTP /></Route>
              <Route path="/verify-phone"><VerifyPhoneRoute /></Route>
              {/* Support / membership / post-checkout pages */}
              <Route path="/membership"><MembershipRoute /></Route>
              <Route path="/welcome"><Welcome /></Route>
              {/* Static pages */}
              <Route path="/privacy"><Privacy /></Route>
              <Route path="/terms"><TermsOfService /></Route>
              <Route path="/support"><Support /></Route>
              <Route path="/download"><Download /></Route>
              {/* Auth flow */}
              <Route path="/forgot-password"><ForgotPassword /></Route>
              <Route path="/reset-password"><ResetPassword /></Route>
              <Route path="/auth/reset-password"><ResetPassword /></Route>
              <Route path="/auth/callback"><AuthCallback /></Route>
              {/* Common route aliases — redirect to canonical paths */}
              <Route path="/home"><Redirect to="/" /></Route>
              <Route path="/ovia-ai"><Redirect to="/coach" /></Route>
              <Route path="/progress"><Redirect to="/tracking" /></Route>
              <Route path="/profile"><Redirect to="/settings" /></Route>
              <Route path="/measurements"><Redirect to="/tracking" /></Route>
              <Route path="/progress-photos"><Redirect to="/progress/photos" /></Route>
              <Route path="/public-profile"><Redirect to="/settings/public-profile" /></Route>
              <Route path="/pricing"><Redirect to="/membership" /></Route>
              <Route path="/contact"><Redirect to="/support" /></Route>
              <Route path="/privacy-policy"><Redirect to="/privacy" /></Route>
              <Route path="/delete-account"><Redirect to="/settings/delete-account" /></Route>
              <Route path="/body-measurements"><Redirect to="/tracking" /></Route>
              <Route path="/export"><Redirect to="/settings" /></Route>
              {/* All other routes — handled by AppContent based on auth state */}
              <Route><AppContent /></Route>
            </Switch>
            </Suspense>
          </WouterRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
