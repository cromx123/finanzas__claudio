import { api } from "./http";
import type {
  ApiAssetDetail,
  ApiComparadorAsset,
  ApiCountryAllocation,
  ApiDividendCalendar,
  ApiFxRateDetail,
  ApiGoal,
  ApiGoalsProgress,
  ApiMovement,
  ApiPortfolio,
  ApiPortfolioSummary,
  ApiScreenerAsset,
  ApiTransaction,
} from "./types";

// Portfolios
export const listPortfolios = () => api.get<ApiPortfolio[]>("/v1/portfolios");
export const createPortfolio = (input: { name: string; currency: string }) =>
  api.post<ApiPortfolio>("/v1/portfolios", input);
export const renamePortfolio = (id: string, name: string) => api.patch<ApiPortfolio>(`/v1/portfolios/${id}`, { name });
export const deletePortfolio = (id: string) => api.delete<void>(`/v1/portfolios/${id}`);
export const getPortfolioSummary = (id: string) => api.get<ApiPortfolioSummary>(`/v1/portfolios/${id}/summary`);
export const getCountryAllocation = (currency: string) =>
  api.get<ApiCountryAllocation>(`/v1/portfolios/allocation/country?currency=${currency}`);

// Transactions
export const listTransactions = (portfolioId: string) =>
  api.get<ApiTransaction[]>(`/v1/portfolios/${portfolioId}/transactions`);
export const addTransaction = (
  portfolioId: string,
  input: { yahoo_symbol: string; type: "buy" | "sell"; trade_date: string; quantity: number; price: number }
) => api.post<ApiTransaction>(`/v1/portfolios/${portfolioId}/transactions`, input);
export const deleteTransaction = (portfolioId: string, transactionId: string) =>
  api.delete<void>(`/v1/portfolios/${portfolioId}/transactions/${transactionId}`);

// Holdings (tags + delete position)
export const deletePosition = (portfolioId: string, assetId: string) =>
  api.delete<void>(`/v1/portfolios/${portfolioId}/holdings/${assetId}`);
export const setHoldingTags = (portfolioId: string, assetId: string, tags: string[]) =>
  api.put<string[]>(`/v1/portfolios/${portfolioId}/holdings/${assetId}/tags`, { tags });

// FX rates
export const getFxRates = () => api.get<Record<string, number>>("/v1/fx-rates");

// Tags
export const listTags = () => api.get<string[]>("/v1/tags");
export const createTag = (label: string) => api.post<string[]>("/v1/tags", { label });

// Goals
export const listGoals = () => api.get<ApiGoal[]>("/v1/goals");
export const upsertGoals = (
  goals: { kind: string; target_amount: number; currency: string; monthly_expenses?: number | null }[]
) => api.put<ApiGoal[]>("/v1/goals", goals);
export const getGoalsProgress = (currency: string) => api.get<ApiGoalsProgress>(`/v1/goals/progress?currency=${currency}`);

// Screener
export const getScreener = () => api.get<ApiScreenerAsset[]>("/v1/screener");
export const getAssetDetail = (yahooSymbol: string) => api.get<ApiAssetDetail>(`/v1/assets/${yahooSymbol}`);

// Comparador
export const getComparadorAssets = () => api.get<ApiComparadorAsset[]>("/v1/comparador/assets");

// Dividends
export const getDividendCalendar = (portfolioId: string, year: number) =>
  api.get<ApiDividendCalendar>(`/v1/dividends/calendar?portfolio_id=${portfolioId}&year=${year}`);

// Movements
export const getMovements = () => api.get<ApiMovement[]>("/v1/movements");
