import { useState, useEffect } from "react";
import { AccessibilityInfo } from "react-native";

// Module-level singleton — a single native listener serves every hook
// instance, so a history list with 50 MacroRings still adds exactly one
// system event listener for the lifetime of the app.
let initialized = false;
let currentValue = false;
const listeners = new Set<(val: boolean) => void>();

function initializeSingleton() {
  if (initialized) return;
  initialized = true;

  AccessibilityInfo.isReduceMotionEnabled().then((val) => {
    currentValue = val;
    listeners.forEach((cb) => cb(val));
  });

  // Keep this listener alive for the app lifetime — there is no meaningful
  // teardown point for a module-level singleton.
  AccessibilityInfo.addEventListener("reduceMotionChanged", (val) => {
    currentValue = val;
    listeners.forEach((cb) => cb(val));
  });
}

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState<boolean>(currentValue);

  useEffect(() => {
    initializeSingleton();

    const cb = (val: boolean) => setReduceMotion(val);
    listeners.add(cb);

    // Sync in case the value changed between module load and this effect.
    setReduceMotion(currentValue);

    return () => {
      listeners.delete(cb);
    };
  }, []);

  return reduceMotion;
}
