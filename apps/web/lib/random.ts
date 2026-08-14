/**
 * Deterministic LCG, ported from the design prototypes, so mock historical
 * series are reproducible across renders instead of reshuffling on refresh.
 */
export function lcg(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generateSeries(seed: number, drift: number, vol: number, length = 61): number[] {
  const rand = lcg(seed);
  let v = 100;
  const out = [100];
  for (let i = 1; i < length; i++) {
    v *= 1 + drift + (rand() - 0.5) * vol;
    out.push(v);
  }
  return out;
}
