import { api } from "./http";
import type {
  AlertCondition,
  ApiAlert,
  ApiAssetDetail,
  ApiAssetSearchResult,
  ApiComparadorAsset,
  ApiCountryAllocation,
  ApiDividendCalendar,
  ApiFxRateDetail,
  ApiGoal,
  ApiGoalsProgress,
  ApiLot,
  ApiMovement,
  ApiNetWorthHistory,
  ApiPortfolio,
  ApiPortfolioPerformance,
  ApiPortfolioSummary,
  ApiPriceOnDate,
  ApiScreenerAsset,
  ApiScreenerPage,
  ApiTag,
  ApiTransaction,
  ApiTransactionImportResult,
  ApiTransactionImportRow,
  ApiUserDataExport,
} from "./types";

// Portfolios
export const listPortfolios = () => api.get<ApiPortfolio[]>("/v1/portfolios");
export const createPortfolio = (input: { name: string; currency: string }) =>
  api.post<ApiPortfolio>("/v1/portfolios", input);
export const renamePortfolio = (id: string, name: string) => api.patch<ApiPortfolio>(`/v1/portfolios/${id}`, { name });
export const deletePortfolio = (id: string) => api.delete<void>(`/v1/portfolios/${id}`);
export const getPortfolioSummary = (id: string) => api.get<ApiPortfolioSummary>(`/v1/portfolios/${id}/summary`);
export const getPortfolioPerformance = (id: string, range: string) =>
  api.get<ApiPortfolioPerformance>(`/v1/portfolios/${id}/performance?range=${range}`);
export const getCountryAllocation = (currency: string) =>
  api.get<ApiCountryAllocation>(`/v1/portfolios/allocation/country?currency=${currency}`);

// Transactions
export const listTransactions = (portfolioId: string) =>
  api.get<ApiTransaction[]>(`/v1/portfolios/${portfolioId}/transactions`);
export const addTransaction = (
  portfolioId: string,
  input: {
    yahoo_symbol: string;
    type: "buy" | "sell";
    trade_date: string;
    quantity: number;
    price: number;
    lot_strategy?: "fifo" | "lifo" | "specific";
    lots?: Record<string, number>;
  }
) => api.post<ApiTransaction>(`/v1/portfolios/${portfolioId}/transactions`, input);
export const importTransactions = (rows: ApiTransactionImportRow[]) =>
  api.post<ApiTransactionImportResult>("/v1/portfolios/import-transactions", { rows });
export const getOpenLots = (portfolioId: string, yahooSymbol: string) =>
  api.get<ApiLot[]>(`/v1/portfolios/${portfolioId}/lots?yahoo_symbol=${encodeURIComponent(yahooSymbol)}`);
export const updateTransaction = (
  portfolioId: string,
  transactionId: string,
  input: { trade_date: string; quantity: number; price: number }
) => api.patch<ApiTransaction>(`/v1/portfolios/${portfolioId}/transactions/${transactionId}`, input);
export const deleteTransaction = (portfolioId: string, transactionId: string) =>
  api.delete<void>(`/v1/portfolios/${portfolioId}/transactions/${transactionId}`);

// Holdings (tags + delete position)
export const deletePosition = (portfolioId: string, assetId: string) =>
  api.delete<void>(`/v1/portfolios/${portfolioId}/holdings/${assetId}`);
export const setHoldingTags = (portfolioId: string, assetId: string, tags: string[]) =>
  api.put<string[]>(`/v1/portfolios/${portfolioId}/holdings/${assetId}/tags`, { tags });

// FX rates
export const getFxRates = () => api.get<Record<string, number>>("/v1/fx-rates");
export const getFxRateDetails = () => api.get<Record<string, ApiFxRateDetail>>("/v1/fx-rates/detail");
export const setFxRate = (currency: string, rate_to_clp: number) =>
  api.put<Record<string, number>>("/v1/fx-rates", { currency, rate_to_clp });
export const refreshFxRates = () => api.post<Record<string, number>>("/v1/fx-rates/refresh");

