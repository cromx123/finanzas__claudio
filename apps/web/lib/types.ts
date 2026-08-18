export type Currency = "CLP" | "USD" | "EUR" | "JPY";
export type DividendStatus = "Pagado" | "Confirmado" | "Estimado";
export type AllocBy = "tipo" | "sector" | "pais";
export type RangeKey = "1D" | "1W" | "1M" | "3M" | "1A" | "3A" | "5A";

export interface UpcomingDividend {
  ticker: string;
  fecha: string;
  montoPorAccion: number;
  cantidad: number;
  estado: DividendStatus;
}

export interface PerformancePoint {
  index: number;
  cartera: number;
  benchmark: number | null;
  label: string;
}

export interface ComparadorParams {
  activoA: string;
  activoB: string;
  inversionInicial: number;
  aporteMensual: number;
  costoVidaMensual: number;
  inflacionAnual: number;
  horizonteAnios: number;
  drip: boolean;
}
