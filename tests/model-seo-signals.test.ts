import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modelLayoutSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx',
  'utf8',
);
const modelHeroSpecsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-hero-specs.ts',
  'utf8',
);
const modelSpecsConstantsSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs-constants.ts',
  'utf8',
);
const localizationSource = readFileSync('frontend/lib/ltx-localization.ts', 'utf8');

test('model hero chips expose max duration and max resolution as compact crawlable labels', () => {
  assert.match(localizationSource, /maxDuration:\s*'Max duration'/);
  assert.match(localizationSource, /maxResolution:\s*'Max resolution'/);
  assert.match(localizationSource, /maxDuration:\s*'Durée max'/);
  assert.match(localizationSource, /maxResolution:\s*'Résolution max'/);
  assert.match(localizationSource, /maxDuration:\s*'Duración máx\.'/);
  assert.match(localizationSource, /maxResolution:\s*'Resolución máx\.'/);
  assert.match(modelHeroSpecsSource, /formatHeroLimitChip\(labels\.maxResolution, resolution\)/);
  assert.match(modelHeroSpecsSource, /formatHeroLimitChip\(labels\.maxDuration, duration\)/);
});

test('model hero includes a short model limits line near the top of the page', () => {
  assert.match(modelLayoutSource, /const heroLimitsLine = isVideoEngine \? resolveHeroLimitsLine\(locale\) : null/);
  assert.match(modelSpecsConstantsSource, /Model limits: duration, resolution, aspect ratio, audio, and input modes vary by engine\./);
  assert.match(modelSpecsConstantsSource, /Limites du modèle : durée, résolution, ratio, audio et modes d’entrée varient selon le modèle\./);
  assert.match(modelSpecsConstantsSource, /Límites del modelo: duración, resolución, relación de aspecto, audio y modos de entrada varían según el motor\./);
});
