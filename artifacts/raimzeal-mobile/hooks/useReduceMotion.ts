import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";

// Module-level singleton — one native listener for the entire app lifetime.
// Initialized at module-parse time so the promise has maximum opportunity to
// resolve before any component's animation effect fires.
//
// Default is `true` (reduce-motion enabled) so that no animation runs before
// the async preference read resolves.  This is the accessibility-safe default:
// users who have reduce-motion ON are never shown an animation, even on the
// very first cold-start frame.  Users who have reduce-motion OFF see at most
// a brief instant jump on first load (before the promise resolves), which is
// far less harmful than the reverse.
let currentValue = true;
const listeners = new Set<(val: boolean) => void>();

// Kick off the async read immediately when this module is first imported so
// the promise has the maximum time to resolve before any animation fires.
AccessibilityInfo.isReduceMotionEnabled().then((val) => {
  currentValue = val;
  listeners.forEach((cb) => cb(val));
});

// Keep listening for system-level changes for the app lifetime.
AccessibilityInfo.addEventListener("reduceMotionChanged", (val) => {
  currentValue = val;
  listeners.forEach((cb) => cb(val));
});

/**
 * Returns the current reduce-motion preference.
 *
 * Defaults to `true` (animations skipped) until the OS preference is read,
 * so callers never accidentally animate on cold start when reduce-motion is on.
 *
 * Backed by a module-level singleton — only one native event listener is
 * registered regardless of how many components use this hook.
 */
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState<boolean>(currentValue);

  useEffect(() => {
    const cb = (val: boolean) => setReduceMotion(val);
    listeners.add(cb);

    // Sync with module state in case it changed between render and this effect.
    setReduceMotion(currentValue);

    return () => {
      listeners.delete(cb);
    };
  }, []);

  return reduceMotion;
}
