# Guess Who — Product Requirements Document

Version: 1.0 · 2026-11-08 · Status: Implementation-ready MVP specification

## 1. Product vision
A zero-friction party game playable on each participant's own phone/tablet, launched by URL. One player holds the screen outward against their forehead, asks yes/no questions, and guesses the famous person or fictional character displayed to everyone else. No accounts, multiplayer networking, rooms, microphone, camera, or account storage.

**North star:** from landing page to visible character in <= 2 taps plus 5 seconds of preparation.

## 2. Players and game contract
- 2+ people in the same physical room. Each player may independently open the site on a different device; the app does NOT coordinate their screens. Players verbally agree on a category.
- The device holder does not look at the word. Others answer yes/no, optionally provide hints by house rules. No built-in game clock or scoring in MVP.
- A 5-second preparation countdown runs BEFORE the character is revealed, giving the holder time to put the phone on their forehead. Do not display the selected character until the countdown ends.
- After the countdown, the revealed character remains visible **indefinitely**, until a deliberate user action. Never automatically replace it.
- Tapping 'Next' starts a new 5-second countdown with a new character; do not accidentally expose the next character during the countdown.
- The app is a web app deployed on Vercel, optimized first for phones and tablets in portrait AND landscape, then desktop.

## 3. MVP categories
1. Movies & TV — widely known live-action actors and notable figures; fictional film/TV characters belong in Fictional Characters instead (avoid overlap).
2. Music — globally recognized singers, bands' front persons, major artists.
3. Fictional Characters — iconic characters from animation, films, books, comics and games (canonical fictional identity, not the actor).
4. Politics — universally recognizable political leaders, current or historical; factual and neutral naming.
5. History — extremely well-known historical figures and cultural/scientific figures, excluding political leaders if assigned to Politics.
6. Sports — globally famous athletes across major sports.
7. Mix — random draw across all six banks, not a separate duplicated bank.
8. Custom — user types their own name/word, no catalog required; this value is intentionally displayed only after the same 5-second countdown.

Categories are fixed for MVP but configuration-driven in code. Mixed category selection should sample uniformly across **characters**, not merely uniformly across category IDs, unless product explicitly changes this later.

## 4. Screens and interactions
### A. Home / Category selection
- Brand title and one-line instruction: 'Choose a category. Place your phone on your forehead after tapping Start.'
- Six prominent category tiles, a prominent Mix tile, and Custom Word option.
- Device-local language default determined from browser, but UI may initially be English-only; data model must support future localization. Avoid complex translation framework for initial build.
- Visible 'How to play' disclosure (no modal required). Minimal controls; no login, ads, home-page feed.

### B. Custom Word input
- Simple accessible text field; accept Unicode, accents, Cyrillic and emoji; trim leading/trailing whitespace; max 80 Unicode code points; reject empty/whitespace-only.
- Start button triggers same countdown. Custom value is session-only: no server, analytics payload, or URL query storage; clearing the session clears it.
- Avoid showing the entered word again during countdown or in elements visible from the front while player is lifting the device. After Start, immediately hide the input, including browser autocomplete artifacts where practical.

### C. Countdown / preparation
- Full-viewport immersive background; central 5→4→3→2→1, then reveal. Avoid '0' lingering for a whole second.
- Show generic instruction only: 'Raise your phone — screen facing your friends.'
- Simple progress indicator, Back/Cancel control. No character name in DOM during countdown if possible; choose at reveal or keep unrevealed choice only in JS memory without rendering.
- Timer based on wall-clock/performance elapsed time (monotonic `performance.now`) rather than counting setInterval ticks to avoid drift. If tab backgrounds, pause/cancel countdown and safely return to ready state (no unintended reveal on foreground).

### D. Character display
- One ultra-large responsive name (line wrapping, shrinking gracefully for long names and landscape layout). Accessible visual contrast; readable at arm's length/room distance.
- Optional 'Show photo' button — hidden/disabled with an informative message when no usable photo is supplied. Photo uses locally referenced licensed image or validated URL with attribution requirements, never scraped on the fly.
- 'Next', 'Change category', and 'End game' controls visually secondary to character; show photo toggles back to text if requested.
- Character persists until Next/End/Change category, including if user rotates device. No gestures required; avoid swipe/tilt controls and motion permissions.
- Protect against unintended touches while pressed to forehead: require intentional button use; large tap targets, buttons away from center, and optionally a 600ms hold for Next (not mandatory for MVP, test usability first).

## 5. Wake lock and immersive display
- Attempt `navigator.wakeLock.request('screen')` after the Start user gesture; keep it during countdown and active character display. Maintain sentinel in a hook/service, release on exit, reacquire on `visibilitychange` only when visible and play is active.
- Wake Lock is best-effort. When unsupported/rejected/revoked, show a subtle but clear message: 'Your device may lock its screen. Increase Auto-Lock time in device settings.' Do NOT claim guaranteed prevention.
- `requestFullscreen()` is an enhancement only, invoked from explicit user interaction when supported. Never require fullscreen to play; iPhone Safari support may be partial/restricted.
- Add `viewport-fit=cover`, safe-area insets, `100dvh` with fallback, installable web manifest if inexpensive. Do not assume standalone PWA installation bypasses browser policy.
- During active game, prevent app-induced sleep; cannot override physical power button, system policy or exhausted battery.

