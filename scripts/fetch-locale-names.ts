/**
 * Fetches Russian and Ukrainian names for every entry in content-source/*.txt from
 * the interlanguage links of its English Wikipedia article, and writes them to
 * content-source/locale-names.json (consumed by build-bank.ts as `localeNames`).
 *
 * Wikipedia titles are turned into names people actually say:
 *   "Хэнкс, Том" → "Том Хэнкс", "Мадонна (певица)" → "Мадонна",
 *   "Тарас Григорович Шевченко" → "Тарас Шевченко" (patronymics dropped).
 * Hand-written fixes in content-source/locale-overrides.json always win.
 *
 * Usage: npm run content:locales [-- --refresh]   (then npm run content:build)
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped MediaWiki API JSON */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readAllSources } from './build-bank.ts';

export const LOCALES = ['ru', 'uk'] as const;
const OUT = 'content-source/locale-names.json';
const UA = 'GuessWhoContentBuilder/1.0 (https://github.com/okhaliavinskyi/guess-who)';

const PATRONYMIC = /^\p{Lu}\p{Ll}+(ович|евич|ьевич|йович|івна|ївна|овна|евна|ична|інична|ич|іч)$/u;

/** Converts a ru/uk Wikipedia article title into a natural display name. */
export function titleToName(title: string): string {
  let name = title.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const parts = name.split(', ');
  // "Фамилия, Имя [Отчество]" → "Имя [Отчество] Фамилия". Titles such as
  // "Диана, принцесса Уэльская" (lower-case second part) are left alone.
  if (parts.length === 2 && /^\p{Lu}/u.test(parts[1]!)) name = `${parts[1]} ${parts[0]}`;
  const words = name.split(/\s+/);
  if (words.length >= 3) name = words.filter((w, i) => i === 0 || !PATRONYMIC.test(w)).join(' ');
  return name.replace(/\s+/g, ' ').trim();
}

/** Rough cross-alphabet key so "Шевченко" (ru) and "Шевченко" (uk) compare equal. */
function key(word: string): string {
  return word
    .toLowerCase()
    .replace(/[эє]/g, 'е')
    .replace(/[ыії]/g, 'и')
    .replace(/ё/g, 'е')
    .replace(/[йґ]/g, (c) => (c === 'й' ? 'и' : 'г'))
    .slice(0, 3);
}

/**
 * Ukrainian Wikipedia often titles people "Прізвище Ім'я" without a comma
 * ("Шевченко Тарас"). When the Russian name has the same surname last, move the
 * Ukrainian surname to the end as well: "Тарас Шевченко".
 */
export function fixUkrainianOrder(ru: string | undefined, uk: string): string {
  if (!ru) return uk;
  const r = ru.split(' ');
  const u = uk.split(' ');
  if (r.length < 2 || u.length !== r.length) return uk;
  if (key(u[0]!) === key(r[r.length - 1]!) && key(u[0]!) !== key(r[0]!))
    return [...u.slice(1), u[0]].join(' ');
  return uk;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api(params: Record<string, string>): Promise<any> {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params }))
    url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (attempt >= 20 || (res.status !== 429 && res.status < 500))
      throw new Error(`wikipedia ${res.status}`);
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 500 : 5000);
  }
}

async function langLinks(titles: string[], lang: string): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let cont: Record<string, string> = {};
    const alias = new Map<string, string>();
    const found = new Map<string, string>();
    do {
      const data = await api({
        action: 'query',
        prop: 'langlinks',
        lllang: lang,
        lllimit: 'max',
        redirects: '1',
        titles: batch.join('|'),
        ...cont,
      });
      for (const n of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])])
        alias.set(n.from, n.to);
      for (const p of data.query?.pages ?? [])
        if (p.langlinks?.[0]?.title) found.set(p.title, p.langlinks[0].title);
      cont = data.continue ?? {};
      await sleep(1500);
    } while (Object.keys(cont).length > 0);
    for (const t of batch) {
      let cur = t;
      for (let k = 0; k < 5 && alias.has(cur); k += 1) cur = alias.get(cur)!;
      const linked = found.get(cur);
      if (linked) out.set(t, linked);
    }
  }
  return out;
}

/** Final cleanup applied to every stored name (also runnable offline: --reprocess). */
function cleanup(result: Record<string, Record<string, string>>) {
  for (const names of Object.values(result)) {
    for (const lang of LOCALES) if (names[lang]) names[lang] = titleToName(names[lang]);
    if (names.uk) names.uk = fixUkrainianOrder(names.ru, names.uk);
  }
}

function write(result: Record<string, Record<string, string>>) {
  const sorted = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
}

async function main() {
  if (process.argv.includes('--reprocess')) {
    const stored = JSON.parse(readFileSync(OUT, 'utf8'));
    cleanup(stored);
    write(stored);
    return;
  }
  const entries = readAllSources();
  const titles = [...new Set(entries.map((e) => e.wikiTitle))];
  const result: Record<string, Record<string, string>> = existsSync(OUT)
    ? JSON.parse(readFileSync(OUT, 'utf8'))
    : {};
  for (const lang of LOCALES) {
    // Only look up entries that have no name in this language yet (--refresh: all).
    const todo = process.argv.includes('--refresh')
      ? titles
      : [...new Set(entries.filter((e) => !result[e.displayName]?.[lang]).map((e) => e.wikiTitle))];
    const links = await langLinks(todo, lang);
    console.log(`${lang}: ${links.size} / ${todo.length} titles linked`);
    for (const e of entries) {
      const linked = links.get(e.wikiTitle);
      if (!linked) continue;
      (result[e.displayName] ??= {})[lang] = titleToName(linked);
    }
  }
  cleanup(result);
  write(result);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
