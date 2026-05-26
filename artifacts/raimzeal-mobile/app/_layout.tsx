import "react-native-url-polyfill/auto";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  useFonts as useSpaceGroteskFonts,
} from "@expo-google-fonts/space-grotesk";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { BootSplash } from "@/components/BootSplash";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CameraRollRationaleModal } from "@/components/CameraRollRationaleModal";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FitnessProvider, useFitness } from "@/contexts/FitnessContext";
import { MacroGoalsProvider } from "@/contexts/MacroGoalsContext";
import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";
import { ThumbnailSizeProvider } from "@/hooks/useThumbnailSize";
import { Per100gDefaultProvider } from "@/hooks/usePer100gDefault";
import { BootPreferences, loadBootPreferences } from "@/hooks/useBootPreferences";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  loadReminderSettings,
  requestNotificationPermissions,
  scheduleReminders,
} from "@/lib/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/** Bootstraps notifications silently after first session load */
async function initNotifications() {
  if (Platform.OS === "web") return;
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return;
    const settings = await loadReminderSettings();
    const hasAnyOn = Object.values(settings).some(Boolean);
    if (hasAnyOn) await scheduleReminders(settings);
  } catch (err) {
    console.warn("[initNotifications] failed (non-fatal):", err);
  }
}

/** Redirects between auth and app based on session */
function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notificationsInitialised = useRef(false);
  const rationaleShown = useRef(false);
  const { cameraRollStatus, permissionsBootstrapped, hasSeenRationale, markRationaleDismissed, requestCameraRollPermission } = usePermissions();
  const [showRationale, setShowRationale] = useState(false);
  const { isOnboarded, stateHydrated } = useFitness();

  useEffect(() => {
    if (loading) return;
    if (!isSupabaseConfigured) return; // no-op: let app run without auth

    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) {
      router.replace("/auth/welcome");
    } else if (session && inAuthGroup && segments[1] !== "health-onboarding") {
      // Wait for AsyncStorage to hydrate before checking onboarding status
      if (!stateHydrated) return;
      if (!isOnboarded) {
        router.replace("/auth/health-onboarding");
      } else {
        router.replace("/(tabs)");
      }
    } else if (session && !inAuthGroup) {
      // Already in app — redirect to onboarding if not yet completed
      if (stateHydrated && !isOnboarded) {
        router.replace("/auth/health-onboarding");
      }
    }

    // Initialise notifications once per session
    if (session && !notificationsInitialised.current) {
      notificationsInitialised.current = true;
      initNotifications();
    }

    // Show the in-app rationale sheet once per session when permission is
    // undetermined AND the user hasn't already dismissed it in a prior session.
    // We wait for `permissionsBootstrapped` so that both the OS status and the
    // AsyncStorage dismissal flag are fully loaded before deciding — this
    // prevents a transient flash of the modal before the persisted flag arrives.
    // If they previously tapped "Not Now", skip the sheet entirely so they are
    // never asked twice — the save flow will go straight to the OS prompt on
    // the next explicit save attempt.
    if (
      session &&
      permissionsBootstrapped &&
      !rationaleShown.current &&
      cameraRollStatus === "undetermined" &&
      !hasSeenRationale
    ) {
      rationaleShown.current = true;
      setShowRationale(true);
    }
  }, [session, loading, segments, cameraRollStatus, permissionsBootstrapped, hasSeenRationale, isOnboarded, stateHydrated]);

  const handleAllow = useCallback(() => {
    setShowRationale(false);
    requestCameraRollPermission().catch(() => {
      // Non-fatal — the save flow will fall back to requesting on demand
    });
  }, [requestCameraRollPermission]);

  const handleNotNow = useCallback(() => {
    setShowRationale(false);
    // Persist the dismissal so the pre-prompt is never shown again while the
    // OS permission remains undetermined. The flag is cleared automatically
    // once the OS reaches a definitive granted/denied state.
    markRationaleDismissed().catch(() => {});
  }, [markRationaleDismissed]);

  return (
    <>
      <Slot />
      <CameraRollRationaleModal
        visible={showRationale}
        onAllow={handleAllow}
        onNotNow={handleNotNow}
      />
    </>
  );
}

export default function RootLayout() {
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [groteskLoaded, groteskError] = useSpaceGroteskFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const fontsLoaded = interLoaded && groteskLoaded;
  const fontError = interError || groteskError;

  const [bootPrefs, setBootPrefs] = useState<BootPreferences | null>(null);

  useEffect(() => {
    loadBootPreferences().then(setBootPrefs);
  }, []);

  const appReady = (fontsLoaded || !!fontError) && bootPrefs !== null;

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) return <BootSplash />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <FitnessProvider>
                  <MacroGoalsProvider initialGoals={bootPrefs.macroGoals}>
                    <PermissionsProvider initialRationaleDismissed={bootPrefs.cameraRollRationaleDismissed}>
                      <ThumbnailSizeProvider initialSize={bootPrefs.thumbnailSize}>
                        <Per100gDefaultProvider initialValue={bootPrefs.defaultPer100g}>
                          <AuthGate />
                        </Per100gDefaultProvider>
                      </ThumbnailSizeProvider>
                    </PermissionsProvider>
                  </MacroGoalsProvider>
                </FitnessProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
