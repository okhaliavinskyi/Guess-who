/**
 * Quality checks over the real character bank (src/content/characters/*.json):
 * volume, uniqueness, naming hygiene, sync with the curated lists in
 * content-source/, and licensing metadata of every photo.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANK_STATUS } from '../src/content/bankStatus.ts';
import { CATEGORY_IDS, type CategoryId } from '../src/content/categories.ts';
import { hasUsableImage } from '../src/content/image.ts';
import { FAIR_USE, isAllowedLicense } from '../src/content/license.ts';
import { normalizeName, validateBank, type Character } from '../src/content/schema.ts';

const files = CATEGORY_IDS.map((category) => ({
  file: `src/content/characters/${category}.json`,
  category,
  data: JSON.parse(readFileSync(`src/content/characters/${category}.json`, 'utf8')) as Character[],
}));
const all = files.flatMap((f) => f.data);
const production = BANK_STATUS === 'production';

describe('character bank', () => {
  it('passes the schema validator with zero issues', () => {
    const { issues } = validateBank(files);
    expect(issues).toEqual([]);
  });

  // Quality over quantity: only names ordinary people know in any country.
  it.runIf(production)('has at least 100 names in every category and 900 overall', () => {
    for (const f of files) expect(f.data.length, f.category).toBeGreaterThanOrEqual(100);
    expect(all.length).toBeGreaterThanOrEqual(900);
  });

  it('has globally unique ids and display names', () => {
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(new Set(all.map((c) => normalizeName(c.displayName))).size).toBe(all.length);
  });

  it('has unique, clean Russian and Ukrainian names', () => {
    for (const lang of ['ru', 'uk']) {
      const seen = new Map<string, string>();
      for (const c of all) {
        const name = c.localeNames?.[lang];
        if (!name) continue;
        expect(name, `${c.id} ${lang}`).not.toMatch(/[,()«»]|^Список|^Серия|\s{2}/);
        const key = normalizeName(name);
        expect(seen.get(key), `${lang} "${name}" used by ${c.id} and ${seen.get(key)}`).toBe(
          undefined,
        );
        seen.set(key, c.id);
      }
    }
  });

  it.runIf(production)('translates every name into ru and uk (bands may stay in Latin)', () => {
    for (const c of all) {
      for (const lang of ['ru', 'uk']) {
        if (c.localeNames?.[lang]) continue;
        // Only music acts written in Latin in ru/uk too (Queen, ABBA, 50 Cent) may skip.
        expect(c.category, `${c.id} has no ${lang} name`).toBe('music');
      }
    }
  });

  it.runIf(production)('has Russian and Ukrainian names for most entries', () => {
    for (const lang of ['ru', 'uk']) {
      const share = all.filter((c) => c.localeNames?.[lang]).length / all.length;
      expect(share, lang).toBeGreaterThan(0.85);
    }
  });

  it('has clean display names (no list syntax, brackets or double spaces)', () => {
    for (const c of all) {
      expect(c.displayName, c.id).not.toMatch(/[@*()[\]{}|]|\s{2}|^\s|\s$/);
      expect(c.displayName.length, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it.runIf(production)('marks a sensible share of each category as iconic', () => {
    for (const f of files) {
      const share = f.data.filter((c) => c.popularityTier === 'iconic').length / f.data.length;
      expect(share, f.category).toBeGreaterThan(0.1);
      expect(share, f.category).toBeLessThan(0.85);
    }
  });

  it.runIf(production)(
    'matches the curated source lists exactly (run npm run content:build)',
    () => {
      for (const category of CATEGORY_IDS) {
        const names = readFileSync(`content-source/${category}.txt`, 'utf8')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('#'))
          .map((l) => (l.replace(/^\*/, '').split(' @')[0] ?? '').trim());
        const json = files.find((f) => f.category === category)!.data.map((c) => c.displayName);
        expect(json, category).toEqual(names);
      }
    },
  );
});

describe('bank photos', () => {
  const withImages = all.filter((c) => c.image);

  it.runIf(production)('covers a large part of the real-people categories', () => {
    const people: CategoryId[] = ['movies-tv', 'music', 'politics', 'history', 'sports'];
    for (const category of people) {
      const list = all.filter((c) => c.category === category);
      const share = list.filter((c) => c.image).length / list.length;
      expect(share, category).toBeGreaterThan(0.5);
    }
  });

  it('only uses usable images with full licensing metadata', () => {
    for (const c of withImages) {
      const image = c.image!;
      expect(hasUsableImage(image), c.id).toBe(true);
      const ok = isAllowedLicense(image.license) || image.license === FAIR_USE;
      expect(ok, `${c.id}: ${image.license}`).toBe(true);
      expect(image.alt, c.id).toContain(c.displayName);
    }
  });

  it('hotlinks Wikimedia files and links each file page as the source', () => {
    for (const c of withImages) {
      const image = c.image!;
      if (image.src.startsWith('/images/')) continue;
      expect(image.src, c.id).toMatch(/^https:\/\/upload\.wikimedia\.org\//);
      // Free files live on Commons; fair-use artwork only on English Wikipedia.
      const host = image.license === FAIR_USE ? 'en\\.wikipedia' : 'commons\\.wikimedia';
      expect(image.sourceUrl, c.id).toMatch(new RegExp(`^https://${host}\\.org/wiki/File:`));
    }
  });

  it.runIf(production)('gives every card a photo', () => {
    expect(all.filter((c) => !c.image).map((c) => c.id)).toEqual([]);
  });

  it('carries an attribution line whenever the license requires one', () => {
    for (const c of withImages) {
      const { license, attribution, creator } = c.image!;
      if (/^cc by/i.test(license)) expect(attribution ?? creator, c.id).toBeTruthy();
    }
  });
});

describe('isAllowedLicense', () => {
  it.each(['Public domain', 'PD-US', 'CC0', 'CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 2.0 de'])(
    'accepts %s',
    (l) => expect(isAllowedLicense(l)).toBe(true),
  );
  it.each(['Fair use', 'CC BY-NC 4.0', 'CC BY-ND 2.0', 'All rights reserved', ''])(
    'rejects %s',
    (l) => expect(isAllowedLicense(l)).toBe(false),
  );
});
