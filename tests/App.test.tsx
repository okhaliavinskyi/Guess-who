import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App.tsx';
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from '../src/content/categories.ts';
import { createBank, getDefaultBank, type CharacterBank } from '../src/content/loader.ts';
import type { Character } from '../src/content/schema.ts';
import { char, seededRng } from './helpers.ts';
import { installWakeLock, removeWakeLock, setVisibility } from './wakeLockMock.ts';

const now = () => Date.now();
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const click = (el: HTMLElement) => act(() => void fireEvent.click(el));
const button = (name: string | RegExp) => screen.getByRole('button', { name });

function bankOf(entries: Partial<Record<CategoryId, Character[]>>): CharacterBank {
  return createBank(
    CATEGORY_IDS.map((category) => ({
      file: `${category}.json`,
      category,
      data: entries[category] ?? [],
    })),
  );
}

function renderApp(bank: CharacterBank = getDefaultBank()) {
  return render(<App bank={bank} now={now} rng={seededRng(11)} />);
}

function revealedName() {
  return screen.getByTestId('character-name').textContent ?? '';
}

function startAndReveal() {
  click(button('Start'));
  tick(5000);
}

beforeEach(() => {
  vi.useFakeTimers();
  removeWakeLock();
});
afterEach(() => {
  vi.useRealTimers();
  setVisibility('visible');
});

describe('home', () => {
  it('shows the instruction, six categories, Mix, Custom and How to play', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: /Guess Who/ })).toBeInTheDocument();
    expect(
      screen.getByText(/Place your phone on your forehead after tapping Start/),
    ).toBeInTheDocument();
    for (const c of CATEGORIES) expect(button(new RegExp(c.label))).toBeInTheDocument();
    expect(button(/Mix/)).toBeInTheDocument();
    expect(button(/Custom word/)).toBeInTheDocument();
    expect(screen.queryByText('Demo content')).not.toBeInTheDocument(); // production bank
    expect(screen.getByText('How to play')).toBeInTheDocument();
  });

  it('labels a demo bank as demo content', () => {
    render(<App now={now} rng={seededRng(11)} isDemo />);
    expect(screen.getByText('Demo content')).toBeInTheDocument();
  });
});

