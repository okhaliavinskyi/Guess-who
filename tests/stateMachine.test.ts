import { describe, expect, it } from 'vitest';
import type { PoolId } from '../src/content/categories.ts';
import {
  createGameReducer,
  initialGameState,
  type GameEvent,
  type GameState,
} from '../src/game/stateMachine.ts';
import { seededRng } from './helpers.ts';

const pools: Partial<Record<PoolId, string[]>> = {
  music: ['m1', 'm2', 'm3'],
  sports: ['s1'],
  mix: ['m1', 'm2', 'm3', 's1'],
};
const reduce = createGameReducer({ getPool: (p) => pools[p] ?? [], rng: seededRng(7) });
const run = (events: GameEvent[], from: GameState = initialGameState()) =>
  events.reduce(reduce, from);

function completeCurrent(state: GameState) {
  if (state.screen.phase !== 'COUNTDOWN') throw new Error('not counting down');
  return reduce(state, { type: 'COMPLETE', round: state.screen.round });
}

describe('game state machine', () => {
  it('HOME → READY → COUNTDOWN → REVEALED', () => {
    let s = run([{ type: 'SELECT_POOL', pool: 'music' }]);
    expect(s.screen).toMatchObject({ phase: 'READY', selection: { kind: 'pool', pool: 'music' } });
    s = reduce(s, { type: 'START' });
    expect(s.screen.phase).toBe('COUNTDOWN');
    expect(JSON.stringify(s.screen)).not.toMatch(/m[123]/); // nothing chosen yet
    s = completeCurrent(s);
    expect(s.screen).toMatchObject({ phase: 'REVEALED', item: { kind: 'character' } });
  });

  it('empty pools go to UNAVAILABLE', () => {
    const s = run([{ type: 'SELECT_POOL', pool: 'history' }]);
    expect(s.screen).toEqual({ phase: 'UNAVAILABLE', pool: 'history' });
    expect(reduce(s, { type: 'BACK' }).screen.phase).toBe('HOME');
  });

  it('ignores invalid transitions by returning the same object', () => {
    const home = initialGameState();
    for (const e of [
      { type: 'START' },
      { type: 'NEXT' },
      { type: 'COMPLETE', round: 0 },
      { type: 'TOGGLE_PHOTO' },
      { type: 'CANCEL' },
      { type: 'END' },
    ] as GameEvent[]) {
      expect(reduce(home, e)).toBe(home);
    }
  });

  it('cancel and interrupt return to READY without consuming the bag', () => {
    const ready = run([{ type: 'SELECT_POOL', pool: 'music' }]);
    const counting = reduce(ready, { type: 'START' });
    const cancelled = reduce(counting, { type: 'CANCEL' });
    expect(cancelled.screen).toMatchObject({ phase: 'READY', interrupted: false });
    expect(cancelled.bags).toBe(ready.bags);
    const interrupted = reduce(reduce(cancelled, { type: 'START' }), { type: 'INTERRUPT' });
    expect(interrupted.screen).toMatchObject({ phase: 'READY', interrupted: true });
    expect(interrupted.bags.music).toBeUndefined();
  });

  it('ignores stale or duplicate COMPLETE events (double tap safety)', () => {
    let s = run([{ type: 'SELECT_POOL', pool: 'music' }, { type: 'START' }]);
    const staleRound = s.round;
    s = reduce(s, { type: 'CANCEL' });
    s = reduce(s, { type: 'START' });
    expect(reduce(s, { type: 'COMPLETE', round: staleRound })).toBe(s);
    const revealed = completeCurrent(s);
    expect(reduce(revealed, { type: 'COMPLETE', round: s.round })).toBe(revealed);
  });

  it('double NEXT yields exactly one new countdown', () => {
    let s = completeCurrent(run([{ type: 'SELECT_POOL', pool: 'music' }, { type: 'START' }]));
    s = reduce(s, { type: 'NEXT' });
    const once = s;
    s = reduce(s, { type: 'NEXT' });
    expect(s).toBe(once);
    expect(s.screen.phase).toBe('COUNTDOWN');
  });

  it('draws distinct characters until the pool is exhausted', () => {
    let s = run([{ type: 'SELECT_POOL', pool: 'music' }, { type: 'START' }]);
    const seen: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      s = completeCurrent(s);
      if (s.screen.phase !== 'REVEALED' || s.screen.item.kind !== 'character') throw new Error();
      seen.push(s.screen.item.id);
      s = reduce(s, { type: 'NEXT' });
    }
    expect(new Set(seen).size).toBe(3);
  });

  it('mix draws from every category without duplicates before exhaustion', () => {
    let s = run([{ type: 'SELECT_POOL', pool: 'mix' }, { type: 'START' }]);
    const seen: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      s = completeCurrent(s);
      if (s.screen.phase !== 'REVEALED' || s.screen.item.kind !== 'character') throw new Error();
      seen.push(s.screen.item.id);
      s = reduce(s, { type: 'NEXT' });
    }
    expect([...seen].sort()).toEqual(['m1', 'm2', 'm3', 's1']);
  });

  it('a single-item category repeats', () => {
    let s = run([{ type: 'SELECT_POOL', pool: 'sports' }, { type: 'START' }]);
    s = completeCurrent(s);
    s = completeCurrent(reduce(s, { type: 'NEXT' }));
    expect(s.screen).toMatchObject({ item: { id: 's1' } });
  });

  it('custom word: validated, trimmed, revealed, and Next asks for a new word', () => {
    let s = run([{ type: 'OPEN_CUSTOM' }]);
    expect(reduce(s, { type: 'SUBMIT_CUSTOM', word: '   ' })).toBe(s);
    s = reduce(s, { type: 'SUBMIT_CUSTOM', word: '  Капитан Немо ' });
    expect(s.screen.phase).toBe('COUNTDOWN');
    s = completeCurrent(s);
    expect(s.screen).toMatchObject({
      phase: 'REVEALED',
      item: { kind: 'custom', word: 'Капитан Немо' },
    });
    expect(reduce(s, { type: 'TOGGLE_PHOTO' })).toBe(s);
    expect(reduce(s, { type: 'NEXT' }).screen).toEqual({ phase: 'CUSTOM_INPUT' });
    expect(Object.keys(s.bags)).toEqual([]); // custom words never enter bags
  });

  it('photo toggle, END and CHANGE_CATEGORY', () => {
    const r = completeCurrent(run([{ type: 'SELECT_POOL', pool: 'music' }, { type: 'START' }]));
    expect(reduce(r, { type: 'TOGGLE_PHOTO' }).screen).toMatchObject({ showPhoto: true });
    expect(reduce(r, { type: 'END' }).screen.phase).toBe('HOME');
    const back = reduce(r, { type: 'CHANGE_CATEGORY' });
    expect(back.screen.phase).toBe('HOME');
    expect(back.bags.music).toBeDefined(); // bag state kept for the session
  });
});

