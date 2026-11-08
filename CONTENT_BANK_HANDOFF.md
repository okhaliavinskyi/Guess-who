# Character Bank — Content Session Handoff

**Status: PRODUCTION** — 200+ names per category, built from `content-source/*.txt`; see `src/content/characters/README.md` for the workflow. The rest of this document is the original contract.
This document is the contract for a separate Claude Code session that replaces the
fixtures with the production bank. The game code does not need to change for that.

## Prompt starter for the content session

> Populate the production Guess Who character bank, following CONTENT_BANK_HANDOFF.md
> and the existing code schema. First inspect `src/content/schema.ts` and
> `scripts/validate-content.ts`. Research and curate highly recognizable, culturally
> varied people and characters across the six categories, avoiding obscure entries.
> Validate name quality and global ID uniqueness; add only rights-verified optional
> photos with full metadata. Make staged commits per category, run
> `npm run content:validate` and `npm run check`, and report final counts and any
> unresolved licensing gaps. Do not alter game architecture or introduce runtime APIs.

## Files

| Path                                    | Purpose                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/content/characters/movies-tv.json` | Movies & TV — live-action actors / screen personalities                                         |
| `src/content/characters/music.json`     | Music — singers, front persons, major artists                                                   |
| `src/content/characters/fictional.json` | Fictional Characters — the character, not the actor                                             |
| `src/content/characters/politics.json`  | Politics — political leaders, current or historical                                             |
| `src/content/characters/history.json`   | History — historical, cultural, scientific figures (non-political)                              |
| `src/content/characters/sports.json`    | Sports — athletes                                                                               |
| `src/content/bankStatus.ts`             | Flip `BANK_STATUS` from `'demo'` to `'production'` when done (removes the "Demo content" label) |
| `public/images/`                        | Only rights-verified image files                                                                |

**Mix is not a file.** It is the de-duplicated union of all six files, sampled
uniformly per character. Custom words never touch the bank.

Each file is a JSON **array** of characters whose `category` equals the file name.
File names other than the six above are rejected by the validator.

## Schema (`src/content/schema.ts`)

```ts
type CategoryId = 'movies-tv' | 'music' | 'fictional' | 'politics' | 'history' | 'sports';
type Character = {
  id: string; // stable, globally unique, lowercase kebab-case slug: ^[a-z0-9]+(-[a-z0-9]+)*$
  category: CategoryId; // must equal the file's category
  displayName: string; // shown on screen; trimmed, 1–60 characters
  aliases?: string[]; // content QA only, never shown
  localeNames?: Record<string, string>; // e.g. { "uk": "…", "pt-BR": "…" } — used when it matches the browser language
  popularityTier: 'iconic' | 'widely-known';
  image?: {
    src: string; // "/images/<file>" (preferred) or vetted https:// URL
    alt: string; // descriptive alt text
    creator?: string;
    license: string; // e.g. "CC BY-SA 4.0", "CC0", "Public domain"
    sourceUrl: string; // https URL of the original asset page
    attribution?: string; // exact credit line required by the license, if any
  };
};
```

Example:

```json
{
  "id": "marie-curie",
  "category": "history",
  "displayName": "Marie Curie",
  "aliases": ["Maria Skłodowska-Curie"],
  "localeNames": { "pl": "Maria Skłodowska-Curie", "uk": "Марія Склодовська-Кюрі" },
  "popularityTier": "iconic",
  "image": {
    "src": "/images/history/marie-curie.jpg",
    "alt": "Black-and-white portrait photograph of Marie Curie, c. 1920",
    "license": "Public domain",
    "sourceUrl": "https://commons.wikimedia.org/wiki/File:<exact file page>",
    "creator": "<as stated on the file page>"
  }
}
```

## What the validator enforces (`npm run content:validate`, also runs in `npm run build` and CI)

- All six files exist, parse as JSON arrays, and each has ≥ 1 valid entry.
- No unknown fields (catches typos such as `displayname`).
- `id`: non-empty slug, **globally unique across all files**.
- `category` valid and matching the file.
- `displayName`: non-empty, no surrounding whitespace, ≤ 60 code points.
- **No duplicate display names** across the whole bank (case-, accent- and punctuation-insensitive).
- `popularityTier` is `iconic` or `widely-known`.
- `aliases` strings; `localeNames` keyed by valid language tags.
- `image` (if present): `src` is `/images/...` (no `..`) or `https://`; `alt`, `license`, `sourceUrl` (https) required.

Errors print as `file [index].field: message` and exit with code 1. At runtime, any
entry that would fail is dropped instead of crashing, and an empty category shows a
"No names here yet" screen.

## IDs and duplicates

- IDs are **immutable**: never rename an existing id (session shuffle bags reference ids).
  To fix a typo in a name, change `displayName` only.
- Use `firstname-lastname`; disambiguate only when needed (`michael-jordan` is fine).
- Each person/character belongs to exactly **one** category. Actor vs. role: the
  actor goes in Movies & TV, the role in Fictional (e.g. `daniel-radcliffe` vs `harry-potter`).
  Political leaders go in Politics, not History.
- Do not add the same person twice under different spellings — the duplicate-name
  check catches exact/accents variants; review near-duplicates manually.

## Recognition and curation rules

- Only names that general audiences across many countries can identify or reasonably
  guess with yes/no questions. Exclude hyperlocal, niche or specialist fame.
- Balance eras, regions, cultures, genders and media types where recognizable.
- Names must be distinctive and unambiguous — "Michael Jordan" yes, a lone common
  first name no (mononyms are fine when globally unique: "Madonna", "Beyoncé").
- Family-friendly. No spoilers in names or aliases.
- Politics: neutral, factual naming; no ideological ranking or labels.
- Fictional: specifically named characters, not franchises ("Darth Vader", not "Star Wars").
- `popularityTier` reflects responsible curation, not an invented external metric.
- Volume: choose from real playtesting needs (a round uses one name per Next). Do
  **not** present 4–5 fixtures, or any small number, as production-complete.

## Image policy

- Images are optional; text-only entries are fully supported and preferred over doubtful images.
- Verify each file's **own** page (e.g. a Wikimedia Commons file page): license,
  attribution requirements, commercial reuse, personality/trademark notes. Not
  every Commons/Wikipedia image is unrestricted; article thumbnails are not a license.
- Preferred: public domain, CC0, CC BY, CC BY-SA (with exact attribution captured).
- Never scrape Google Images, IMDb, Instagram, fan wikis, or use AI-generated likenesses of real people.
- Copyrighted fictional characters stay text-only unless authorized imagery exists.
- Download validated files into `public/images/<category>/<id>.<ext>`; keep them
  reasonably small (≈ ≤ 800 px long edge, ≤ 150 KB). The app lazy-loads them only when
  "Show photo" is tapped, shows the credit + source link, and falls back to the name
  if the file fails to load.

## Acceptance for the content session

1. Zero duplicate IDs; zero empty or duplicate names.
2. `npm run content:validate` passes; `npm run check` (lint, typecheck, tests, build) passes.
   Note: `tests/loader.test.ts` caps fixtures at 5 per category only while `BANK_STATUS === 'demo'`.
3. `BANK_STATUS` set to `'production'`.
4. Meaningful volume per category chosen by gameplay needs; report final counts.
5. Spot-check random samples for ambiguity and correct category.
6. Every image renders with a readable name and visible attribution; list any licensing gaps.
7. Staged commits per category.
