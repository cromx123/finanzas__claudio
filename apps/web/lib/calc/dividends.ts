import { formatCurrency, formatNumber, formatPercent } from "../format";
import type { ApiDividendCalendarEvent } from "../api/types";
import type { Currency, DividendStatus } from "../types";

const MES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MESL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface DividendEvent {
  ticker: string;
  nombre: string;
  mes: number;
  dia: number;
  montoPorAccion: number;
  cantidad: number;
  total: number;
  estado: DividendStatus;
}

export function mapApiEvents(events: ApiDividendCalendarEvent[], neto: boolean): DividendEvent[] {
  const evs: DividendEvent[] = events.map((e) => {
    const [, m, d] = e.ex_date.split("-").map(Number);
    return {
      ticker: e.yahoo_symbol,
      nombre: e.name,
      mes: m - 1,
      dia: d,
      montoPorAccion: e.amount_per_share,
      cantidad: e.quantity,
      total: neto ? e.total_neto : e.total_bruto,
      estado: e.estado,
    };
  });
  evs.sort((a, b) => a.mes - b.mes || a.dia - b.dia);
  return evs;
}

export function monthlyTotals(events: DividendEvent[]): number[] {
  const monthly = new Array(12).fill(0);
  events.forEach((e) => (monthly[e.mes] += e.total));
  return monthly;
}

export function bestMonthIndex(monthly: number[]): number {
  let best = 0;
  monthly.forEach((v, i) => {
    if (v > monthly[best]) best = i;
  });
  return best;
}

export interface MonthlyBarDatum {
  label: string;
  value: number;
  valueLabel: string;
  best: boolean;
}

export function buildMonthlyBars(monthly: number[], best: number, ccy: Currency): MonthlyBarDatum[] {
  return monthly.map((v, i) => ({
    label: MES[i],
    value: v,
    valueLabel: v ? formatCurrency(v, ccy, 0) : "",
    best: i === best,
  }));
}

export interface CalendarCell {
  mes: string;
  totalLabel: string;
  isBest: boolean;
  eventos: { ticker: string; total: string; variant: "pagado" | "confirmado" | "estimado" }[];
  more: string;
}

function dotVariant(estado: DividendStatus): "pagado" | "confirmado" | "estimado" {
  if (estado === "Pagado") return "pagado";
  if (estado === "Confirmado") return "confirmado";
  return "estimado";
}

export function buildCalendarCells(events: DividendEvent[], monthly: number[], best: number, ccy: Currency): CalendarCell[] {
  return MESL.map((_, i) => {
    const monthEvents = events.filter((e) => e.mes === i);
    return {
      mes: `${MES[i]} · ${String(i + 1).padStart(2, "0")}`,
      totalLabel: monthEvents.length ? formatCurrency(monthly[i], ccy, 0) : "—",
      isBest: i === best,
      eventos: monthEvents.slice(0, 3).map((e) => ({ ticker: e.ticker, total: formatCurrency(e.total, ccy, 0), variant: dotVariant(e.estado) })),
      more: monthEvents.length > 3 ? `+${monthEvents.length - 3} pagos más` : "",
    };
  });
}

export interface TopPayerRow {
  ticker: string;
  totalLabel: string;
  pctLabel: string;
  widthPct: number;
}

export function buildTopPayers(events: DividendEvent[], totalY: number, ccy: Currency): TopPayerRow[] {
  const byTicker = new Map<string, number>();
  events.forEach((e) => byTicker.set(e.ticker, (byTicker.get(e.ticker) ?? 0) + e.total));
  const sorted = Array.from(byTicker.entries()).sort((a, b) => b[1] - a[1]);
  const max = sorted.length ? sorted[0][1] : 1;
  return sorted.map(([ticker, total]) => ({
    ticker,
    totalLabel: formatCurrency(total, ccy, 0),
    pctLabel: formatPercent((total / totalY) * 100),
    widthPct: (total / max) * 100,
  }));
}

export interface TopMonthRow {
  pos: string;
  mes: string;
  totalLabel: string;
}

export function buildTopMonths(monthly: number[], ccy: Currency): TopMonthRow[] {
  return monthly
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 3)
    .map((x, k) => ({ pos: `0${k + 1}`, mes: MESL[x.i], totalLabel: formatCurrency(x.v, ccy, 0) }));
}

export interface DetailRow {
  ticker: string;
  nombre: string;
  fecha: string;
  montoLabel: string;
  cantidadLabel: string;
  totalLabel: string;
  estado: DividendStatus;
}

export function buildDetailRows(events: DividendEvent[], filtro: DividendStatus | "*", ccy: Currency, year: number): DetailRow[] {
  const filtered = filtro === "*" ? events : events.filter((e) => e.estado === filtro);
  return filtered.map((e) => ({
    ticker: e.ticker,
    nombre: e.nombre,
    fecha: `${String(e.dia).padStart(2, "0")} ${MES[e.mes]} ${String(year).slice(2)}`,
    montoLabel: formatCurrency(e.montoPorAccion, ccy, ccy === "USD" ? 3 : 1),
    cantidadLabel: formatNumber(e.cantidad),
    totalLabel: formatCurrency(e.total, ccy, ccy === "USD" ? 2 : 0),
    estado: e.estado,
  }));
}