describe('category play (all six + Mix)', () => {
  const bank = getDefaultBank();
  const allNames = bank.characters.map((c) => c.displayName);

  it.each([...CATEGORIES.map((c) => [c.label, c.id] as const), ['Mix', 'mix'] as const])(
    '%s: 5s countdown with no name in the DOM, then one character from that pool',
    (label, id) => {
      renderApp(bank);
      click(button(new RegExp(`^\\S*\\s*${label.replace('&', '&')}`)));
      click(button('Start'));
      for (const s of [5, 4, 3, 2, 1]) {
        expect(screen.getByTestId('countdown-number')).toHaveTextContent(String(s));
        const text = document.body.textContent ?? '';
        for (const n of allNames) expect(text).not.toContain(n);
        tick(1000 - (s === 1 ? 1 : 0));
      }
      expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
      tick(1);
      const name = revealedName();
      const character = bank.characters.find((c) => c.displayName === name);
      expect(character).toBeDefined();
      if (id !== 'mix') expect(character?.category).toBe(id);
    },
  );

  it('keeps the same character indefinitely, through rotation/resizes and rerenders', () => {
    const { rerender } = renderApp();
    click(button(/Sports/));
    startAndReveal();
    const name = revealedName();
    for (let i = 0; i < 10; i += 1) {
      tick(30_000); // 5 minutes total
      act(() => void window.dispatchEvent(new Event('resize')));
      act(() => void window.dispatchEvent(new Event('orientationchange')));
    }
    rerender(<App bank={getDefaultBank()} now={now} rng={seededRng(11)} />);
    expect(revealedName()).toBe(name);
  });

  it('Next shows distinct characters until the bag is exhausted; double tap = one countdown', () => {
    renderApp();
    click(button(/History/));
    startAndReveal();
    const seen = [revealedName()];
    for (let i = 0; i < 4; i += 1) {
      const next = button(/Next/);
      act(() => {
        fireEvent.click(next);
        fireEvent.click(next);
      });
      expect(screen.getByTestId('countdown-number')).toHaveTextContent('5');
      tick(5000);
      seen.push(revealedName());
    }
    expect(new Set(seen).size).toBe(5);
  });

  it('Mix with small pools shows no duplicate before exhaustion', () => {
    const bank = bankOf({
      music: [char('m-1', 'music')],
      sports: [char('s-1', 'sports'), char('s-2', 'sports')],
    });
    renderApp(bank);
    click(button(/Mix/));
    startAndReveal();
    const seen = [revealedName()];
    for (let i = 0; i < 2; i += 1) {
      click(button(/Next/));
      tick(5000);
      seen.push(revealedName());
    }
    expect(seen.sort()).toEqual(['m 1', 's 1', 's 2']);
  });

  it('a one-entry category repeats; an empty category shows a safe unavailable state', () => {
    renderApp(bankOf({ music: [char('only-one', 'music')] }));
    click(button(/Music/));
    startAndReveal();
    expect(revealedName()).toBe('only one');
    click(button(/Next/));
    tick(5000);
    expect(revealedName()).toBe('only one');
    click(button('Change category'));
    click(button(/Politics/));
    expect(screen.getByRole('heading', { name: 'No names here yet' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start' })).not.toBeInTheDocument();
    click(button(/Back/));
    expect(screen.getByRole('heading', { name: /Guess Who/ })).toBeInTheDocument();
  });

  it('a completely empty bank does not crash', () => {
    renderApp(bankOf({}));
    click(button(/Mix/));
    expect(screen.getByText('No names here yet')).toBeInTheDocument();
  });

  it('cancel at second 2: no reveal and nothing consumed from the bag', () => {
    renderApp();
    click(button(/Music/));
    click(button('Start'));
    tick(2000);
    const before = sessionStorage.getItem('guess-who:bags:v1');
    click(button('Cancel'));
    tick(10_000);
    expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
    expect(button('Start')).toBeInTheDocument();
    expect(sessionStorage.getItem('guess-who:bags:v1')).toBe(before);
    expect(before).not.toMatch(/music/);
  });

  it('backgrounding during the countdown cancels it; resume does not reveal', () => {
    renderApp();
    click(button(/Fictional/));
    click(button('Start'));
    tick(3000);
    act(() => setVisibility('hidden'));
    tick(10_000);
    act(() => setVisibility('visible'));
    tick(10_000);
    expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/Nothing was revealed/);
    startAndReveal();
    expect(screen.getByTestId('character-name')).toBeInTheDocument();
  });

  it('after the screen is locked, the same name comes back only after a countdown', () => {
    renderApp();
    click(button(/Sports/));
    startAndReveal();
    const name = revealedName();
    act(() => setVisibility('hidden')); // screen locked
    expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
    tick(60_000);
    act(() => setVisibility('visible')); // unlocked
    expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('countdown-number')).toHaveTextContent('5');
    expect(screen.getByRole('status')).toHaveTextContent(/screen was locked/);
    tick(4000);
    expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
    tick(1000);
    expect(revealedName()).toBe(name); // same name, nothing new drawn
  });

  it('locking again during the re-reveal countdown keeps the name hidden', () => {
    renderApp();
    click(button(/Sports/));
    startAndReveal();
    const name = revealedName();
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    tick(2000);
    act(() => setVisibility('hidden'));
    tick(10_000);
    act(() => setVisibility('visible'));
    expect(screen.queryByTestId('character-name')).not.toBeInTheDocument();
    tick(5000);
    expect(revealedName()).toBe(name);
  });

  it('End and Change category return home', () => {
    renderApp();
    click(button(/Movies/));
    startAndReveal();
    click(button('End game'));
    expect(screen.getByRole('heading', { name: /Guess Who/ })).toBeInTheDocument();
    click(button(/Movies/));
    startAndReveal();
    click(button('Change category'));
    expect(button(/Music/)).toBeInTheDocument();
  });
});

describe('custom word', () => {
  function enter(value: string) {
    renderApp();
    click(button(/Custom word/));
    const input = screen.getByLabelText('Name or word');
    act(() => void fireEvent.change(input, { target: { value } }));
    click(button('Start'));
  }

  it('shows exactly the trimmed Cyrillic phrase after the countdown and stores nothing', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    enter('   Капитан Немо  ');
    expect(document.body.textContent).not.toContain('Капитан');
    expect(screen.queryByLabelText('Name or word')).not.toBeInTheDocument();
    tick(5000);
    expect(revealedName()).toBe('Капитан Немо');
    for (const call of setItem.mock.calls) expect(call.join()).not.toContain('Капитан');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(location.search + location.hash).toBe('');
    vi.unstubAllGlobals();
  });

  it.each(['José Martí ñ', 'محمد صلاح', '🦖🎉 T-Rex', 'x'.repeat(80)])('accepts %s', (word) => {
    enter(word);
    tick(5000);
    expect(revealedName()).toBe(word);
    expect(screen.queryByRole('button', { name: /Show photo/ })).not.toBeInTheDocument();
  });

  it('rejects whitespace-only and > 80 characters', () => {
    enter('    ');
    expect(screen.getByRole('alert')).toHaveTextContent('Please type a name or word.');
    act(
      () =>
        void fireEvent.change(screen.getByLabelText('Name or word'), {
          target: { value: 'y'.repeat(81) },
        }),
    );
    click(button('Start'));
    expect(screen.getByRole('alert')).toHaveTextContent(/80 characters/);
    expect(screen.queryByTestId('countdown-number')).not.toBeInTheDocument();
  });

  it('"New word" returns to an empty form', () => {
    enter('Zorro');
    tick(5000);
    click(button(/New word/));
    expect(screen.getByLabelText('Name or word')).toHaveValue('');
  });
});

