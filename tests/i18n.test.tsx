import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App.tsx';
import { CATEGORY_IDS } from '../src/content/categories.ts';
import { createBank } from '../src/content/loader.ts';
import { detectLanguage } from '../src/i18n/language.ts';
import { LANGUAGES, STRINGS } from '../src/i18n/strings.ts';
import { char, seededRng } from './helpers.ts';

const click = (el: HTMLElement) => act(() => void fireEvent.click(el));
const button = (name: string | RegExp) => screen.getByRole('button', { name });

const bank = createBank(
  CATEGORY_IDS.map((category) => ({
    file: `${category}.json`,
    category,
    data:
      category === 'history'
        ? [
            char('marie-curie', 'history', {
              displayName: 'Marie Curie',
              localeNames: { ru: 'Мария Кюри', uk: 'Марія Кюрі' },
            }),
          ]
        : [char(`${category}-x`, category)],
  })),
);

function reveal() {
  click(button(/^(Старт|Start)$/));
  act(() => void vi.advanceTimersByTime(5000));
  return screen.getByTestId('character-name').textContent;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('language switcher', () => {
  it('switches the whole menu between English, Russian and Ukrainian', () => {
    render(<App bank={bank} rng={seededRng(1)} lang="en" />);
    expect(button(/Movies & TV/)).toBeInTheDocument();
    click(button('Русский'));
    expect(button(/Кино и ТВ/)).toBeInTheDocument();
    expect(screen.getByText('Как играть')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ru');
    click(button('Українська'));
    expect(button(/Кіно і ТБ/)).toBeInTheDocument();
    expect(button('Українська')).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.lang).toBe('uk');
  });

  it('shows localized character names in the chosen language, English otherwise', () => {
    render(<App bank={bank} rng={seededRng(1)} lang="en" />);
    click(button('Русский'));
    click(button(/История/));
    expect(reveal()).toBe('Мария Кюри');
    click(button(/Категория|Сменить категорию/));
    click(button('Українська'));
    click(button(/Історія/));
    expect(reveal()).toBe('Марія Кюрі');
    click(button(/Змінити категорію/));
    click(button('English'));
    click(button(/History/));
    expect(reveal()).toBe('Marie Curie');
  });

  it('falls back to the English name when no translation exists', () => {
    render(<App bank={bank} rng={seededRng(1)} lang="ru" />);
    click(button(/Музыка/));
    expect(reveal()).toBe('music x');
  });

  it('remembers the chosen language', () => {
    const { unmount } = render(<App bank={bank} rng={seededRng(1)} />);
    click(button('Українська'));
    unmount();
    render(<App bank={bank} rng={seededRng(1)} />);
    expect(button('Українська')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('detectLanguage', () => {
  it('picks the first supported browser language', () => {
    expect(detectLanguage(['uk-UA', 'en'])).toBe('uk');
    expect(detectLanguage(['de-DE', 'ru'])).toBe('ru');
    expect(detectLanguage(['fr', 'de'])).toBe('en');
  });
});

describe('string tables', () => {
  it('translate every key into every language', () => {
    const keys = Object.keys(STRINGS.en).sort();
    for (const lang of LANGUAGES) expect(Object.keys(STRINGS[lang]).sort(), lang).toEqual(keys);
  });

  it('pluralise the deck size in Russian and Ukrainian', () => {
    expect(STRINGS.ru.namesInDeck(1)).toBe('1 имя в колоде');
    expect(STRINGS.ru.namesInDeck(3)).toBe('3 имени в колоде');
    expect(STRINGS.ru.namesInDeck(236)).toBe('236 имён в колоде');
    expect(STRINGS.uk.namesInDeck(21)).toBe('21 ім’я у колоді');
    expect(STRINGS.uk.namesInDeck(12)).toBe('12 імен у колоді');
  });
});
