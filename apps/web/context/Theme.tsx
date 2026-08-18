"use client";

import { createContext, useContext, useEffect } from "react";
import { useLocalStorageJSON } from "../lib/storage";

const STORAGE_KEY = "inversiones-3.0:dark-mode";

interface ThemeContextValue {
  dark: boolean;
  toggleDark: () => void;
}

const Ctx = createContext<ThemeContextValue | null>(null);

/**
 * Dark/light mode preference, persisted like the other UI prefs in
 * context/Portfolios.tsx. The `.dark` class itself is applied by the inline
 * script in app/layout.tsx (runs before hydration, avoids a flash of the
 * wrong theme) — this effect only keeps the DOM in sync after that point,
 * e.g. when the user flips the toggle or another tab changes it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useLocalStorageJSON<boolean>(STORAGE_KEY, false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return <Ctx.Provider value={{ dark, toggleDark: () => setDark(!dark) }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
