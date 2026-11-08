import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LanguageContext, loadLanguage, saveLanguage } from './language.ts';
import { isLang, STRINGS, type Lang } from './strings.ts';

export function LanguageProvider({ initial, children }: { initial?: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? loadLanguage());
  const setLang = useCallback((next: Lang) => {
    if (!isLang(next)) return;
    setLangState(next);
    saveLanguage(next);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, strings: STRINGS[lang], setLang }), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
