import { useId, useState, type FormEvent } from 'react';
import { CUSTOM_WORD_MAX, validateCustomWord } from '../game/customWord.ts';
import { useStrings } from '../i18n/language.ts';

interface Props {
  /** Called with the trimmed word from the Start tap (a user gesture). */
  onSubmit: (word: string) => void;
  onBack: () => void;
}

/**
 * The value lives only in this component's state. When the form unmounts (on
 * Start) the text is gone from the DOM; it is never persisted or transmitted.
 */
export function CustomWordForm({ onSubmit, onBack }: Props) {
  const strings = useStrings();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();
  const hintId = useId();
  const length = Array.from(value.trim()).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateCustomWord(value);
    if (!result.ok) {
      setError(
        result.reason === 'empty' ? strings.customEmpty : strings.customTooLong(CUSTOM_WORD_MAX),
      );
      return;
    }
    // Close the on-screen keyboard / autocomplete popup before hiding the form.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setValue('');
    onSubmit(result.value);
  };

  return (
    <main className="screen custom" aria-labelledby="custom-title">
      <div className="top-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← {strings.back}
        </button>
      </div>
      <form className="custom-form" onSubmit={submit} noValidate autoComplete="off">
        <h1 id="custom-title" className="ready-title">
          <span aria-hidden="true">✏️ </span>
          {strings.customTitle}
        </h1>
        <p id={hintId} className="ready-hint">
          {strings.customPrompt}
        </p>
        <label htmlFor={inputId} className="field-label">
          {strings.customInputLabel}
        </label>
        <input
          id={inputId}
          className="field"
          type="text"
          name="gw-custom-word"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          data-1p-ignore
          data-lpignore="true"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId} ${error ? errorId : ''}`.trim()}
          autoFocus
        />
        <div className="field-row">
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
          <p
            className="field-counter"
            data-over={length > CUSTOM_WORD_MAX || undefined}
            aria-hidden="true"
          >
            {strings.customCounter(length, CUSTOM_WORD_MAX)}
          </p>
        </div>
        <button type="submit" className="btn btn-start">
          {strings.start}
        </button>
      </form>
    </main>
  );
}
