/**
 * Looks up a freely licensed photo for every entry in content-source/*.txt and
 * records its metadata in content-source/images.json (consumed by build-bank.ts).
 *
 * Pipeline per entry (every photo comes from Wikimedia):
 *  1. A hand-picked file from content-source/image-overrides.json (id → file name),
 *     used when the lead image is hard to recognise (e.g. Chaplin without his
 *     moustache) or missing. Otherwise the English Wikipedia article (`@title` or
 *     display name) → its lead image (prop=pageimages), or, when the article has
 *     none, the image in its infobox. Missing or disambiguation pages are reported.
 *  2. The file's description page → license + author (extmetadata). Files on
 *     Wikimedia Commons must be public domain / CC0 / CC BY / CC BY-SA. Files hosted
 *     only on English Wikipedia (mostly the official artwork of fictional characters)
 *     are used under its non-free content policy and credited as "Fair use".
 *  3. A ~500px thumbnail URL on upload.wikimedia.org is stored as `image.src`, with
 *     the file page as `sourceUrl` and the exact credit line as `attribution`.
 *
 * Usage: npm run content:images [-- --refresh]   (then npm run content:build)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
/* eslint-disable @typescript-eslint/no-explicit-any -- untyped MediaWiki API JSON */
import { FAIR_USE, isAllowedLicense } from '../src/content/license.ts';
import type { ImageMetadata } from '../src/content/schema.ts';
import { readAllSources, slugify, type SourceEntry } from './build-bank.ts';

const OUT = 'content-source/images.json';
const REPORT = 'content-source/images-report.txt';
const OVERRIDES = 'content-source/image-overrides.json';
const UA = 'GuessWhoContentBuilder/1.0 (https://github.com/okhaliavinskyi/guess-who)';
const THUMB_WIDTH = 500;

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

async function lookupPages(titles: string[]): Promise<Map<string, PageResult>> {
  const result = new Map<string, PageResult>();
  for (const batch of chunk(titles, 50)) {
    const data = await api('en.wikipedia.org', {
      action: 'query',
      prop: 'pageimages|pageprops',
      piprop: 'name',
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
  // pageimages skips non-free files, so read the infobox of articles without one.
  const noLead = [...result].filter(([, r]) => r.problem === 'article has no lead image');
  for (const batch of chunk(noLead, 20)) {
    const data = await api('en.wikipedia.org', {
      action: 'query',
      prop: 'revisions',
      rvprop: 'content',
      rvslots: 'main',
      redirects: '1',
      titles: batch.map(([t]) => t).join('|'),
    });
    const alias = new Map<string, string>();
    for (const n of [...(data.query.normalized ?? []), ...(data.query.redirects ?? [])])
      alias.set(n.from, n.to);
    const pages = new Map<string, any>(data.query.pages.map((p: any) => [p.title, p]));
    for (const [title] of batch) {
      let cur = title;
      for (let i = 0; i < 5 && alias.has(cur); i += 1) cur = alias.get(cur)!;
      const text: string = pages.get(cur)?.revisions?.[0]?.slots?.main?.content ?? '';
      const file = infoboxImage(text);
      if (file) result.set(title, { file });
    }
    await sleep(1500);
  }
  return result;
}

/** The first `| image = File.ext` parameter of an infobox, if any. */
export function infoboxImage(wikitext: string): string | undefined {
  const m =
    /\|\s*(?:image|image_file)\s*=\s*(?:\[\[)?(?:File:|Image:)?([^|\]\n<{]+?\.(?:png|jpe?g|gif|svg|webp))/i.exec(
      wikitext,
    );
  return m?.[1]?.trim().replace(/_/g, ' ');
}

async function lookupFiles(files: string[]): Promise<Map<string, ImageMetadata | string>> {
  const result = new Map<string, ImageMetadata | string>();
  for (const batch of chunk(files, 50)) {
    // Asked of English Wikipedia so that both Commons files ("shared") and files
    // uploaded only to Wikipedia ("local", i.e. non-free artwork) are found.
    const data = await api('en.wikipedia.org', {
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
      if (!page || !info) {
        result.set(file, 'file not found');
        continue;
      }
      const meta = info.extmetadata ?? {};
      let license = stripHtml(meta.LicenseShortName?.value ?? '');
      const local = page.imagerepository === 'local';
      const nonFree = !!meta.NonFree?.value && meta.NonFree.value !== 'false';
      if (local && (nonFree || !isAllowedLicense(license))) license = FAIR_USE;
      else if (nonFree) {
        result.set(file, 'flagged non-free');
        continue;
      }
      if (license !== FAIR_USE && !isAllowedLicense(license)) {
        result.set(file, `license not allowed: "${license}"`);
        continue;
      }
      const creator = stripHtml(meta.Artist?.value ?? '').slice(0, 200) || undefined;
      if (!creator && /^cc by/i.test(license)) {
        result.set(file, 'no author to attribute');
        continue;
      }
      const attributionRequired = meta.AttributionRequired?.value === 'true';
      const site = local ? 'Wikipedia' : 'Wikimedia Commons';
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
      if (attributionRequired && creator) image.attribution = `${creator}, ${license}, via ${site}`;
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

  // Hand-picked files (id → file name) replace the automatic choice.
  const overrides: Record<string, string> = existsSync(OVERRIDES)
    ? JSON.parse(readFileSync(OVERRIDES, 'utf8'))
    : {};
  const fileKey = (f: string) => f.replace(/_/g, ' ').trim();
  const cachedFile = (img: ImageMetadata | null | undefined) =>
    img ? fileKey(decodeURIComponent(img.sourceUrl.replace(/^.*\/File:/, ''))) : undefined;

  // Entries without a photo yet (new, or not found last time), or whose hand-picked
  // file changed, are looked up again.
  const todo = entries.filter((e) => {
    const id = idOf(e);
    const pick = overrides[id];
    return !existing[id] || (pick !== undefined && cachedFile(existing[id]) !== fileKey(pick));
  });
  console.log(`Looking up ${todo.length} of ${entries.length} entries…`);
  const pages = await lookupPages([
    ...new Set(todo.filter((e) => !overrides[idOf(e)]).map((e) => e.wikiTitle)),
  ]);
  for (const e of todo) {
    const pick = overrides[idOf(e)];
    if (pick) pages.set(`#${idOf(e)}`, { file: fileKey(pick) });
  }
  const fileNames = [...new Set([...pages.values()].flatMap((p) => (p.file ? [p.file] : [])))];
  const files = await lookupFiles(fileNames);

  const report: string[] = [];
  const out = { ...existing };
  for (const e of todo) {
    const id = idOf(e);
    const page = pages.get(overrides[id] ? `#${id}` : e.wikiTitle);
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

  const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  writeFileSync(REPORT, `${report.sort().join('\n')}\n`);
  const found = Object.values(sorted).filter(Boolean).length;
  console.log(`Photos: ${found} / ${Object.keys(sorted).length}. Gaps listed in ${REPORT}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
