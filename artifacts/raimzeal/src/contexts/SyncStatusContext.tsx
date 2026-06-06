import { createContext, useContext, type ReactNode } from 'react';

interface SyncStatusContextValue {
  lastSyncedAt: Date | null;
  loggedIn: boolean;
}

const SyncStatusContext = createContext<SyncStatusContextValue>({ lastSyncedAt: null, loggedIn: false });

export function SyncStatusProvider({
  lastSyncedAt,
  loggedIn,
  children,
}: {
  lastSyncedAt: Date | null;
  loggedIn: boolean;
  children: ReactNode;
}) {
  return (
    <SyncStatusContext.Provider value={{ lastSyncedAt, loggedIn }}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncStatusContext);
}
