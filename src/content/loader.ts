import { CATEGORY_IDS, isCategoryId, type CategoryId, type PoolId } from './categories.ts';
import { formatIssue, validateBank, type Character, type CharacterFileInput } from './schema.ts';

export interface CharacterBank {
  characters: readonly Character[];
  byId: ReadonlyMap<string, Character>;
  counts: Record<CategoryId, number>;
}

/** Builds a validated bank from raw file inputs. Invalid entries are dropped, never crash. */
export function createBank(files: CharacterFileInput[]): CharacterBank {
  const { valid, issues, counts } = validateBank(files, { allowEmptyCategories: true });
  if (issues.length > 0 && import.meta.env?.DEV) {
    console.error(`[content] ${issues.length} issue(s):\n${issues.map(formatIssue).join('\n')}`);
  }
  return { characters: valid, byId: new Map(valid.map((c) => [c.id, c])), counts };
}

/** Converts the result of `import.meta.glob` into validator inputs, keyed by file name. */
export function filesFromGlob(modules: Record<string, unknown>): CharacterFileInput[] {
  const files: CharacterFileInput[] = [];
  for (const [path, data] of Object.entries(modules)) {
    const name = path
      .split('/')
      .pop()
      ?.replace(/\.json$/, '');
    if (!isCategoryId(name)) continue;
    files.push({ file: `src/content/characters/${name}.json`, category: name, data });
  }
  return files.sort((a, b) => CATEGORY_IDS.indexOf(a.category) - CATEGORY_IDS.indexOf(b.category));
}

let defaultBank: CharacterBank | undefined;

/** The bundled bank from src/content/characters/*.json (statically imported at build time). */
export function getDefaultBank(): CharacterBank {
  if (!defaultBank) {
    const modules = import.meta.glob('./characters/*.json', { eager: true, import: 'default' });
    defaultBank = createBank(filesFromGlob(modules));
  }
  return defaultBank;
}

/**
 * Returns the ids available for a pool. Mix is the de-duplicated union of all six
 * categories, so it samples uniformly across characters (not across categories).
 */
export function buildPool(bank: CharacterBank, pool: PoolId): string[] {
  const ids = bank.characters.filter((c) => pool === 'mix' || c.category === pool).map((c) => c.id);
  return [...new Set(ids)];
}

/** Picks the name to show: a localized name for the user's language, else displayName. */
export function localizedName(character: Character, locales: readonly string[]): string {
  const names = character.localeNames;
  if (names) {
    for (const locale of locales) {
      const exact = names[locale];
      if (exact) return exact;
      const base = names[locale.split('-')[0] ?? ''];
      if (base) return base;
    }
  }
  return character.displayName;
}
