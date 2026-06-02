import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import keySpecsFile from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import scoresFile from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import { buildCompareShowdownSlots } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts';
import { buildCompareFaqItems } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-faq.ts';
import { formatEngineMetaName } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-engine-formatting.ts';
import {
  buildSpecValues,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts';

type EngineCatalogEntry = (typeof engineCatalog)[number];

const KLING_OMNI_SLUGS = ['kling-o3-standard', 'kling-o3-pro', 'kling-o3-4k'] as const;

function getCatalogEntry(slug: string): EngineCatalogEntry {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Expected catalog entry for ${slug}`);
  return entry;
}

function getKeySpecs(slug: string): Record<string, unknown> {
  const entry = keySpecsFile.specs.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry?.keySpecs, `Expected benchmark key specs for ${slug}`);
  return entry.keySpecs;
}

test('Kling 3.0 Omni compare pages have calibrated benchmark scores', () => {
  for (const slug of KLING_OMNI_SLUGS) {
    const score = scoresFile.scores.find((entry) => entry.modelSlug === slug);
    assert.ok(score, `Expected benchmark score for ${slug}`);

    [
      'fidelity',
      'visualQuality',
      'motion',
      'anatomy',
      'textRendering',
      'consistency',
      'lipsyncQuality',
      'sequencingQuality',
      'controllability',
      'speedStability',
      'pricing',
    ].forEach((field) => {
      const value = score[field as keyof typeof score];
      assert.equal(typeof value, 'number', `${slug}.${field} should be scored`);
    });
  }
});

test('Kling 3.0 Omni compare metadata preserves the 3.0 product name', () => {
  assert.equal(formatEngineMetaName(getCatalogEntry('kling-o3-pro')), 'Kling 3.0 Omni Pro');
});

test('Kling 3.0 Omni compare specs expose reference and storyboard controls', () => {
  const pro = getCatalogEntry('kling-o3-pro');
  const specs = buildSpecValues(pro, getKeySpecs('kling-o3-pro'));

  assert.equal(specs.textToVideo, 'Supported');
  assert.equal(specs.imageToVideo, 'Supported');
  assert.match(specs.videoToVideo, /source-video|video-to-video|V2V/i);
  assert.doesNotMatch(specs.firstLastFrame, /^Supported\b/);
  assert.match(specs.firstLastFrame, /start/i);
  assert.match(specs.firstLastFrame, /end/i);
  assert.match(specs.referenceImageStyle, /@Image|reference/i);
  assert.doesNotMatch(specs.referenceVideo, /^Supported\b/);
  assert.match(specs.referenceVideo, /video element/i);
  assert.equal(specs.nativeAudioGeneration, 'Supported');
  assert.match(specs.lipSync, /supported/i);
  assert.match(specs.cameraMotionControls, /Shot type|multi-shot|prompt/i);
  assert.equal(specs.outputFormats, 'MP4');
});

test('Kling 3.0 Omni comparisons hide same-prompt showdowns until curated videos exist', async () => {
  const left = getCatalogEntry('kling-o3-pro');
  const right = getCatalogEntry('seedance-2-0');

  const slots = await buildCompareShowdownSlots({
    activeLocale: 'en',
    canonicalSlug: 'kling-o3-pro-vs-seedance-2-0',
    left,
    pairHasKling3Native4k: false,
    pairHasNativeAudio: true,
    right,
    shouldSwapDisplayOrder: false,
  });

  assert.deepEqual(slots, []);
});

test('Kling 3.0 Omni compare FAQ avoids same-prompt claims without curated videos', () => {
  const left = getCatalogEntry('kling-o3-pro');
  const right = getCatalogEntry('seedance-2-0');
  const params: any = {
    activeLocale: 'en',
    compareCopy: {},
    labels: { pending: 'Data pending', supported: 'Supported', notSupported: 'Not supported' },
    left,
    right,
    leftPricingDisplay: { headline: '$0.18/s', subline: null, prices: [18] },
    rightPricingDisplay: { headline: '$0.18/s', subline: null, prices: [18] },
    leftSpecs: buildSpecValues(left, getKeySpecs('kling-o3-pro')),
    rightSpecs: buildSpecValues(right, getKeySpecs('seedance-2-0')),
    pageOverride: null,
    pairHasKling3Native4k: false,
    pairHasNativeAudio: true,
    specLabels: {},
    hasShowdownSlots: false,
  };

  const text = buildCompareFaqItems(params)
    .flatMap((item) => [item.question, ...(Array.isArray(item.answer) ? item.answer : [item.answer])])
    .join('\n');

  assert.doesNotMatch(text, /same prompt/i);
  assert.doesNotMatch(text, /Showdown/i);
});
