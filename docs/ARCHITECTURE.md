# Guess Who — Architecture & Engineering Decisions

Version: 1.0 · 2026-11-08

## Decision summary
- **Vite + React + TypeScript**: smaller, simpler client-only runtime than a server framework for this use case.
- **CSS Modules or plain CSS with custom properties**: no heavy UI design system.
- **Static files on Vercel**: build outputs `dist/`; framework preset Vite; `npm run build`; no server environment variables.
- **Content**: typed JSON under `src/content/characters/*.json` with build-time schema validation.
- **State**: React state + small pure finite state machine, no Redux/Zustand needed.
- **Tests**: Vitest + React Testing Library; Playwright optional for end-to-end responsive smoke tests.
- **Asset policy**: optional vetted content images in `public/images/` with metadata. Prefer local assets, cacheable on CDN.

## Directory design
```text
guess-who/
├── public/
│   ├── manifest.webmanifest
│   ├── icons/
│   └── images/                 # only verified licensed assets
├── src/
│   ├── app/App.tsx
│   ├── components/CategoryPicker.tsx
│   ├── components/Countdown.tsx
│   ├── components/CharacterCard.tsx
│   ├── components/CustomWordForm.tsx
│   ├── components/WakeLockNotice.tsx
│   ├── content/categories.ts
│   ├── content/characters/*.json  # fixtures until separate content run
│   ├── content/schema.ts
│   ├── content/loader.ts
│   ├── game/stateMachine.ts
│   ├── game/shuffleBag.ts
│   ├── hooks/useScreenWakeLock.ts
│   ├── hooks/useCountdown.ts
│   ├── styles/global.css
│   └── main.tsx
├── scripts/validate-content.ts
├── tests/
├── README.md
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## State machine
```text
HOME ──select category──> READY
HOME ──custom──────────> CUSTOM_INPUT ──valid input──> READY
READY ──Start──────────> COUNTDOWN(5s)
COUNTDOWN ──complete─> REVEALED
COUNTDOWN ──cancel/background──> READY
REVEALED ──photo toggle──> REVEALED (photo/text display mode)
REVEALED ──Next────────> COUNTDOWN(5s)
REVEALED ──End─────────> HOME
REVEALED ──Category────> HOME
```

### State invariants
- There is no visible name while `phase === 'COUNTDOWN'`.
- `selectedCharacter` is immutable within `REVEALED` phase and is not reselected on React rerenders/device rotation.
- A new character is committed only on successful countdown completion; cancel must not consume one from the shuffle bag.
- Countdown is timed by monotonic clock and pauses/cancels safely when the tab is hidden.
- No API/network access needed for any game transition.

## Random selection
- `buildPool(category)` loads valid fixtures for category or de-duplicated union for Mix.
- Shuffle IDs with Fisher–Yates. For `Math.random`, adequate for casual game; do not pretend cryptographic randomness necessary.
- Maintain a per-pool shuffle bag and last revealed ID. On exhaustion reshuffle and avoid repeating previous ID first if pool length > 1.
- If user switches category, preserve each pool's bag state in memory for current session where practical; reset on full refresh is acceptable but optional sessionStorage can retain recent IDs.
- Preserve custom entry in memory for active round only; don't persist custom words, including sessionStorage.

## Screen awake: hook contract
```ts
type WakeLockStatus = 'unsupported'|'requesting'|'active'|'denied'|'released';
function useScreenWakeLock(enabled: boolean): {
  status: WakeLockStatus;
  requestFromGesture: () => Promise<void>;
  release: () => Promise<void>;
};
```
- Gesture request: invoke request when the player taps Start (as browsers may limit permission-dependent requests to user interaction); lifecycle hook follows active state afterward.
- On `visibilitychange` when visible and still in Countdown/Reveal, reacquire if needed; never reactivate after End/Unmount.
- Cleanup on unmount and when no longer playing. Handle `release` event and rejected promises without unhandled rejections. Prevent concurrent duplicated requests.
- Never fake wake lock via hidden video or other brittle hacks.
- For unsupported case provide a simple guidance notice only. OS may still sleep; app cannot guarantee otherwise.

## Fullscreen behavior
- Optional maximize icon uses `document.documentElement.requestFullscreen?.()` as enhancement **on explicit tap**; `document.fullscreenEnabled` may be false; hide or disable gracefully.
- iOS Safari can restrict fullscreen, so avoid required fullscreen, rely on edge-to-edge CSS and optional Add to Home Screen.
- Use 100dvh with 100vh fallback and `env(safe-area-inset-*)`.
- Do not attempt to lock screen orientation; support both natively.

## Image delivery
- Show Photo button only if `image` metadata valid. Lazy-load photo when toggled, render name even if image missing/broken.
- Image from `/images/<asset>` preferred; external HTTPS only when valid CORS/network/licensing and reliable hosts are confirmed.
- `loading="lazy"`, `object-fit: contain`, intrinsic sizes or aspect ratio to avoid layout shifts.
- Provide attribution link and license text when photo visible. Never assume broad publicity rights or blanket rights to fictional IP imagery.

## UI sizing strategy
- Game view: viewport-filling flex/grid; use CSS `clamp()` for title 2rem–7rem based on viewport and text length.
- Text must be legible at 320px and when landscape viewport height is ~320px. Adaptive controls can form compact horizontal row in landscape.
- Use `overflow-wrap: anywhere`, sensible `line-height`, preserve word meaning, avoid clipping.
- Large high-contrast central panel; minimize chrome and decorative elements.
- Buttons minimum 44px target; safe area padding.

## Quality & CI checks
```bash
npm install
npm run content:validate
npm run lint
npm run typecheck
npm test -- --run
npm run build
```
E2E manual or Playwright: 320×568, 390×844, 768×1024, 1024×768, 1280×800; rotation during character display; browser tab visibility; Wake Lock unsupported/rejection; missing photos; custom Unicode; empty category; double Start/Next taps.

## Deployment
1. Git repository committed with `README.md` and validated fixtures.
2. Import repository in Vercel. Set Framework Preset Vite, Build Command `npm run build`, Output Directory `dist`.
3. Each change deploys static assets via Vercel CDN and HTTPS; no DB, secrets, or serverless runtime required.
4. If SPA uses History API custom routes in future, add an explicit rewrite fallback; MVP single route requires none.
5. Verify production HTTPS Wake Lock on **real** iOS Safari and Android Chrome because desktop emulation is not sufficient.

## Decision notes
- No native apps: website serves iOS/Android/tablet/desktop with a single codebase.
- No real-time synchronization: each player independently operates a device.
- No photo APIs in browser: predictable availability, speed, privacy, licensing.
- No PWA offline promise for initial MVP. Can add installability and offline service worker after main gameplay passes manual tests.

## Technical research (official docs)
- MDN Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- MDN Fullscreen API: https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
- Browser fullscreen support (including iOS): https://caniuse.com/mdn-api_document_fullscreen
- Vercel Vite guide: https://vercel.com/docs/frameworks/frontend/vite
- Vite deployment guide: https://vite.dev/guide/static-deploy
- Wikimedia Commons reusing content: https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
