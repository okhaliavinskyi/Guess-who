# Implementation Log

Source of truth: `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/CLAUDE_CODE_IMPLEMENTATION_PROMPT.md`.

## Acceptance checklist (Phase 0)

1. Six categories + Mix + Custom on one home screen; ≤ 2 taps to start.
2. Start → full 5 s countdown with **no name in the DOM** → reveal.
3. Revealed name stays indefinitely (no timer) until Next / Category / End.
4. Next → new countdown, distinct name until the shuffle bag is exhausted; no back-to-back repeat.
5. Mix = de-duplicated union, uniform per character.
6. Custom word: trimmed, Unicode, ≤ 80 code points, blank rejected, never stored/sent.
7. Countdown on a monotonic clock; cancel/background → READY with nothing consumed or revealed.
8. Best-effort wake lock with fallback notice; optional fullscreen; works without both.
9. Photos optional, licensed metadata required, broken images fall back to the name.
10. Responsive 320 px → desktop, portrait + landscape, safe areas, 44 px targets, keyboard, reduced motion.
11. Content validator fails CI on bad/empty/duplicate content; runtime shows empty state instead of crashing.
12. Static Vercel build; no backend, trackers or runtime APIs; fixtures labelled as demo.

## Phase 0 — Repo assessment

- Repo was empty (no commits). Initialized Vite 8 + React 19 + TypeScript 6.0 by hand.
- Dependencies are current stable releases (Nov 2026). TypeScript pinned to `~6.0`
  because `typescript-eslint` 8.x supports `<6.1`; TS 7 (native) not yet supported by it.
- `npm audit`: one moderate advisory (`minimatch` ReDoS) in **dev-only** ESLint tooling;
  the only "fix" downgrades ESLint a major. Not shipped to users; revisit on next ESLint release.
- Theme: dark indigo home with bold category-coloured tiles; reveal = full-bleed category
  colour with near-black text (≥ 7:1 contrast); system font stack (no font download).
- Gate: ✅ `npm run dev` / `npm run build` work, no infrastructure added.

## Phase 1 — Data and game logic

Files: `src/content/{categories,schema,loader,image,bankStatus}.ts`,
`src/content/characters/*.json`, `scripts/validate-content.ts`,
`src/game/{shuffleBag,stateMachine,customWord,sessionBags}.ts`, tests.

- Validator enforces schema, unknown fields, category/file match, slug ids, **global id
  uniqueness**, duplicate display names (accent/case-insensitive), name length, image
  license/source/alt/src, missing or empty category files; errors cite `file [index].field`.
- 29 demo fixtures (4–5 per category), no images; `BANK_STATUS = 'demo'`.
- Shuffle bag: Fisher–Yates, reshuffle on exhaustion, swap to avoid a repeat across the
  boundary, handles 0/1 items and pool changes. Pure, injected RNG.
- State machine: pure reducer; invalid events return the same object; draw happens only
  on `COMPLETE` with a matching round id (stale/double events ignored).
- Gate: ✅ `content:validate`, logic tests, typecheck.

## Phase 2 — Mobile-first game

Files: `src/app/App.tsx`, `src/components/*`, `src/hooks/{useCountdown,useFitText}.ts`,
`src/styles/global.css`, `src/i18n/strings.ts`, `index.html`.

- Home → Ready → Countdown → Reveal → Next/Home; Custom form; Unavailable screen.
- Countdown: `performance.now()`-based, wakes at each second boundary, shows 5→1 and
  reveals at 5.000 s (no "0"); `visibilitychange`/`pagehide` → INTERRUPT.
- Name auto-fits its box (binary search + ResizeObserver, re-fits on rotation); words
  only break mid-word when a single word cannot fit at the minimum size.
- Landscape phones: compact chrome, overlayed top bar; ≤ 359 px: controls wrap with Next on top.
- Gate: ✅ integration tests for all 8 choices, rotation/resize, long names, Cyrillic,
  Arabic, accents, emoji; Playwright screenshots at 320×568, 390×844, 844×390, 768×1024,
  1280×800 with no console errors and no horizontal overflow.

## Phase 3 — Device capabilities

Files: `src/hooks/useScreenWakeLock.ts`, `src/hooks/useFullscreen.ts`,
`src/components/{WakeLockNotice,FullscreenButton}.tsx`, `public/manifest.webmanifest`, icons.

