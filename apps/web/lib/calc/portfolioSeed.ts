/**
 * Deterministic small-int seed derived from a portfolio id, so each
 * user-created portfolio gets a stable (but distinct-looking) mock
 * historical series without needing server-issued seed data.
 */
export function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return (hash % 23) + 3;
}
