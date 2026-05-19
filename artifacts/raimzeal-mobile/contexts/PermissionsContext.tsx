import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, AppState, type AppStateStatus } from "react-native";
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

  const requestCameraRollPermission = useCallback((): Promise<CameraRollPermissionStatus> => {
    return new Promise((resolve) => {
      // Guard against double-resolve: Android back-button dismiss fires both
      // onDismiss and (sometimes) the cancel button's onPress.
      let settled = false;
      const resolveOnce = (s: CameraRollPermissionStatus) => {
        if (settled) return;
        settled = true;
        resolve(s);
      };

      Alert.alert(
        "Allow Photo Library Access",
        "RAIMZEAL needs access to your photo library to save your progress card. Your photos are never read or uploaded.",
        [
          {
            text: "Not Now",
            style: "cancel",
            onPress: () => resolveOnce("undetermined"),
          },
          {
            text: "Continue",
            onPress: async () => {
              try {
                const { status } = await MediaLibrary.requestPermissionsAsync();
                const s = status as CameraRollPermissionStatus;
                setCameraRollStatus(s);
                resolveOnce(s);
              } catch {
                // If the OS prompt fails for any reason, resolve as undetermined
                // so callers are never left with a hanging Promise.
                resolveOnce("undetermined");
              }
            },
          },
        ],
        // cancelable: true lets the Android back button dismiss the alert.
        // onDismiss fires when it is dismissed without a button press, ensuring
        // the Promise always resolves regardless of how the dialog is closed.
        { cancelable: true, onDismiss: () => resolveOnce("undetermined") }
      );
    });
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
