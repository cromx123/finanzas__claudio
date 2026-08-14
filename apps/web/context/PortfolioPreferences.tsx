"use client";

import { createContext, useContext, useState, useSyncExternalStore } from "react";
import type { PortfolioKey } from "../lib/types";

interface PortfolioPreferences {
  portfolio: PortfolioKey;
  setPortfolio: (key: PortfolioKey) => void;
  netoRetencion: boolean;
  setNetoRetencion: (value: boolean) => void;
  toggleNetoRetencion: () => void;
}

const Ctx = createContext<PortfolioPreferences | null>(null);

const STORAGE_KEY = "inversiones-3.0:neto-retencion";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getStoredNeto() {
  return window.localStorage.getItem(STORAGE_KEY) !== "0";
}

function getServerNeto() {
  return true;
}

export function PortfolioPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setPortfolio] = useState<PortfolioKey>("global");
  // Hydration-safe read of the persisted preference: matches the server's
  // default on first paint, then syncs to the real stored value (and to
  // other tabs) without setState-in-effect cascades.
  const storedNeto = useSyncExternalStore(subscribeToStorage, getStoredNeto, getServerNeto);
  const [pendingNeto, setPendingNeto] = useState<boolean | null>(null);
  const netoRetencion = pendingNeto ?? storedNeto;

  const setNetoRetencion = (value: boolean) => {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
    setPendingNeto(value);
  };

  return (
    <Ctx.Provider
      value={{
        portfolio,
        setPortfolio,
        netoRetencion,
        setNetoRetencion,
        toggleNetoRetencion: () => setNetoRetencion(!netoRetencion),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePortfolioPreferences() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortfolioPreferences must be used within PortfolioPreferencesProvider");
  return ctx;
}
