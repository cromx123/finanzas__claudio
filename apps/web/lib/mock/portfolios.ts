// Illustrative-only: the Panel's "evolución histórica" chart doesn't have a
// real value-history endpoint yet, so it's seeded from this benchmark
// series + a per-portfolio deterministic seed (see lib/calc/portfolioSeed.ts).
export const SP500_SERIE = { seed: 3, drift: 0.0105, vol: 0.045 };
