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
