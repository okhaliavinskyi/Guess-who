# Guess Who

A zero-friction party guessing game for phones and tablets. Each player opens the
site on their own device, picks a category, taps **Start**, and has **5 seconds** to
raise the phone to their forehead (screen facing friends). Then a famous person or
character appears and **stays on screen until someone taps Next** — no guessing
timer. Ask yes/no questions until you get it.

- Static site: Vite + React + TypeScript. No backend, accounts, database, analytics,
  external APIs or runtime network calls.
- Categories: Movies & TV, Music, Fictional Characters, Politics, History, Sports,
  plus **Mix** (all six) and **Custom word**.
- ⚠ **The character bank is DEMO FIXTURES only** (4–5 names per category). The UI says
  "Demo content" until the production bank is added — see
  [`CONTENT_BANK_HANDOFF.md`](CONTENT_BANK_HANDOFF.md).

Specs: [`docs/PRD.md`](docs/PRD.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Build log and acceptance audit: [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md).

## How to play

1. Everyone opens the site on their own phone and agrees on a category (devices are not linked).
2. Tap the category, then **Start**. A 5→1 countdown shows — no name yet.
3. Put the phone on your forehead, screen out. Friends see the name.
4. Ask yes/no questions. Take as long as you like.
5. **Next** starts a new countdown with a different name. **Category** / **End** go back home.

**Custom word:** a friend types any name or word (any script or emoji, up to 80
characters) and taps Start; it appears only after the same countdown. It is kept in
memory only — never stored, put in the URL, or sent anywhere.

## Local development

Requires Node.js ≥ 20.19 (CI uses 22).

```bash
npm install
npm run dev          # http://localhost:5173 (use --host to open on a phone on the same Wi-Fi)
```

| Command                           | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run content:validate`        | Validate `src/content/characters/*.json` (fails on any error) |
| `npm run lint`                    | ESLint                                                        |
| `npm run typecheck`               | TypeScript project check (app, tests, scripts)                |
| `npm test -- --run`               | Vitest unit + component/integration tests                     |
| `npm run build`                   | Validate content, typecheck, build static site to `dist/`     |
| `npm run preview`                 | Serve the production build locally                            |
| `npm run check`                   | Everything above in sequence                                  |
| `npm run format` / `format:check` | Prettier                                                      |

Note: Wake Lock requires a secure context. `localhost` counts; a LAN IP over plain
HTTP does not, so test wake lock on the HTTPS Vercel deployment.

## Deploy to Vercel

The repo includes `vercel.json` (framework `vite`, `npm ci`, `npm run build`, output
`dist`, long-cache headers for hashed assets, and a `Permissions-Policy` that allows
only wake lock and fullscreen). No environment variables or secrets are needed.

1. Push the repository to GitHub.
2. In Vercel: **Add New… → Project → Import** the repository.
3. Framework preset **Vite** (auto-detected; settings come from `vercel.json`):
   build command `npm run build`, output directory `dist`.
4. Deploy. Every push redeploys; pull requests get preview URLs.

Or from a terminal: `npx vercel` (preview) then `npx vercel --prod`.

The app is a single route, so no SPA rewrite is required. If client-side routes are
added later, add a rewrite to `/index.html`.

After deploying, verify on **real devices over HTTPS** (desktop emulation is not
sufficient): iPhone Safari and Android Chrome, portrait + landscape, leave a name on
screen for several minutes.

## Screen wake lock & fullscreen — limitations

- The app requests the [Screen Wake Lock](https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API)
  when you tap Start/Next, holds it during the countdown and while a name is shown,
  re-acquires it when the tab becomes visible again, and releases it on End/Category.
- It is **best effort**. Browsers may refuse or revoke it (unsupported browser, low-power
  mode, policy, non-HTTPS). Then a subtle notice says: _"Your device may lock its screen.
  Increase Auto-Lock time in device settings."_ The app cannot override the power button,
  OS policy or a dead battery, and uses no hidden-video hacks.
- Supported broadly in current Chrome/Edge/Android and Safari 16.4+ (iOS 16.4+);
  older iOS versions and some in-app browsers show the notice.
- **Fullscreen** is an optional button shown only where the Fullscreen API is enabled.
  iPhone Safari does not offer it; the game is designed to work in the normal browser
  viewport (edge-to-edge with safe-area insets). "Add to Home Screen" gives a
  standalone window via the web manifest but does not bypass auto-lock policy.
- If the tab is hidden during the countdown, the countdown is cancelled (nothing is
  revealed or skipped); tap Start again.

## Content bank

- Characters: `src/content/characters/<category>.json`, typed by `src/content/schema.ts`.
- Validation: `scripts/validate-content.ts` — runs before every build and in CI.
- Demo/production flag: `src/content/bankStatus.ts`.
- To populate the production bank, run a separate session using
  [`CONTENT_BANK_HANDOFF.md`](CONTENT_BANK_HANDOFF.md). No code changes are needed.

### Image rights process

Photos are optional; text always works on its own.

1. Find a candidate on a source with explicit reuse terms (e.g. a Wikimedia Commons
   **file page**). Do not use Google Images, IMDb, Instagram, fan wikis, or Wikipedia
   article thumbnails as a license.
2. Read that page's exact license, attribution requirements and any personality/trademark
   restrictions. Prefer public domain / CC0 / CC BY / CC BY-SA.
3. Download into `public/images/<category>/<id>.<ext>` (small, web-optimized).
4. Fill `image.src`, `alt`, `license`, `sourceUrl`, and `creator`/`attribution` as required.
5. `npm run content:validate`. The app shows **Show photo** only for entries with complete
   metadata, lazy-loads the photo on tap, always keeps the name in a banner, displays the
   credit and a source link, and falls back to the name if the image fails to load.

Copyrighted fictional characters stay text-only unless properly licensed imagery exists.
No images are fetched or generated at runtime.

## Privacy

No cookies, analytics, trackers, accounts or network calls after load. The only stored
data is the shuffle order of bank ids in `sessionStorage` (cleared when the tab closes)
so an accidental reload doesn't immediately repeat names. Custom words are never stored.

## Project layout

```text
src/
  app/App.tsx                 screen routing + wiring of state machine, wake lock, countdown
  components/                 CategoryPicker, ReadyScreen, CustomWordForm, Countdown,
                              RevealScreen, CharacterCard, WakeLockNotice, FullscreenButton, …
  content/categories.ts       category config (labels, colours, order)
  content/schema.ts           Character types + validation rules (shared with the CLI)
  content/loader.ts           bundles JSON via import.meta.glob, drops invalid entries, pools
  content/characters/*.json   DEMO FIXTURES
  game/stateMachine.ts        pure reducer: HOME → READY → COUNTDOWN → REVEALED …
  game/shuffleBag.ts          Fisher–Yates shuffle bag, no back-to-back repeats
  game/customWord.ts          trim / 80 code point validation
  game/sessionBags.ts         optional sessionStorage of bag state (ids only)
  hooks/                      useCountdown, useScreenWakeLock, useFullscreen, useFitText
  i18n/strings.ts             UI copy (English; ready for more locales)
  styles/global.css           mobile-first styles, safe areas, dvh, landscape, reduced motion
scripts/validate-content.ts   content validator CLI
tests/                        Vitest + Testing Library
public/                       manifest, icons, images/ (licensed assets only)
```

## Product decisions beyond the spec

See "Decisions" in [`IMPLEMENTATION_LOG.md`](IMPLEMENTATION_LOG.md).
