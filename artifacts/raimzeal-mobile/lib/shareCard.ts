import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { Alert, Linking } from "react-native";
import type { RefObject } from "react";
import type { View } from "react-native";
import type { CameraRollPermissionStatus } from "@/contexts/PermissionsContext";

export interface PermissionOptions {
  /**
   * The cached permission status from PermissionsContext.
   * - "granted"     → skip the system prompt entirely.
   * - "denied"      → show a "Go to Settings" alert and abort.
   * - "undetermined" / null → call requestPermission (if provided) and report the result via onStatusChange.
   */
  cachedStatus?: CameraRollPermissionStatus | null;
  /** Called with the newly-determined status so callers can update their cache. */
  onStatusChange?: (status: CameraRollPermissionStatus) => void;
  /**
   * Centralized permission request function from PermissionsContext.
   * When provided, it is called instead of the raw OS prompt so that the
   * in-app pre-prompt explanation is always shown to the user.
   */
  requestPermission?: () => Promise<CameraRollPermissionStatus>;
}

function showPermissionDeniedAlert() {
  Alert.alert(
    "Permission Denied",
    "RAIMZEAL cannot save to your camera roll. Please enable photo access in Settings.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() },
    ]
  );
}

/**
 * Resolves camera roll permission using a cached value when available.
 * Returns true if permission is granted, false otherwise (alert already shown).
 */
async function resolvePermission(opts?: PermissionOptions): Promise<boolean> {
  if (opts?.cachedStatus === "granted") {
    return true;
  }

  if (opts?.cachedStatus === "denied") {
    showPermissionDeniedAlert();
    return false;
  }

  // undetermined or no cache — use the centralized context request (which shows
  // the in-app pre-prompt) if available, otherwise fall back to a raw OS prompt.
  let resolved: CameraRollPermissionStatus;
  if (opts?.requestPermission) {
    resolved = await opts.requestPermission();
    // "undetermined" means the user dismissed the pre-prompt — skip silently.
    if (resolved === "undetermined") return false;
  } else {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    resolved = status as CameraRollPermissionStatus;
  }
  opts?.onStatusChange?.(resolved);

  if (resolved !== "granted") {
    showPermissionDeniedAlert();
    return false;
  }
  return true;
}

/**
 * Captures a React Native view ref as a PNG and opens the native share sheet.
 */
export async function captureAndShareCard(ref: RefObject<View | null>): Promise<void> {
  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "image/png",
    dialogTitle: "Share your RAIMZEAL Progress Card",
    UTI: "public.png",
  });
}

/**
 * Captures a React Native view ref as a PNG and saves it to the camera roll.
 * Returns true if saved successfully, false if permission was denied.
 *
 * Pass `permissionOpts` to skip redundant OS permission prompts when the
 * status is already known from PermissionsContext.
 */
export async function captureAndSaveCard(
  ref: RefObject<View | null>,
  permissionOpts?: PermissionOptions
): Promise<boolean> {
  const granted = await resolvePermission(permissionOpts);
  if (!granted) return false;

  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });

  await MediaLibrary.saveToLibraryAsync(uri);
  return true;
}

export interface CaptureShareAndSaveResult {
  /** Whether the card was successfully saved to the camera roll. */
  saved: boolean;
  /** Whether the share sheet was opened. False when sharing is unavailable on the device. */
  shared: boolean;
}

/**
 * Captures a React Native view ref as a PNG exactly once, saves it to the
 * camera roll, and then opens the native share sheet — all in a single capture.
 *
 * Returns a result object so the caller can show accurate feedback:
 * - `saved: false` means camera roll permission was denied (and an alert was shown).
 * - `shared: false` means sharing is not supported on this device, but save may still have succeeded.
 *
 * Pass `permissionOpts` to skip redundant OS permission prompts when the
 * status is already known from PermissionsContext.
 */
export async function captureShareAndSaveCard(
  ref: RefObject<View | null>,
  permissionOpts?: PermissionOptions
): Promise<CaptureShareAndSaveResult> {
  const granted = await resolvePermission(permissionOpts);
  if (!granted) return { saved: false, shared: false };

  const uri = await captureRef(ref, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });

  await MediaLibrary.saveToLibraryAsync(uri);

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "image/png",
      dialogTitle: "Share your RAIMZEAL Progress Card",
      UTI: "public.png",
    });
    return { saved: true, shared: true };
  }

  return { saved: true, shared: false };
}
