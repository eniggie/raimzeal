import { enableScreens } from "react-native-screens";
enableScreens(false);
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
import { Animated, Platform, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import { PostHogProvider } from "posthog-react-native";

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
import { CardPreferencesProvider } from "@/hooks/useCardPreferences";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  configureNotificationHandler,
  loadReminderSettings,
  requestNotificationPermissions,
  scheduleReminders,
} from "@/lib/notifications";
import { configureRevenueCat } from "@/lib/revenuecat";

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;
const SENTRY_DSN = extra.sentryDsn;
const POSTHOG_KEY = extra.posthogKey;
const POSTHOG_HOST = extra.posthogHost || "https://us.i.posthog.com";

// Crash + error monitoring. Only active in release builds (not Expo Go / dev),
// and only when a DSN is configured in app.json → extra.sentryDsn.
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.2,
    enabled: !__DEV__,
  });
}

SplashScreen.preventAutoHideAsync();

if (Platform.OS !== "web") configureRevenueCat();

const queryClient = new QueryClient();

/** Bootstraps notifications silently after first session load */
async function initNotifications() {
  if (Platform.OS === "web") return;
  try {
    await configureNotificationHandler();
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
  const segments = useSegments() as string[];
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

function RootLayout() {
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
    loadBootPreferences().then(setBootPrefs).catch(() => {
      setBootPrefs({
        thumbnailSize: "m",
        defaultPer100g: false,
        macroGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
        cameraRollRationaleDismissed: false,
        cardAction: null,
        cardAutoTriggerDelay: "3",
        lastTab: "index",
      });
    });
  }, []);

  // Safety valve: if fonts have not signalled loaded/error after 5 s (e.g.
  // a production bundle issue or a React-Compiler hook-stale bug), proceed
  // anyway so SplashScreen.hideAsync() is never skipped indefinitely.
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const appReady = (fontsLoaded || !!fontError || fontTimedOut) && bootPrefs !== null;

  const splashFadeAnim = useRef(new Animated.Value(1)).current;
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (!appReady) return;
    SplashScreen.hideAsync().then(
      () => {
        Animated.timing(splashFadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) setSplashDone(true);
        });
      },
      () => {
        setSplashDone(true);
      },
    );
  }, [appReady, splashFadeAnim]);

  // SafeAreaProvider is required before any SafeAreaView can render.
  // Wrapping the pre-ready skeleton here prevents an uncaught throw that
  // would leave the native splash screen (black bg) frozen on screen.
  if (!appReady) {
    return (
      <SafeAreaProvider>
        <BootSplash tab={bootPrefs?.lastTab} />
      </SafeAreaProvider>
    );
  }

  const appTree = (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <AuthProvider>
              <FitnessProvider>
                <MacroGoalsProvider initialGoals={bootPrefs.macroGoals}>
                  <PermissionsProvider initialRationaleDismissed={bootPrefs.cameraRollRationaleDismissed}>
                    <ThumbnailSizeProvider initialSize={bootPrefs.thumbnailSize}>
                      <Per100gDefaultProvider initialValue={bootPrefs.defaultPer100g}>
                        <CardPreferencesProvider
                          initialAction={bootPrefs.cardAction}
                          initialDelay={bootPrefs.cardAutoTriggerDelay}
                        >
                          <AuthGate />
                        </CardPreferencesProvider>
                      </Per100gDefaultProvider>
                    </ThumbnailSizeProvider>
                  </PermissionsProvider>
                </MacroGoalsProvider>
              </FitnessProvider>
            </AuthProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
      {!splashDone && (
        <Animated.View
          pointerEvents="none"
          style={[styles.splashOverlay, { opacity: splashFadeAnim }]}
        >
          <BootSplash tab={bootPrefs.lastTab} />
        </Animated.View>
      )}
    </SafeAreaProvider>
  );

  // Product analytics. Wraps the app only when a key is configured
  // (app.json → extra.posthogKey); otherwise renders the app untouched.
  return POSTHOG_KEY ? (
    <PostHogProvider
      apiKey={POSTHOG_KEY}
      options={{ host: POSTHOG_HOST }}
      autocapture
    >
      {appTree}
    </PostHogProvider>
  ) : (
    appTree
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
