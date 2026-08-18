import type { Currency } from "./types";

/** Every displayed amount shows at least 2 decimals, regardless of currency. */
const MIN_DECIMALS = 2;

export function formatCurrency(value: number, ccy: Currency, decimals?: number): string {
  const dec = Math.max(MIN_DECIMALS, decimals ?? MIN_DECIMALS);
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: ccy,
    maximumFractionDigits: dec,
    minimumFractionDigits: dec,
  }).format(value);
}

export function formatUsd(value: number, decimals = MIN_DECIMALS): string {
  return formatCurrency(value, "USD", decimals);
}

export function decimalesForCurrency(): number {
  return MIN_DECIMALS;
}

export function formatPercent(value: number, withSign = false): string {
  const sign = withSign && value >= 0 ? "+" : "";
  return sign + value.toFixed(1).replace(".", ",") + "%";
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(value);
}

export function formatDecimal(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

export function formatCompactUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e6) return "US$" + (value / 1e6).toFixed(2).replace(".", ",") + "M";
  if (abs >= 1e4) return "US$" + formatNumber(Math.round(value / 100) * 100 / 1000) + "k";
  return "US$" + new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(value);
}

export function formatAumOrCap(value: number): string {
  return (value >= 1000 ? (value / 1000).toFixed(2).replace(".", ",") + "T" : value.toFixed(1).replace(".", ",") + "B") + " US$";
}
