import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const specsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs.ts');
const typesPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-types.ts');
const constantsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-constants.ts');

const specsSource = readFileSync(specsPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');
const constantsSource = readFileSync(constantsPath, 'utf8');

test('model page specs delegates contracts and constants to focused modules', () => {
  assert.ok(existsSync(typesPath), 'model page spec contracts should live in a focused type module');
  assert.ok(existsSync(constantsPath), 'model page spec constants should live in a focused constants module');
  assert.match(specsSource, /from '\.\/model-page-specs-types'/);
  assert.match(specsSource, /from '\.\/model-page-specs-constants'/);
  assert.match(specsSource, /export type \{[\s\S]*SoraCopy[\s\S]*SpecSection[\s\S]*\} from '\.\/model-page-specs-types'/);
  assert.match(specsSource, /export \{[\s\S]*HERO_SPEC_ICON_MAP[\s\S]*TIPS_CARD_LABELS[\s\S]*\} from '\.\/model-page-specs-constants'/);
});

test('model page specs does not regain extracted type or constants ownership', () => {
  assert.doesNotMatch(specsSource, /from 'lucide-react'/, 'icon maps belong in model-page-specs-constants.ts');
  assert.doesNotMatch(specsSource, /export type SoraCopy =/, 'large page copy contracts belong in model-page-specs-types.ts');
  assert.doesNotMatch(specsSource, /export const HERO_SPEC_ICON_MAP =/, 'hero icon maps belong in model-page-specs-constants.ts');
  assert.doesNotMatch(specsSource, /export const COMPARE_COPY_BY_LOCALE/, 'localized compare copy belongs in model-page-specs-constants.ts');

  const lineCount = specsSource.split('\n').length;
  assert.ok(lineCount <= 650, `model-page-specs.ts should stay below 650 lines after extraction, got ${lineCount}`);
});

test('model page specs helper modules expose the expected contract', () => {
  for (const typeName of [
    'SpecSection',
    'HeroSpecChip',
    'BestUseCaseIconKey',
    'KeySpecValues',
    'SoraCopy',
  ]) {
    assert.match(typesSource, new RegExp(`export type ${typeName}`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'HERO_SPEC_ICON_MAP',
    'BEST_USE_CASE_ICON_MAP',
    'FULL_BLEED_SECTION',
    'HERO_LIMITS_LINES',
    'BEST_USE_CASE_ICON_RULES',
    'SECTION_LABELS',
    'SPEC_STATUS_LABELS',
    'AUTO_SPEC_LABELS',
    'COMPARE_COPY_BY_LOCALE',
    'VIDEO_SPEC_ROW_DEFS',
    'IMAGE_SPEC_ROW_DEFS',
  ]) {
    assert.match(constantsSource, new RegExp(`export const ${exportName}`), `${exportName} should be exported`);
  }
});
