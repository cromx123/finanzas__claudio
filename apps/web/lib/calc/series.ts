import type { PerformancePoint, RangeKey } from "../types";

const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

// "Today" is anchored to August 2026, matching the seed data in the design handoff.
const TODAY_YEAR = 2026;
const TODAY_MONTH_INDEX = 7; // AGO

export const RANGE_LENGTHS: Record<RangeKey, number> = { "1A": 13, "3A": 37, "5A": 61 };

export function monthLabel(indexInRange: number, rangeLength: number): string {
  const d = new Date(TODAY_YEAR, TODAY_MONTH_INDEX - (rangeLength - 1 - indexInRange), 1);
  return `${MES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

export function buildPerformancePoints(fullPortfolio: number[], fullBenchmark: number[], range: RangeKey): PerformancePoint[] {
  const N = RANGE_LENGTHS[range];
  const sliceAndRebase = (full: number[]) => {
    const slice = full.slice(full.length - N);
    return slice.map((v) => (v / slice[0]) * 100);
  };
  const portfolio = sliceAndRebase(fullPortfolio);
  const benchmark = sliceAndRebase(fullBenchmark);
  return portfolio.map((cartera, i) => ({
    index: i,
    cartera,
    benchmark: benchmark[i],
    label: monthLabel(i, N),
  }));
}
