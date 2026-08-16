import type { Currency } from "../types";

/** CLP value of 1 unit of each currency. CLP is always the base (1). */
export const DEFAULT_FX_RATES: Record<Currency, number> = {
  CLP: 1,
  USD: 970,
  EUR: 1050,
};

export function convertAmount(amount: number, from: Currency, to: Currency, rates: Record<Currency, number>): number {
  if (from === to) return amount;
  const clp = amount * rates[from];
  return clp / rates[to];
}
