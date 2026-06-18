import { useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEY_TOAST_SWIPE_HINT_SEEN = "@raimzeal_toast_swipe_hint_seen";

/**
 * Shared hook for the swipe-to-dismiss hint shown on toasts.
 *
 * The hint fades in once — on whichever swipeable toast the user sees first
 * across the whole app — and never appears again. All toasts share the same
 * AsyncStorage key so the "seen" flag is global.
 *
 * Usage:
 *   const { hintSeen, swipeHintOpacity, triggerToastSwipeHint, dismissToastSwipeHint } = useToastSwipeHint();
 *
 *   // When showing a toast:
 *   if (!hintSeen) triggerToastSwipeHint();
 *
 *   // When dismissing a toast (animated):
 *   dismissToastSwipeHint();
 *
 *   // In JSX (above the toast, pointerEvents="none"):
 *   <Animated.View style={{ opacity: swipeHintOpacity }} pointerEvents="none">
 *     <Ionicons name="chevron-up" size={10} color="#fff" />
 *     <Text>swipe to dismiss</Text>
 *   </Animated.View>
 *
 * Race-condition note: `hintSeen` starts `false` and `isStorageLoaded` starts `false`.
 * `triggerToastSwipeHint` is a no-op until storage has been read, so a toast that
 * appears before the first AsyncStorage read completes simply defers the hint to the
 * next eligible toast rather than incorrectly suppressing it.
 */
export function useToastSwipeHint() {
  const [hintSeen, setHintSeen] = useState(false);
  const swipeHintOpacity = useRef(new Animated.Value(0)).current;
  const swipeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStorageLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY_TOAST_SWIPE_HINT_SEEN)
      .then((val) => {
        if (!cancelled) {
          isStorageLoadedRef.current = true;
          setHintSeen(val === "1");
        }
      })
      .catch(() => {
        if (!cancelled) isStorageLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
      if (swipeHintTimerRef.current !== null) {
        clearTimeout(swipeHintTimerRef.current);
        swipeHintTimerRef.current = null;
      }
      swipeHintOpacity.stopAnimation();
    };
  }, [swipeHintOpacity]);

  function triggerToastSwipeHint() {
    if (!isStorageLoadedRef.current) return;
    if (swipeHintTimerRef.current !== null) {
      clearTimeout(swipeHintTimerRef.current);
      swipeHintTimerRef.current = null;
    }
    swipeHintOpacity.stopAnimation();
    swipeHintOpacity.setValue(0);
    Animated.timing(swipeHintOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    swipeHintTimerRef.current = setTimeout(() => {
      swipeHintTimerRef.current = null;
      Animated.timing(swipeHintOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        swipeHintOpacity.setValue(0);
      });
    }, 1000);
    setHintSeen(true);
    AsyncStorage.setItem(STORAGE_KEY_TOAST_SWIPE_HINT_SEEN, "1").catch(() => {});
  }

  function dismissToastSwipeHint() {
    if (swipeHintTimerRef.current !== null) {
      clearTimeout(swipeHintTimerRef.current);
      swipeHintTimerRef.current = null;
    }
    swipeHintOpacity.stopAnimation();
    Animated.timing(swipeHintOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      swipeHintOpacity.setValue(0);
    });
  }

  function clearToastSwipeHintInstant() {
    if (swipeHintTimerRef.current !== null) {
      clearTimeout(swipeHintTimerRef.current);
      swipeHintTimerRef.current = null;
    }
    swipeHintOpacity.stopAnimation();
    swipeHintOpacity.setValue(0);
  }

  return {
    hintSeen,
    swipeHintOpacity,
    triggerToastSwipeHint,
    dismissToastSwipeHint,
    clearToastSwipeHintInstant,
  };
}
