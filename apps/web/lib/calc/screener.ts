import { formatCurrency, formatDecimal, formatPercent } from "../format";
import { generateSeries } from "../random";
import type { ScreenerAsset } from "../types";

export interface ScreenerFilters {
  q: string;
  tipo: "*" | ScreenerAsset["tipo"];
  yieldMin: 0 | 3 | 5;
  peMax: 0 | 15 | 25;
  roeMin: 0 | 15 | 25;
}

export function filterScreener(list: ScreenerAsset[], f: ScreenerFilters): ScreenerAsset[] {
  const q = f.q.toLowerCase();
  return list.filter(
    (a) =>
      (!q || a.ticker.toLowerCase().includes(q) || a.nombre.toLowerCase().includes(q)) &&
      (f.tipo === "*" || a.tipo === f.tipo) &&
      (!f.yieldMin || a.yield >= f.yieldMin) &&
      (!f.peMax || (a.pe !== null && a.pe <= f.peMax)) &&
      (!f.roeMin || (a.roe !== null && a.roe >= f.roeMin))
  );
}

export type ScreenerSortKey = "yield" | "cagrDiv5A" | "pe" | "roe";

export function sortScreener(list: ScreenerAsset[], key: ScreenerSortKey, dir: 1 | -1): ScreenerAsset[] {
  return [...list].sort((x, y) => {
    const a = x[key];
    const b = y[key];
    if (a === null) return 1;
    if (b === null) return -1;
    return dir * (a - b);
  });
}

export function formatAssetPrice(a: ScreenerAsset): string {
  return formatCurrency(a.precio, a.moneda, a.moneda === "CLP" ? 0 : 2);
}

export function formatAumOrCap(value: number): string {
  return (value >= 1000 ? (value / 1000).toFixed(2).replace(".", ",") + "T" : value.toFixed(1).replace(".", ",") + "B") + " US$";
}

export interface DetailCell {
  key: string;
  value: string;
}

export function buildDetailCells(a: ScreenerAsset): DetailCell[] {
  const nn = (v: number | null) => (v === null ? "—" : formatPercent(v));
  return [
    { key: "Yield", value: formatPercent(a.yield) },
    { key: "CAGR div 3A", value: formatPercent(a.cagrDiv3A, true) },
    { key: "CAGR div 5A", value: formatPercent(a.cagrDiv5A, true) },
    { key: "P/E", value: a.pe === null ? "—" : formatDecimal(a.pe, 1) },
    { key: "Payout", value: nn(a.payout) },
    { key: "ROE", value: nn(a.roe) },
    { key: "ROA", value: nn(a.roa) },
    { key: "ROIC", value: nn(a.roic) },
    { key: "M. neta", value: nn(a.margenNeta) },
    { key: "Expense ratio", value: a.expenseRatio === null ? "—" : formatPercent(a.expenseRatio) },
    { key: "Beta", value: formatDecimal(a.beta, 2) },
    { key: a.expenseRatio === null ? "Cap. bursátil" : "AUM", value: formatAumOrCap(a.aumOCap) },
    { key: "Retorno 1A", value: formatPercent(a.retorno1A, true) },
    { key: "Retorno 3A", value: formatPercent(a.retorno3A, true) },
    { key: "Retorno 5A", value: formatPercent(a.retorno5A, true) },
  ];
}

export function buildSparkline(a: ScreenerAsset, indexInUniverse: number): number[] {
  const drift = a.retorno3A / 100 / 36;
  return generateSeries(indexInUniverse * 13 + 5, drift, 0.055, 37);
}

export interface DividendBarPoint {
  year: string;
  value: number;
  isLast: boolean;
}

export function buildDividendHistory(a: ScreenerAsset): DividendBarPoint[] {
  const dps = (a.yield / 100) * a.precio;
  const points: DividendBarPoint[] = [];
  for (let k = 7; k >= 0; k--) {
    const value = dps / Math.pow(1 + a.cagrDiv5A / 100, k);
    points.push({ year: String(2026 - k).slice(2), value, isLast: k === 0 });
  }
  return points;
}
