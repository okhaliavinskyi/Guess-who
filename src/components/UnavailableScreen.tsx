import { strings } from '../i18n/strings.ts';

export function UnavailableScreen({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <main className="screen unavailable" aria-labelledby="unavailable-title">
      <div className="ready-body">
        <p className="ready-emoji" aria-hidden="true">
          🫙
        </p>
        <h1 id="unavailable-title" className="ready-title" tabIndex={-1} data-autofocus>
          {strings.unavailableTitle}
        </h1>
        <p className="ready-hint">
          <strong>{title}</strong> — {strings.unavailableBody}
        </p>
        <button type="button" className="btn btn-start" onClick={onBack}>
          ← {strings.back}
        </button>
      </div>
    </main>
  );
}
