import React, { createContext, useContext } from "react";

export interface CardPreferencesContextType {
  /** Pre-loaded card action from AsyncStorage ("share"|"save"|"both"|"copy"|null). */
  bootCardAction: string | null;
  /** Pre-loaded auto-trigger delay from AsyncStorage ("off"|"1"|"3"|"5"). */
  bootAutoTriggerDelay: string;
}

const CardPreferencesContext = createContext<CardPreferencesContextType | null>(null);

interface CardPreferencesProviderProps {
  children: React.ReactNode;
  initialAction: string | null;
  initialDelay: string;
}

/**
 * Provides boot-time card action and countdown delay to the component tree.
 * Seeded from loadBootPreferences() so that profile.tsx and
 * CardCustomizationModal can initialise from these values on their first
 * render — no AsyncStorage reads on mount, no flicker.
 */
export function CardPreferencesProvider({
  children,
  initialAction,
  initialDelay,
}: CardPreferencesProviderProps) {
  const value: CardPreferencesContextType = React.useMemo(
    () => ({ bootCardAction: initialAction, bootAutoTriggerDelay: initialDelay }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return React.createElement(CardPreferencesContext.Provider, { value }, children);
}

export function useCardPreferences(): CardPreferencesContextType {
  const ctx = useContext(CardPreferencesContext);
  if (!ctx) {
    throw new Error("useCardPreferences must be used within CardPreferencesProvider");
  }
  return ctx;
}
