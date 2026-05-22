import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

export interface PedometerState {
  steps: number;
  available: boolean;
  loading: boolean;
}

/**
 * Shared hook that reads the device pedometer for today's step count.
 *
 * - Returns live updates via Pedometer.watchStepCount (subscription fires on
 *   each new batch of steps the OS reports).
 * - Falls back gracefully on simulators, Android devices that lack a
 *   step-counter sensor, and the web platform.
 * - Cleans up the subscription when the component unmounts.
 */
export function usePedometer(): PedometerState {
  const [steps, setSteps] = useState(0);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(Platform.OS !== "web");
  const subRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function init() {
      try {
        const { Pedometer } = await import("expo-sensors");

        const { granted } = await Pedometer.requestPermissionsAsync();
        if (!granted || cancelled) {
          setLoading(false);
          return;
        }

        const isAvailable = await Pedometer.isAvailableAsync();
        if (!isAvailable || cancelled) {
          setLoading(false);
          return;
        }

        setAvailable(true);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const { steps: todaySteps } = await Pedometer.getStepCountAsync(start, new Date());
        if (!cancelled) setSteps(todaySteps);

        subRef.current = Pedometer.watchStepCount(({ steps: liveSteps }) => {
          if (!cancelled) setSteps(liveSteps);
        });
      } catch {
        // Sensor unavailable — app degrades gracefully
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, []);

  return { steps, available, loading };
}
