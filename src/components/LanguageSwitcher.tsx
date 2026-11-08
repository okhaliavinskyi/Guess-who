import { useLanguage } from '../i18n/language.ts';
import { LANGUAGE_NAMES, LANGUAGES } from '../i18n/strings.ts';

/** Segmented EN / RU / UA control in the home menu. Also switches character names. */
export function LanguageSwitcher() {
  const { lang, setLang, strings } = useLanguage();
  return (
    <div className="lang-switch" role="group" aria-label={strings.language}>
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          className="lang-option"
          lang={l}
          aria-pressed={l === lang}
          aria-label={LANGUAGE_NAMES[l].name}
          title={LANGUAGE_NAMES[l].name}
          onClick={() => setLang(l)}
        >
          {LANGUAGE_NAMES[l].short}
        </button>
      ))}
    </div>
  );
}
