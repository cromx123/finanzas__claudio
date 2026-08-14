import { formatCurrency, formatPercent } from "../format";
import type { AllocBy, Holding, Portfolio, UpcomingDividend } from "../types";

export interface ValuedHolding extends Holding {
  valor: number;
  costo: number;
  gp: number;
  dividendoAnualTotal: number;
  peso: number;
  yoc: number;
}

export interface HoldingsValuation {
  holdings: ValuedHolding[];
  valorTotal: number;
  costoTotal: number;
  dividendoProyectadoBruto: number;
  gpNoRealizada: number;
}

export function valuateHoldings(holdings: Holding[]): HoldingsValuation {
  let costoTotal = 0;
  let valorTotal = 0;
  let dividendoProyectadoBruto = 0;
  const base = holdings.map((h) => {
    const valor = h.cantidad * h.precio;
    const costo = h.cantidad * h.costoPromedio;
    const dividendoAnualTotal = h.cantidad * h.dividendoAnualPorAccion;
    costoTotal += costo;
    valorTotal += valor;
    dividendoProyectadoBruto += dividendoAnualTotal;
    return { ...h, valor, costo, gp: valor - costo, dividendoAnualTotal };
  });
  const valued: ValuedHolding[] = base.map((h) => ({
    ...h,
    peso: h.valor / valorTotal,
    yoc: h.dividendoAnualTotal / h.costo,
  }));
  return { holdings: valued, valorTotal, costoTotal, dividendoProyectadoBruto, gpNoRealizada: valorTotal - costoTotal };
}

export function sortHoldings(holdings: ValuedHolding[], key: "valor" | "yoc" | "gp", dir: 1 | -1): ValuedHolding[] {
  return [...holdings].sort((a, b) => dir * (a[key] - b[key]));
}

export interface AllocationRow {
  label: string;
  value: number;
  pct: number;
  valueLabel: string;
  pctLabel: string;
}

export function computeAllocation(
  valued: ValuedHolding[],
  valorTotal: number,
  allocBy: AllocBy,
  ccy: Portfolio["moneda"],
  decimales: number
): AllocationRow[] {
  const keyOf = (h: ValuedHolding) => (allocBy === "tipo" ? h.tipo : allocBy === "sector" ? h.sector : allocBy === "pais" ? h.pais : h.tag);
  const groups = new Map<string, number>();
  valued.forEach((h) => groups.set(keyOf(h), (groups.get(keyOf(h)) ?? 0) + h.valor));
  return Array.from(groups.entries())
    .map(([label, value]) => ({
      label,
      value,
      pct: value / valorTotal,
      valueLabel: formatCurrency(value, ccy, decimales),
      pctLabel: formatPercent((value / valorTotal) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);
}

export interface UpcomingDividendRow {
  ticker: string;
  fecha: string;
  estado: UpcomingDividend["estado"];
  montoLabel: string;
}

export function computeUpcomingDividends(divs: UpcomingDividend[], wh: number, ccy: Portfolio["moneda"], decimalesPrecio: number): UpcomingDividendRow[] {
  return divs.map((d) => ({
    ticker: d.ticker,
    fecha: d.fecha,
    estado: d.estado,
    montoLabel: formatCurrency(d.montoPorAccion * d.cantidad * (1 - wh), ccy, decimalesPrecio),
  }));
}

export interface GoalRow {
  label: string;
  actualLabel: string;
  objetivoLabel: string;
  pctLabel: string;
  widthPct: number;
}

export function makeGoalRow(label: string, actual: number, objetivo: number, ccy: Portfolio["moneda"], decimales: number): GoalRow {
  const ratio = Math.min(actual / objetivo, 1);
  return {
    label,
    actualLabel: formatCurrency(actual, ccy, decimales),
    objetivoLabel: formatCurrency(objetivo, ccy, decimales),
    pctLabel: formatPercent(ratio * 100),
    widthPct: ratio * 100,
  };
}
