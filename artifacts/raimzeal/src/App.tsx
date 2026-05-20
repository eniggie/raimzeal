import { useState, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { useAppState, type UserProfile } from '@/lib/store';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

import { Onboarding } from '@/pages/Onboarding';
import { Login } from '@/pages/Login';
import { ForgotPassword } from '@/pages/ForgotPassword';
import { ResetPassword } from '@/pages/ResetPassword';
import { VerifyEmail } from '@/pages/VerifyEmail';
import { AuthCallback } from '@/pages/AuthCallback';
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
import { Privacy } from '@/pages/Privacy';
import { TermsOfService } from '@/pages/TermsOfService';
import { Support } from '@/pages/Support';
import NotFound from '@/pages/not-found';

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

  // When a verified session is established, auto-complete onboarding from Supabase metadata
  useEffect(() => {
    if (user && user.email_confirmed_at && !state.isOnboarded) {
      const meta = user.user_metadata ?? {};
      if (meta.name) {
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

  // Authenticated but email not verified
  if (!user?.email_confirmed_at) {
    return <VerifyEmail email={user?.email} onSignOut={signOut} />;
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Toaster />
            <Switch>
              <Route path="/privacy"><Privacy /></Route>
              <Route path="/terms"><TermsOfService /></Route>
              <Route path="/support"><Support /></Route>
              <Route path="/forgot-password"><ForgotPassword /></Route>
              <Route path="/auth/reset-password"><ResetPassword /></Route>
              <Route path="/auth/callback"><AuthCallback /></Route>
              <Route><AppContent /></Route>
            </Switch>
          </WouterRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
