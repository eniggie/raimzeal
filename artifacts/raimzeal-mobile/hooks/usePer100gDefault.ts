import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "@raimzeal_default_per100g";

interface Per100gDefaultContextType {
  defaultPer100g: boolean;
  setDefaultPer100g: (value: boolean) => void;
}

const Per100gDefaultContext = createContext<Per100gDefaultContextType | null>(null);

/**
 * Reads the "default to per-100g view" preference from AsyncStorage once at
 * app boot and exposes shared state to all consumers.  Wrap the app root with
 * this provider so the preference is available app-wide without per-component
 * AsyncStorage round-trips.
 */
export function Per100gDefaultProvider({ children }: { children: React.ReactNode }) {
  const [defaultPer100g, setDefaultPer100gState] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        setDefaultPer100gState(saved === "true");
      })
      .catch(() => {
        setDefaultPer100gState(false);
      });
  }, []);

  const setDefaultPer100g = useCallback((value: boolean) => {
    setDefaultPer100gState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? "true" : "false").catch(() => {});
  }, []);

  if (defaultPer100g === null) {
    return null;
  }

  return React.createElement(
    Per100gDefaultContext.Provider,
    { value: { defaultPer100g, setDefaultPer100g } },
    children
  );
}

/**
 * Returns the app-wide "default to per-100g view" preference and a setter
 * that persists the change to AsyncStorage.  Must be called inside
 * `Per100gDefaultProvider`.
 */
export function usePer100gDefault(): [boolean, (value: boolean) => void] {
  const ctx = useContext(Per100gDefaultContext);
  if (!ctx) throw new Error("usePer100gDefault must be used within Per100gDefaultProvider");
  return [ctx.defaultPer100g, ctx.setDefaultPer100g];
}
