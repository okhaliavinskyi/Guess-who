export const CUSTOM_WORD_MAX = 80;

export type CustomWordResult =
  { ok: true; value: string } | { ok: false; reason: 'empty' | 'too-long' };

/** Trims, NFC-normalises and checks the 80 code point limit. Any script or emoji is fine. */
export function validateCustomWord(input: string): CustomWordResult {
  const value = input.normalize('NFC').trim();
  if (value.length === 0) return { ok: false, reason: 'empty' };
  if (Array.from(value).length > CUSTOM_WORD_MAX) return { ok: false, reason: 'too-long' };
  return { ok: true, value };
}