describe('session shadow ban', () => {
  const revealedId = (s: GameState) =>
    s.screen.phase === 'REVEALED' && s.screen.item.kind === 'character' ? s.screen.item.id : null;

  function play(pool: PoolId, rounds: number, from: GameState = initialGameState()) {
    let s = run([{ type: 'SELECT_POOL', pool }, { type: 'START' }], from);
    const ids: string[] = [];
    for (let i = 0; i < rounds; i += 1) {
      if (i > 0) s = reduce(s, { type: 'NEXT' });
      s = completeCurrent(s);
      ids.push(revealedId(s)!);
    }
    return { s: reduce(s, { type: 'END' }), ids };
  }

  it('records every revealed id', () => {
    const { s, ids } = play('music', 2);
    expect(s.seen).toEqual(ids);
  });

  it('names already shown in a category are not offered again in Mix', () => {
    const music = play('music', 3); // all of music seen
    const mix = play('mix', 1, music.s);
    expect(mix.ids).toEqual(['s1']);
  });

  it('starts a new cycle for a pool once everything in it was seen', () => {
    const first = play('music', 3);
    expect(new Set(first.ids).size).toBe(3);
    const second = play('music', 1, first.s);
    expect(pools.music).toContain(second.ids[0]);
    // Only this pool's ids are forgotten; the new draw is recorded.
    expect(second.s.seen).toEqual([second.ids[0]]);
  });

  it('a restored seen list (page reload) is respected', () => {
    const { ids } = play('music', 2, initialGameState({}, ['m1', 'm2']));
    expect(ids[0]).toBe('m3');
  });
});
