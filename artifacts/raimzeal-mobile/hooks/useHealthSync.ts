import { useState, useCallback, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface HealthData {
  stepsToday: number | null;
  sleepLastNightHours: number | null;
  restingHeartRate: number | null;
  latestWeightKg: number | null;
  activeCaloriesToday: number | null;
  lastSynced: Date | null;
}

export type HealthSyncStatus = "idle" | "loading" | "authorized" | "denied" | "unavailable";

const STORAGE_KEY = "@raimzeal_health_data_v1";
const AUTH_KEY = "@raimzeal_health_authorized_v1";

const EMPTY: HealthData = {
  stepsToday: null,
  sleepLastNightHours: null,
  restingHeartRate: null,
  latestWeightKg: null,
  activeCaloriesToday: null,
  lastSynced: null,
};

// ─── iOS HealthKit helpers ────────────────────────────────────────────────────

async function initHealthKit(): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HK = require("react-native-health").default;
    const Perms = HK.Constants.Permissions;
    const permissions = {
      permissions: {
        read: [
          Perms.Steps,
          Perms.HeartRate,
          Perms.RestingHeartRate,
          Perms.SleepAnalysis,
          Perms.Weight,
          Perms.ActiveEnergyBurned,
        ],
        write: [Perms.ActiveEnergyBurned, Perms.Steps],
      },
    };
    return await new Promise<boolean>((resolve) => {
      HK.initHealthKit(permissions, (err: string | null) => resolve(!err));
    });
  } catch {
    return false;
  }
}

async function readiOSData(): Promise<HealthData> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const HK = require("react-native-health").default;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const yesterday = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);

    const stepsToday = await new Promise<number | null>((resolve) => {
      HK.getStepCount({ date: now.toISOString() }, (err: unknown, r: { value: number }) =>
        resolve(err ? null : r?.value ?? null)
      );
    });

    const activeCaloriesToday = await new Promise<number | null>((resolve) => {
      HK.getActiveEnergyBurned(
        { startDate: startOfDay.toISOString(), endDate: now.toISOString() },
        (err: unknown, r: { value: number }[]) =>
          resolve(err ? null : (r ?? []).reduce((s, x) => s + (x.value ?? 0), 0))
      );
    });

    const restingHeartRate = await new Promise<number | null>((resolve) => {
      HK.getHeartRateSamples(
        { startDate: yesterday.toISOString(), endDate: now.toISOString(), limit: 10 },
        (err: unknown, r: { value: number }[]) => {
          if (err || !r?.length) return resolve(null);
          const avg = r.reduce((s, x) => s + x.value, 0) / r.length;
          resolve(Math.round(avg));
        }
      );
    });

    const latestWeightKg = await new Promise<number | null>((resolve) => {
      HK.getLatestWeight({ unit: "kg" }, (err: unknown, r: { value: number }) =>
        resolve(err ? null : r?.value ?? null)
      );
    });

    const sleepLastNightHours = await new Promise<number | null>((resolve) => {
      HK.getSleepSamples(
        { startDate: yesterday.toISOString(), endDate: now.toISOString() },
        (err: unknown, r: { value: string; startDate: string; endDate: string }[]) => {
          if (err || !r?.length) return resolve(null);
          const asleep = r.filter((s) => s.value === "ASLEEP");
          const totalMs = asleep.reduce(
            (sum, s) =>
              sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()),
            0
          );
          resolve(totalMs > 0 ? Math.round((totalMs / 3_600_000) * 10) / 10 : null);
        }
      );
    });

    return {
      stepsToday,
      sleepLastNightHours,
      restingHeartRate,
      latestWeightKg,
      activeCaloriesToday,
      lastSynced: now,
    };
  } catch {
    return EMPTY;
  }
}

// ─── Android Health Connect helpers ─────────────────────────────────────────

async function initHealthConnect(): Promise<boolean> {
  try {
    const HC = await import("react-native-health-connect");
    const ok = await HC.initialize();
    if (!ok) return false;
    const granted = await HC.requestPermission([
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "SleepSession" },
      { accessType: "read", recordType: "HeartRate" },
      { accessType: "read", recordType: "Weight" },
      { accessType: "read", recordType: "ActiveCaloriesBurned" },
    ]);
    return granted.length > 0;
  } catch {
    return false;
  }
}

