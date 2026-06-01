import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * One-time swipe hint for a list with a delete action.
 *
 * Returns `true` exactly once per storage key (i.e. the first time the user
 * sees the list with at least one item). Callers should pass this value as a
 * `runHintAnimation` prop to the first swipeable row so it can peek open and
 * then close, teaching the swipe gesture.
 *
 * @param storageKey  - Unique AsyncStorage key for this list (e.g. "@meal_swipe_hint_v1")
 * @param enabled     - Whether the list currently has items to swipe. When
 *                      `false` the hint is deferred until the next render where
 *                      items are present.
 */
export function useSwipeHint(storageKey: string, enabled: boolean): boolean {
  const [shouldRun, setShouldRun] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey)
      .then((val) => {
        if (!cancelled && !val) {
          AsyncStorage.setItem(storageKey, "1").catch(() => {});
          setShouldRun(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storageKey, enabled]);

  return shouldRun;
}
