"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

function eventName(key: string) {
  return `local-storage:${key}`;
}

function subscribe(key: string, callback: () => void) {
  const onCustomEvent = () => callback();
  const onStorageEvent = (e: StorageEvent) => {
    if (e.key === key) callback();
  };
  window.addEventListener(eventName(key), onCustomEvent);
  window.addEventListener("storage", onStorageEvent);
  return () => {
    window.removeEventListener(eventName(key), onCustomEvent);
    window.removeEventListener("storage", onStorageEvent);
  };
}

function getServerSnapshot() {
  return null;
}

/**
 * JSON value persisted to localStorage, hydration-safe: server and first
 * client paint both see `fallback` (via getServerSnapshot), then React
 * syncs to the real stored value right after hydration — same mechanism
 * as PortfolioPreferences, generalized to arbitrary JSON.
 */
export function useLocalStorageJSON<T>(key: string, fallback: T): [T, (value: T) => void] {
  const getSnapshot = useCallback(() => window.localStorage.getItem(key), [key]);
  const raw = useSyncExternalStore((cb) => subscribe(key, cb), getSnapshot, getServerSnapshot);

  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // fallback is intentionally excluded: callers often pass a fresh
    // literal (e.g. []) each render, and only `raw` should drive recompute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (next: T) => {
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(eventName(key)));
    },
    [key]
  );

  return [value, setValue];
}
