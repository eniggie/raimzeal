import { useState, useCallback, useRef, useEffect } from "react";

export type SyncStatus = "idle" | "syncing" | "saved" | "offline";

export function useSyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>("idle");
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
    };
  }, []);

  const startSync = useCallback(() => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setStatus("syncing");
  }, []);

  const finishSync = useCallback((succeeded: boolean) => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    const nextStatus: SyncStatus = succeeded ? "saved" : "offline";
    setStatus(nextStatus);
    holdTimer.current = setTimeout(() => {
      setStatus("idle");
    }, succeeded ? 2000 : 4000);
  }, []);

  return { syncStatus: status, startSync, finishSync };
}
