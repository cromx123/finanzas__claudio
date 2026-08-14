/**
 * Mock implementation of the future `/v1` REST client (see Architecture
 * Blueprint). Function signatures and return shapes mirror the real
 * endpoints on purpose, so swapping this file for a generated OpenAPI
 * client later doesn't require touching hooks or components.
 */
import { COMPARADOR_ASSETS } from "../mock/comparadorAssets";
import { ASIGNACIONES_INICIALES, GOAL_ASSETS, TAGS_INICIALES } from "../mock/goalsTags";
import { DIVIDEND_CALENDAR, PORTFOLIOS, SP500_SERIE } from "../mock/portfolios";
import { SCREENER_UNIVERSE } from "../mock/screener";
import type { ComparadorAsset, GoalAsset, Portfolio, PortfolioKey, ScreenerAsset } from "../types";

// GET /portfolios/:id/summary (+ holdings, inlined — the mock ledger keeps them together)
export async function getPortfolio(key: PortfolioKey): Promise<Portfolio> {
  return PORTFOLIOS[key];
}

// GET /portfolios/:id/performance?benchmark=^GSPC — raw generator params; rebasing happens on read.
export async function getPerformanceInputs(key: PortfolioKey) {
  const p = PORTFOLIOS[key];
  return { seed: p.seedSerie, drift: p.driftSerie, vol: p.volSerie, benchmark: SP500_SERIE };
}

// GET /dividends/calendar?portfolio=:id
export async function getDividendCalendar(key: PortfolioKey) {
  return DIVIDEND_CALENDAR[key];
}

// GET /screener
export async function getScreenerUniverse(): Promise<ScreenerAsset[]> {
  return SCREENER_UNIVERSE;
}

// GET /projections/compare — asset reference data (the simulation itself runs on read, params are live UI state)
export async function getComparadorAssets(): Promise<Record<string, ComparadorAsset>> {
  return COMPARADOR_ASSETS;
}

// GET /goals/progress — underlying asset valuations feeding goals + tag breakdowns
export async function getGoalAssets(): Promise<GoalAsset[]> {
  return GOAL_ASSETS;
}

// GET /tags
export async function getTags(): Promise<string[]> {
  return TAGS_INICIALES;
}

// GET /me/tag-assignments (placeholder until goals/tags module exists)
export async function getTagAssignments(): Promise<Record<string, string[]>> {
  return ASIGNACIONES_INICIALES;
}
