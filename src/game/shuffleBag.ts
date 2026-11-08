/**
 * Shuffle bag: every id in a pool is shown once (in random order) before any
 * repeats. On reshuffle, the previous id is never drawn first when avoidable.
 * Pure functions — the random source is injected so tests are deterministic.
 */
export type Rng = () => number;

export interface BagState {
  /** Ids not yet drawn in the current cycle, in draw order. */
  remaining: string[];
  /** Last id drawn from this bag (persists across reshuffles). */
  lastId: string | null;
}

export const EMPTY_BAG: BagState = { remaining: [], lastId: null };

/** Fisher–Yates shuffle returning a new array. Math.random is adequate for a casual game. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Draws the next id. `poolIds` is the current valid pool; ids that disappeared
 * from it (content refresh) are skipped. Returns null only for an empty pool.
 */
export function drawFromBag(
  bag: BagState,
  poolIds: readonly string[],
  rng: Rng = Math.random,
): { id: string | null; bag: BagState } {
  const pool = [...new Set(poolIds)];
  if (pool.length === 0) return { id: null, bag: { remaining: [], lastId: bag.lastId } };

  const inPool = new Set(pool);
  let remaining = bag.remaining.filter((id) => inPool.has(id));

  if (remaining.length === 0) {
    remaining = shuffle(pool, rng);
    if (remaining.length > 1 && remaining[0] === bag.lastId) {
      // Swap the repeat with a random later position so it is not shown back-to-back.
      const j = 1 + Math.floor(rng() * (remaining.length - 1));
      const first = remaining[0] as string;
      remaining[0] = remaining[j] as string;
      remaining[j] = first;
    }
  }

  const [id, ...rest] = remaining as [string, ...string[]];
  return { id, bag: { remaining: rest, lastId: id } };
}

export function isBagState(value: unknown): value is BagState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.remaining) &&
    v.remaining.every((x) => typeof x === 'string') &&
    (v.lastId === null || typeof v.lastId === 'string')
  );
}
