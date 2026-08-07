import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { getFalEngineById } from '../frontend/src/config/falEngines.ts';
import { buildSeoMetadata } from '../frontend/lib/seo/metadata.ts';

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
const modelPageSource = readFileSync(
  'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx',
  'utf8',
);

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

test('model metadata keeps localized seo.image as the social owner without coming-soon copy', () => {
  assert.match(modelPageSource, /localized\.seo\.image/);
  assert.match(modelPageSource, /image:\s*ogImagePath/);

  for (const locale of ['en', 'fr', 'es']) {
    const contentSource = readFileSync(`content/models/${locale}/seedance-2-5.json`, 'utf8');
    assert.doesNotMatch(contentSource, /coming-soon/i, `${locale} visible model metadata`);
  }
});

test('Seedance 2.0 metadata remains index-follow and self-canonical in every locale', () => {
  const expectedUrls = {
    en: 'https://maxvideoai.com/models/seedance-2-0',
    fr: 'https://maxvideoai.com/fr/modeles/seedance-2-0',
    es: 'https://maxvideoai.com/es/modelos/seedance-2-0',
  } as const;
  const engine = getFalEngineById('seedance-2-0');
  assert.ok(engine);

  for (const locale of ['en', 'fr', 'es'] as const) {
    const document = JSON.parse(readFileSync(`content/models/${locale}/seedance-2-0.json`, 'utf8')) as {
      seo: { title: string; description: string; image?: string };
    };
    const metadata = buildSeoMetadata({
      locale,
      title: document.seo.title,
      description: document.seo.description,
      image: document.seo.image,
      englishPath: '/models/seedance-2-0',
      availableLocales: ['en', 'fr', 'es'],
      robots: { index: engine.surfaces.modelPage.indexable, follow: true },
    });

    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.alternates?.canonical, expectedUrls[locale]);
  }
});
