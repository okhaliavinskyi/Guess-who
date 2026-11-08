/**
 * Looks up a freely licensed photo for every entry in content-source/*.txt and
 * records its metadata in content-source/images.json (consumed by build-bank.ts).
 *
 * Pipeline per entry:
 *  1. English Wikipedia article (`@title` or display name) → its lead image file
 *     (prop=pageimages). Missing or disambiguation pages are reported, not guessed.
 *  2. The file's own Wikimedia Commons page → license + author (extmetadata).
 *     Files that are not on Commons (local "fair use" uploads), flagged NonFree, or
 *     whose license is not public domain / CC0 / CC BY / CC BY-SA are rejected,
 *     so copyrighted fictional artwork stays text-only.
 *  3. A ~500px thumbnail URL on upload.wikimedia.org is stored as `image.src`, with
 *     the file page as `sourceUrl` and the exact credit line as `attribution`.
 *
 * Usage: npm run content:images [-- --refresh] [-- --non-free]   (then npm run content:build)
 *   --non-free also fills remaining gaps with the (copyrighted) image Wikipedia uses.
 *   content-source/image-picks.json pins a specific file for a name.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped MediaWiki API JSON */
import { isAllowedLicense, NON_FREE_LICENSE } from '../src/content/license.ts';
import type { ImageMetadata } from '../src/content/schema.ts';
import { readAllSources, slugify, type SourceEntry } from './build-bank.ts';

const OUT = 'content-source/images.json';
const REPORT = 'content-source/images-report.txt';
const UA = 'GuessWhoContentBuilder/1.0 (https://github.com/okhaliavinskyi/guess-who)';
const THUMB_WIDTH = 500;
/** Lead images reviewed by hand and rejected (not a picture of the person). */
const SKIP = new Set<string>(); // replaced by hand-picks in image-picks.json

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function api(host: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: 'json', formatversion: '2', ...params }))
    url.searchParams.set(k, v);
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (attempt >= 20 || (res.status !== 429 && res.status < 500))
      throw new Error(`${host} ${res.status}`);
    // Respect the server's rate limit (Retry-After, in seconds).
    const retryAfter = Number(res.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 + 500 : 5000);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface PageResult {
  file?: string;
  problem?: string;
}

async function lookupPages(titles: string[], anyLicense = false): Promise<Map<string, PageResult>> {
  const result = new Map<string, PageResult>();
  for (const batch of chunk(titles, 50)) {
    const data = await api('en.wikipedia.org', {
      action: 'query',
      prop: 'pageimages|pageprops',
      piprop: 'name',
      // By default pageimages only returns free images; 'any' includes fair-use ones.
      ...(anyLicense ? { pilicense: 'any' } : {}),
      ppprop: 'disambiguation',
      redirects: '1',
      titles: batch.join('|'),
    });
    const alias = new Map<string, string>();
    for (const n of [...(data.query.normalized ?? []), ...(data.query.redirects ?? [])])
      alias.set(n.from, n.to);
    const resolve = (t: string) => {
      let cur = t;
      for (let i = 0; i < 5 && alias.has(cur); i += 1) cur = alias.get(cur)!;
      return cur;
    };
    const pages = new Map<string, any>(data.query.pages.map((p: any) => [p.title, p]));
    for (const title of batch) {
      const page = pages.get(resolve(title));
      if (!page || page.missing) result.set(title, { problem: 'article not found' });
      else if (page.pageprops && 'disambiguation' in page.pageprops)
        result.set(title, { problem: 'disambiguation page' });
      else if (!page.pageimage) result.set(title, { problem: 'article has no lead image' });
      else result.set(title, { file: page.pageimage });
    }
    await sleep(1500);
  }
  return result;
}

async function lookupFiles(
  files: string[],
  nonFree = false,
): Promise<Map<string, ImageMetadata | string>> {
  const result = new Map<string, ImageMetadata | string>();
  for (const batch of chunk(files, 50)) {
    // Non-free (fair-use) files live on English Wikipedia itself, not on Commons.
    const data = await api(nonFree ? 'en.wikipedia.org' : 'commons.wikimedia.org', {
      action: 'query',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter:
        'LicenseShortName|Artist|Credit|AttributionRequired|NonFree|Restrictions',
      titles: batch.map((f) => `File:${f}`).join('|'),
    });
    const alias = new Map<string, string>(
      (data.query.normalized ?? []).map((n: any) => [n.from, n.to]),
    );
    const pages = new Map<string, any>(data.query.pages.map((p: any) => [p.title, p]));
    for (const file of batch) {
      const key = `File:${file}`;
      const page = pages.get(alias.get(key) ?? key);
      const info = page?.imageinfo?.[0];
      if (!page || page.missing || !info) {
        result.set(file, 'not on Commons (likely non-free local upload)');
        continue;
      }
      const meta = info.extmetadata ?? {};
      if (nonFree) {
        const owner = stripHtml(meta.Artist?.value ?? '').slice(0, 120) || 'rights holder';
        result.set(file, {
          src: String(info.thumburl ?? info.url)
            .replace(/\?utm_.*$/, '')
            .replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/'),
          alt: '',
          license: NON_FREE_LICENSE,
          sourceUrl: info.descriptionurl,
          attribution: `© ${owner}, via Wikipedia`,
        });
        continue;
      }
      const license = stripHtml(meta.LicenseShortName?.value ?? '');
      if (meta.NonFree?.value && meta.NonFree.value !== 'false') {
        result.set(file, 'flagged non-free');
        continue;
      }
      if (!isAllowedLicense(license)) {
        result.set(file, `license not allowed: "${license}"`);
        continue;
      }
      const creator = stripHtml(meta.Artist?.value ?? '').slice(0, 200) || undefined;
      if (!creator && /^cc by/i.test(license)) {
        result.set(file, 'no author to attribute');
        continue;
      }
      const attributionRequired = meta.AttributionRequired?.value === 'true';
      const image: ImageMetadata = {
        // Drop Wikimedia's tracking query string; the bare thumbnail URL is stable.
        // Same path is served by the long-standing upload.wikimedia.org host.
        src: String(info.thumburl ?? info.url)
          .replace(/\?utm_.*$/, '')
          .replace('https://thumb.wikimedia.org/', 'https://upload.wikimedia.org/'),
        alt: '',
        license,
        sourceUrl: info.descriptionurl,
      };
      if (creator) image.creator = creator;
      if (attributionRequired && creator)
        image.attribution = `${creator}, ${license}, via Wikimedia Commons`;
      result.set(file, image);
    }
    await sleep(1500);
  }
  return result;
}

