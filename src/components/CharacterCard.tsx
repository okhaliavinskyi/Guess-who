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
  /** Horizontal swipe: left → next name, right → previous name. */
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  /** Whether swiping right has anything to go back to (only affects the hint). */
  canGoBack?: boolean;
}

/** Minimum horizontal travel (px) for a swipe; shorter movements count as a tap. */
export const SWIPE_MIN_PX = 50;

/**
 * The revealed card shows ONE thing at a time: the name, as large as the viewport
 * allows, or — after a tap — the photo filling the card. Another tap switches back.
 * While the photo is shown the name stays in the DOM for screen readers only.
 * A failed image falls back to the name with no broken-image icon.
 */
export function CharacterCard({
  name,
  image,
  showPhoto,
  onPhotoFailed,
  onTap,
  onSwipeNext,
  onSwipePrev,
  canGoBack = false,
}: Props) {
  const strings = useStrings();
  const usable = hasUsableImage(image) ? image : undefined;
  const photo = showPhoto ? usable : undefined;
  const { containerRef, textRef } = useFitText<HTMLDivElement, HTMLHeadingElement>(
    `${name}|${photo ? 'photo' : 'text'}`,
    { max: 240 },
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
  const swipeable = !!onSwipeNext || !!onSwipePrev;
  // Pointer start position; a swipe suppresses the click that may follow it.
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  return (
    <div
      className={`card ${photo ? 'card--photo' : ''} ${tappable || swipeable ? 'card--tappable' : ''}`}
      data-testid="character-card"
      onPointerDown={(event) => {
        start.current = { x: event.clientX, y: event.clientY };
        swiped.current = false;
      }}
      onPointerUp={(event) => {
        const from = start.current;
        start.current = null;
        if (!from) return;
        const dx = event.clientX - from.x;
        const dy = event.clientY - from.y;
        if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        swiped.current = true;
        if (dx < 0) onSwipeNext?.();
        else onSwipePrev?.();
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
      onClick={(event) => {
        if (swiped.current) {
          swiped.current = false;
          return;
        }
        // Let the source link inside the credit work normally.
        if (!tappable || (event.target as HTMLElement).closest('a')) return;
        onTap();
      }}
    >
      {photo && (
        <Photo
          key={photo.src}
          image={photo}
          alt={strings.photoAlt(name)}
          onFailed={onPhotoFailed}
        />
      )}
      <div className={photo ? 'sr-only' : 'card-name-box'} ref={containerRef}>
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
      {(tappable || swipeable) && (
        <p className="card-tap-hint" aria-hidden="true">
          {[
            tappable && (photo ? strings.tapForName : strings.tapForPhoto),
            swipeable && (canGoBack ? strings.swipeHint : strings.swipeNextHint),
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </p>
      )}
    </div>
  );
}

function Photo({
  image,
  alt,
  onFailed,
}: {
  image: ImageMetadata;
  /** Localized alt text (the bank's `image.alt` is English). */
  alt: string;
  onFailed: () => void;
}) {
  const strings = useStrings();
  const [loaded, setLoaded] = useState(false);
  // A full attribution line already names the license; otherwise show creator · license.
  const credit = image.attribution ?? [image.creator, image.license].filter(Boolean).join(' · ');
  return (
    <figure className="card-photo" data-loaded={loaded || undefined}>
      <img
        src={image.src}
        alt={alt}
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
