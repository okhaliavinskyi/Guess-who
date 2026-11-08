import { useEffect, useState } from 'react';
import { useCountdown } from '../hooks/useCountdown.ts';
import { useStrings } from '../i18n/language.ts';

interface Props {
  durationMs: number;
  onComplete: () => void;
  onCancel: () => void;
  now?: () => number;
}

/**
 * Preparation countdown. Deliberately receives no character: nothing to leak.
 * The visual digits are aria-hidden; screen readers get one announcement only.
 */
export function Countdown({ durationMs, onComplete, onCancel, now }: Props) {
  const strings = useStrings();
  const { secondsLeft, totalSeconds } = useCountdown({ durationMs, onComplete, now });
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    // Set after mount so the live region (already in the DOM) announces it once.
    const id = setTimeout(() => setAnnouncement(strings.countdownAnnouncement(totalSeconds)), 50);
    return () => clearTimeout(id);
  }, [strings, totalSeconds]);

  return (
    <main className="screen countdown" aria-labelledby="countdown-title">
      <h1 id="countdown-title" className="sr-only" tabIndex={-1} data-autofocus>
        {strings.countdownInstruction}
      </h1>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <p className="countdown-instruction" aria-hidden="true">
        {strings.countdownInstruction}
      </p>
      <div
        className="countdown-number"
        aria-hidden="true"
        key={secondsLeft}
        data-testid="countdown-number"
      >
        {secondsLeft}
      </div>
      <ol className="countdown-progress" aria-hidden="true">
        {Array.from({ length: totalSeconds }, (_, i) => (
          <li key={i} data-done={i < totalSeconds - secondsLeft || undefined} />
        ))}
      </ol>
      <div className="bottom-bar">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {strings.cancel}
        </button>
      </div>
    </main>
  );
}
