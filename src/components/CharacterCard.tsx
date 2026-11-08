import { useEffect, useRef, useState } from 'react';
import type { ImageMetadata } from '../content/schema.ts';
import { hasUsableImage } from '../content/image.ts';
import { useFitText } from '../hooks/useFitText.ts';
import { strings } from '../i18n/strings.ts';

interface Props {
  name: string;
  image?: ImageMetadata;
  showPhoto: boolean;
  onPhotoFailed: () => void;
}

/**
 * The revealed name, as large as the viewport allows. With a photo, the name stays
 * in a dedicated banner so it is always readable; a failed image falls back to
 * name-only with no broken-image icon.
 */
export function CharacterCard({ name, image, showPhoto, onPhotoFailed }: Props) {
  const photo = showPhoto && hasUsableImage(image) ? image : undefined;
  const { containerRef, textRef } = useFitText<HTMLDivElement, HTMLHeadingElement>(
    `${name}|${photo ? 'photo' : 'text'}`,
    { max: photo ? 96 : 240 },
  );
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className={`card ${photo ? 'card--photo' : ''}`}>
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
    </div>
  );
}

function Photo({ image, onFailed }: { image: ImageMetadata; onFailed: () => void }) {
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
