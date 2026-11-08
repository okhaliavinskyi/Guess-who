/**
 * Builds src/content/characters/*.json from the curated lists in content-source/*.txt.
 *
 * List format (one entry per line, `#` = comment):
 *   [*]Display Name [@Wikipedia title]
 *   `*` marks the "iconic" tier (otherwise "widely-known"); `@title` overrides the
 *   English Wikipedia article used to look up a photo (defaults to the display name).
 *
 * Existing ids and image metadata are preserved (ids are immutable); new entries get
 * a slug of the display name. Image metadata comes from scripts/fetch-images.ts via
 * content-source/images.json.
 *
 * Usage: npm run content:build
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { CATEGORY_IDS, type CategoryId } from '../src/content/categories.ts';
import { normalizeName, type Character, type ImageMetadata } from '../src/content/schema.ts';

export interface SourceEntry {
  category: CategoryId;
  displayName: string;
  iconic: boolean;
  wikiTitle: string;
}

export function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseSource(category: CategoryId, text: string): SourceEntry[] {
  const out: SourceEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const iconic = line.startsWith('*');
    const [name = '', title] = line.replace(/^\*/, '').split(' @');
    const displayName = name.trim();
    out.push({ category, displayName, iconic, wikiTitle: (title ?? displayName).trim() });
  }
  return out;
}

export function readAllSources(dir = 'content-source'): SourceEntry[] {
  return CATEGORY_IDS.flatMap((c) => parseSource(c, readFileSync(`${dir}/${c}.txt`, 'utf8')));
}

type ImageMap = Record<string, ImageMetadata | null>;

function main() {
  const sources = readAllSources();
  const images: ImageMap = existsSync('content-source/images.json')
    ? (JSON.parse(readFileSync('content-source/images.json', 'utf8')) as ImageMap)
    : {};

  // Preserve ids of entries that already exist (looked up by normalised name).
  const existingIds = new Map<string, string>();
  for (const c of CATEGORY_IDS) {
    const path = `src/content/characters/${c}.json`;
    if (!existsSync(path)) continue;
    for (const ch of JSON.parse(readFileSync(path, 'utf8')) as Character[])
      existingIds.set(normalizeName(ch.displayName), ch.id);
  }

  const seenIds = new Set<string>();
  const seenNames = new Map<string, string>();
  const errors: string[] = [];
  const byCategory = Object.fromEntries(CATEGORY_IDS.map((c) => [c, [] as Character[]]));

  for (const s of sources) {
    const key = normalizeName(s.displayName);
    const prev = seenNames.get(key);
    if (prev) {
      errors.push(`duplicate name "${s.displayName}" in ${s.category} (already in ${prev})`);
      continue;
    }
    seenNames.set(key, s.category);
    let id = existingIds.get(key) ?? slugify(s.displayName);
    if (seenIds.has(id)) id = `${id}-${s.category}`;
    seenIds.add(id);
    const character: Character = {
      id,
      category: s.category,
      displayName: s.displayName,
      popularityTier: s.iconic ? 'iconic' : 'widely-known',
    };
    const image = images[id];
    if (image) character.image = image;
    byCategory[s.category]!.push(character);
  }

  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  for (const c of CATEGORY_IDS) {
    writeFileSync(
      `src/content/characters/${c}.json`,
      `${JSON.stringify(byCategory[c], null, 2)}\n`,
    );
    const list = byCategory[c]!;
    console.log(`${c.padEnd(10)} ${list.length} (${list.filter((x) => x.image).length} photos)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
