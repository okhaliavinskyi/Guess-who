/**
 * Validates src/content/characters/*.json against the Character schema.
 * Exit code 1 on any error (missing/empty category, duplicate id or name, bad
 * image metadata, unknown fields...). Runs in CI and before every build.
 *
 * Usage: npm run content:validate [-- --dir path/to/characters]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { CATEGORY_IDS, isCategoryId } from '../src/content/categories.ts';
import { formatIssue, validateBank, type CharacterFileInput } from '../src/content/schema.ts';
import { BANK_STATUS } from '../src/content/bankStatus.ts';

const dirFlag = process.argv.indexOf('--dir');
const dir = resolve(dirFlag >= 0 ? (process.argv[dirFlag + 1] ?? '') : 'src/content/characters');

const files: CharacterFileInput[] = [];
const parseErrors: string[] = [];

for (const name of readdirSync(dir).sort()) {
  if (!name.endsWith('.json')) continue;
  const file = relative(process.cwd(), join(dir, name));
  const category = name.replace(/\.json$/, '');
  if (!isCategoryId(category)) {
    parseErrors.push(`${file}: unexpected file; expected one of ${CATEGORY_IDS.join(', ')}.json`);
    continue;
  }
  try {
    files.push({ file, category, data: JSON.parse(readFileSync(join(dir, name), 'utf8')) });
  } catch (error) {
    parseErrors.push(`${file}: invalid JSON — ${(error as Error).message}`);
  }
}

const { issues, counts, valid } = validateBank(files);
const errors = [...parseErrors, ...issues.map(formatIssue)];

console.log('Character bank:');
for (const category of CATEGORY_IDS) console.log(`  ${category.padEnd(10)} ${counts[category]}`);
console.log(`  ${'total'.padEnd(10)} ${valid.length}  (mix draws from all ${valid.length})`);
console.log(`  images     ${valid.filter((c) => c.image).length}`);

if (BANK_STATUS === 'demo') {
  console.warn('\n⚠  BANK_STATUS is "demo": these are DEMO FIXTURES, not production content.');
}

if (errors.length > 0) {
  console.error(`\n✖ ${errors.length} content error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('\n✔ Content is valid.');
