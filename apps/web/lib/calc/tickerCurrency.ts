import type { Currency } from "../types";

// Mirrors app/modules/ingestion/markets.py resolve_suffix (README business
// rule #1) so the "Agregar transacción" form can show/validate the asset's
// real currency without a round trip — the backend re-validates regardless.
const US_TICKER_RE = /^[A-Z][A-Z0-9-]{0,9}$/;
const SUFFIX_TO_CURRENCY: Record<string, Currency> = { ".SN": "CLP", ".MC": "EUR" };

/** Returns the ticker's listing currency, or null if the symbol isn't recognized yet. */
export function resolveTickerCurrency(rawSymbol: string): Currency | null {
  const symbol = rawSymbol.trim().toUpperCase();
  if (!symbol) return null;
  if (symbol.startsWith("^")) return "USD";

  const dotIndex = symbol.lastIndexOf(".");
  if (dotIndex >= 0) {
    return SUFFIX_TO_CURRENCY[symbol.slice(dotIndex)] ?? null;
  }
  return US_TICKER_RE.test(symbol) ? "USD" : null;
}
