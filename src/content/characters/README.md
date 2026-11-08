# Character bank — production

**Generated files — do not edit by hand.** The source of truth is the curated lists in
`/content-source/<category>.txt` (200+ names per category). To change the bank:

1. Edit a list: one entry per line, `*Name` = iconic tier, optional `@Wikipedia title`
   to point the photo lookup at the right article.
2. `npm run content:images` — finds a freely licensed photo on Wikimedia Commons for new
   entries (public domain / CC0 / CC BY / CC BY-SA only; non-free and missing images are
   listed in `content-source/images-report.txt`). Cached in `content-source/images.json`.
3. `npm run content:build` — regenerates these JSON files (existing ids are preserved).
4. `npm run check` — validator + bank quality tests (`tests/bank.test.ts`).

Each file is a JSON array of `Character` objects (`src/content/schema.ts`).
