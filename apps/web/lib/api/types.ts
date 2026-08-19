// Mirrors the FastAPI Pydantic schemas exactly (snake_case, as returned by
// services/api). Kept separate from lib/types.ts (the frontend's own
// display-oriented types) so the API's shape can drift without silently
// breaking components — see lib/api/mappers.ts for the translation layer.

export interface ApiPortfolio {
  id: string;
  name: string;
  currency: string;
}

export interface ApiAsset {
  id: string;
  yahoo_symbol: string;
  name: string;
  sector: string | null;
  type: string;
  currency: string;
  country: string;
}

export interface ApiTransaction {
  id: string;
  portfolio_id: string;
  asset: ApiAsset;
  type: "buy" | "sell";
  trade_date: string;
  quantity: number;
  price: number;
  gross_amount: number;
  currency: string;
}

export interface ApiLot {
  id: string;
  trade_date: string;
  quantity: number;
  price: number;
}

export interface ApiHolding {
  asset: ApiAsset;
  tags: string[];
  quantity: number;
  avg_cost: number;
  price: number;
  price_is_stale: boolean;
  market_value: number;
  cost_basis: number;
  unrealized_pl: number;
  yield_on_cost: number;
  dividend_per_share_ttm: number;
}

export interface ApiPortfolioSummary {
  portfolio: ApiPortfolio;
  holdings: ApiHolding[];
  valor_total: number;
  costo_total: number;
  aportes: number;
  compras_totales: number;
  gp_realizada: number;
  gp_no_realizada: number;
  dividendo_anual_bruto: number;
  dividendo_anual_neto: number;
  dividendos_cobrados_bruto: number;
  dividendos_cobrados_neto: number;
}

export interface ApiPerformancePoint {
  date: string;
  cartera_value: number;
  benchmark_index: number | null;
}

export interface ApiPortfolioPerformance {
  start_date: string;
  currency: string;
  points: ApiPerformancePoint[];
}

export interface ApiScreenerAsset {
  id: string;
  yahoo_symbol: string;
  name: string;
  sector: string | null;
  type: string;
  currency: string;
  country: string;
  price: number | null;
  change_today_pct: number | null;
  yield_pct: number | null;
  cagr_div_3y: number | null;
  cagr_div_5y: number | null;
  pe_ratio: number | null;
  payout_ratio: number | null;
  roe: number | null;
  roa: number | null;
  roic: number | null;
  net_margin: number | null;
  expense_ratio: number | null;
  aum_or_cap: number | null;
  beta: number | null;
  return_1y: number | null;
  return_3y: number | null;
  return_5y: number | null;
  dividend_frequency: string | null;
}

export interface ApiAssetSearchResult {
  symbol: string;
  name: string;
  exchange: string | null;
}

export interface ApiPriceOnDate {
  date: string;
  price: number;
}

export interface ApiAssetDetail {
  asset: ApiScreenerAsset;
  sparkline: number[];
  dividend_history: { year: string; amount_per_share: number; is_latest: boolean }[];
}

export interface ApiComparadorAsset {
  yahoo_symbol: string;
  name: string;
  price: number | null;
  rentabilidad_promedio_anual: number | null;
  yield_inicial: number | null;
  cagr_div_3y: number | null;
  cagr_div_5y: number | null;
  expense_ratio: number | null;
  aum_or_cap: number | null;
  return_3y: number | null;
  return_5y: number | null;
}

export interface ApiDividendCalendarEvent {
  yahoo_symbol: string;
  name: string;
  ex_date: string;
  amount_per_share: number;
  quantity: number;
  total_bruto: number;
  total_neto: number;
  estado: "Pagado" | "Estimado";
}

export interface ApiDividendCalendar {
  portfolio_id: string;
  currency: string;
  year: number;
  events: ApiDividendCalendarEvent[];
}

export interface ApiGoal {
  id: string;
  kind: "monthly_dividends" | "cost_coverage" | "net_worth";
  target_amount: number;
  currency: string;
  monthly_expenses: number | null;
  target_date: string | null;
}

export interface ApiHoldingContribution {
  yahoo_symbol: string;
  valor_nativo: number;
}

export interface ApiPortfolioContribution {
  id: string;
  name: string;
  currency: string;
  valor_nativo: number;
  valor_convertido: number;
  dividendo_mensual_convertido: number;
  holdings: ApiHoldingContribution[];
}

export interface ApiGoalsProgress {
  currency: string;
  patrimonio_total: number;
  dividendo_mensual: number;
  dividendo_anual_bruto: number;
  portfolios: ApiPortfolioContribution[];
  goals: ApiGoal[];
  hitos_fi: { monto: number; logrado: boolean }[];
  numero_fi: number;
}

export interface ApiCountryAllocation {
  currency: string;
  rows: { country: string; value: number }[];
}

export interface ApiNetWorthPoint {
  date: string;
  value: number;
}

export interface ApiNetWorthHistory {
  currency: string;
  start_date: string;
  points: ApiNetWorthPoint[];
}

export type AlertCondition =
  | "price_below"
  | "price_above"
  | "rsi_below"
  | "rsi_above"
  | "bollinger_lower_cross"
  | "bollinger_upper_cross";

export interface ApiAlert {
  id: string;
  asset: ApiAsset;
  condition: AlertCondition;
  threshold: number | null;
  params: Record<string, number>;
  active: boolean;
  triggered_at: string | null;
  created_at: string;
  current_price: number | null;
  current_value: number | null;
}

export interface ApiFxRateDetail {
  rate: number;
  source: "yahoo" | "manual" | "default" | "base";
  as_of: string | null;
}

export interface ApiMovement {
  date: string;
  kind: "buy" | "sell" | "dividend";
  portfolio_id: string;
  portfolio_name: string;
  yahoo_symbol: string;
  asset_name: string;
  quantity: number;
  price: number;
  total: number;
  currency: string;
}