## 6. Randomization and repetition
- Candidate IDs are unique, immutable across content refreshes.
- Build category-specific shuffle bag (Fisher–Yates), consume in random order, reshuffle only when exhausted; avoid immediate repeat across bag boundaries. Persist recent IDs within current tab session with `sessionStorage` (optional, but prefer to protect accidental navigation); never require backend.
- If content bank is empty or a selected category has no valid entries, show a clear unavailable state and let user return. Do NOT invent new names or silently pull arbitrary results from an API.
- Mix draws from union of valid characters; de-duplicate by stable ID; no duplicate IDs across categories. Custom word is not part of random bank.

## 7. Content bank — separate task
This project phase creates only the **schema, loader, data-validation script, and 3–5 clearly labeled DEV FIXTURES per relevant category**, not production content. A separate Claude Code content-fill session will populate the full bank.

Character shape:
```ts
type CategoryId = 'movies-tv' | 'music' | 'fictional' | 'politics' | 'history' | 'sports';
type Character = {
  id: string;                 // stable globally unique slug
  category: CategoryId;       // exactly one primary category
  displayName: string;        // text shown on screen
  aliases?: string[];         // content QA only, not shown
  localeNames?: Record<string,string>; // future translations
  popularityTier: 'iconic' | 'widely-known';
  image?: {
    src: string;             // approved /public asset path (preferred), or vetted HTTPS URL
    alt: string;
    creator?: string;
    license: string;         // e.g. CC BY-SA 4.0, CC0, public domain
    sourceUrl: string;       // attributable original source
    attribution?: string;
  };
};
```

Content acceptance for separate phase: broad international recognition, clear and distinctive character names, family-friendly, culturally varied, no niche selections, no speculative factual labels, no duplicates or ambiguous names (e.g. 'Michael Jordan' clear; a single common first name not clear). Define target content volume later based on testing; never claim current placeholders are production-complete.

## 8. Image policy
- Text works independently of photographs. Photo is optional enhancement, not a blocking requirement.
- Source media from licenses permitting the intended public web use (e.g. eligible Wikimedia Commons assets) and retain attribution and license metadata. **Not every image on Wikipedia/Wikimedia Commons is unrestricted**; verify each asset's exact page and terms.
- Do not hotlink random images from Google Images, IMDb, Instagram, Wikipedia article thumbnails without verifying reuse terms. No automated image fetching at runtime or AI image generation for real people's likenesses in this task.
- An attribution link/credit must remain accessible with image view; use descriptive alt text and graceful broken-image fallback to name display.
- Photos of fictional commercial characters may have third-party copyright restrictions; allow image-less cards until appropriately licensed material is available.

## 9. Responsive UX and accessibility
- Support viewport widths 320px–1440px+, portrait/landscape, zoom to 200%, safe areas around display notches, large and small tablets.
- Minimum touch targets 44×44 CSS px; supports touchscreen, mouse, keyboard and reduced-motion setting.
- High contrast and readable typography; avoid photo-only clues. Character name must remain legible with a photo present (dedicated name banner or switchable photo mode).
- Use `aria-live` carefully for countdown; don't announce every animation tick repeatedly to screen readers. Semantic headings/buttons/labels, keyboard Enter/Space, visible focus.
- International text including non-Latin scripts must wrap without clipping.
- No blocking audio; optional haptic/sound deliberately out of MVP.

## 10. Nonfunctional requirements
- Static frontend only, fast initial load on normal mobile network; no auth/database/serverless functions/remote runtime content APIs.
- Can continue a session after initial successful load without constant internet connectivity. Optional service-worker offline caching is a nice-to-have; do not hold MVP hostage to it.
- Do not collect personal data, send entered custom words to server, or add marketing trackers.
- Unit tests for randomization, validation, countdown state, and wake-lock behavior; basic component/integration tests; run build/lint/typecheck.

## 11. Acceptance criteria (Given / When / Then)
1. Given home screen, when selecting Movies and tapping Start, then 5 sec preparation counts down and only afterward is one Movies character visible.
2. Given a displayed character, when nobody touches device for several minutes, then app continues showing the same name while browser/system permits wake lock; failure messaging appears when lock not available.
3. Given Next, then a new countdown starts and a distinct character is selected until the shuffle bag is exhausted.
4. Given Mix, then entries may come from any of the six categories; no duplicated ID is shown while bag remains unexhausted.
5. Given Custom, when 'Капитан Немо' is entered, then after countdown exactly that trimmed phrase is displayed, not saved to backend.
6. Given an image-less character, when Show Photo is considered, then user is not offered a broken image.
7. Given a broken image URL, then the name remains visible; layout doesn't break.
8. Given device rotation during reveal, then state/character remain unchanged.
9. Given backgrounding during countdown, then the character is not accidentally exposed or skipped when app resumes.
10. Given iPhone Safari lacks full fullscreen behavior, game still works in ordinary browser viewport.
11. Given an empty future production content file, validation fails in CI or the category gets a safe empty state, not a crash.

## 12. Explicitly out of scope
Rooms/multiplayer sync, accounts, scoring, leaderboards, server-hosted custom decks, social sharing, camera/face tracking, microphone/voice recognition, advertising, in-app purchases, content-management dashboard, AI-generated runtime prompts, complex motion gestures.

## 13. Key product decisions
- Pre-reveal 5-second timer, **not** a 5-second guessing limit.
- Character remains displayed indefinitely.
- Users independently select the same category, no cross-device synchronization.
- Image toggle optional, text is primary.
- No category filter by difficulty in MVP; production bank should contain only extremely recognizable entries.
