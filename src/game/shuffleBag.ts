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
 *
 * `seen` is the session-wide "shadow ban": ids already revealed in this session
 * from any pool (e.g. a name shown in Music is not offered again in Mix). They are
 * skipped until every id of this pool has been seen; then the pool starts a fresh
 * cycle and `cycleReset` tells the caller to forget this pool's ids from `seen`.
 */
export function drawFromBag(
  bag: BagState,
  poolIds: readonly string[],
  rng: Rng = Math.random,
  seen: ReadonlySet<string> = new Set(),
): { id: string | null; bag: BagState; cycleReset: boolean } {
  const pool = [...new Set(poolIds)];
  if (pool.length === 0)
    return { id: null, bag: { remaining: [], lastId: bag.lastId }, cycleReset: false };

  const inPool = new Set(pool);
  let remaining = bag.remaining.filter((id) => inPool.has(id) && !seen.has(id));
  let cycleReset = false;

  if (remaining.length === 0) {
    let fresh = pool.filter((id) => !seen.has(id));
    if (fresh.length === 0) {
      // Everything in this pool was already shown this session: start over.
      fresh = pool;
      cycleReset = true;
    }
    remaining = shuffle(fresh, rng);
    if (remaining.length > 1 && remaining[0] === bag.lastId) {
      // Swap the repeat with a random later position so it is not shown back-to-back.
      const j = 1 + Math.floor(rng() * (remaining.length - 1));
      const first = remaining[0] as string;
      remaining[0] = remaining[j] as string;
      remaining[j] = first;
    }
  }

  const [id, ...rest] = remaining as [string, ...string[]];
  return { id, bag: { remaining: rest, lastId: id }, cycleReset };
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
