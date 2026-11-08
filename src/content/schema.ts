import { CATEGORY_IDS, isCategoryId, type CategoryId } from './categories.ts';

export type { CategoryId } from './categories.ts';

export type PopularityTier = 'iconic' | 'widely-known';

export interface ImageMetadata {
  /** Approved `/images/...` asset path (preferred) or a vetted https:// URL. */
  src: string;
  alt: string;
  creator?: string;
  /** e.g. "CC BY-SA 4.0", "CC0", "Public domain". */
  license: string;
  /** Attributable original source page (https). */
  sourceUrl: string;
  attribution?: string;
}

export interface Character {
  /** Stable, globally unique, immutable slug. */
  id: string;
  /** Exactly one primary category; must match the file it lives in. */
  category: CategoryId;
  /** Text shown on screen. */
  displayName: string;
  /** Content QA only — never shown in the UI. */
  aliases?: string[];
  /** Future translations keyed by BCP-47 language tag (e.g. "uk", "pt-BR"). */
  localeNames?: Record<string, string>;
  popularityTier: PopularityTier;
  image?: ImageMetadata;
}

export const DISPLAY_NAME_MAX = 60;
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POPULARITY_TIERS: readonly PopularityTier[] = ['iconic', 'widely-known'];
const CHARACTER_KEYS = new Set([
  'id',
  'category',
  'displayName',
  'aliases',
  'localeNames',
  'popularityTier',
  'image',
]);
const IMAGE_KEYS = new Set(['src', 'alt', 'creator', 'license', 'sourceUrl', 'attribution']);

export interface ValidationIssue {
  /** File path (or label) the issue was found in. */
  file: string;
  /** JSON pointer-ish location, e.g. "[3].image.license". */
  path: string;
  message: string;
}

export interface CharacterFileInput {
  /** File path shown in errors, e.g. "src/content/characters/music.json". */
  file: string;
  /** Category implied by the file name. */
  category: CategoryId;
  data: unknown;
}

export interface BankValidationResult {
  issues: ValidationIssue[];
  /** Entries that passed validation, de-duplicated by id (first wins). */
  valid: Character[];
  counts: Record<CategoryId, number>;
}

export function codePointLength(value: string): number {
  return Array.from(value).length;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/** Normalises a display name for duplicate detection (case/accents/spacing-insensitive). */
export function normalizeName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function isValidImageSrc(src: string): boolean {
  if (src.startsWith('/images/')) return !src.includes('..') && src.length > '/images/'.length;
  return isHttpsUrl(src);
}

function validateImage(image: unknown, at: string, push: (path: string, msg: string) => void) {
  if (!isPlainObject(image)) {
    push(at, 'image must be an object when present');
    return false;
  }
  let ok = true;
  const fail = (path: string, msg: string) => {
    ok = false;
    push(path, msg);
  };
  for (const key of Object.keys(image)) {
    if (!IMAGE_KEYS.has(key)) fail(`${at}.${key}`, `unknown image field "${key}"`);
  }
  if (!isNonEmptyString(image.src)) fail(`${at}.src`, 'image.src is required');
  else if (!isValidImageSrc(image.src))
    fail(`${at}.src`, 'image.src must be an /images/... path or an https:// URL');
  if (!isNonEmptyString(image.alt))
    fail(`${at}.alt`, 'image.alt (descriptive alt text) is required');
  if (!isNonEmptyString(image.license)) fail(`${at}.license`, 'image.license is required');
  if (!isNonEmptyString(image.sourceUrl)) fail(`${at}.sourceUrl`, 'image.sourceUrl is required');
  else if (!isHttpsUrl(image.sourceUrl)) fail(`${at}.sourceUrl`, 'image.sourceUrl must be https');
  for (const key of ['creator', 'attribution'] as const) {
    if (image[key] !== undefined && !isNonEmptyString(image[key]))
      fail(`${at}.${key}`, `image.${key} must be a non-empty string when present`);
  }
  return ok;
}

/**
 * Validates one entry. Returns the issues found; an entry with zero issues is a
 * valid `Character`.
 */
export function validateCharacter(
  entry: unknown,
  expectedCategory: CategoryId,
  index: number,
): Omit<ValidationIssue, 'file'>[] {
  const issues: Omit<ValidationIssue, 'file'>[] = [];
  const push = (path: string, message: string) => issues.push({ path, message });
  const at = `[${index}]`;

  if (!isPlainObject(entry)) {
    push(at, 'entry must be an object');
    return issues;
  }
  for (const key of Object.keys(entry)) {
    if (!CHARACTER_KEYS.has(key)) push(`${at}.${key}`, `unknown field "${key}"`);
  }

  if (!isNonEmptyString(entry.id)) push(`${at}.id`, 'id is required and must be non-empty');
  else if (!ID_PATTERN.test(entry.id))
    push(`${at}.id`, `id "${entry.id}" must be a lowercase kebab-case slug (a-z, 0-9, -)`);

  if (!isCategoryId(entry.category))
    push(`${at}.category`, `category must be one of: ${CATEGORY_IDS.join(', ')}`);
  else if (entry.category !== expectedCategory)
    push(
      `${at}.category`,
      `category "${entry.category}" does not match file category "${expectedCategory}"`,
    );

  if (!isNonEmptyString(entry.displayName)) push(`${at}.displayName`, 'displayName is required');
  else {
    if (entry.displayName !== entry.displayName.trim())
      push(`${at}.displayName`, 'displayName must not have leading/trailing whitespace');
    if (codePointLength(entry.displayName) > DISPLAY_NAME_MAX)
      push(`${at}.displayName`, `displayName must be <= ${DISPLAY_NAME_MAX} characters`);
  }

  if (!POPULARITY_TIERS.includes(entry.popularityTier as PopularityTier))
    push(`${at}.popularityTier`, `popularityTier must be one of: ${POPULARITY_TIERS.join(', ')}`);

  if (entry.aliases !== undefined) {
    if (!Array.isArray(entry.aliases)) push(`${at}.aliases`, 'aliases must be an array of strings');
    else
      entry.aliases.forEach((alias, i) => {
        if (!isNonEmptyString(alias))
          push(`${at}.aliases[${i}]`, 'alias must be a non-empty string');
      });
  }

  if (entry.localeNames !== undefined) {
    if (!isPlainObject(entry.localeNames))
      push(`${at}.localeNames`, 'localeNames must be an object of { locale: name }');
    else
      for (const [locale, name] of Object.entries(entry.localeNames)) {
        if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale))
          push(`${at}.localeNames.${locale}`, `"${locale}" is not a valid language tag`);
        if (!isNonEmptyString(name) || codePointLength(name) > DISPLAY_NAME_MAX)
          push(`${at}.localeNames.${locale}`, 'localized name must be a non-empty string');
      }
  }

  if (entry.image !== undefined) validateImage(entry.image, `${at}.image`, push);

  return issues;
}

