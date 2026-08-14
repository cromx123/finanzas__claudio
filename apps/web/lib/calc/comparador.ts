import { formatCompactUsd, formatDecimal, formatPercent } from "../format";
import type { ComparadorAsset, ComparadorParams } from "../types";

export interface SimResult {
  cap: number;
  aportes: number;
  divTot: number;
  divAF: number;
  divSerie: number[];
  cubre: number | null;
}

export function simulate(asset: ComparadorAsset, params: ComparadorParams): SimResult {
  const rpM = Math.pow(1 + asset.rentabilidadPromedioAnual / 100, 1 / 12) - 1;
  let cap = params.inversionInicial;
  let y = asset.yieldInicial / 100;
  let aportes = params.inversionInicial;
  let divTot = 0;
  const divSerie = [cap * y];
  for (let t = 1; t <= params.horizonteAnios; t++) {
    for (let m = 0; m < 12; m++) {
      const div = (cap * y) / 12;
      divTot += div;
      if (params.drip) cap += div;
      cap = cap * (1 + rpM) + params.aporteMensual;
      aportes += params.aporteMensual;
    }
    y = (y * (1 + asset.cagrDiv5A / 100)) / (1 + asset.rentabilidadPromedioAnual / 100);
    divSerie.push(cap * y);
  }
  const divAF = cap * y;
  let cubre: number | null = null;
  for (let t = 0; t <= params.horizonteAnios; t++) {
    if (divSerie[t] >= params.costoVidaMensual * 12 * Math.pow(1 + params.inflacionAnual / 100, t)) {
      cubre = t;
      break;
    }
  }
  return { cap, aportes, divTot, divAF, divSerie, cubre };
}

export function buildCostOfLivingSeries(params: ComparadorParams): number[] {
  const out: number[] = [];
  for (let t = 0; t <= params.horizonteAnios; t++) {
    out.push(params.costoVidaMensual * 12 * Math.pow(1 + params.inflacionAnual / 100, t));
  }
  return out;
}

export interface MetricRow {
  label: string;
  a: string;
  b: string;
}

export function buildMetricRows(a: ComparadorAsset, b: ComparadorAsset): MetricRow[] {
  const nn = (v: number | null) => (v === null ? "—" : formatPercent(v));
  return [
    { label: "Precio actual", a: `US$${formatDecimal(a.precio, 2)}`, b: `US$${formatDecimal(b.precio, 2)}` },
    { label: "Yield actual", a: formatPercent(a.yieldInicial), b: formatPercent(b.yieldInicial) },
    { label: "CAGR dividendo 3A", a: formatPercent(a.cagrDiv3A), b: formatPercent(b.cagrDiv3A) },
    { label: "CAGR dividendo 5A", a: formatPercent(a.cagrDiv5A), b: formatPercent(b.cagrDiv5A) },
    { label: "Rentab. promedio anual", a: formatPercent(a.rentabilidadPromedioAnual), b: formatPercent(b.rentabilidadPromedioAnual) },
    { label: "Retorno 3A", a: formatPercent(a.retorno3A, true), b: formatPercent(b.retorno3A, true) },
    { label: "Retorno 5A", a: formatPercent(a.retorno5A, true), b: formatPercent(b.retorno5A, true) },
    { label: "Expense ratio", a: nn(a.expenseRatio), b: nn(b.expenseRatio) },
    { label: "AUM / Cap.", a: `US$${a.aumOCap}`, b: `US$${b.aumOCap}` },
  ];
}

export interface ResultRow {
  ticker: string;
  colorVar: string;
  capital: string;
  aportes: string;
  dividendosCobrados: string;
  dividendoAnual: string;
  dividendoMensual: string;
  yoc: string;
  cubre: string;
  cubreNegative: boolean;
}

export function buildResultRow(ticker: string, s: SimResult, colorVar: string, horizonteAnios: number): ResultRow {
  return {
    ticker,
    colorVar,
    capital: formatCompactUsd(s.cap),
    aportes: formatCompactUsd(s.aportes),
    dividendosCobrados: formatCompactUsd(s.divTot),
    dividendoAnual: formatCompactUsd(s.divAF),
    dividendoMensual: formatCompactUsd(s.divAF / 12),
    yoc: formatPercent((s.divAF / s.aportes) * 100),
    cubre: s.cubre === null ? `No en ${horizonteAnios} años` : `Sí · año ${s.cubre} (${2026 + s.cubre})`,
    cubreNegative: s.cubre === null,
  };
}
