import { useState, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { useAppState, type UserProfile } from '@/lib/store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { SyncIndicator } from '@/components/SyncIndicator';

import { Onboarding } from '@/pages/Onboarding';
import { Login } from '@/pages/Login';
import { OAuthSetup } from '@/pages/OAuthSetup';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { VerifyEmail } from '@/pages/VerifyEmail';
import { AuthCallback } from '@/pages/AuthCallback';
import Signup from '@/pages/Signup';
import VerifyEmailOTP from '@/pages/VerifyEmailOTP';
import VerifyPhone from '@/pages/VerifyPhone';
import { Home } from '@/pages/Home';
import { Workouts } from '@/pages/Workouts';
import { WorkoutDetail } from '@/pages/WorkoutDetail';
import { WorkoutPlayer } from '@/pages/WorkoutPlayer';
import { Exercises } from '@/pages/Exercises';
import { ExerciseDetail } from '@/pages/ExerciseDetail';
import { Tracking } from '@/pages/Tracking';
import { Calendar } from '@/pages/Calendar';
import { Nutrition } from '@/pages/Nutrition';
import { Programs } from '@/pages/Programs';
import { Coach } from '@/pages/Coach';
import { Community } from '@/pages/Community';
import { Legacy } from '@/pages/Legacy';
import { Settings } from '@/pages/Settings';
import { Membership } from '@/pages/Membership';
import { WorkoutCreator } from '@/pages/WorkoutCreator';
import { ProgressPhotos } from '@/pages/ProgressPhotos';
import { MacroTargets } from '@/pages/MacroTargets';
import { DeleteAccount } from '@/pages/DeleteAccount';
import { SleepTracking } from '@/pages/SleepTracking';
import { PersonalRecords } from '@/pages/PersonalRecords';
import { PublicProfile } from '@/pages/PublicProfile';
import { PublicProfileSettings } from '@/pages/PublicProfileSettings';
import { Privacy } from '@/pages/Privacy';
import { TermsOfService } from '@/pages/TermsOfService';
import { Support } from '@/pages/Support';
import { Download } from '@/pages/Download';
import { Welcome } from '@/pages/Welcome';
import { Breathing } from '@/pages/Breathing';
import { Calculators } from '@/pages/Calculators';
import { Recipes } from '@/pages/Recipes';
import { HabitTracker } from '@/pages/HabitTracker';
import { Supplements } from '@/pages/Supplements';
import NotFound from '@/pages/not-found';

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
          createdAt: user.created_at,
        };
        completeOnboarding(profile);
      }
    }
  }, [user, state.isOnboarded, completeOnboarding]);

  // Loading — waiting for Supabase to restore session
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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
  if (!state.isOnboarded) {
    const meta = user?.user_metadata ?? {};
    const hasFullFitnessData =
      !!(meta.age && meta.height && meta.weight && (meta.goals as string[])?.length > 0);
    if (!hasFullFitnessData) {
      return <OAuthSetup user={user} onComplete={completeOnboarding} />;
    }
  }

  // Authenticated + verified — show the app
  return (
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
        <MacroTargets />
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
      <Route component={NotFound} />
    </Switch>
    </>
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
          </WouterRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
