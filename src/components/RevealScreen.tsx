import { useEffect, type CSSProperties } from 'react';
import type { ImageMetadata } from '../content/schema.ts';
import type { WakeLockStatus } from '../hooks/useScreenWakeLock.ts';
import { useStrings } from '../i18n/language.ts';
import { hasUsableImage } from '../content/image.ts';
import { useFullscreen } from '../hooks/useFullscreen.ts';
import { CharacterCard } from './CharacterCard.tsx';
import { FullscreenButton } from './FullscreenButton.tsx';
import { WakeLockNotice } from './WakeLockNotice.tsx';

interface Props {
  name: string;
  image?: ImageMetadata;
  color: string;
  isCustom: boolean;
  showPhoto: boolean;
  photoFailed: boolean;
  wakeLockStatus: WakeLockStatus;
  onNext: () => void;
  /** Go back to the previous name (swipe right / ←). Absent when there is none. */
  onPrev?: () => void;
  onTogglePhoto: () => void;
  onPhotoFailed: () => void;
  onChangeCategory: () => void;
  onEnd: () => void;
}

/**
 * Character display. Stays until a deliberate button press — there is no timer.
 * Controls sit along the bottom edge, away from the centre that touches the forehead.
 * In fullscreen only the card and the exit-fullscreen button remain.
 * Swiping the card left/right (or ←/→ keys) moves to the next/previous name.
 * Tapping the card switches between the name and the photo (touch-friendly for friends
 * holding the phone); the button stays for keyboard and screen-reader users.
 * "Show photo" is only rendered for entries with valid, licensed image metadata;
 * if the image fails to load the button disappears and a short status is shown.
 */
export function RevealScreen(p: Props) {
  const strings = useStrings();
  const { onNext, onPrev } = p;

  // Keyboard equivalents of the swipes: → next, ← previous.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === 'ArrowRight') onNext();
      else if (event.key === 'ArrowLeft') onPrev?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onPrev]);
  const photoAvailable = hasUsableImage(p.image) && !p.photoFailed;
  // Fullscreen = play mode: only the card (tap / swipe) and the exit-fullscreen button.
  const { isFullscreen } = useFullscreen();
  return (
    <main
      className={`screen reveal ${isFullscreen ? 'reveal--immersive' : ''}`}
      style={{ '--accent': p.color } as CSSProperties}
      aria-label={strings.revealedLabel}
    >
      <div className="top-bar top-bar--overlay">
        {!isFullscreen && <WakeLockNotice status={p.wakeLockStatus} />}
        {!isFullscreen && p.photoFailed && (
          <p className="photo-status" role="status">
            {strings.photoFailed}
          </p>
        )}
        <FullscreenButton />
      </div>
      <CharacterCard
        name={p.name}
        image={photoAvailable ? p.image : undefined}
        showPhoto={p.showPhoto && photoAvailable}
        onPhotoFailed={p.onPhotoFailed}
        onTap={photoAvailable ? p.onTogglePhoto : undefined}
        onSwipeNext={p.onNext}
        onSwipePrev={p.onPrev}
      />
      {!isFullscreen && (
        <nav className="bottom-bar controls" aria-label={strings.controlsLabel}>
          <button
            type="button"
            className="btn btn-secondary btn-square"
            onClick={p.onEnd}
            aria-label={strings.endLabel}
            title={strings.endLabel}
          >
            <span aria-hidden="true">✕</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-square"
            onClick={p.onChangeCategory}
            aria-label={strings.changeCategoryLabel}
            title={strings.changeCategoryLabel}
          >
            <span aria-hidden="true">☰</span>
          </button>
          {photoAvailable && (
            <button
              type="button"
              className="btn btn-secondary btn-square"
              onClick={p.onTogglePhoto}
              aria-pressed={p.showPhoto}
              aria-label={p.showPhoto ? strings.showName : strings.showPhoto}
              title={p.showPhoto ? strings.showName : strings.showPhoto}
            >
              <span aria-hidden="true">{p.showPhoto ? '🔤' : '🖼'}</span>
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={p.onNext}>
            {p.isCustom ? strings.newWord : strings.next} →
          </button>
        </nav>
      )}
    </main>
  );
}
