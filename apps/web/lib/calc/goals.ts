import { formatPercent, formatUsd } from "../format";
import type { GoalAsset } from "../types";

export interface ConvertedAsset {
  ticker: string;
  nombre: string;
  valorUsd: number;
  dividendoUsdAnual: number;
}

export function convertAssets(assets: GoalAsset[], fxClpUsd: number): ConvertedAsset[] {
  return assets.map((a) => ({
    ticker: a.ticker,
    nombre: a.nombre,
    valorUsd: a.monedaNativa === "CLP" ? a.valorNativo / fxClpUsd : a.valorNativo,
    dividendoUsdAnual: a.monedaNativa === "CLP" ? a.dividendoAnualNativo / fxClpUsd : a.dividendoAnualNativo,
  }));
}

export interface GoalCardData {
  pctLabel: string;
  widthPct: number;
  subLabel: string;
  extraLabel: string;
}

export function buildGoalCards(divMesUsd: number, metaDivMensual: number, gastoMensual: number, patrimonio: number, nextHito: number) {
  const g1 = divMesUsd / metaDivMensual;
  const g2 = divMesUsd / gastoMensual;
  const g3 = patrimonio / nextHito;
  const goal1: GoalCardData = {
    pctLabel: formatPercent(Math.min(g1, 1) * 100),
    widthPct: Math.min(g1, 1) * 100,
    subLabel: `${formatUsd(divMesUsd, 2)} de ${formatUsd(metaDivMensual)}/mes`,
    extraLabel: g1 >= 1 ? "meta cumplida" : `faltan ${formatUsd(metaDivMensual - divMesUsd, 2)}/mes`,
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

export function buildFiLadder(patrimonio: number, hitos: number[], gastoMensual: number) {
  const fiNum = (gastoMensual * 12) / 0.04;
  let next = hitos.find((h) => patrimonio < h);
  if (next === undefined) next = fiNum;

  const mkStep = (h: number, label: string): FiStep => {
    const done = patrimonio >= h;
    const current = !done && h === next;
    return {
      key: label,
      valueLabel: formatUsd(h),
      statusLabel: done ? "Logrado" : current ? `En curso · ${formatPercent((patrimonio / h) * 100)}` : "Pendiente",
      status: done ? "done" : current ? "current" : "pending",
    };
  };

  const steps = hitos.map((h) => mkStep(h, String(h)));
  const fiStep = mkStep(fiNum, "fi");
  return { steps, fiStep, fiNum };
}

export interface TagRow {
  name: string;
  count: number;
  valorLabel: string;
  pesoLabel: string;
  widthPct: number;
  ingresoPctLabel: string;
}

export function buildTagRows(
  assets: ConvertedAsset[],
  tags: string[],
  assignments: Record<string, string[]>,
  patrimonio: number,
  divAnual: number
): TagRow[] {
  return tags.map((name) => {
    const members = assets.filter((a) => (assignments[a.ticker] ?? []).includes(name));
    const valor = members.reduce((s, a) => s + a.valorUsd, 0);
    const div = members.reduce((s, a) => s + a.dividendoUsdAnual, 0);
    return {
      name,
      count: members.length,
      valorLabel: valor ? formatUsd(valor) : "—",
      pesoLabel: formatPercent((valor / patrimonio) * 100),
      widthPct: (valor / patrimonio) * 100,
      ingresoPctLabel: divAnual ? formatPercent((div / divAnual) * 100) : "—",
    };
  });
}