// Tags
export const listTags = () => api.get<ApiTag[]>("/v1/tags");
export const createTag = (label: string) => api.post<ApiTag[]>("/v1/tags", { label });
export const setTagTargetWeight = (label: string, targetWeight: number | null) =>
  api.patch<ApiTag[]>(`/v1/tags/${encodeURIComponent(label)}`, { target_weight: targetWeight });
export const deleteTag = (label: string) => api.delete<ApiTag[]>(`/v1/tags/${encodeURIComponent(label)}`);

// Goals
export const listGoals = () => api.get<ApiGoal[]>("/v1/goals");
export const upsertGoals = (
  goals: { kind: string; target_amount: number; currency: string; monthly_expenses?: number | null }[]
) => api.put<ApiGoal[]>("/v1/goals", goals);
export const getGoalsProgress = (currency: string) => api.get<ApiGoalsProgress>(`/v1/goals/progress?currency=${currency}`);

export interface CustomGoalInput {
  name: string;
  target_amount: number;
  currency: string;
  target_date?: string | null;
}
export const createCustomGoal = (input: CustomGoalInput) => api.post<ApiGoal>("/v1/goals/custom", input);
export const updateCustomGoal = (id: string, input: CustomGoalInput) =>
  api.patch<ApiGoal>(`/v1/goals/custom/${id}`, input);
export const deleteCustomGoal = (id: string) => api.delete<void>(`/v1/goals/custom/${id}`);

// Screener
export interface ScreenerPageParams {
  q?: string;
  tipo?: string;
  yieldMin?: number;
  peMax?: number;
  roeMin?: number;
  sortKey?: string;
  sortDir?: 1 | -1;
  offset?: number;
  limit?: number;
}

export const getScreenerPage = (params: ScreenerPageParams = {}) => {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.tipo) qs.set("tipo", params.tipo);
  if (params.yieldMin) qs.set("yield_min", String(params.yieldMin));
  if (params.peMax) qs.set("pe_max", String(params.peMax));
  if (params.roeMin) qs.set("roe_min", String(params.roeMin));
  if (params.sortKey) qs.set("sort_key", params.sortKey);
  if (params.sortDir) qs.set("sort_dir", String(params.sortDir));
  if (params.offset) qs.set("offset", String(params.offset));
  if (params.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return api.get<ApiScreenerPage>(`/v1/screener${query ? `?${query}` : ""}`);
};
export const getScreener = () => getScreenerPage().then((page) => page.rows);
export const addScreenerAsset = (yahooSymbol: string) => api.post<ApiScreenerAsset>("/v1/screener", { yahoo_symbol: yahooSymbol });
export const getAssetDetail = (yahooSymbol: string) => api.get<ApiAssetDetail>(`/v1/assets/${yahooSymbol}`);
export const searchAssets = (q: string) => api.get<ApiAssetSearchResult[]>(`/v1/assets/search?q=${encodeURIComponent(q)}`);
export const getPriceOnDate = (yahooSymbol: string, isoDate: string) =>
  api.get<ApiPriceOnDate>(`/v1/assets/${encodeURIComponent(yahooSymbol)}/price-on-date?on=${isoDate}`);

// Comparador
export const getComparadorAssets = () => api.get<ApiComparadorAsset[]>("/v1/comparador/assets");

// Dividends
export const getDividendCalendar = (portfolioId: string, year: number) =>
  api.get<ApiDividendCalendar>(`/v1/dividends/calendar?portfolio_id=${portfolioId}&year=${year}`);

// Movements
export const getMovements = () => api.get<ApiMovement[]>("/v1/movements");

// Net worth
export const getNetWorthHistory = (currency: string, range: string) =>
  api.get<ApiNetWorthHistory>(`/v1/networth/history?currency=${currency}&range=${range}`);

// Alerts
export const listAlerts = () => api.get<ApiAlert[]>("/v1/alerts");
export const createAlert = (input: {
  yahoo_symbol: string;
  condition: AlertCondition;
  threshold?: number;
  params?: Record<string, number>;
}) => api.post<ApiAlert>("/v1/alerts", input);
export const deleteAlert = (id: string) => api.delete<void>(`/v1/alerts/${id}`);

// Export (backup)
export const getExportAll = () => api.get<ApiUserDataExport>("/v1/export/all");