describe('photos', () => {
  const withImage = char('img-person', 'sports', {
    displayName: 'Image Person',
    image: {
      src: '/images/img-person.jpg',
      alt: 'Portrait of Image Person',
      license: 'CC BY 4.0',
      creator: 'Jane Photographer',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Img.jpg',
    },
  });

  it('image-less characters never offer Show photo', () => {
    renderApp(bankOf({ sports: [char('plain', 'sports')] }));
    click(button(/Sports/));
    startAndReveal();
    expect(screen.queryByRole('button', { name: /photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('toggles a lazily-loaded photo with attribution instead of the name', () => {
    renderApp(bankOf({ sports: [withImage] }));
    click(button(/Sports/));
    startAndReveal();
    expect(screen.queryByRole('img')).not.toBeInTheDocument(); // not loaded until asked
    click(button('Show photo'));
    const img = screen.getByRole('img', { name: 'Photo: Image Person' });
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(revealedName()).toBe('Image Person');
    expect(screen.getByText(/Jane Photographer · CC BY 4.0/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://commons.wikimedia.org/wiki/File:Img.jpg',
    );
    click(button('Show name'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('tapping the card switches between the name and the photo', () => {
    renderApp(bankOf({ sports: [withImage] }));
    click(button(/Sports/));
    startAndReveal();
    const nameBox = () => screen.getByTestId('character-name').parentElement!;
    expect(screen.getByText('Tap to show photo')).toBeInTheDocument();
    expect(nameBox()).toHaveClass('card-name-box');
    click(screen.getByTestId('character-card'));
    // Photo only: the name is hidden visually (kept for screen readers).
    expect(screen.getByRole('img', { name: 'Photo: Image Person' })).toBeInTheDocument();
    expect(nameBox()).toHaveClass('sr-only');
    expect(revealedName()).toBe('Image Person');
    expect(screen.getByText('Tap to show name')).toBeInTheDocument();
    expect(button('Show name')).toHaveAttribute('aria-pressed', 'true');
    click(screen.getByTestId('character-card'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(nameBox()).toHaveClass('card-name-box');
  });

  it('tapping a card without a photo does nothing', () => {
    renderApp(bankOf({ sports: [char('plain', 'sports')] }));
    click(button(/Sports/));
    startAndReveal();
    expect(screen.queryByText('Tap to show photo')).not.toBeInTheDocument();
    click(screen.getByTestId('character-card'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('a broken image (404) falls back to the name with no broken image', () => {
    renderApp(bankOf({ sports: [withImage] }));
    click(button(/Sports/));
    startAndReveal();
    click(button('Show photo'));
    act(() => void fireEvent.error(screen.getByRole('img')));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(revealedName()).toBe('Image Person');
    expect(screen.queryByRole('button', { name: /Show photo/ })).not.toBeInTheDocument();
    expect(screen.getByText('Photo unavailable')).toBeInTheDocument();
  });
});

describe('wake lock and fullscreen integration', () => {
  it('shows the fallback notice when Wake Lock is unsupported', () => {
    renderApp();
    click(button(/Music/));
    startAndReveal();
    expect(screen.getByText(/Your device may lock its screen/)).toBeInTheDocument();
  });

  it('requests the lock on Start, hides the notice while active, releases on End', async () => {
    const { request, sentinels } = installWakeLock();
    renderApp();
    click(button(/Music/));
    click(button('Start'));
    expect(request).toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    tick(5000);
    expect(screen.queryByText(/Your device may lock its screen/)).not.toBeInTheDocument();
    click(button('End game'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(sentinels.every((s) => s.released)).toBe(true);
  });

  it('shows no fullscreen control where the API is unavailable (e.g. iPhone Safari)', () => {
    renderApp();
    click(button(/Music/));
    expect(screen.queryByRole('button', { name: /fullscreen/i })).not.toBeInTheDocument();
    startAndReveal();
    expect(within(screen.getByRole('main')).getByTestId('character-name')).toBeInTheDocument();
  });
});
