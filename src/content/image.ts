import { isValidImageSrc, type ImageMetadata } from './schema.ts';

/** Only images with complete, valid licensing metadata are ever offered. */
export function hasUsableImage(image: ImageMetadata | undefined): image is ImageMetadata {
  return (
    !!image &&
    isValidImageSrc(image.src) &&
    !!image.license?.trim() &&
    !!image.sourceUrl?.trim() &&
    !!image.alt?.trim()
  );
}
