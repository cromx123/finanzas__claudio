export type Currency = "CLP" | "USD" | "EUR";
export type Country = "Chile" | "EE.UU." | "España" | "Otro";
export type AssetType = "Acción" | "ETF" | "REIT";
export type DividendStatus = "Pagado" | "Confirmado" | "Estimado";
export type AllocBy = "tag" | "tipo" | "sector" | "pais";
export type RangeKey = "1A" | "3A" | "5A";

export interface Holding {
  ticker: string;
  nombre: string;
  tipo: AssetType;
  tag: string;
  sector: string;
  pais: string;
  cantidad: number;
  costoPromedio: number;
  precio: number;
  dividendoAnualPorAccion: number;
  stale?: boolean;
}

export interface UpcomingDividend {
  ticker: string;
  fecha: string;
  montoPorAccion: number;
  cantidad: number;
  estado: DividendStatus;
}

export interface PortfolioObjectives {
  dividendoMensual: number;
  costoVida: number;
  hitoPatrimonio: number;
}

// User-created portfolio config, persisted to localStorage. Everything
// money-related (holdings, aportes, G/P realizada, dividendos) is derived
// at read time from the transaction ledger — see lib/calc/ledger.ts —
// never stored here.
export interface PortfolioConfig {
  id: string;
  nombre: string;
  moneda: Currency;
  pais: Country;
  retencion: number;
  objetivos: PortfolioObjectives;
}

export type TransactionType = "Compra" | "Venta";

export interface Transaction {
  id: string;
  ticker: string;
  tipo: TransactionType;
  fecha: string; // yyyy-mm-dd
  monto: number; // total money moved, in the portfolio's currency
  precio: number; // price per share at the time of the transaction
  cantidad: number; // monto / precio, derived when the transaction is entered
}

// User-entered reference data for a ticker (name, classification, mark
// price, dividend rate) — not part of any single transaction, so it's
// captured once per ticker and can be edited later.
export interface HoldingMeta {
  ticker: string;
  nombre: string;
  tipo: AssetType;
  tag: string;
  sector: string;
  pais: string;
  precioActual: number;
  dividendoAnualPorAccion: number;
}

export interface PerformancePoint {
  index: number;
  cartera: number;
  benchmark: number;
  label: string;
}

export interface ScreenerAsset {
  ticker: string;
  nombre: string;
  tipo: AssetType;
  pais: string;
  moneda: Currency;
  precio: number;
  variacionHoy: number;
  yield: number;
  cagrDiv3A: number;
  cagrDiv5A: number;
  pe: number | null;
  payout: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  margenNeta: number | null;
  expenseRatio: number | null;
  aumOCap: number;
  beta: number;
  retorno1A: number;
  retorno3A: number;
  retorno5A: number;
  frecuenciaPago: string;
}

export interface ComparadorAsset {
  ticker: string;
  nombre: string;
  precio: number;
  rentabilidadPromedioAnual: number;
  yieldInicial: number;
  cagrDiv5A: number;
  cagrDiv3A: number;
  expenseRatio: number | null;
  aumOCap: string;
  retorno3A: number;
  retorno5A: number;
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

export interface DividendPortfolioAsset {
  ticker: string;
  nombre: string;
  cantidad: number;
  pagos: Array<{ mes: number; dia: number; montoPorAccion: number }>;
}

export interface Tag {
  name: string;
}

export interface GoalAsset {
  ticker: string;
  nombre: string;
  monedaNativa: "CLP" | "USD";
  valorNativo: number;
  dividendoAnualNativo: number;
}
