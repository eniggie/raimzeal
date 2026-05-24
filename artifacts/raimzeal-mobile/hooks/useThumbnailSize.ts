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
 * Reads the thumbnail-size preference from AsyncStorage once at app boot and
 * exposes shared state to all consumers.  Wrap the app root with this provider
 * so the preference is available app-wide without per-component AsyncStorage
 * round-trips.
 *
 * Renders nothing until the stored value has been read so that children never
 * see the default "m" before the real preference is known, preventing a
 * visible size flash on first load.
 */
export function ThumbnailSizeProvider({ children }: { children: React.ReactNode }) {
  const [thumbnailSize, setThumbnailSizeState] = useState<ThumbnailSize | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved && VALID_SIZES.includes(saved as ThumbnailSize)) {
          setThumbnailSizeState(saved as ThumbnailSize);
        } else {
          setThumbnailSizeState(DEFAULT_SIZE);
        }
      })
      .catch(() => {
        setThumbnailSizeState(DEFAULT_SIZE);
      });
  }, []);

  const setThumbnailSize = useCallback((size: ThumbnailSize) => {
    setThumbnailSizeState(size);
    AsyncStorage.setItem(STORAGE_KEY, size).catch(() => {});
  }, []);

  if (thumbnailSize === null) {
    return null;
  }

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
