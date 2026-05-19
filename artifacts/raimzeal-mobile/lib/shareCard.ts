import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { captureRef } from "react-native-view-shot";
import { Alert } from "react-native";
import type { RefObject } from "react";
import type { View } from "react-native";

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
 */
export async function captureAndSaveCard(ref: RefObject<View | null>): Promise<boolean> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Allow RAIMZEAL to access your photos to save your progress card."
    );
    return false;
  }

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
 */
export async function captureShareAndSaveCard(ref: RefObject<View | null>): Promise<CaptureShareAndSaveResult> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Permission Required",
      "Allow RAIMZEAL to access your photos to save your progress card."
    );
    return { saved: false, shared: false };
  }

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
