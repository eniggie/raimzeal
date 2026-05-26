import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type ThumbnailSize = "s" | "m" | "l";

const STORAGE_KEY = "@raimzeal_card_thumb_size";
const VALID_SIZES: ThumbnailSize[] = ["s", "m", "l"];
const DEFAULT_SIZE: ThumbnailSize = "m";

interface ThumbnailSizeContextType {
  thumbnailSize: ThumbnailSize;
  setThumbnailSize: (size: ThumbnailSize) => void;
}

const ThumbnailSizeContext = createContext<ThumbnailSizeContextType | null>(null);

/**
 * Reads the persisted thumbnail-size from AsyncStorage.  Call this once at
 * app boot (before mounting the provider) and pass the result as `initialSize`
 * to `ThumbnailSizeProvider` so the provider starts with the correct value
 * immediately — no null state, no flash, no AsyncStorage race.
 */
export async function loadInitialThumbnailSize(): Promise<ThumbnailSize> {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved && VALID_SIZES.includes(saved as ThumbnailSize)) {
      return saved as ThumbnailSize;
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_SIZE;
}

interface ThumbnailSizeProviderProps {
  children: React.ReactNode;
  /** Pre-loaded value from `loadInitialThumbnailSize()`. Providing this avoids
   *  any AsyncStorage read inside the provider and prevents a null/default flash. */
  initialSize: ThumbnailSize;
}

/**
 * Provides the app-wide thumbnail-size preference to all descendants.
 *
 * Pass `initialSize` from `loadInitialThumbnailSize()` (called before the
 * provider mounts) so the correct persisted value is available on the very
 * first render — no race condition between the provider mount and the first
 * modal open.
 */
export function ThumbnailSizeProvider({ children, initialSize }: ThumbnailSizeProviderProps) {
  const [thumbnailSize, setThumbnailSizeState] = useState<ThumbnailSize>(initialSize);

  const setThumbnailSize = useCallback((size: ThumbnailSize) => {
    setThumbnailSizeState(size);
    AsyncStorage.setItem(STORAGE_KEY, size).catch(() => {});
  }, []);

  return React.createElement(
    ThumbnailSizeContext.Provider,
    { value: { thumbnailSize, setThumbnailSize } },
    children
  );
}

/**
 * Returns the app-wide thumbnail size preference and a setter that persists
 * the change to AsyncStorage.  Must be called inside `ThumbnailSizeProvider`.
 */
export function useThumbnailSize(): [ThumbnailSize, (size: ThumbnailSize) => void] {
  const ctx = useContext(ThumbnailSizeContext);
  if (!ctx) throw new Error("useThumbnailSize must be used within ThumbnailSizeProvider");
  return [ctx.thumbnailSize, ctx.setThumbnailSize];
}
