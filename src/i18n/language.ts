/**
 * Active UI language. Chosen explicitly in the menu (remembered in localStorage)
 * or, on first visit, detected from the browser languages; English otherwise.
 * The same language picks the localized character names.
 */
import { createContext, useContext } from 'react';
import { isLang, STRINGS, type Lang, type Strings } from './strings.ts';

const STORAGE_KEY = 'guess-who:lang';

export function detectLanguage(locales: readonly string[]): Lang {
  for (const locale of locales) {
    const base = locale.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

function browserLocales(): readonly string[] {
  if (typeof navigator === 'undefined') return ['en'];
  return navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
}

export function loadLanguage(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) return stored;
  } catch {
    /* storage unavailable */
  }
  return detectLanguage(browserLocales());
}

export function saveLanguage(lang: Lang) {
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* persistence is optional */
  }
}

export interface LanguageState {
  lang: Lang;
  strings: Strings;
  setLang: (lang: Lang) => void;
}

export const LanguageContext = createContext<LanguageState>({
  lang: 'en',
  strings: STRINGS.en,
  setLang: () => {},
});

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

export function useStrings(): Strings {
  return useContext(LanguageContext).strings;
}
