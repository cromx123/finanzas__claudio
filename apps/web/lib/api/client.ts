/**
 * Mock implementation of the future `/v1` REST client (see Architecture
 * Blueprint). Function signatures and return shapes mirror the real
 * endpoints on purpose, so swapping this file for a generated OpenAPI
 * client later doesn't require touching hooks or components.
 */
import { COMPARADOR_ASSETS } from "../mock/comparadorAssets";
import { ASIGNACIONES_INICIALES, GOAL_ASSETS, TAGS_INICIALES } from "../mock/goalsTags";
import { DIVIDEND_CALENDAR } from "../mock/portfolios";
import { SCREENER_UNIVERSE } from "../mock/screener";
import type { ComparadorAsset, GoalAsset, ScreenerAsset } from "../types";

// GET /dividends/calendar?portfolio=:id — still a fixed two-portfolio demo
// dataset, independent of the user's real portfolios (see Panel).
export async function getDividendCalendar(key: "chile" | "global") {
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
