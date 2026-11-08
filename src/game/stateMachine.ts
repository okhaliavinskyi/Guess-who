/**
 * Game finite state machine (pure reducer).
 *
 *   HOME ──SELECT_POOL──> READY            (or UNAVAILABLE if the pool is empty)
 *   HOME ──OPEN_CUSTOM──> CUSTOM_INPUT ──SUBMIT_CUSTOM──> COUNTDOWN
 *   READY ──START──> COUNTDOWN ──COMPLETE──> REVEALED
 *   COUNTDOWN ──CANCEL / INTERRUPT──> READY  (nothing drawn from the bag)
 *   REVEALED ──TOGGLE_PHOTO──> REVEALED
 *   REVEALED ──NEXT──> COUNTDOWN (pool) | CUSTOM_INPUT (custom word)
 *   REVEALED/READY/... ──END / CHANGE_CATEGORY / BACK──> HOME
 *
 * Invariants:
 * - No character exists in state during COUNTDOWN: the draw happens on COMPLETE,
 *   so nothing can be rendered (or leaked into the DOM) before the reveal.
 * - Cancelling or backgrounding the countdown never consumes a bag entry.
 * - The revealed item is fixed for the REVEALED phase; rerenders and rotation
 *   cannot change it.
 * - Any event not valid for the current phase returns the identical state object.
 */
import type { PoolId } from '../content/categories.ts';
import { validateCustomWord } from './customWord.ts';
import { drawFromBag, EMPTY_BAG, type BagState, type Rng } from './shuffleBag.ts';

export type Selection = { kind: 'pool'; pool: PoolId } | { kind: 'custom'; word: string };

export type RevealedItem = { kind: 'character'; id: string } | { kind: 'custom'; word: string };

export type Screen =
  | { phase: 'HOME' }
  | { phase: 'CUSTOM_INPUT' }
  | { phase: 'UNAVAILABLE'; pool: PoolId }
  | { phase: 'READY'; selection: Selection; interrupted: boolean }
  | { phase: 'COUNTDOWN'; selection: Selection; round: number }
  | { phase: 'REVEALED'; selection: Selection; item: RevealedItem; showPhoto: boolean };

export type Phase = Screen['phase'];

export interface GameState {
  screen: Screen;
  /** Increments for every countdown so stale completions are ignored. */
  round: number;
  /** Per-pool shuffle bags, kept across category switches for the session. */
  bags: Partial<Record<PoolId, BagState>>;
}

export type GameEvent =
  | { type: 'SELECT_POOL'; pool: PoolId }
  | { type: 'OPEN_CUSTOM' }
  | { type: 'SUBMIT_CUSTOM'; word: string }
  | { type: 'START' }
  | { type: 'COMPLETE'; round: number }
  | { type: 'CANCEL' }
  | { type: 'INTERRUPT' }
  | { type: 'TOGGLE_PHOTO' }
  | { type: 'NEXT' }
  | { type: 'END' }
  | { type: 'CHANGE_CATEGORY' }
  | { type: 'BACK' };

export interface MachineDeps {
  /** Valid character ids for a pool (Mix = union of all categories). */
  getPool: (pool: PoolId) => readonly string[];
  rng?: Rng;
}

export function initialGameState(bags: GameState['bags'] = {}): GameState {
  return { screen: { phase: 'HOME' }, round: 0, bags };
}

const HOME: Screen = { phase: 'HOME' };

function startCountdown(state: GameState, selection: Selection): GameState {
  const round = state.round + 1;
  return { ...state, round, screen: { phase: 'COUNTDOWN', selection, round } };
}

export function createGameReducer({ getPool, rng = Math.random }: MachineDeps) {
  return function reduce(state: GameState, event: GameEvent): GameState {
    const { screen } = state;

    switch (event.type) {
      case 'SELECT_POOL':
        if (screen.phase !== 'HOME') return state;
        if (getPool(event.pool).length === 0)
          return { ...state, screen: { phase: 'UNAVAILABLE', pool: event.pool } };
        return {
          ...state,
          screen: {
            phase: 'READY',
            selection: { kind: 'pool', pool: event.pool },
            interrupted: false,
          },
        };

      case 'OPEN_CUSTOM':
        if (screen.phase !== 'HOME') return state;
        return { ...state, screen: { phase: 'CUSTOM_INPUT' } };

      case 'SUBMIT_CUSTOM': {
        if (screen.phase !== 'CUSTOM_INPUT') return state;
        const result = validateCustomWord(event.word);
        if (!result.ok) return state;
        return startCountdown(state, { kind: 'custom', word: result.value });
      }

      case 'START':
        if (screen.phase !== 'READY') return state;
        return startCountdown(state, screen.selection);

      case 'COMPLETE': {
        if (screen.phase !== 'COUNTDOWN' || event.round !== screen.round) return state;
        const { selection } = screen;
        if (selection.kind === 'custom') {
          return {
            ...state,
            screen: {
              phase: 'REVEALED',
              selection,
              item: { kind: 'custom', word: selection.word },
              showPhoto: false,
            },
          };
        }
        const pool = getPool(selection.pool);
        const { id, bag } = drawFromBag(state.bags[selection.pool] ?? EMPTY_BAG, pool, rng);
        if (id === null)
          return { ...state, screen: { phase: 'UNAVAILABLE', pool: selection.pool } };
        return {
          ...state,
          bags: { ...state.bags, [selection.pool]: bag },
          screen: {
            phase: 'REVEALED',
            selection,
            item: { kind: 'character', id },
            showPhoto: false,
          },
        };
      }

      case 'CANCEL':
      case 'INTERRUPT':
        if (screen.phase !== 'COUNTDOWN') return state;
        return {
          ...state,
          screen: {
            phase: 'READY',
            selection: screen.selection,
            interrupted: event.type === 'INTERRUPT',
          },
        };

      case 'TOGGLE_PHOTO':
        if (screen.phase !== 'REVEALED' || screen.item.kind !== 'character') return state;
        return { ...state, screen: { ...screen, showPhoto: !screen.showPhoto } };

      case 'NEXT':
        if (screen.phase !== 'REVEALED') return state;
        // A custom word has no bank: "Next" asks for a new word (old one is discarded).
        if (screen.selection.kind === 'custom')
          return { ...state, screen: { phase: 'CUSTOM_INPUT' } };
        return startCountdown(state, screen.selection);

      case 'END':
      case 'CHANGE_CATEGORY':
        if (screen.phase !== 'REVEALED' && screen.phase !== 'READY') return state;
        return { ...state, screen: HOME };

      case 'BACK':
        if (
          screen.phase !== 'CUSTOM_INPUT' &&
          screen.phase !== 'READY' &&
          screen.phase !== 'UNAVAILABLE'
        )
          return state;
        return { ...state, screen: HOME };

      default:
        return state;
    }
  };
}

/** True while the player is "in play" (wake lock should be held). */
export function isPlaying(phase: Phase): boolean {
  return phase === 'COUNTDOWN' || phase === 'REVEALED';
}
