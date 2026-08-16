"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getComparadorAssets,
  getDividendCalendar,
  getGoalAssets,
  getScreenerUniverse,
  getTagAssignments,
  getTags,
} from "../lib/api/client";

const staticQuery = { staleTime: Infinity, gcTime: Infinity } as const;

export function useDividendCalendar(key: "chile" | "global") {
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