/**
 * Validates every category file together: per-entry schema plus bank-wide rules
 * (globally unique ids, no duplicate display names, no empty categories).
 */
export function validateBank(
  files: CharacterFileInput[],
  options: { allowEmptyCategories?: boolean } = {},
): BankValidationResult {
  const issues: ValidationIssue[] = [];
  const valid: Character[] = [];
  const counts = Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<CategoryId, number>;
  const seenIds = new Map<string, string>();
  const seenNames = new Map<string, string>();

  for (const { file, category, data } of files) {
    if (!Array.isArray(data)) {
      issues.push({ file, path: '', message: 'file must contain a JSON array of characters' });
      continue;
    }
    data.forEach((entry, index) => {
      const entryIssues = validateCharacter(entry, category, index).map((i) => ({ file, ...i }));
      issues.push(...entryIssues);
      if (entryIssues.length > 0) return;
      const character = entry as Character;
      const where = `${file}[${index}]`;
      const prevId = seenIds.get(character.id);
      if (prevId) {
        issues.push({
          file,
          path: `[${index}].id`,
          message: `duplicate id "${character.id}" (already used at ${prevId})`,
        });
        return;
      }
      seenIds.set(character.id, where);
      const nameKey = normalizeName(character.displayName);
      const prevName = seenNames.get(nameKey);
      if (prevName) {
        issues.push({
          file,
          path: `[${index}].displayName`,
          message: `duplicate displayName "${character.displayName}" (already used at ${prevName})`,
        });
        return;
      }
      seenNames.set(nameKey, where);
      valid.push(character);
      counts[character.category] += 1;
    });
  }

  const provided = new Set(files.map((f) => f.category));
  for (const category of CATEGORY_IDS) {
    if (!provided.has(category))
      issues.push({ file: `${category}.json`, path: '', message: 'category file is missing' });
    else if (counts[category] === 0 && !options.allowEmptyCategories)
      issues.push({
        file: files.find((f) => f.category === category)?.file ?? `${category}.json`,
        path: '',
        message: 'category has no valid characters',
      });
  }

  return { issues, valid, counts };
}

export function formatIssue(issue: ValidationIssue): string {
  return `${issue.file}${issue.path ? ` ${issue.path}` : ''}: ${issue.message}`;
}
