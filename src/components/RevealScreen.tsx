import type { CSSProperties } from 'react';
import type { ImageMetadata } from '../content/schema.ts';
import type { WakeLockStatus } from '../hooks/useScreenWakeLock.ts';
import { strings } from '../i18n/strings.ts';
import { hasUsableImage } from '../content/image.ts';
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
  onTogglePhoto: () => void;
  onPhotoFailed: () => void;
  onChangeCategory: () => void;
  onEnd: () => void;
}

/**
 * Character display. Stays until a deliberate button press — there is no timer.
 * Controls sit along the bottom edge, away from the centre that touches the forehead.
 * "Show photo" is only rendered for entries with valid, licensed image metadata;
 * if the image fails to load the button disappears and a short status is shown.
 */
export function RevealScreen(p: Props) {
  const photoAvailable = hasUsableImage(p.image) && !p.photoFailed;
  return (
    <main
      className="screen reveal"
      style={{ '--accent': p.color } as CSSProperties}
      aria-label={strings.revealedLabel}
    >
      <div className="top-bar top-bar--overlay">
        <WakeLockNotice status={p.wakeLockStatus} />
        {p.photoFailed && (
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
      />
      <nav className="bottom-bar controls" aria-label="Game controls">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={p.onEnd}
          aria-label={strings.endLabel}
        >
          {strings.end}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={p.onChangeCategory}
          aria-label={strings.changeCategoryLabel}
        >
          {strings.changeCategory}
        </button>
        {photoAvailable && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={p.onTogglePhoto}
            aria-pressed={p.showPhoto}
          >
            {p.showPhoto ? strings.showName : strings.showPhoto}
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={p.onNext}>
          {p.isCustom ? strings.newWord : strings.next} →
        </button>
      </nav>
    </main>
  );
}
