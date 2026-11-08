import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '../src/content/categories.ts';

const tsx = join(process.cwd(), 'node_modules/.bin/tsx');

function runValidator(files: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), 'gw-content-'));
  for (const [name, data] of Object.entries(files))
    writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
  try {
    const out = execFileSync(tsx, ['scripts/validate-content.ts', '--dir', dir], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stdout: string; stderr: string };
    return { code: err.status, out: err.stdout + err.stderr };
  }
}

const validFiles = (): Record<string, unknown[]> =>
  Object.fromEntries(
    CATEGORY_IDS.map((c) => [
      `${c}.json`,
      [{ id: `${c}-x`, category: c, displayName: `${c} X`, popularityTier: 'iconic' }],
    ]),
  );

describe('npm run content:validate', { timeout: 20000 }, () => {
  it('passes on the bundled demo fixtures', () => {
    const out = execFileSync(tsx, ['scripts/validate-content.ts'], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    expect(out).toMatch(/Content is valid/);
  });

  it('fails CI on duplicate ids across files', () => {
    const files = validFiles();
    files['sports.json'] = [
      { id: 'music-x', category: 'sports', displayName: 'Dup', popularityTier: 'iconic' },
    ];
    const r = runValidator(files);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/duplicate id "music-x"/);
  });

  it('fails CI on an empty production file and on invalid JSON', () => {
    expect(runValidator({ ...validFiles(), 'music.json': [] }).out).toMatch(/no valid characters/);
    const r = runValidator({ ...validFiles(), 'music.json': '[{' });
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/invalid JSON/);
  });

  it('fails CI on image without license/source', () => {
    const files = validFiles();
    files['music.json'] = [
      {
        id: 'm',
        category: 'music',
        displayName: 'M',
        popularityTier: 'iconic',
        image: { src: '/images/m.jpg', alt: 'M' },
      },
    ];
    const r = runValidator(files);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/image\.license is required/);
    expect(r.out).toMatch(/image\.sourceUrl is required/);
  });
});
