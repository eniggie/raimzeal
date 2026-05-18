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
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { FitnessProvider } from "@/contexts/FitnessContext";
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
  } catch {
    // Non-fatal — app continues normally
  }
}

/** Redirects between auth and app based on session */
function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const notificationsInitialised = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!isSupabaseConfigured) return; // no-op: let app run without auth

    const inAuthGroup = segments[0] === "auth";
    if (!session && !inAuthGroup) {
      router.replace("/auth/welcome");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }

    // Initialise notifications once per session
    if (session && !notificationsInitialised.current) {
      notificationsInitialised.current = true;
      initNotifications();
    }
  }, [session, loading, segments]);

  return <Slot />;
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <AuthProvider>
                <FitnessProvider>
                  <AuthGate />
                </FitnessProvider>
              </AuthProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
