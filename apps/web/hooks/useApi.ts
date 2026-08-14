"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getComparadorAssets,
  getDividendCalendar,
  getGoalAssets,
  getPerformanceInputs,
  getPortfolio,
  getScreenerUniverse,
  getTagAssignments,
  getTags,
} from "../lib/api/client";
import type { PortfolioKey } from "../lib/types";

const staticQuery = { staleTime: Infinity, gcTime: Infinity } as const;

export function usePortfolio(key: PortfolioKey) {
  return useQuery({ queryKey: ["portfolio", key], queryFn: () => getPortfolio(key), ...staticQuery });
}

export function usePerformanceInputs(key: PortfolioKey) {
  return useQuery({ queryKey: ["performance-inputs", key], queryFn: () => getPerformanceInputs(key), ...staticQuery });
}

export function useDividendCalendar(key: PortfolioKey) {
  return useQuery({ queryKey: ["dividend-calendar", key], queryFn: () => getDividendCalendar(key), ...staticQuery });
}

export function useScreenerUniverse() {
  return useQuery({ queryKey: ["screener-universe"], queryFn: getScreenerUniverse, ...staticQuery });
}

export function useComparadorAssets() {
  return useQuery({ queryKey: ["comparador-assets"], queryFn: getComparadorAssets, ...staticQuery });
}

export function useGoalAssets() {
  return useQuery({ queryKey: ["goal-assets"], queryFn: getGoalAssets, ...staticQuery });
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: getTags, ...staticQuery });
}

export function useTagAssignments() {
  return useQuery({ queryKey: ["tag-assignments"], queryFn: getTagAssignments, ...staticQuery });
}
