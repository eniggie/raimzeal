import { createContext, useContext, type ReactNode } from 'react';

const STALE_MS = 30 * 60 * 1000;

interface SyncStatusContextValue {
  isStale: boolean;
}

const SyncStatusContext = createContext<SyncStatusContextValue>({ isStale: false });

export function SyncStatusProvider({
  lastSyncedAt,
  loggedIn,
  syncConfigured,
  children,
}: {
  lastSyncedAt: Date | null;
  loggedIn: boolean;
  syncConfigured: boolean;
  children: ReactNode;
}) {
  const isStale =
    syncConfigured &&
    loggedIn &&
    (!lastSyncedAt || Date.now() - lastSyncedAt.getTime() > STALE_MS);

  return (
    <SyncStatusContext.Provider value={{ isStale }}>
      {children}
    </SyncStatusContext.Provider>
  );
}

export function useSyncStatus() {
  return useContext(SyncStatusContext);
}
