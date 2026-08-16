"use client";

import { createContext, useContext } from "react";
import { useLocalStorageJSON } from "../lib/storage";

interface PortfolioUiContextValue {
  activePortfolioId: string | null;
  setActivePortfolioId: (id: string | null) => void;
  netoRetencion: boolean;
  toggleNetoRetencion: () => void;
}

const Ctx = createContext<PortfolioUiContextValue | null>(null);

/**
 * Pure UI/session preferences — which portfolio is selected, and the
 * bruto/neto display toggle (README: "preferencia global persistida").
 * Portfolio/transaction/holding *data* lives on the server now; see
 * hooks/useApi.ts.
 */
export function PortfoliosProvider({ children }: { children: React.ReactNode }) {
  const [activePortfolioId, setActivePortfolioId] = useLocalStorageJSON<string | null>(
    "inversiones-3.0:active-portfolio",
    null
  );
  const [netoRetencion, setNetoRetencion] = useLocalStorageJSON<boolean>("inversiones-3.0:neto", true);

  return (
    <Ctx.Provider
      value={{
        activePortfolioId,
        setActivePortfolioId,
        netoRetencion,
        toggleNetoRetencion: () => setNetoRetencion(!netoRetencion),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePortfolioUi() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePortfolioUi must be used within PortfoliosProvider");
  return ctx;
}
