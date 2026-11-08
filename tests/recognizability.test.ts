/**
 * Guard for the "globally famous only" rule: names that were removed because most
 * players outside one country would not recognise them must not come back.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '../src/content/categories.ts';

const names = CATEGORY_IDS.flatMap((c) =>
  (
    JSON.parse(readFileSync(`src/content/characters/${c}.json`, 'utf8')) as {
      displayName: string;
    }[]
  ).map((x) => x.displayName),
);

const REGIONAL_ONLY = [
  'Shah Rukh Khan',
  'Aamir Khan',
  'Salman Khan',
  'Amitabh Bachchan',
  'Sachin Tendulkar',
  'Virat Kohli',
  'Toto Cutugno',
  'Adriano Celentano',
  'Mylène Farmer',
  'Louis de Funès',
  'Cheburashka',
  'Postman Pat',
  'Lesya Ukrainka',
  'Sanna Marin',
];

describe('recognisability', () => {
  it.each(REGIONAL_ONLY)('does not include regionally famous %s', (name) => {
    expect(names).not.toContain(name);
  });

  it('keeps headline names everyone knows', () => {
    for (const name of [
      'Michael Jackson',
      'Lionel Messi',
      'Albert Einstein',
      'Harry Potter',
      'Barack Obama',
      'Tom Hanks',
    ])
      expect(names).toContain(name);
  });
});
