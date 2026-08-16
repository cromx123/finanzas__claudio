import { formatCompactUsd, formatDecimal, formatPercent } from "../format";
import type { ApiComparadorAsset } from "../api/types";
import type { ComparadorParams } from "../types";

const CURRENT_YEAR = new Date().getFullYear();

export interface SimResult {
  cap: number;
  aportes: number;
  divTot: number;
  divAF: number;
  divSerie: number[];
  cubre: number | null;
}

export function simulate(asset: ApiComparadorAsset, params: ComparadorParams): SimResult {
  const rp = asset.rentabilidad_promedio_anual ?? 8;
  const y0 = (asset.yield_inicial ?? 0) / 100;
  const cd = asset.cagr_div_5y ?? 0;
  const rpM = Math.pow(1 + rp / 100, 1 / 12) - 1;
  let cap = params.inversionInicial;
  let y = y0;
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
    y = (y * (1 + cd / 100)) / (1 + rp / 100);
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

export function buildMetricRows(a: ApiComparadorAsset, b: ApiComparadorAsset): MetricRow[] {
  const nn = (v: number | null) => (v === null ? "—" : formatPercent(v));
  const px = (v: number | null) => (v === null ? "—" : `US$${formatDecimal(v, 2)}`);
  const aum = (v: number | null) => (v === null ? "—" : `US$${(v / 1e9).toFixed(1).replace(".", ",")}B`);
  return [
    { label: "Precio actual", a: px(a.price), b: px(b.price) },
    { label: "Yield actual", a: nn(a.yield_inicial), b: nn(b.yield_inicial) },
    { label: "CAGR dividendo 3A", a: nn(a.cagr_div_3y), b: nn(b.cagr_div_3y) },
    { label: "CAGR dividendo 5A", a: nn(a.cagr_div_5y), b: nn(b.cagr_div_5y) },
    { label: "Rentab. promedio anual", a: nn(a.rentabilidad_promedio_anual), b: nn(b.rentabilidad_promedio_anual) },
    { label: "Retorno 3A", a: a.return_3y === null ? "—" : formatPercent(a.return_3y, true), b: b.return_3y === null ? "—" : formatPercent(b.return_3y, true) },
    { label: "Retorno 5A", a: a.return_5y === null ? "—" : formatPercent(a.return_5y, true), b: b.return_5y === null ? "—" : formatPercent(b.return_5y, true) },
    { label: "Expense ratio", a: nn(a.expense_ratio), b: nn(b.expense_ratio) },
    { label: "AUM / Cap.", a: aum(a.aum_or_cap), b: aum(b.aum_or_cap) },
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
    cubre: s.cubre === null ? `No en ${horizonteAnios} años` : `Sí · año ${s.cubre} (${CURRENT_YEAR + s.cubre})`,
    cubreNegative: s.cubre === null,
  };
}

export { CURRENT_YEAR };
