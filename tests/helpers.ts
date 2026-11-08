import type { Rng } from '../src/game/shuffleBag.ts';
import type { Character } from '../src/content/schema.ts';
import type { CategoryId } from '../src/content/categories.ts';

/** Deterministic PRNG (mulberry32) for reproducible shuffles. */
export function seededRng(seed = 1): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function char(id: string, category: CategoryId, extra: Partial<Character> = {}): Character {
  return { id, category, displayName: id.replace(/-/g, ' '), popularityTier: 'iconic', ...extra };
}
