import type { ApiNetWorthPoint } from "../api/types";
import type { RangeKey } from "../types";
import { dateLabel } from "./series";

export interface NetWorthPoint {
  index: number;
  value: number;
  label: string;
}

export function buildNetWorthPoints(points: ApiNetWorthPoint[], range: RangeKey): NetWorthPoint[] {
  return points.map((p, i) => ({ index: i, value: p.value, label: dateLabel(p.date, range) }));
}
