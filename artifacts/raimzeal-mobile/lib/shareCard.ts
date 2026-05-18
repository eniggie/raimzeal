import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";
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
