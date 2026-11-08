import { strings } from '../i18n/strings.ts';

export function HowToPlay() {
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
