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
  };
}

export function useAddTransaction(portfolioId: string) {
  const invalidate = useInvalidatePortfolio(portfolioId);
  return useMutation({
    mutationFn: (input: Parameters<typeof client.addTransaction>[1]) => client.addTransaction(portfolioId, input),
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

export function useAssetDetail(yahooSymbol: string | null) {
  return useQuery({
    queryKey: ["asset-detail", yahooSymbol],
    queryFn: () => client.getAssetDetail(yahooSymbol as string),
    enabled: !!yahooSymbol,
    staleTime: 5 * 60_000,
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
