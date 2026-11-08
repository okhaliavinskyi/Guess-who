import { describe, expect, it } from 'vitest';
import { buildPool, createBank, getDefaultBank, localizedName } from '../src/content/loader.ts';
import { CATEGORY_IDS } from '../src/content/categories.ts';
import { BANK_STATUS } from '../src/content/bankStatus.ts';
import { char } from './helpers.ts';

describe('bundled bank', () => {
  it('loads every category (demo: 3-5 fixtures, production: 100+) with no invalid entries', () => {
    const bank = getDefaultBank();
    for (const c of CATEGORY_IDS) {
      if (BANK_STATUS === 'demo') {
        expect(bank.counts[c]).toBeGreaterThanOrEqual(3);
        expect(bank.counts[c]).toBeLessThanOrEqual(5);
      } else expect(bank.counts[c]).toBeGreaterThanOrEqual(100);
    }
    expect(buildPool(bank, 'mix')).toHaveLength(bank.characters.length);
  });
});

describe('createBank / buildPool', () => {
  const bank = createBank([
    { file: 'music.json', category: 'music', data: [char('a', 'music'), char('b', 'music')] },
    {
      file: 'sports.json',
      category: 'sports',
      data: [char('a', 'sports'), char('c', 'sports'), { bad: 1 }],
    },
    { file: 'history.json', category: 'history', data: [] },
  ]);

  it('drops invalid and duplicate entries instead of crashing', () => {
    expect(bank.characters.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('builds per-category pools, empty pools and a de-duplicated mix', () => {
    expect(buildPool(bank, 'music')).toEqual(['a', 'b']);
    expect(buildPool(bank, 'sports')).toEqual(['c']);
    expect(buildPool(bank, 'history')).toEqual([]);
    expect(buildPool(bank, 'mix')).toEqual(['a', 'b', 'c']);
  });
});

describe('localizedName', () => {
  const c = char('x', 'music', {
    displayName: 'Default',
    localeNames: { uk: 'Укр', 'pt-BR': 'BR' },
  });
  it('prefers exact, then base language, then displayName', () => {
    expect(localizedName(c, ['pt-BR'])).toBe('BR');
    expect(localizedName(c, ['uk-UA'])).toBe('Укр');
    expect(localizedName(c, ['fr', 'en'])).toBe('Default');
  });
});