- Wake lock requested from the Start/Next/custom-Start tap; coalesced requests; statuses
  `unsupported | requesting | active | denied | released`; re-acquire on visible while
  playing; released on End/Category/unmount; late-resolving lock released if play ended.
- Fullscreen button only when `document.fullscreenEnabled`; never required.
- Manifest + SVG/PNG icons (installable); no service worker (out of MVP scope).
- Gate: ✅ mocked tests for unsupported, rejected (no unhandled rejection), release event,
  hidden/visible re-acquire, no re-acquire after End, unmount cleanup.
  ⚠ Not verified on real iOS/Android hardware (none available in this environment).

## Phase 4 — Images, safety, accessibility

- "Show photo" rendered only when image metadata is complete and valid; photo is lazy
  (not in the DOM until toggled), name kept in a banner, credit + source link shown.
- `onError` → photo removed, button hidden, "Photo unavailable" status, name stays.
- Semantics: one `h1` per screen, focus moved to each screen heading, `aria-live` used once
  per countdown (digits are `aria-hidden`), labelled inputs, `role=alert` errors,
  visible focus ring, `prefers-reduced-motion` and `forced-colors` support.
- All buttons ≥ 44×44 px (verified in Chromium). Custom words: not in storage, URL or
  network (tested in jsdom and Chromium); zero external requests after load.
- Gate: ✅ component tests + visual checks.

## Phase 5 — QA and release readiness

- `npm run check` = content:validate → lint → typecheck → 99 tests → build: all pass.
- Prettier clean. A GitHub Actions workflow running the same steps is provided as
  `docs/ci-workflow.yml` (the session's GitHub token cannot push workflow files; copy it to
  `.github/workflows/ci.yml` to enable CI).
- Build: ~248 kB JS (78 kB gzip), 9 kB CSS.
- Docs: `README.md`, `CONTENT_BANK_HANDOFF.md`, this log. `vercel.json` added.

### Acceptance criteria audit (PRD §11)

| #   | Criterion                                                 | Result                          | Evidence                                                                                                     |
| --- | --------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Movies + Start → 5 s countdown, then one Movies character | PASS                            | `App.test.tsx` "category play" (all 7 pools; DOM scanned for every bank name each second); Chromium smoke    |
| 2   | Name persists for minutes; notice when lock unavailable   | PASS (wake lock itself: mocked) | "keeps the same character indefinitely" (5 min fake time); wake-lock notice tests; real-device check pending |
| 3   | Next → new countdown, distinct until exhausted            | PASS                            | "Next shows distinct characters…" + `stateMachine.test.ts`                                                   |
| 4   | Mix from all categories, no duplicate before exhaustion   | PASS                            | "Mix with small pools…", state machine Mix test                                                              |
| 5   | Custom 'Капитан Немо' shown trimmed, not saved/sent       | PASS                            | custom word tests (storage spy, fetch spy, URL); Chromium smoke                                              |
| 6   | Image-less → no broken image offered                      | PASS                            | "image-less characters never offer Show photo"                                                               |
| 7   | Broken image → name visible, layout intact                | PASS                            | "a broken image (404) falls back…"                                                                           |
| 8   | Rotation during reveal keeps state                        | PASS                            | resize/orientationchange test; Chromium 390×844 → 844×390 same name                                          |
| 9   | Backgrounding during countdown → no exposure/skip         | PASS                            | "backgrounding during the countdown cancels it" + bag unchanged on cancel                                    |
| 10  | Works without fullscreen (iPhone Safari)                  | PASS                            | fullscreen button hidden when API absent; game flow test without it                                          |
| 11  | Empty production file → CI fails or safe empty state      | PASS                            | `validateScript.test.ts` (exit 1), "empty category … unavailable", "completely empty bank does not crash"    |

### Edge cases from the prompt

Cancel at second 2 ✅ · tab hidden ✅ · double Next ✅ · rotation ✅ · one-item category
repeats ✅ · empty category ✅ · duplicate id across files fails ✅ · Mix small pools ✅ ·
image without license/source rejected ✅ · image 404 ✅ · 80 code points / Cyrillic /
Arabic / diacritics / emoji / whitespace-only ✅ · wakeLock absent / rejects / visibility /
release event / unmount ✅ · fullscreen unsupported ✅ · 5-minute display ✅.

## Decisions (gaps resolved for a small MVP)

