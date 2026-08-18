import type { ApiPerformancePoint } from "../api/types";
import type { PerformancePoint, RangeKey } from "../types";

const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

// Short ranges sample daily — a month-only label ("AGO 26") would repeat
// identically for every point, so these use a day+month label instead.
const DAILY_SAMPLED_RANGES = new Set<RangeKey>(["1D", "1W", "1M", "3M"]);

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")} ${MES[d.getMonth()]}`;
}

function monthLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return `${MES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

/**
 * Rebases the portfolio's real value series and the S&P 500's real index
 * level series to 100 at the first point each has data for — the two use
 * unrelated units (portfolio currency vs. index points), so only relative
 * growth is comparable, not the absolute lines.
 */
export function buildPerformancePoints(points: ApiPerformancePoint[], range: RangeKey): PerformancePoint[] {
  const carteraBase = points.find((p) => p.cartera_value > 0)?.cartera_value ?? null;
  const benchmarkBase = points.find((p) => (p.benchmark_index ?? 0) > 0)?.benchmark_index ?? null;
  const label = DAILY_SAMPLED_RANGES.has(range) ? dayLabel : monthLabel;

  return points.map((p, i) => ({
    index: i,
    cartera: carteraBase ? (p.cartera_value / carteraBase) * 100 : 0,
    benchmark: benchmarkBase && p.benchmark_index !== null ? (p.benchmark_index / benchmarkBase) * 100 : null,
    label: label(p.date),
  }));
}
