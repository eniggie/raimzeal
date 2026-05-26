import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useState } from "react";

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

interface MacroGoalsProviderProps {
  children: React.ReactNode;
  /**
   * Pre-loaded goals from `loadBootPreferences()`. Providing this avoids any
   * AsyncStorage read inside the provider and ensures the correct persisted
   * value is available on the very first render with no flash or extra round-trip.
   */
  initialGoals: MacroGoals;
}

export function MacroGoalsProvider({ children, initialGoals }: MacroGoalsProviderProps) {
  const [goals, setGoalsState] = useState<MacroGoals>(initialGoals);

  const setGoals = useCallback(async (newGoals: MacroGoals) => {
    setGoalsState(newGoals);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newGoals));
    } catch {
      // non-fatal — in-memory state is already updated
    }
  }, []);

  return (
    <MacroGoalsContext.Provider value={{ goals, setGoals, loaded: true }}>
      {children}
    </MacroGoalsContext.Provider>
  );
}

export function useMacroGoals(): MacroGoalsContextType {
  const ctx = useContext(MacroGoalsContext);
  if (!ctx) throw new Error("useMacroGoals must be inside MacroGoalsProvider");
  return ctx;
}
