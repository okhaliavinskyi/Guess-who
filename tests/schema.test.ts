import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS, type CategoryId } from '../src/content/categories.ts';
import { validateBank, type CharacterFileInput } from '../src/content/schema.ts';
import { char } from './helpers.ts';

function bankWith(overrides: Partial<Record<CategoryId, unknown>> = {}): CharacterFileInput[] {
  return CATEGORY_IDS.map((category) => ({
    file: `${category}.json`,
    category,
    data: category in overrides ? overrides[category] : [char(`${category}-one`, category)],
  }));
}

const messages = (files: CharacterFileInput[]) =>
  validateBank(files).issues.map((i) => `${i.file} ${i.path}: ${i.message}`);

describe('validateBank', () => {
  it('accepts a valid bank', () => {
    const r = validateBank(bankWith());
    expect(r.issues).toEqual([]);
    expect(r.valid).toHaveLength(6);
  });

  it('fails on duplicate ids across files, naming both locations', () => {
    const out = messages(bankWith({ sports: [char('music-one', 'sports')] }));
    expect(out.join('\n')).toMatch(
      /sports\.json \[0\]\.id: duplicate id "music-one".*music\.json\[0\]/,
    );
  });

  it('fails on duplicate display names ignoring case and accents', () => {
    const out = messages(
      bankWith({
        music: [
          char('beyonce', 'music', { displayName: 'Beyoncé' }),
          char('beyonce-2', 'music', { displayName: 'beyonce' }),
        ],
      }),
    );
    expect(out.join()).toMatch(/duplicate displayName/);
  });

  it('fails on empty categories, missing files and non-arrays', () => {
    expect(messages(bankWith({ politics: [] })).join()).toMatch(
      /politics\.json : category has no valid/,
    );
    expect(messages(bankWith().filter((f) => f.category !== 'history')).join()).toMatch(
      /history\.json : category file is missing/,
    );
    expect(messages(bankWith({ music: { nope: true } })).join()).toMatch(
      /must contain a JSON array/,
    );
  });

  it('allows empty categories when asked (runtime loader)', () => {
    expect(validateBank(bankWith({ politics: [] }), { allowEmptyCategories: true }).issues).toEqual(
      [],
    );
  });

  it.each([
    [{ id: '' }, /id is required/],
    [{ id: 'Tom Hanks' }, /kebab-case/],
    [{ category: 'music' }, /does not match file category/],
    [{ category: 'cooking' }, /category must be one of/],
    [{ displayName: '   ' }, /displayName is required/],
    [{ displayName: ' Padded' }, /leading\/trailing/],
    [{ displayName: 'x'.repeat(61) }, /<= 60/],
    [{ popularityTier: 'famous' }, /popularityTier/],
    [{ aliases: 'x' }, /aliases must be an array/],
    [{ localeNames: { english: 'x' } }, /valid language tag/],
    [{ extra: 1 }, /unknown field "extra"/],
  ])('rejects bad entry %j', (patch, pattern) => {
    const out = messages(bankWith({ sports: [{ ...char('sports-one', 'sports'), ...patch }] }));
    expect(out.join('\n')).toMatch(pattern);
    expect(out.join('\n')).toMatch(/^sports\.json \[0\]/);
  });

  const goodImage = {
    src: '/images/a.jpg',
    alt: 'Portrait',
    license: 'CC0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
  };

  it('accepts complete image metadata', () => {
    expect(messages(bankWith({ sports: [char('s', 'sports', { image: goodImage })] }))).toEqual([]);
  });

  it.each([
    [{ license: undefined }, /image\.license is required/],
    [{ sourceUrl: undefined }, /image\.sourceUrl is required/],
    [{ sourceUrl: 'http://example.com' }, /must be https/],
    [{ alt: '' }, /image\.alt/],
    [{ src: 'images/a.jpg' }, /\/images\/\.\.\. path or an https/],
    [{ src: '/images/../secret' }, /\/images\/\.\.\. path/],
    [{ src: 'http://x.com/a.jpg' }, /https/],
  ])('rejects image %j', (patch, pattern) => {
    const image = { ...goodImage, ...patch };
    expect(
      messages(bankWith({ sports: [char('s', 'sports', { image: image as never })] })).join(),
    ).toMatch(pattern);
  });
});
