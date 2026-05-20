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
import { Settings } from '@/pages/Settings';
import { Membership } from '@/pages/Membership';
import { Pricing } from '@/pages/Pricing';
import { Billing } from '@/pages/Billing';
import { Privacy } from '@/pages/Privacy';
import { TermsOfService } from '@/pages/TermsOfService';
import { Support } from '@/pages/Support';
import NotFound from '@/pages/not-found';

// ─── Route wrappers (rendered inside WouterRouter so hooks work) ─────────────

function SignupRoute() {
  const [, navigate] = useLocation();
  return <Signup onLogin={() => navigate('/')} />;
}

function LoginRoute() {
  const [, navigate] = useLocation();
  return <Login onBack={() => navigate('/')} />;
}

function MembershipRoute() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!session) return <Pricing />;
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
    completeOnboarding,
    addWorkoutLog,
    addMealLog,
    updateWaterIntake,
    scheduleWorkout,
    addBodyMeasurement,
    updateSettings,
    updateProfile,
    exportData,
    exportPdfReport,
  } = useAppState(user?.id);

  const [showLogin, setShowLogin] = useState(false);

  // Sync theme
  useEffect(() => {
    if (state.settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.darkMode]);

  useEffect(() => {
    document.documentElement.classList.remove('text-size-small', 'text-size-medium', 'text-size-large');
    document.documentElement.classList.add(`text-size-${state.settings.textSize}`);
  }, [state.settings.textSize]);

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
          units: 'imperial',
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

  // Phone verification gate: shown when user has a phone on file but hasn't verified it
  // (only applies to users created via the /signup OTP flow, who have phone_e164 in metadata)
  const phoneE164 = user?.user_metadata?.phone_e164 as string | undefined;
  const phoneVerified = user?.user_metadata?.phone_verified === true;
  if (phoneE164 && !phoneVerified) {
    const base = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';
    return (
      <VerifyPhone
        onVerified={() => { window.location.href = base || '/'; }}
      />
    );
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
    <Switch>
      <Route path="/">
        <Home state={state} onUpdateWater={updateWaterIntake} />
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
        <Tracking state={state} onAddMeasurement={addBodyMeasurement} />
      </Route>
      <Route path="/calendar">
        <Calendar state={state} onScheduleWorkout={scheduleWorkout} />
      </Route>
      <Route path="/nutrition">
        <Nutrition state={state} onAddMeal={addMealLog} />
      </Route>
      <Route path="/programs">
        <Programs />
      </Route>
      <Route path="/coach">
        <Coach state={state} />
      </Route>
      <Route path="/community">
        <Community />
      </Route>
      <Route path="/settings">
        <Settings
          state={state}
          onUpdateSettings={updateSettings}
          onUpdateProfile={updateProfile}
          onExportData={exportData}
          onExportPdfReport={exportPdfReport}
          onLogout={signOut}
        />
      </Route>
      <Route path="/membership">
        <Membership />
      </Route>
      <Route path="/pricing">
        <Pricing />
      </Route>
      <Route path="/billing">
        <Billing />
      </Route>
      <Route component={NotFound} />
    </Switch>
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
              {/* Public commerce pages */}
              <Route path="/pricing"><Pricing /></Route>
              <Route path="/membership"><MembershipRoute /></Route>
              {/* Static pages */}
              <Route path="/privacy"><Privacy /></Route>
              <Route path="/terms"><TermsOfService /></Route>
              <Route path="/support"><Support /></Route>
              {/* Auth flow */}
              <Route path="/forgot-password"><ForgotPassword /></Route>
              <Route path="/auth/reset-password"><ResetPassword /></Route>
              <Route path="/auth/callback"><AuthCallback /></Route>
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
