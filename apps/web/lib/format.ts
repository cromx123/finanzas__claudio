import type { Currency } from "./types";

/** Every displayed amount shows at least 2 decimals, regardless of currency. */
const MIN_DECIMALS = 2;

/**
 * Truncates toward zero at `decimals` places instead of rounding, so a
 * displayed amount never overstates the underlying value. The tiny nudge
 * before Math.trunc compensates for float representation error (e.g.
 * 1.1 * 100 === 109.99999999999999), without affecting genuine truncation.
 */
export function truncate(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const nudge = value >= 0 ? 1e-9 : -1e-9;
  return Math.trunc(value * factor + nudge) / factor;
}

export function formatCurrency(value: number, ccy: Currency, decimals?: number): string {
  const dec = Math.max(MIN_DECIMALS, decimals ?? MIN_DECIMALS);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  }).format(truncate(value, dec));
}

export function formatUsd(value: number, decimals = MIN_DECIMALS): string {
  return formatCurrency(value, "USD", decimals);
}

export function decimalesForCurrency(): number {
  return MIN_DECIMALS;
}

export function formatPercent(value: number, withSign = false): string {
  const sign = withSign && value >= 0 ? "+" : "";
  return sign + truncate(value, 1).toFixed(1).replace(".", ",") + "%";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 3 }).format(truncate(value, 3));
}

export function formatDecimal(value: number, digits = 1): string {
  return truncate(value, digits).toFixed(digits).replace(".", ",");
}

export function formatCompactUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return "US$" + truncate(value / 1e6, 2).toFixed(2).replace(".", ",") + "M";
  if (abs >= 1e4) return "US$" + formatNumber((Math.trunc(value / 100) * 100) / 1000) + "k";
  return "US$" + new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(Math.trunc(value));
}

export function formatAumOrCap(value: number): string {
  return (
    (value >= 1000 ? truncate(value / 1000, 2).toFixed(2).replace(".", ",") + "T" : truncate(value, 1).toFixed(1).replace(".", ",") + "B") +
    " US$"
  );
}
