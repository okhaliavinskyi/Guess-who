/**
 * Optional sessionStorage persistence of shuffle bags so an accidental reload in the
 * same tab does not immediately repeat names (bags + the session shadow-ban list).
 * Only bank ids are stored — never
 * custom words. All access is guarded: storage may be unavailable (private mode).
 */
import { CATEGORY_IDS, type PoolId } from '../content/categories.ts';
import { isBagState, type BagState } from './shuffleBag.ts';

const KEY = 'guess-who:bags:v1';
const SEEN_KEY = 'guess-who:seen:v1';
const POOLS: readonly PoolId[] = [...CATEGORY_IDS, 'mix'];

export function loadBags(storage: Storage | undefined = safeSessionStorage()) {
  const bags: Partial<Record<PoolId, BagState>> = {};
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return bags;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return bags;
    for (const pool of POOLS) {
      const value = (parsed as Record<string, unknown>)[pool];
      if (isBagState(value)) bags[pool] = value;
    }
  } catch {
    /* ignore corrupt or inaccessible storage */
  }
  return bags;
}

export function saveBags(
  bags: Partial<Record<PoolId, BagState>>,
  storage: Storage | undefined = safeSessionStorage(),
) {
  try {
    storage?.setItem(KEY, JSON.stringify(bags));
  } catch {
    /* quota or privacy mode — persistence is optional */
  }
}

function safeSessionStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Ids already revealed in this session (the shadow-ban list). */
export function loadSeen(storage: Storage | undefined = safeSessionStorage()): string[] {
  try {
    const raw = storage?.getItem(SEEN_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSeen(
  seen: readonly string[],
  storage: Storage | undefined = safeSessionStorage(),
) {
  try {
    storage?.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* persistence is optional */
  }
}
