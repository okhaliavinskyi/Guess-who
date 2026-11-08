import { useStrings } from '../i18n/language.ts';

export function HowToPlay() {
  const strings = useStrings();
  return (
    <details className="how-to">
      <summary>{strings.howToTitle}</summary>
      <ol>
        {strings.howToSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </details>
  );
}
