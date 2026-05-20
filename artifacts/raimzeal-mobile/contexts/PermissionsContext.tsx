import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as MediaLibrary from "expo-media-library";

export type CameraRollPermissionStatus = "granted" | "denied" | "undetermined";

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
    const { status } = await MediaLibrary.getPermissionsAsync();
    return status as CameraRollPermissionStatus;
  } catch {
    return "undetermined";
  }
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [cameraRollStatus, setCameraRollStatus] = useState<CameraRollPermissionStatus | null>(null);
  const [hasSeenRationale, setHasSeenRationale] = useState(false);
  const [permissionsBootstrapped, setPermissionsBootstrapped] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Load the persisted "dismissed" flag alongside the permission check.
    // Both must resolve before we signal that bootstrapping is done, so that
    // consumers never make rationale-visibility decisions with stale state.
    Promise.all([
      checkPermission(),
      AsyncStorage.getItem(RATIONALE_DISMISSED_KEY),
    ]).then(([status, dismissed]) => {
      setCameraRollStatus(status);
      // Only treat the flag as active when permission is still undetermined.
      // If permission was already resolved, clear any stale flag.
      if (status !== "undetermined" && dismissed) {
        AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY).catch(() => {});
        setHasSeenRationale(false);
      } else {
        setHasSeenRationale(dismissed === "true");
      }
      setPermissionsBootstrapped(true);
    });

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

  const markRationaleDismissed = useCallback(async () => {
    await AsyncStorage.setItem(RATIONALE_DISMISSED_KEY, "true");
    setHasSeenRationale(true);
  }, []);

  const resetRationale = useCallback(async () => {
    await AsyncStorage.removeItem(RATIONALE_DISMISSED_KEY);
    setHasSeenRationale(false);
  }, []);

  const updateCameraRollStatus = useCallback((status: CameraRollPermissionStatus) => {
    setCameraRollStatus(status);
  }, []);

  const requestCameraRollPermission = useCallback(async (): Promise<CameraRollPermissionStatus> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
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
