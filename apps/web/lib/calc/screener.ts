import { formatCurrency, formatDecimal, formatPercent } from "../format";
import type { ApiScreenerAsset } from "../api/types";
import type { Currency } from "../types";

export interface ScreenerFilters {
  q: string;
  tipo: "*" | "stock" | "etf" | "reit";
  yieldMin: 0 | 3 | 5;
  peMax: 0 | 15 | 25;
  roeMin: 0 | 15 | 25;
}

export function filterScreener(list: ApiScreenerAsset[], f: ScreenerFilters): ApiScreenerAsset[] {
  const q = f.q.toLowerCase();
  return list.filter(
    (a) =>
      (!q || a.yahoo_symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) &&
      (f.tipo === "*" || a.type === f.tipo) &&
      (!f.yieldMin || (a.yield_pct ?? 0) >= f.yieldMin) &&
      (!f.peMax || (a.pe_ratio !== null && a.pe_ratio <= f.peMax)) &&
      (!f.roeMin || (a.roe !== null && a.roe >= f.roeMin))
  );
}

export type ScreenerSortKey = "yield_pct" | "cagr_div_5y" | "pe_ratio" | "roe";

export function sortScreener(list: ApiScreenerAsset[], key: ScreenerSortKey, dir: 1 | -1): ApiScreenerAsset[] {
  return [...list].sort((x, y) => {
    const a = x[key];
    const b = y[key];
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    return dir * (a - b);
  });
}

export function formatAssetPrice(a: ApiScreenerAsset): string {
  if (a.price === null) return "—";
  return formatCurrency(a.price, a.currency as Currency, a.currency === "CLP" ? 0 : 2);
}

export function formatAumOrCap(value: number | null): string {
  if (value === null) return "—";
  return (value >= 1e12 ? (value / 1e12).toFixed(2).replace(".", ",") + "T" : (value / 1e9).toFixed(1).replace(".", ",") + "B") + " US$";
}

export interface DetailCell {
  key: string;
  value: string;
}

export function buildDetailCells(a: ApiScreenerAsset): DetailCell[] {
  const nn = (v: number | null) => (v === null ? "—" : formatPercent(v));
  return [
    { key: "Yield", value: nn(a.yield_pct) },
    { key: "CAGR div 3A", value: a.cagr_div_3y === null ? "—" : formatPercent(a.cagr_div_3y, true) },
    { key: "CAGR div 5A", value: a.cagr_div_5y === null ? "—" : formatPercent(a.cagr_div_5y, true) },
    { key: "P/E", value: a.pe_ratio === null ? "—" : formatDecimal(a.pe_ratio, 1) },
    { key: "Payout", value: nn(a.payout_ratio) },
    { key: "ROE", value: nn(a.roe) },
    { key: "ROA", value: nn(a.roa) },
    { key: "ROIC", value: nn(a.roic) },
    { key: "M. neta", value: nn(a.net_margin) },
    { key: "Expense ratio", value: a.expense_ratio === null ? "—" : formatPercent(a.expense_ratio) },
    { key: a.type === "etf" ? "AUM" : "Cap. bursátil", value: formatAumOrCap(a.aum_or_cap) },
    { key: "Retorno 1A", value: a.return_1y === null ? "—" : formatPercent(a.return_1y, true) },
    { key: "Retorno 3A", value: a.return_3y === null ? "—" : formatPercent(a.return_3y, true) },
    { key: "Retorno 5A", value: a.return_5y === null ? "—" : formatPercent(a.return_5y, true) },
  ];
}
