import { useEffect, useRef, useState } from 'react';
import type { ImageMetadata } from '../content/schema.ts';
import { hasUsableImage } from '../content/image.ts';
import { useFitText } from '../hooks/useFitText.ts';
import { useStrings } from '../i18n/language.ts';

interface Props {
  name: string;
  image?: ImageMetadata;
  showPhoto: boolean;
  onPhotoFailed: () => void;
  /** Tapping anywhere on the card adds (or removes) the photo, when one exists. */
  onTap?: () => void;
}

/**
 * The revealed name, as large as the viewport allows. With a photo, the name stays
 * in a dedicated banner so it is always readable; a failed image falls back to
 * name-only with no broken-image icon.
 */
export function CharacterCard({ name, image, showPhoto, onPhotoFailed, onTap }: Props) {
  const strings = useStrings();
  const usable = hasUsableImage(image) ? image : undefined;
  const photo = showPhoto ? usable : undefined;
  const { containerRef, textRef } = useFitText<HTMLDivElement, HTMLHeadingElement>(
    `${name}|${photo ? 'photo' : 'text'}`,
    { max: photo ? 96 : 240 },
  );
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  // Warm the cache as soon as the name is revealed so a tap shows the photo instantly.
  const preloadSrc = usable?.src;
  useEffect(() => {
    if (!preloadSrc || typeof Image === 'undefined') return;
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.src = preloadSrc;
  }, [preloadSrc]);

  const tappable = !!usable && !!onTap;
  return (
    <div
      className={`card ${photo ? 'card--photo' : ''} ${tappable ? 'card--tappable' : ''}`}
      data-testid="character-card"
      onClick={
        tappable
          ? (event) => {
              // Let the source link inside the credit work normally.
              if ((event.target as HTMLElement).closest('a')) return;
              onTap();
            }
          : undefined
      }
    >
      {photo && <Photo key={photo.src} image={photo} onFailed={onPhotoFailed} />}
      <div className="card-name-box" ref={containerRef}>
        <h1
          className="card-name"
          ref={(el) => {
            textRef.current = el;
            headingRef.current = el;
          }}
          tabIndex={-1}
          lang="und"
          dir="auto"
          data-testid="character-name"
        >
          {name}
        </h1>
      </div>
      {tappable && !photo && (
        <p className="card-tap-hint" aria-hidden="true">
          {strings.tapForPhoto}
        </p>
      )}
    </div>
  );
}

function Photo({ image, onFailed }: { image: ImageMetadata; onFailed: () => void }) {
  const strings = useStrings();
  const [loaded, setLoaded] = useState(false);
  const credit = [image.attribution ?? image.creator, image.license].filter(Boolean).join(' · ');
  return (
    <figure className="card-photo" data-loaded={loaded || undefined}>
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={onFailed}
      />
      <figcaption className="card-credit">
        {strings.photoCredit}: {credit} ·{' '}
        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
          {strings.source}
        </a>
      </figcaption>
    </figure>
  );
}
