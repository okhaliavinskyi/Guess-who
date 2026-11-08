import { describe, expect, it } from 'vitest';
import { validateCustomWord } from '../src/game/customWord.ts';

describe('validateCustomWord', () => {
  it.each([
    ['  Капитан Немо  ', 'Капитан Немо'],
    ['José Martí', 'José Martí'],
    ['محمد صلاح', 'محمد صلاح'],
    ['🦖 T-Rex', '🦖 T-Rex'],
    ['\tSmith\n', 'Smith'],
  ])('accepts %j', (input, expected) => {
    expect(validateCustomWord(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['', '   ', '\n\t '])('rejects blank %j', (input) => {
    expect(validateCustomWord(input)).toEqual({ ok: false, reason: 'empty' });
  });

  it('counts code points, not UTF-16 units', () => {
    expect(validateCustomWord('😀'.repeat(80)).ok).toBe(true);
    expect(validateCustomWord('😀'.repeat(81))).toEqual({ ok: false, reason: 'too-long' });
    expect(validateCustomWord('a'.repeat(80)).ok).toBe(true);
    expect(validateCustomWord('a'.repeat(81)).ok).toBe(false);
  });
});
