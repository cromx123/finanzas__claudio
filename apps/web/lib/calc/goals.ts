import { formatCurrency, formatDateEs, formatPercent } from "../format";
import type { ApiHolding, ApiTag } from "../api/types";
import type { Currency } from "../types";

export interface GoalCardData {
  pctLabel: string;
  widthPct: number;
  subLabel: string;
  extraLabel: string;
}

export function buildGoalCards(
  divMes: number,
  metaDivMensual: number,
  gastoMensual: number,
  patrimonio: number,
  nextHito: number,
  ccy: Currency
) {
  const g1 = metaDivMensual > 0 ? divMes / metaDivMensual : 0;
  const g2 = gastoMensual > 0 ? divMes / gastoMensual : 0;
  const g3 = nextHito > 0 ? patrimonio / nextHito : 0;
  const goal1: GoalCardData = {
    pctLabel: formatPercent(Math.min(g1, 1) * 100),
    widthPct: Math.min(g1, 1) * 100,
    subLabel: `${formatCurrency(divMes, ccy, 2)} de ${formatCurrency(metaDivMensual, ccy)}/mes`,
    extraLabel: g1 >= 1 ? "meta cumplida" : `faltan ${formatCurrency(Math.max(0, metaDivMensual - divMes), ccy, 2)}/mes`,
  };
  const goal2: GoalCardData = {
    pctLabel: formatPercent(g2 * 100),
    widthPct: Math.min(g2, 1) * 100,
    subLabel: "de tus gastos los paga la cartera",
    extraLabel: `gasto anual ${formatCurrency(gastoMensual * 12, ccy)}`,
  };
  const goal3: GoalCardData = {
    pctLabel: formatPercent(Math.min(g3, 1) * 100),
    widthPct: Math.min(g3, 1) * 100,
    subLabel: `hacia ${formatCurrency(nextHito, ccy)}`,
    extraLabel: `patrimonio actual ${formatCurrency(patrimonio, ccy)} · faltan ${formatCurrency(Math.max(0, nextHito - patrimonio), ccy)}`,
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

export function buildFiSteps(
  hitos: { monto: number; logrado: boolean; projected_date: string | null }[],
  patrimonio: number,
  numeroFi: number,
  numeroFiProjectedDate: string | null,
  ccy: Currency
): { steps: FiStep[]; fiStep: FiStep } {
  const next = hitos.find((h) => !h.logrado)?.monto ?? numeroFi;
  const mkStep = (monto: number, done: boolean, projectedDate: string | null): FiStep => {
    const current = !done && monto === next;
    const proj = !done && projectedDate ? ` · llegarías el ${formatDateEs(projectedDate)}` : "";
    return {
      key: String(monto),
      valueLabel: formatCurrency(monto, ccy),
      statusLabel:
        (done ? "Logrado" : current ? `En curso · ${formatPercent(Math.min((patrimonio / monto) * 100, 100))}` : "Pendiente") + proj,
      status: done ? "done" : current ? "current" : "pending",
    };
  };
  const steps = hitos.map((h) => mkStep(h.monto, h.logrado, h.projected_date));
  const fiStep = mkStep(numeroFi, patrimonio >= numeroFi, numeroFiProjectedDate);
  return { steps, fiStep };
}

export type RebalanceStatus = "over" | "under" | "on";

export interface TagRow {
  name: string;
  count: number;
  valorLabel: string;
  pesoLabel: string;
  widthPct: number;
  ingresoPctLabel: string;
  targetWeight: number | null;
  rebalanceStatus: RebalanceStatus | null;
  rebalanceLabel: string | null;
}

// Tolerance in percentage points before flagging a tag as over/under target
// — avoids nagging over noise (e.g. 0.3pp off) that isn't worth acting on.
const REBALANCE_TOLERANCE_PCT = 2;

export function buildTagRows(holdings: ApiHolding[], tags: ApiTag[], patrimonio: number, divAnual: number, ccy: Currency): TagRow[] {
  return tags.map((tag) => {
    const members = holdings.filter((h) => h.tags.includes(tag.label));
    const valor = members.reduce((s, h) => s + h.market_value, 0);
    const div = members.reduce((s, h) => s + h.quantity * h.dividend_per_share_ttm, 0);
    const widthPct = patrimonio > 0 ? (valor / patrimonio) * 100 : 0;

    let rebalanceStatus: RebalanceStatus | null = null;
    let rebalanceLabel: string | null = null;
    if (tag.target_weight !== null) {
      const diff = widthPct - tag.target_weight;
      if (diff > REBALANCE_TOLERANCE_PCT) {
        rebalanceStatus = "over";
        rebalanceLabel = `Sobre-ponderado (${formatPercent(diff, true)})`;
      } else if (diff < -REBALANCE_TOLERANCE_PCT) {
        rebalanceStatus = "under";
        rebalanceLabel = `Sub-ponderado (${formatPercent(diff, true)})`;
      } else {
        rebalanceStatus = "on";
        rebalanceLabel = "En objetivo";
      }
    }

    return {
      name: tag.label,
      count: members.length,
      valorLabel: valor ? formatCurrency(valor, ccy) : "—",
      pesoLabel: patrimonio > 0 ? formatPercent(widthPct) : "—",
      widthPct,
      ingresoPctLabel: divAnual > 0 ? formatPercent((div / divAnual) * 100) : "—",
      targetWeight: tag.target_weight,
      rebalanceStatus,
      rebalanceLabel,
    };
  });
}