function altText(entry: SourceEntry): string {
  return entry.category === 'fictional'
    ? `Image of ${entry.displayName}`
    : `Photo of ${entry.displayName}`;
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  const existing: Record<string, ImageMetadata | null> =
    existsSync(OUT) && !refresh ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  const entries = readAllSources();
  const idOf = (e: SourceEntry) => existingIdMap.get(e.displayName) ?? slugify(e.displayName);

  // Ids must match build-bank.ts: reuse ids from the current JSON files.
  const existingIdMap = new Map<string, string>();
  for (const e of entries) {
    const path = `src/content/characters/${e.category}.json`;
    if (!existsSync(path)) continue;
    for (const ch of JSON.parse(readFileSync(path, 'utf8')) as {
      id: string;
      displayName: string;
    }[])
      existingIdMap.set(ch.displayName, ch.id);
  }

  // Entries without a photo yet (new, or not found last time) are looked up again.
  const todo = entries.filter((e) => !existing[idOf(e)]);
  console.log(`Looking up ${todo.length} of ${entries.length} entries…`);
  const pages = await lookupPages([...new Set(todo.map((e) => e.wikiTitle))]);
  const fileNames = [...new Set([...pages.values()].flatMap((p) => (p.file ? [p.file] : [])))];
  const files = await lookupFiles(fileNames);

  const report: string[] = [];
  const out = { ...existing };
  for (const id of SKIP) out[id] = null;
  for (const e of todo) {
    const id = idOf(e);
    if (SKIP.has(id)) continue;
    const page = pages.get(e.wikiTitle);
    if (!page?.file) {
      out[id] = null;
      report.push(`${e.category}\t${e.displayName}\t${page?.problem ?? 'lookup failed'}`);
      continue;
    }
    const file = files.get(page.file);
    if (!file || typeof file === 'string') {
      out[id] = null;
      report.push(`${e.category}\t${e.displayName}\t${file ?? 'lookup failed'} [${page.file}]`);
      continue;
    }
    out[id] = { ...file, alt: altText(e) };
  }

  // --non-free: for entries still without a free image, use the copyrighted image
  // Wikipedia shows in the article (e.g. Disney/Pixar characters), credited to its
  // owner. The owner of the deployment decided this is acceptable for a personal,
  // non-commercial game.
  if (process.argv.includes('--non-free')) {
    const rest = entries.filter((e) => !out[idOf(e)] && !SKIP.has(idOf(e)));
    console.log(`Non-free pass for ${rest.length} entries…`);
    const anyPages = await lookupPages([...new Set(rest.map((e) => e.wikiTitle))], true);
    const anyFiles = await lookupFiles(
      [...new Set([...anyPages.values()].flatMap((p) => (p.file ? [p.file] : [])))],
      true,
    );
    for (const e of rest) {
      const page = anyPages.get(e.wikiTitle);
      const file = page?.file ? anyFiles.get(page.file) : undefined;
      if (file && typeof file !== 'string') out[idOf(e)] = { ...file, alt: altText(e) };
    }
  }

  // Hand-picked files (content-source/image-picks.json: display name → file name) win
  // over everything else. Each is checked on Commons first (free license), then on
  // English Wikipedia (fair use, credited to the owner).
  const PICKS = 'content-source/image-picks.json';
  if (existsSync(PICKS)) {
    const picks = JSON.parse(readFileSync(PICKS, 'utf8')) as Record<string, string>;
    const byName = new Map(entries.map((e) => [e.displayName, e]));
    const files = Object.values(picks);
    const free = await lookupFiles(files);
    const nonFreeFiles = files.filter((f) => typeof free.get(f) === 'string');
    const local = nonFreeFiles.length ? await lookupFiles(nonFreeFiles, true) : new Map();
    for (const [name, file] of Object.entries(picks)) {
      const e = byName.get(name);
      if (!e) {
        console.warn(`pick for unknown name: ${name}`);
        continue;
      }
      const meta = [free.get(file), local.get(file)].find((m) => m && typeof m !== 'string');
      if (meta && typeof meta !== 'string') out[idOf(e)] = { ...meta, alt: altText(e) };
      else console.warn(`pick not found: ${name} → ${file}`);
    }
  }

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  writeFileSync(REPORT, `${report.sort().join('\n')}\n`);
  const found = Object.values(sorted).filter(Boolean).length;
  console.log(`Photos: ${found} / ${Object.keys(sorted).length}. Gaps listed in ${REPORT}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
