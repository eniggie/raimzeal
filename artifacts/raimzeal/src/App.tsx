import { useState, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter } from 'wouter';
import { queryClient } from './lib/queryClient';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAppState } from '@/lib/store';

import { Onboarding } from '@/pages/Onboarding';
import { Login } from '@/pages/Login';
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
  const {
    state,
    completeOnboarding,
    login,
    logout,
    addWorkoutLog,
    addMealLog,
    updateWaterIntake,
    scheduleWorkout,
    addBodyMeasurement,
    updateSettings,
    updateProfile,
    exportData,
    exportPdfReport,
  } = useAppState();

  const [showLogin, setShowLogin] = useState(false);

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

  if (!state.isOnboarded && !state.isLoggedIn) {
    if (showLogin) {
      return (
        <Login
          onLogin={(email, password) => {
            login(email, password);
            setShowLogin(false);
          }}
          onBack={() => setShowLogin(false)}
        />
      );
    }
    return (
      <Onboarding
        onComplete={completeOnboarding}
        onLogin={() => setShowLogin(true)}
      />
    );
  }

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
          onLogout={logout}
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
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Toaster />
          <Switch>
            <Route path="/privacy"><Privacy /></Route>
            <Route path="/terms"><TermsOfService /></Route>
            <Route path="/support"><Support /></Route>
            <Route><AppContent /></Route>
          </Switch>
        </WouterRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
