import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const builderPath = join(root, 'frontend/lib/examples/modelLanding.ts');
const dataPath = join(root, 'frontend/lib/examples/modelLandingData.ts');
const faqPath = join(root, 'frontend/lib/examples/modelLandingFaq.ts');
const typesPath = join(root, 'frontend/lib/examples/modelLandingTypes.ts');
const localeDataPaths = ['en', 'fr', 'es'].map((locale) =>
  join(root, `frontend/lib/examples/modelLandingData.${locale}.ts`)
);

const builderSource = readFileSync(builderPath, 'utf8');

test('example model landing builder delegates localized data and shared types', () => {
  assert.ok(existsSync(dataPath), 'localized model landing data selector should live outside the builder');
  assert.ok(existsSync(faqPath), 'hub example FAQ content should live outside the builder');
  assert.ok(existsSync(typesPath), 'shared model landing types should live outside the builder');
  for (const localePath of localeDataPaths) {
    assert.ok(existsSync(localePath), `${localePath} should exist`);
  }

  assert.match(builderSource, /from '@\/lib\/examples\/modelLandingData'/);
  assert.match(builderSource, /from '@\/lib\/examples\/modelLandingFaq'/);
  assert.match(builderSource, /from '@\/lib\/examples\/modelLandingTypes'/);
});

test('example model landing builder does not regain static localized content', () => {
  assert.doesNotMatch(builderSource, /const EN_MODEL_DATA/, 'English landing copy belongs in modelLandingData.en.ts');
  assert.doesNotMatch(builderSource, /const FR_MODEL_DATA/, 'French landing copy belongs in modelLandingData.fr.ts');
  assert.doesNotMatch(builderSource, /const ES_MODEL_DATA/, 'Spanish landing copy belongs in modelLandingData.es.ts');
  assert.doesNotMatch(builderSource, /const HUB_FAQ_BY_LOCALE/, 'hub FAQ copy belongs in modelLandingFaq.ts');

  const lineCount = builderSource.split('\n').length;
  assert.ok(lineCount <= 220, `modelLanding.ts should stay below 220 lines after data extraction, got ${lineCount}`);
});
