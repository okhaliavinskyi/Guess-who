import { describe, expect, it } from 'vitest';
import { drawFromBag, EMPTY_BAG, shuffle, type BagState } from '../src/game/shuffleBag.ts';
import { seededRng } from './helpers.ts';

function drawMany(pool: string[], n: number, seed = 1, start: BagState = EMPTY_BAG) {
  const rng = seededRng(seed);
  let bag = start;
  const ids: (string | null)[] = [];
  for (let i = 0; i < n; i += 1) {
    const r = drawFromBag(bag, pool, rng);
    ids.push(r.id);
    bag = r.bag;
  }
  return { ids, bag };
}

describe('shuffle', () => {
  it('returns a permutation without mutating input', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const out = shuffle(input, seededRng(3));
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('produces every permutation of 3 items with roughly uniform frequency', () => {
    const rng = seededRng(42);
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i += 1) {
      const key = shuffle(['a', 'b', 'c'], rng).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const v of counts.values()) expect(v).toBeGreaterThan(800);
  });
});

describe('drawFromBag', () => {
  it('returns null for an empty pool', () => {
    expect(drawFromBag(EMPTY_BAG, []).id).toBeNull();
  });

  it('repeats the only item of a one-item pool', () => {
    expect(drawMany(['solo'], 3).ids).toEqual(['solo', 'solo', 'solo']);
  });

  it('shows every id once before any repeat', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    for (let seed = 1; seed < 50; seed += 1) {
      const { ids } = drawMany(pool, 10, seed);
      expect(new Set(ids.slice(0, 5)).size).toBe(5);
      expect(new Set(ids.slice(5, 10)).size).toBe(5);
    }
  });

  it('never repeats back-to-back across a reshuffle boundary', () => {
    for (const pool of [
      ['a', 'b'],
      ['a', 'b', 'c'],
      ['a', 'b', 'c', 'd', 'e', 'f'],
    ]) {
      for (let seed = 1; seed < 200; seed += 1) {
        const { ids } = drawMany(pool, pool.length * 4, seed);
        for (let i = 1; i < ids.length; i += 1) expect(ids[i]).not.toBe(ids[i - 1]);
      }
    }
  });

  it('skips ids that disappeared from the pool and does not mutate the bag', () => {
    const bag: BagState = { remaining: ['gone', 'b'], lastId: 'a' };
    const r = drawFromBag(bag, ['a', 'b']);
    expect(r.id).toBe('b');
    expect(bag.remaining).toEqual(['gone', 'b']);
  });

  it('de-duplicates pool ids', () => {
    const { ids } = drawMany(['a', 'a', 'b'], 2);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('drawFromBag with a session seen-set', () => {
  it('skips seen ids, including ones already queued in the bag', () => {
    const bag = { remaining: ['a', 'b', 'c'], lastId: null };
    const r = drawFromBag(bag, ['a', 'b', 'c'], seededRng(1), new Set(['a']));
    expect(r.id).toBe('b');
    expect(r.cycleReset).toBe(false);
  });

  it('builds a new cycle only from unseen ids', () => {
    for (let seed = 1; seed < 30; seed += 1) {
      const r = drawFromBag(EMPTY_BAG, ['a', 'b', 'c', 'd'], seededRng(seed), new Set(['a', 'c']));
      expect(['b', 'd']).toContain(r.id);
      expect(r.bag.remaining.every((id) => id === 'b' || id === 'd')).toBe(true);
    }
  });

  it('resets when every id of the pool was seen', () => {
    const r = drawFromBag(EMPTY_BAG, ['a', 'b'], seededRng(2), new Set(['a', 'b']));
    expect(['a', 'b']).toContain(r.id);
    expect(r.cycleReset).toBe(true);
  });
});
