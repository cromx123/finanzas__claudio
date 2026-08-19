"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as client from "../lib/api/client";

const staticQuery = { staleTime: 60_000 } as const;

// Portfolios
export function usePortfolios() {
  return useQuery({ queryKey: ["portfolios"], queryFn: client.listPortfolios, ...staticQuery });
}

export function usePortfolioSummary(portfolioId: string | null) {
  return useQuery({
    queryKey: ["portfolio-summary", portfolioId],
    queryFn: () => client.getPortfolioSummary(portfolioId as string),
    enabled: !!portfolioId,
    staleTime: 30_000,
  });
}

export function usePortfolioPerformance(portfolioId: string | null, range: string) {
  return useQuery({
    queryKey: ["portfolio-performance", portfolioId, range],
    queryFn: () => client.getPortfolioPerformance(portfolioId as string, range),
    enabled: !!portfolioId,
    staleTime: 5 * 60_000,
  });
}

export function useCountryAllocation(currency: string) {
  return useQuery({
    queryKey: ["country-allocation", currency],
    queryFn: () => client.getCountryAllocation(currency),
    staleTime: 30_000,
  });
}

export function useCreatePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.createPortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}

export function useRenamePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => client.renamePortfolio(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}

export function useDeletePortfolio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.deletePortfolio,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portfolios"] }),
  });
}

// Transactions
export function useTransactions(portfolioId: string | null) {
  return useQuery({
    queryKey: ["transactions", portfolioId],
    queryFn: () => client.listTransactions(portfolioId as string),
    enabled: !!portfolioId,
  });
}

function useInvalidatePortfolio(portfolioId: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["portfolio-summary", portfolioId] });
    qc.invalidateQueries({ queryKey: ["transactions", portfolioId] });
    qc.invalidateQueries({ queryKey: ["portfolio-performance", portfolioId] });
    qc.invalidateQueries({ queryKey: ["lots", portfolioId] });
  };
}

export function useOpenLots(portfolioId: string | null, yahooSymbol: string | null) {
  return useQuery({
    queryKey: ["lots", portfolioId, yahooSymbol],
    queryFn: () => client.getOpenLots(portfolioId as string, yahooSymbol as string),
    enabled: !!portfolioId && !!yahooSymbol,
    staleTime: 10_000,
  });
}

export function useAddTransaction(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: (input: Parameters<typeof client.addTransaction>[1]) => client.addTransaction(portfolioId, input),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: ({ transactionId, input }: { transactionId: string; input: Parameters<typeof client.updateTransaction>[2] }) =>
      client.updateTransaction(portfolioId, transactionId, input),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: (transactionId: string) => client.deleteTransaction(portfolioId, transactionId),
    onSuccess: invalidate,
  });
}

export function useDeletePosition(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: (assetId: string) => client.deletePosition(portfolioId, assetId),
    onSuccess: invalidate,
  });
}

export function useSetHoldingTags(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: ({ assetId, tags }: { assetId: string; tags: string[] }) =>
      client.setHoldingTags(portfolioId, assetId, tags),
    onSuccess: invalidate,
  });
}

// FX rates
export function useFxRates() {
  return useQuery({ queryKey: ["fx-rates"], queryFn: client.getFxRates, ...staticQuery });
}

export function useFxRateDetails() {
  return useQuery({ queryKey: ["fx-rate-details"], queryFn: client.getFxRateDetails, ...staticQuery });
}

function useInvalidateFxRates() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["fx-rates"] });
    qc.invalidateQueries({ queryKey: ["fx-rate-details"] });
    qc.invalidateQueries({ queryKey: ["goals-progress"] });
    qc.invalidateQueries({ queryKey: ["country-allocation"] });
  };
}

export function useSetFxRate() {
  const invalidate = useInvalidateFxRates();
  return useMutation({
    mutationFn: ({ currency, rate }: { currency: string; rate: number }) => client.setFxRate(currency, rate),
    onSuccess: invalidate,
  });
}

export function useRefreshFxRates() {
  const invalidate = useInvalidateFxRates();
  return useMutation({
    mutationFn: client.refreshFxRates,
    onSuccess: invalidate,
  });
}

// Tags
export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: client.listTags, ...staticQuery });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.createTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

// Goals
export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: client.listGoals, ...staticQuery });
}

export function useUpsertGoals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.upsertGoals,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["goals"] });
      qc.invalidateQueries({ queryKey: ["goals-progress"] });
    },
  });
}

export function useGoalsProgress(currency: string) {
  return useQuery({
    queryKey: ["goals-progress", currency],
    queryFn: () => client.getGoalsProgress(currency),
    staleTime: 30_000,
  });
}

// Screener
export function useScreener() {
  return useQuery({ queryKey: ["screener"], queryFn: client.getScreener, staleTime: 5 * 60_000 });
}

export function useAddScreenerAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.addScreenerAsset,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["screener"] }),
  });
}

export function useAssetDetail(yahooSymbol: string | null) {
  return useQuery({
    queryKey: ["asset-detail", yahooSymbol],
    queryFn: () => client.getAssetDetail(yahooSymbol as string),
    enabled: !!yahooSymbol,
    staleTime: 5 * 60_000,
  });
}

export function useAssetPriceOnDate(yahooSymbol: string | null, isoDate: string | null) {
  return useQuery({
    queryKey: ["asset-price-on-date", yahooSymbol, isoDate],
    queryFn: () => client.getPriceOnDate(yahooSymbol as string, isoDate as string),
    enabled: !!yahooSymbol && !!isoDate,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useAssetSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ["asset-search", q.toUpperCase()],
    queryFn: () => client.searchAssets(q),
    enabled: q.length >= 1,
    staleTime: 60_000,
  });
}

// Comparador
export function useComparadorAssets() {
  return useQuery({ queryKey: ["comparador-assets"], queryFn: client.getComparadorAssets, staleTime: 5 * 60_000 });
}

// Dividends
export function useDividendCalendar(portfolioId: string | null, year: number) {
  return useQuery({
    queryKey: ["dividend-calendar", portfolioId, year],
    queryFn: () => client.getDividendCalendar(portfolioId as string, year),
    enabled: !!portfolioId,
    staleTime: 30_000,
  });
}

// Movements
export function useMovements() {
  return useQuery({ queryKey: ["movements"], queryFn: client.getMovements, staleTime: 30_000 });
}

// Net worth
export function useNetWorthHistory(currency: string, range: string) {
  return useQuery({
    queryKey: ["networth-history", currency, range],
    queryFn: () => client.getNetWorthHistory(currency, range),
    staleTime: 5 * 60_000,
  });
}

// Alerts
export function useAlerts() {
  return useQuery({ queryKey: ["alerts"], queryFn: client.listAlerts, staleTime: 30_000 });
}

export function useCreateAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.createAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}

export function useDeleteAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: client.deleteAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
