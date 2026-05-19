import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface MacroGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const DEFAULT_MACRO_GOALS: MacroGoals = {
  calories: 2200,
  protein: 150,
  carbs: 250,
  fat: 70,
};

const STORAGE_KEY = "raimzeal_macro_goals";

interface MacroGoalsContextType {
  goals: MacroGoals;
  setGoals: (goals: MacroGoals) => Promise<void>;
  loaded: boolean;
}

const MacroGoalsContext = createContext<MacroGoalsContextType | null>(null);

export function MacroGoalsProvider({ children }: { children: React.ReactNode }) {
  const [goals, setGoalsState] = useState<MacroGoals>(DEFAULT_MACRO_GOALS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<MacroGoals>;
            setGoalsState({
              calories: parsed.calories ?? DEFAULT_MACRO_GOALS.calories,
              protein: parsed.protein ?? DEFAULT_MACRO_GOALS.protein,
              carbs: parsed.carbs ?? DEFAULT_MACRO_GOALS.carbs,
              fat: parsed.fat ?? DEFAULT_MACRO_GOALS.fat,
            });
          } catch {
            // corrupted — keep defaults
          }
        }
      })
      .catch(() => {
        // storage read failed — keep defaults
      })
      .finally(() => setLoaded(true));
  }, []);

  const setGoals = useCallback(async (newGoals: MacroGoals) => {
    setGoalsState(newGoals);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newGoals));
    } catch {
      // non-fatal — in-memory state is already updated
    }
  }, []);

  return (
    <MacroGoalsContext.Provider value={{ goals, setGoals, loaded }}>
      {children}
    </MacroGoalsContext.Provider>
  );
}

export function useMacroGoals(): MacroGoalsContextType {
  const ctx = useContext(MacroGoalsContext);
  if (!ctx) throw new Error("useMacroGoals must be used inside MacroGoalsProvider");
  return ctx;
}
