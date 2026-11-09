# Character bank — production

**Generated files — do not edit by hand.** The source of truth is the curated lists in
`/content-source/<category>.txt` (200+ names per category). To change the bank:

1. Edit a list: one entry per line, `*Name` = iconic tier, optional `@Wikipedia title`
   to point the photo lookup at the right article.
2. `npm run content:images` — finds a photo on Wikimedia for new entries: the Wikipedia
   lead image (public domain / CC0 / CC BY / CC BY-SA on Commons) or, if there is none,
   the infobox image (fictional characters' artwork is a fair-use file on English
   Wikipedia). A hand-picked file in `content-source/image-overrides.json` (id → file
   name) wins over both; use it when the automatic photo is hard to recognise. Gaps are
   listed in `content-source/images-report.txt`; results are cached in
   `content-source/images.json`.
3. `npm run content:build` — regenerates these JSON files (existing ids are preserved).
4. `npm run check` — validator + bank quality tests (`tests/bank.test.ts`).

Each file is a JSON array of `Character` objects (`src/content/schema.ts`).
