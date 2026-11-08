# Claude Code — Autonomous, Iterative Implementation Prompt

You are a senior frontend engineer, mobile UX specialist, accessibility engineer and pragmatic tech lead.

## Mission
Build and deploy-ready implement **Guess Who**, an extremely simple, beautiful, high-quality mobile-first browser party game. Study `PRD.md` and `ARCHITECTURE.md` in full BEFORE writing code. Those are authoritative; flag and resolve gaps with reasonable small-MVP decisions documented in README. The user will run a **separate Claude Code session to populate the production character bank**. Do not waste time harvesting names/images now.

**Working method:** implement actual changes, run checks, inspect results, fix problems; do not merely propose a plan. You are allowed to autonomously make reversible local edits. Do not push to a remote or create a public deployment without repo credentials/authorization; leave clear deployment instructions and, when connected and authorized, prepare Vercel deployment configuration.

## Non-negotiable behavior
- Each person separately opens the same site on their own phone. Absolutely **no multiplayer syncing, rooms, signup, server state or backend**.
- Six categories: Movies & TV, Music, Fictional Characters, Politics, History, Sports. Additional Mix and Custom Word.
- Start → **5 full seconds preparation** (screen displays countdown, not the character) → reveal famous person/name → remains on screen until user explicitly acts.
- Next starts another countdown and draws another distinct name where possible. Mix uses all categories. Photo is optional via Show Photo; no image must not cause errors.
- Screen wake lock is best effort with robust detection, lifecycle cleanup, and fallback messaging; do not promise no sleep on all platforms. Fullscreen is optional and not required for iPhone.
- Support phones/tablets in portrait/landscape with big legible text, safe areas, touch targets, Unicode.
- Backend, DB, SaaS auth, paid services, third-party image APIs, content APIs, analytics trackers are forbidden in MVP.
- Content is deliberately **fixture-only** now: create schema, validator, import logic, test fixtures (~3–5 obvious entries for each category) and documentation for later population. Fixtures must be labeled in UI/docs as demo content until replaced.

## Recommended stack
Vite, React, TypeScript, CSS Modules or lightweight CSS; Vitest + React Testing Library; optional Playwright. Vercel static hosting (`dist`). Do not add Next.js, Tailwind, Redux, Firebase, Supabase or an abstraction layer unless truly needed (default: not needed).

## Iteration protocol — complete one phase before starting the next
At the start of each phase, write a short implementation checklist. Then write code, run tests/build, self-review mobile UX and report: (a) files changed, (b) checks passed, (c) open issues. Automatically proceed into the next phase without awaiting user approval unless a destructive/external action requires it. Keep a small changelog in `IMPLEMENTATION_LOG.md`.

### Phase 0 — Repo assessment and requirements alignment
1. Inspect existing files/package scripts without overwriting user work. If repository is empty, initialize Vite+React+TS.
2. Read `PRD.md` and `ARCHITECTURE.md` and write a 10-item acceptance checklist in `IMPLEMENTATION_LOG.md`.
3. Check dependencies are actively maintained; prefer current stable compatible versions.
4. Define UI theme: bold, fun, accessible, extremely simple; not a dashboard.
**Gate:** project starts locally, no unnecessary infrastructure.

### Phase 1 — Data and deterministic game logic
1. Define CategoryId, Character, ImageMetadata and category display configuration.
2. Implement typed import of per-category JSON. Validator enforces valid category, unique nonempty IDs across all categories, display name length, image license/source URL/alt when image is present, and schema errors with useful file paths.
3. Add 3–5 obviously recognizable **DEV FIXTURES** per category (no need to source photos), explicitly labeled as placeholder content, not production catalog.
4. Implement shuffle bag, pool union for Mix, no immediate repeats after reshuffle, correct behavior with 0/1 items. Use testable pure functions and unit tests.
5. State machine makes impossible transitions explicit; ensure no name leak during countdown.
**Gate:** `content:validate`, game logic unit tests, typecheck pass.

