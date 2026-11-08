/**
 * Category configuration. Categories are fixed for the MVP but driven by this
 * single table so labels, order, colours and future additions live in one place.
 */
export const CATEGORY_IDS = [
  'movies-tv',
  'music',
  'fictional',
  'politics',
  'history',
  'sports',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** A pool the shuffle bag can draw from: one category, or the union of all ("mix"). */
export type PoolId = CategoryId | 'mix';

export interface CategoryConfig {
  id: PoolId;
  label: string;
  emoji: string;
  blurb: string;
  /** Card background. Text on top is always near-black (#111), contrast >= 7:1. */
  color: string;
}

export const CATEGORIES: readonly CategoryConfig[] = [
  {
    id: 'movies-tv',
    label: 'Movies & TV',
    emoji: '🎬',
    blurb: 'Actors and screen stars',
    color: '#FFD23F',
  },
  { id: 'music', label: 'Music', emoji: '🎤', blurb: 'Singers and music icons', color: '#7CC6FE' },
  {
    id: 'fictional',
    label: 'Fictional Characters',
    emoji: '🦸',
    blurb: 'Cartoons, books, games',
    color: '#C4B5FD',
  },
  { id: 'politics', label: 'Politics', emoji: '🏛️', blurb: 'World leaders', color: '#FDBA74' },
  {
    id: 'history',
    label: 'History',
    emoji: '📜',
    blurb: 'Thinkers, artists, pioneers',
    color: '#5EEAD4',
  },
  { id: 'sports', label: 'Sports', emoji: '🏅', blurb: 'Legendary athletes', color: '#A3E635' },
] as const;

export const MIX_CATEGORY: CategoryConfig = {
  id: 'mix',
  label: 'Mix',
  emoji: '🎲',
  blurb: 'Anything from all six',
  color: '#F9A8D4',
};

export const CUSTOM_COLOR = '#FFFFFF';

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && (CATEGORY_IDS as readonly string[]).includes(value);
}

export function getPoolConfig(id: PoolId): CategoryConfig {
  if (id === 'mix') return MIX_CATEGORY;
  const found = CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown category: ${id}`);
  return found;
}
