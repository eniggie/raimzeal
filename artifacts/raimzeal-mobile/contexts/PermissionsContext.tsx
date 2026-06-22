import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as MediaLibrary from "expo-media-library";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchUserPreferences, upsertUserPreferences } from "@/lib/db";

export type CameraRollPermissionStatus = "granted" | "denied" | "undetermined" | "restricted";

const RATIONALE_DISMISSED_KEY = "camera_roll_rationale_dismissed";

interface PermissionsContextType {
  cameraRollStatus: CameraRollPermissionStatus | null;
  /**
   * True once both the OS permission status and the AsyncStorage dismissal
   * flag have finished loading. Consumers should wait for this before
   * deciding whether to show the rationale modal.
   */
  permissionsBootstrapped: boolean;
  /**
   * True if the user previously tapped "Not Now" on the in-app rationale
   * sheet and the OS permission is still undetermined. The flag is cleared
   * automatically when the OS grants or denies the permission.
   */
  hasSeenRationale: boolean;
  /**
   * Persists the flag that the user dismissed the in-app pre-prompt.
   * Call this when the user taps "Not Now" on the rationale sheet.
   */
  markRationaleDismissed: () => Promise<void>;
  /**
   * Clears the rationale-dismissed flag so the explanation sheet will
   * re-appear on the next save attempt. Only meaningful when
   * cameraRollStatus is "undetermined".
   */
  resetRationale: () => Promise<void>;
  /**
   * Shows an in-app explanation dialog, then — if the user accepts — triggers
   * the OS photo-library permission prompt and caches the result.
   * Resolves to "undetermined" if the user declines or dismisses without granting.
   */
  requestCameraRollPermission: () => Promise<CameraRollPermissionStatus>;
  /** Updates the cached status without triggering a new OS prompt. */
  updateCameraRollStatus: (status: CameraRollPermissionStatus) => void;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

async function checkPermission(): Promise<CameraRollPermissionStatus> {
  try {
    const { status } = await MediaLibrary.getPermissionsAsync(true, []);
    return status as CameraRollPermissionStatus;
  } catch {
    return "undetermined";
  }
}

interface PermissionsProviderProps {
  children: React.ReactNode;
  /**
   * Pre-loaded value of the rationale-dismissed flag from `loadBootPreferences()`.
   * Seeding this avoids a redundant AsyncStorage read inside the bootstrap
   * (the OS permission check and optional Supabase call still run as normal).
   */
  initialRationaleDismissed?: boolean;
}

export function PermissionsProvider({ children, initialRationaleDismissed = false }: PermissionsProviderProps) {
  const [cameraRollStatus, setCameraRollStatus] = useState<CameraRollPermissionStatus | null>(null);
  const [hasSeenRationale, setHasSeenRationale] = useState(initialRationaleDismissed);
  const [permissionsBootstrapped, setPermissionsBootstrapped] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  // Kept in sync with cameraRollStatus state so the auth-change callback can
  // read the latest value without being re-subscribed on every status change.
  const cameraRollStatusRef = useRef<CameraRollPermissionStatus | null>(null);
  cameraRollStatusRef.current = cameraRollStatus;

  useEffect(() => {
    /**
     * Bootstrap order (all must resolve before permissionsBootstrapped = true):
     *  1. OS permission status check  (always needed; can't be pre-fetched)
     *  2. Local AsyncStorage flag — already seeded via `initialRationaleDismissed`
     *     from `loadBootPreferences()`, so no extra read is needed here.
     *  3. Remote Supabase preference (for signed-in returning users on a fresh
     *     install whose local AsyncStorage was wiped by the uninstall)
     *
     * Remote wins over local when both are present, so a user who dismissed
     * the rationale before reinstalling will not see the sheet again.
     */
    async function bootstrap() {
      const status = await checkPermission();

      setCameraRollStatus(status);

      // If permission is already resolved the flag is irrelevant; clear it.
      if (status !== "undetermined") {
        AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY).catch(() => {});
        setHasSeenRationale(false);
        setPermissionsBootstrapped(true);
        return;
      }

      // Permission is still undetermined — start from the pre-seeded value
      // (initialRationaleDismissed) and let Supabase override if available.
      let effectiveDismissed = initialRationaleDismissed;

      // For signed-in users, the cloud value is the source of truth on fresh
      // installs (local AsyncStorage was wiped by the uninstall).
      if (isSupabaseConfigured) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const prefs = await fetchUserPreferences(session.user.id);
            const remote = prefs?.appSettings?.cameraRollRationaleDismissed;
            if (remote != null) {
              effectiveDismissed = remote;
              // Seed AsyncStorage so subsequent cold starts don't need a network call.
              if (remote) {
                AsyncStorage.setItem(RATIONALE_DISMISSED_KEY, "true").catch(() => {});
              } else {
                AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY).catch(() => {});
              }
            }
          }
        } catch {
          // Non-fatal: keep the local value if the network call fails.
        }
      }

      setHasSeenRationale(effectiveDismissed);
      setPermissionsBootstrapped(true);
    }

    bootstrap();

    // Re-check whenever the app returns to the foreground so a stale "denied"
    // cache is refreshed if the user enabled access in Settings and came back.
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        checkPermission().then((status) => {
          setCameraRollStatus(status);
          // Clear the stale flag if permission was resolved while away
          if (status !== "undetermined") {
            AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY).catch(() => {});
            setHasSeenRationale(false);
          }
        });
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  /**
   * Post-login hydration: if the user was not signed in during the initial
   * bootstrap (common on a fresh install), apply their cloud preference as
   * soon as they log in — within the same app session.
   */
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user) return;
        // Only relevant while permission is still undetermined.
        if (cameraRollStatusRef.current !== "undetermined") return;

        try {
          const prefs = await fetchUserPreferences(session.user.id);
          const remote = prefs?.appSettings?.cameraRollRationaleDismissed;
          if (remote != null) {
            setHasSeenRationale(remote);
            if (remote) {
              AsyncStorage.setItem(RATIONALE_DISMISSED_KEY, "true").catch(() => {});
            } else {
              AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY).catch(() => {});
            }
          }
        } catch {
          // Non-fatal: local state is already correct from bootstrap.
        }
      }
    );

    return () => authSub.unsubscribe();
  }, []);

  const markRationaleDismissed = useCallback(async () => {
    await AsyncStorage.setItem(RATIONALE_DISMISSED_KEY, "true");
    setHasSeenRationale(true);
    // Persist to Supabase so the preference survives a reinstall for signed-in users.
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        fetchUserPreferences(session.user.id)
          .then((existing) =>
            upsertUserPreferences(session.user.id, {
              ...existing,
              appSettings: {
                ...(existing?.appSettings ?? {}),
                cameraRollRationaleDismissed: true,
              },
            })
          )
          .catch(() => {});
      });
    }
  }, []);

  const resetRationale = useCallback(async () => {
    await AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY);
    setHasSeenRationale(false);
    // Clear from Supabase so the pre-prompt re-appears on other devices too.
    if (isSupabaseConfigured) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const existing = await fetchUserPreferences(session.user.id);
        await upsertUserPreferences(session.user.id, {
          ...existing,
          appSettings: {
            ...(existing?.appSettings ?? {}),
            cameraRollRationaleDismissed: false,
          },
        });
      }
    }
  }, []);

  const updateCameraRollStatus = useCallback((status: CameraRollPermissionStatus) => {
    setCameraRollStatus(status);
  }, []);

  const requestCameraRollPermission = useCallback(async (): Promise<CameraRollPermissionStatus> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true, []);
      const s = status as CameraRollPermissionStatus;
      setCameraRollStatus(s);
      // Clear the dismissed flag whenever the OS reaches a definitive answer
      if (s !== "undetermined") {
        AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY).catch(() => {});
        setHasSeenRationale(false);
      }
      return s;
    } catch {
      // If the OS prompt fails for any reason, return undetermined so callers
      // are never left with an unresolved promise.
      return "undetermined";
    }
  }, []);

  return (
    <PermissionsContext.Provider
      value={{
        cameraRollStatus,
        permissionsBootstrapped,
        hasSeenRationale,
        markRationaleDismissed,
        resetRationale,
        requestCameraRollPermission,
        updateCameraRollStatus,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
}