async function readAndroidData(): Promise<HealthData> {
  try {
    const HC = await import("react-native-health-connect");
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const yesterday = new Date(startOfDay);
    yesterday.setDate(yesterday.getDate() - 1);

    const timeToday = {
      operator: "between" as const,
      startTime: startOfDay.toISOString(),
      endTime: now.toISOString(),
    };
    const timeSinceYesterday = {
      operator: "between" as const,
      startTime: yesterday.toISOString(),
      endTime: now.toISOString(),
    };

    const [stepsResult, sleepResult, hrResult, weightResult, calResult] =
      await Promise.allSettled([
        HC.readRecords("Steps", { timeRangeFilter: timeToday }),
        HC.readRecords("SleepSession", { timeRangeFilter: timeSinceYesterday }),
        HC.readRecords("HeartRate", { timeRangeFilter: timeSinceYesterday }),
        HC.readRecords("Weight", { timeRangeFilter: timeSinceYesterday }),
        HC.readRecords("ActiveCaloriesBurned", { timeRangeFilter: timeToday }),
      ]);

    const stepsToday =
      stepsResult.status === "fulfilled"
        ? stepsResult.value.records.reduce(
            (s: number, r: { count?: number }) => s + (r.count ?? 0),
            0
          )
        : null;

    const activeCaloriesToday =
      calResult.status === "fulfilled"
        ? calResult.value.records.reduce(
            (s: number, r: { energy?: { inKilocalories?: number } }) =>
              s + (r.energy?.inKilocalories ?? 0),
            0
          )
        : null;

    const restingHeartRate =
      hrResult.status === "fulfilled" && hrResult.value.records.length > 0
        ? (() => {
            const samples = hrResult.value.records.flatMap(
              (r: { samples?: { beatsPerMinute?: number }[] }) =>
                r.samples ?? []
            );
            if (!samples.length) return null;
            const avg =
              samples.reduce(
                (s: number, x: { beatsPerMinute?: number }) =>
                  s + (x.beatsPerMinute ?? 0),
                0
              ) / samples.length;
            return Math.round(avg);
          })()
        : null;

    const latestWeightKg =
      weightResult.status === "fulfilled" &&
      weightResult.value.records.length > 0
        ? (weightResult.value.records[weightResult.value.records.length - 1] as {
            weight?: { inKilograms?: number };
          }).weight?.inKilograms ?? null
        : null;

    const sleepLastNightHours =
      sleepResult.status === "fulfilled" && sleepResult.value.records.length > 0
        ? (() => {
            const totalMs = sleepResult.value.records.reduce(
              (
                sum: number,
                r: { startTime?: string; endTime?: string }
              ) =>
                sum +
                (r.endTime && r.startTime
                  ? new Date(r.endTime).getTime() -
                    new Date(r.startTime).getTime()
                  : 0),
              0
            );
            return totalMs > 0
              ? Math.round((totalMs / 3_600_000) * 10) / 10
              : null;
          })()
        : null;

    return {
      stepsToday,
      sleepLastNightHours,
      restingHeartRate,
      latestWeightKg,
      activeCaloriesToday,
      lastSynced: now,
    };
  } catch {
    return EMPTY;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useHealthSync() {
  const [healthData, setHealthData] = useState<HealthData>(EMPTY);
  const [status, setStatus] = useState<HealthSyncStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const syncInProgress = useRef(false);

  const isAvailable = Platform.OS === "ios" || Platform.OS === "android";

  useEffect(() => {
    if (!isAvailable) {
      setStatus("unavailable");
      return;
    }
    Promise.all([
      AsyncStorage.getItem(AUTH_KEY),
      AsyncStorage.getItem(STORAGE_KEY),
    ]).then(([authVal, dataVal]) => {
      if (authVal === "true") setStatus("authorized");
      if (dataVal) {
        try {
          const parsed = JSON.parse(dataVal) as HealthData & { lastSynced: string | null };
          setHealthData({
            ...parsed,
            lastSynced: parsed.lastSynced ? new Date(parsed.lastSynced) : null,
          });
        } catch {
          // malformed cache — ignore
        }
      }
    });
  }, [isAvailable]);

  const persist = useCallback(async (data: HealthData) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // non-fatal
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (syncInProgress.current) return;
    syncInProgress.current = true;
    setStatus("loading");
    setError(null);
    try {
      const data =
        Platform.OS === "ios" ? await readiOSData() : await readAndroidData();
      setHealthData(data);
      await persist(data);
      setStatus("authorized");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
      setStatus("authorized");
    } finally {
      syncInProgress.current = false;
    }
  }, [persist]);

  const requestPermissions = useCallback(async () => {
    if (!isAvailable) return;

    // Show a rationale so users know exactly what data will be shared
    // before the OS health-permissions dialog appears.
    const consented = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Connect Health Data",
        Platform.OS === "ios"
          ? "RAIMZEAL will read steps, heart rate, sleep, weight, and active calories from Apple Health to personalise your insights. You can revoke access any time in the Health app."
          : "RAIMZEAL will read steps, heart rate, sleep, weight, and active calories from Health Connect to personalise your insights. You can revoke access any time in Health Connect.",
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Connect", onPress: () => resolve(true) },
        ]
      );
    });
    if (!consented) return;

    setStatus("loading");
    setError(null);
    try {
      const granted =
        Platform.OS === "ios"
          ? await initHealthKit()
          : await initHealthConnect();
      await AsyncStorage.setItem(AUTH_KEY, granted ? "true" : "false");
      if (granted) {
        await syncNow();
      } else {
        setStatus("denied");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Permission request failed");
      setStatus("idle");
    }
  }, [isAvailable, syncNow]);

  const disconnect = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_KEY, STORAGE_KEY]);
    setHealthData(EMPTY);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    healthData,
    status,
    error,
    isAvailable,
    isAuthorized: status === "authorized",
    requestPermissions,
    syncNow,
    disconnect,
  };
}
