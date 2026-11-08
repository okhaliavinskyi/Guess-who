import { useFullscreen } from '../hooks/useFullscreen.ts';
import { useStrings } from '../i18n/language.ts';

/** Rendered only where the Fullscreen API is available (hidden on iPhone Safari). */
export function FullscreenButton() {
  const strings = useStrings();
  const { supported, isFullscreen, toggle } = useFullscreen();
  if (!supported) return null;
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      onClick={() => void toggle()}
      aria-pressed={isFullscreen}
      aria-label={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
      title={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
    >
      <span aria-hidden="true">{isFullscreen ? '⤡' : '⤢'}</span>
    </button>
  );
}
