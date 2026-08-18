import { formatCurrency, formatPercent, formatUsd } from "../format";
import type { ApiHolding } from "../api/types";
import type { Currency } from "../types";

export interface GoalCardData {
  pctLabel: string;
  widthPct: number;
  subLabel: string;
  extraLabel: string;
}

export function buildGoalCards(divMesUsd: number, metaDivMensual: number, gastoMensual: number, patrimonio: number, nextHito: number) {
  const g1 = metaDivMensual > 0 ? divMesUsd / metaDivMensual : 0;
  const g2 = gastoMensual > 0 ? divMesUsd / gastoMensual : 0;
  const g3 = nextHito > 0 ? patrimonio / nextHito : 0;
  const goal1: GoalCardData = {
    pctLabel: formatPercent(Math.min(g1, 1) * 100),
    widthPct: Math.min(g1, 1) * 100,
    subLabel: `${formatUsd(divMesUsd, 2)} de ${formatUsd(metaDivMensual)}/mes`,
    extraLabel: g1 >= 1 ? "meta cumplida" : `faltan ${formatUsd(Math.max(0, metaDivMensual - divMesUsd), 2)}/mes`,
  };
  const goal2: GoalCardData = {
    pctLabel: formatPercent(g2 * 100),
    widthPct: Math.min(g2, 1) * 100,
    subLabel: "de tus gastos los paga la cartera",
    extraLabel: `gasto anual ${formatUsd(gastoMensual * 12)}`,
  };
  const goal3: GoalCardData = {
    pctLabel: formatPercent(Math.min(g3, 1) * 100),
    widthPct: Math.min(g3, 1) * 100,
    subLabel: `hacia ${formatUsd(nextHito)}`,
    extraLabel: `patrimonio actual ${formatUsd(patrimonio)} · faltan ${formatUsd(Math.max(0, nextHito - patrimonio))}`,
  };
  return { goal1, goal2, goal3 };
}

export type StepStatus = "done" | "current" | "pending";

export interface FiStep {
  key: string;
  valueLabel: string;
  statusLabel: string;
  status: StepStatus;
}

export function buildFiSteps(hitos: { monto: number; logrado: boolean }[], patrimonio: number, numeroFi: number): { steps: FiStep[]; fiStep: FiStep } {
  const next = hitos.find((h) => !h.logrado)?.monto ?? numeroFi;
  const mkStep = (monto: number, done: boolean): FiStep => {
    const current = !done && monto === next;
    return {
      key: String(monto),
      valueLabel: formatUsd(monto),
      statusLabel: done ? "Logrado" : current ? `En curso · ${formatPercent(Math.min((patrimonio / monto) * 100, 100))}` : "Pendiente",
      status: done ? "done" : current ? "current" : "pending",
    };
  };
  const steps = hitos.map((h) => mkStep(h.monto, h.logrado));
  const fiStep = mkStep(numeroFi, patrimonio >= numeroFi);
  return { steps, fiStep };
}

export interface TagRow {
  name: string;
  count: number;
  valorLabel: string;
  pesoLabel: string;
  widthPct: number;
  ingresoPctLabel: string;
}

export function buildTagRows(holdings: ApiHolding[], tags: string[], patrimonio: number, divAnual: number, ccy: Currency): TagRow[] {
  return tags.map((name) => {
    const members = holdings.filter((h) => h.tags.includes(name));
    const valor = members.reduce((s, h) => s + h.market_value, 0);
    const div = members.reduce((s, h) => s + h.quantity * h.dividend_per_share_ttm, 0);
    return {
      name,
      count: members.length,
      valorLabel: valor ? formatCurrency(valor, ccy) : "—",
      pesoLabel: patrimonio > 0 ? formatPercent((valor / patrimonio) * 100) : "—",
      widthPct: patrimonio > 0 ? (valor / patrimonio) * 100 : 0,
      ingresoPctLabel: divAnual > 0 ? formatPercent((div / divAnual) * 100) : "—",
    };
  });
}
