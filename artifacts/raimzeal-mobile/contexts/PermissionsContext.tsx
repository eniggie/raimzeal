import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as MediaLibrary from "expo-media-library";

export type CameraRollPermissionStatus = "granted" | "denied" | "undetermined";

interface PermissionsContextType {
  cameraRollStatus: CameraRollPermissionStatus | null;
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
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Initial check without prompting the user
    checkPermission().then(setCameraRollStatus);

    // Re-check whenever the app returns to the foreground so a stale "denied"
    // cache is refreshed if the user enabled access in Settings and came back.
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        checkPermission().then(setCameraRollStatus);
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, []);

  const updateCameraRollStatus = useCallback((status: CameraRollPermissionStatus) => {
    setCameraRollStatus(status);
  }, []);

  const requestCameraRollPermission = useCallback(async (): Promise<CameraRollPermissionStatus> => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      const s = status as CameraRollPermissionStatus;
      setCameraRollStatus(s);
      return s;
    } catch {
      // If the OS prompt fails for any reason, return undetermined so callers
      // are never left with an unresolved promise.
      return "undetermined";
    }
  }, []);

  return (
    <PermissionsContext.Provider value={{ cameraRollStatus, requestCameraRollPermission, updateCameraRollStatus }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider");
  return ctx;
}
