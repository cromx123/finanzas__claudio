// Shared row shapes rendered by panel/DistributionPanel, GoalsPanel, and
// UpcomingDividends. The actual holdings math now runs server-side (see
// services/api/app/modules/portfolios/service.py) — these types just
// describe what the UI expects once that data is formatted for display.
import type { UpcomingDividend } from "../types";

export interface AllocationRow {
  label: string;
  value: number;
  pct: number;
  valueLabel: string;
  pctLabel: string;
}

export interface UpcomingDividendRow {
  ticker: string;
  fecha: string;
  estado: UpcomingDividend["estado"];
  montoLabel: string;
}

export interface GoalRow {
  label: string;
  actualLabel: string;
  objetivoLabel: string;
  pctLabel: string;
  widthPct: number;
}