- **Custom Start goes straight to the countdown** (PRD §4B "Start button triggers same
  countdown"), skipping READY. Cancel/background from a custom countdown returns to a
  READY screen that doesn't show the word.
- **Custom "Next" is "New word"**: there is no bank, so it reopens the empty form.
- Added an **UNAVAILABLE** phase for empty pools (PRD §6) — not in the architecture diagram.
- **Show photo is hidden** (not disabled) when an entry has no usable image: a disabled
  fourth button truncated labels on 360–390 px phones. A failed load shows "Photo unavailable".
- **End vs Category**: both return home; End also exits fullscreen.
- Each pool (6 categories + Mix) has its own bag; Mix may show a name recently seen in a
  single category. Bags (ids only) persist in `sessionStorage`.
- Hold-to-confirm Next (600 ms) not implemented — optional in PRD; revisit after playtests.
- No service worker/offline caching (nice-to-have); after load the game needs no network anyway.
- UI copy English-only in `src/i18n/strings.ts`; names use `localeNames[navigator.language]` when present.

## Open issues / not verified

- Wake lock, fullscreen, safe areas and Add-to-Home-Screen not verified on real iOS Safari
  or Android Chrome hardware — must be checked on the HTTPS Vercel deployment.
- Photo layout verified only in jsdom tests (no licensed images exist yet); check visually
  once the content session adds images.
- Content: production bank since 2026-11-08 (see "Production content & features" below).
- Dev-only `npm audit` moderate advisory (see Phase 0).
- CI workflow not active yet: copy `docs/ci-workflow.yml` to `.github/workflows/ci.yml`.

## Deployment (2026-11-08)

- Deployed to Vercel production with the Vercel CLI: https://guess-who-jade-mu.vercel.app
  (project `guess-who`, preset Vite, `npm run build`, output `dist`).
- Deployment protection set to Standard (`prod_deployment_urls_and_all_previews`): the
  production domain is public, per-deployment and preview URLs require Vercel login.
- Verified live in Chromium (390×844): full Music round, Next, no console errors;
  security headers from `vercel.json` present; manifest and icons served.
- Git auto-deploy: connected (2026-11-08). Every push to `ccr-e90e4d2a-a0sxbh`
  deploys to production; other branches get preview deployments.

## Production content & features (2026-11-08)

- Bank: 1,439 curated names (200+ per category) in `content-source/*.txt`, built by
  `npm run content:build`; `BANK_STATUS = 'production'`.
- Photos: 1,267 Wikimedia Commons files, license-checked per file (PD, CC0, CC BY,
  CC BY-SA, OGL/KOGL/GODL), hotlinked thumbnails with credit + source link
  (`npm run content:images`; gaps in `content-source/images-report.txt`).
- Names in Russian (1,370) and Ukrainian (1,321) from Wikipedia interlanguage links
  plus manual fixes (`npm run content:locales`, `content-source/locale-overrides.json`).
- UI in EN / RU / UA with a switcher; choice remembered, browser language by default.
- Session shadow ban: names already revealed are skipped in every pool until it runs out.
- Reveal: tap switches name ↔ photo; swipe ← next, → previous (both via countdown);
  arrow keys too.
- Screen lock while a name is shown → name hidden, re-revealed after a countdown.
- Landscape-first: fullscreen + orientation lock on Start where supported; rotate hint.
- Tests: 154 (bank quality, i18n coverage of every screen, swipes, lock/resume).

## Production deploy (2026-11-08, evening)

- Deployed with the Vercel CLI (device-login, no token stored in the repo):
  https://guesswhogame.vercel.app (alias of project `guess-who`).
- Verified live (Playwright, iPhone 13 / Pixel 7 landscape, iPhone 13 portrait; EN/RU/UA):
  page title and `lang` per language, no demo label, 236 names in Movies & TV, Next and
  back (←) return the right names, a live Wikimedia photo loads with its credit, no
  console errors. Longest names in every language fit on an iPhone SE in landscape.
- README rewritten with screenshots from the live site (`docs/screenshots/`).

## Round 3 (2026-11-08, night)

- Countdown shortened to 3 s everywhere (start, next/previous, after unlock).
- Less text: icon-only End/Menu/Photo buttons, no hint line, short notices.
- Fullscreen = immersive: only the card (tap/swipe) and an exit-fullscreen button.
- Bank reviewed for global recognisability: regional stars removed (Bollywood,
  cricket, national pop/TV, regional politicians and writers). 949 names (104–214 per
  category), 797 photos, ru 885 / uk 860 names. Tests: 100+ per category, guard list.
- Git auto-deploy verified: merging into `ccr-e90e4d2a-a0sxbh` deploys production.