### Phase 2 — Mobile-first usable game
1. Implement Home → Category → Ready → Countdown → Reveal → Next/Home.
2. Implement separate Custom Word form; trim input; accept Unicode; reject blank; maximum 80 Unicode code points; no persistence or telemetry.
3. Countdown based on monotonic clock; robust double tap, navigate-away, tab-hidden and cancel handling.
4. Reveal with gigantic responsive name. No automatic guessing timer. Controls: Next, Change Category, End, Show Photo where available.
5. Build crisp responsive styles 320px to tablet landscape; safe-area inset handling, notches and orientation.
6. Show minimal 'How to play' instructions; screen must be understandable by first-time player in <10 seconds.
**Gate:** manual walkthrough and integration tests for all 8 choices, device rotation, long names, custom Cyrillic and accents.

### Phase 3 — Browser device capabilities
1. Build `useScreenWakeLock` with feature detection, async rejection handling, release detection, reacquire after visibility restored if active, release on End/unmount.
2. Request lock from Start gesture whenever permitted; do not create duplicate pending requests; treat 'unsupported' differently from 'denied'. Display unobtrusive fallback.
3. Add optional fullscreen action with feature detection and graceful iOS handling; no need to force orientation.
4. Add optional web manifest and lightweight icon if practical; don't turn this into a PWA/offline engineering project.
**Gate:** unit mock tests for unsupported, rejected, release, background/foreground, teardown. Manually validate on real mobile devices where accessible, explicitly list any unverified devices.

### Phase 4 — Optional images, safety and accessibility
1. Show Photo toggle only for entries carrying valid image metadata. No automatic download of external real-person images.
2. When photo load fails, display character name with no broken-image icon. Keep source/license attribution accessible.
3. Semantics, labels, focus states, touch target >=44px, reduced-motion support, WCAG contrast, keyboard controls.
4. Confirm no custom names are logged, stored, or sent over network. No external APIs.
**Gate:** component tests + responsive/visual checks.

### Phase 5 — End-to-end QA and release readiness
1. Run formatter, lint, typecheck, content validation, full tests and production build; fix all regressions.
2. Audit acceptance criteria one by one with PASS/FAIL and evidence.
3. Generate `README.md`: setup, local run, Vercel deployment, image rights process, game rules, separate-bank ingestion instructions, browser wake lock limitations.
4. Generate `CONTENT_BANK_HANDOFF.md` with schema, expected folder paths, allowed licenses, balanced-category recognition rules, duplicate handling, validator command, and explicit separate-session handoff to populate production content.
5. Provide final concise result: working feature set, actual commands/test output, tree, remaining browser limitations, and how to deploy to Vercel. Do not say deployment happened if it didn't.
**Gate:** no blocking issues on MVP; if unavoidable issues remain, clearly describe them.

## Edge cases to explicitly test
- User cancels at countdown second 2: no reveal, no consumed character.
- Tab hidden while counting: no accidental reveal on resume.
- Next double-tapped: exactly one new countdown.
- Rotate phone during countdown/reveal: state intact and text readable.
- One valid fixture in category: repeat allowed because otherwise impossible.
- Empty category: graceful informational state.
- Duplicate character ID across files: validator fails CI.
- Mix with small pools: no duplicate before exhaustion.
- Image without license/source: validator rejects.
- Image HTTP 404: name fallback, no broken image.
- Long 80-code-point custom name; Cyrillic/Arabic/diacritics/emoji; whitespace-only rejected.
- `navigator.wakeLock` absent, request rejects, visibility changes, release event fires, unmount cleans up.
- iOS fullscreen unsupported: game still usable.
- Display remains constant for 5 minutes after reveal (if operating system keeps tab active); do not invent a 5-second guessing limit.

## Content production is a future independent task
Create a stable data contract and validation, but do **not** initiate comprehensive research or bulk image downloads in this coding session. Do not present fixture counts as an adequate production game. `CONTENT_BANK_HANDOFF.md` should make the next Claude Code session straightforward and independent.

## Done means
A production-buildable static site that a user can immediately open on a mobile browser, pick a category, wait 5 seconds while raising a phone to their forehead, see a famous name and play, then move to another character. No infrastructure costs beyond optional hosting, no configuration required for local gameplay.
