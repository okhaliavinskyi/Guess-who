import type { CSSProperties } from 'react';
import { strings } from '../i18n/strings.ts';
import { FullscreenButton } from './FullscreenButton.tsx';

interface Props {
  title: string;
  emoji: string;
  color: string;
  deckSize: number | null;
  isDemo: boolean;
  interrupted: boolean;
  onStart: () => void;
  onBack: () => void;
}

export function ReadyScreen(p: Props) {
  return (
    <main
      className="screen ready"
      style={{ '--accent': p.color } as CSSProperties}
      aria-labelledby="ready-title"
    >
      <div className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={p.onBack}>
          ← {strings.back}
        </button>
        <FullscreenButton />
      </div>
      <div className="ready-body">
        <p className="ready-emoji" aria-hidden="true">
          {p.emoji}
        </p>
        <h1 id="ready-title" className="ready-title" tabIndex={-1} data-autofocus>
          {p.title}
        </h1>
        {p.deckSize !== null && (
          <p className="ready-meta">
            {strings.namesInDeck(p.deckSize)}
            {p.isDemo && ` · ${strings.demoBadge}`}
          </p>
        )}
        {p.interrupted && (
          <p className="notice" role="status">
            {strings.interrupted}
          </p>
        )}
        <p className="ready-hint">{strings.readyHint}</p>
        <button type="button" className="btn btn-start" onClick={p.onStart}>
          {strings.start}
        </button>
      </div>
    </main>
  );
}
