import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MARKETING_FOOTER_EXAMPLES, MARKETING_NAV_COMPARE, MARKETING_NAV_EXAMPLES, MARKETING_NAV_MODELS } from '../frontend/config/navigation.ts';
import { getModelFamilyDefinition } from '../frontend/config/model-families.ts';
import { getPublishedComparisonSlugs, getHubEngines } from '../frontend/lib/compare-hub/data.ts';
import { orderExamplesHubFamilyIds } from '../frontend/lib/examples/familyOrder.ts';
import { getExampleFamilyIds } from '../frontend/lib/model-families.ts';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines.ts';
import { normalizeEngineId } from '../frontend/src/lib/engine-alias.ts';
import { canonicalizeFalModelSlug, getFalEngineBySlug, listFalEngines } from '../frontend/src/config/falEngines.ts';

test('Seedance 2 registry centralizes provisional Fal IDs and keeps both launch surfaces aligned', () => {
  const seedance = listFalEngines().find((entry) => entry.id === 'seedance-2-0');
  const fast = listFalEngines().find((entry) => entry.id === 'seedance-2-0-fast');

  assert.ok(seedance);
  assert.ok(fast);

  assert.equal(seedance.defaultFalModelId, 'bytedance/seedance-2.0/text-to-video');
  assert.equal(seedance.engine.providerMeta?.modelSlug, 'bytedance/seedance-2.0/text-to-video');
  assert.equal(fast.defaultFalModelId, 'bytedance/seedance-2.0/fast/text-to-video');
  assert.equal(fast.engine.providerMeta?.modelSlug, 'bytedance/seedance-2.0/fast/text-to-video');
  assert.equal(seedance.engine.status, 'live');
  assert.equal(fast.engine.status, 'live');
  assert.equal(seedance.engine.modes.includes('ref2v'), true);
  assert.equal(fast.engine.modes.includes('ref2v'), true);
  assert.equal(seedance.modes.some((mode) => mode.mode === 'ref2v'), true);
  assert.equal(fast.modes.some((mode) => mode.mode === 'ref2v'), true);
  assert.deepEqual(seedance.engine.resolutions, ['480p', '720p']);
  assert.deepEqual(fast.engine.resolutions, ['480p', '720p']);
  assert.deepEqual(seedance.engine.aspectRatios, ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(fast.engine.aspectRatios, ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.equal(seedance.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokens, 0.014);
  assert.equal(fast.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokens, 0.0112);
  assert.equal(seedance.engine.pricingDetails?.tokenPricing?.defaultAspectRatio, '16:9');
  assert.equal(fast.engine.pricingDetails?.tokenPricing?.defaultAspectRatio, '16:9');

  const seedanceI2v = seedance.modes.find((mode) => mode.mode === 'i2v');
  const seedanceRef2v = seedance.modes.find((mode) => mode.mode === 'ref2v');
  const fastRef2v = fast.modes.find((mode) => mode.mode === 'ref2v');
  assert.ok(seedanceI2v);
  assert.ok(seedanceRef2v);
  assert.ok(fastRef2v);
  assert.deepEqual(seedanceI2v.ui.duration, { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' });
  assert.deepEqual(seedanceI2v.ui.resolution, ['480p', '720p']);
  assert.deepEqual(seedanceI2v.ui.aspectRatio, ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(seedanceRef2v.ui.resolution, ['480p', '720p']);
  assert.deepEqual(fastRef2v.ui.resolution, ['480p', '720p']);

  const seedanceFields = [...(seedance.engine.inputSchema?.required ?? []), ...(seedance.engine.inputSchema?.optional ?? [])];
  const fastFields = [...(fast.engine.inputSchema?.required ?? []), ...(fast.engine.inputSchema?.optional ?? [])];
  assert.ok(seedanceFields.some((field) => field.id === 'end_image_url' && field.modes?.includes('i2v')));
  assert.ok(seedanceFields.some((field) => field.id === 'image_urls' && field.modes?.includes('ref2v') && field.maxCount === 9));
  assert.ok(seedanceFields.some((field) => field.id === 'video_urls' && field.modes?.includes('ref2v') && field.maxCount === 3));
  assert.ok(seedanceFields.some((field) => field.id === 'audio_urls' && field.modes?.includes('ref2v') && field.maxCount === 3));
  assert.equal(seedanceFields.some((field) => field.id === 'reference_image_urls' && field.modes?.includes('ref2v')), false);
  assert.ok(fastFields.some((field) => field.id === 'end_image_url' && field.modes?.includes('i2v')));
  assert.ok(fastFields.some((field) => field.id === 'image_urls' && field.modes?.includes('ref2v') && field.maxCount === 9));
  assert.ok(fastFields.some((field) => field.id === 'video_urls' && field.modes?.includes('ref2v') && field.maxCount === 3));
  assert.ok(fastFields.some((field) => field.id === 'audio_urls' && field.modes?.includes('ref2v') && field.maxCount === 3));
  assert.equal(fastFields.some((field) => field.id === 'reference_image_urls' && field.modes?.includes('ref2v')), false);

  assert.equal(seedance.availability, 'available');
  assert.equal(fast.availability, 'available');
  assert.equal(seedance.surfaces.app.enabled, true);
  assert.equal(fast.surfaces.app.enabled, true);
  assert.equal(seedance.surfaces.compare.includeInHub, true);
  assert.equal(fast.surfaces.compare.includeInHub, true);
  assert.equal(seedance.surfaces.modelPage.indexable, true);
  assert.equal(fast.surfaces.modelPage.indexable, true);
  assert.deepEqual(seedance.surfaces.compare.publishedPairs, ['veo-3-1', 'kling-3-pro', 'sora-2']);
  assert.deepEqual(fast.surfaces.compare.publishedPairs, ['veo-3-1-fast', 'ltx-2-3-fast']);
});

test('Seedance aliases, family routing, hub publication, and locale coverage are launch-ready', () => {
  assert.equal(normalizeEngineId('seedance-2.0'), 'seedance-2-0');
  assert.equal(normalizeEngineId('seedance-2.0-fast'), 'seedance-2-0-fast');
  assert.equal(canonicalizeFalModelSlug('seedance-v2-fast'), 'seedance-2-0-fast');
  assert.equal(getFalEngineBySlug('bytedance/seedance-2.0/fast/text-to-video')?.id, 'seedance-2-0-fast');

  const family = getModelFamilyDefinition('seedance');
  assert.ok(family);
  assert.equal(family.defaultModelSlug, 'seedance-2-0');
  assert.deepEqual(family.examplesPage?.publishedModelSlugs, ['seedance-2-0', 'seedance-2-0-fast', 'seedance-1-5-pro']);

  const publishedComparisonSlugs = getPublishedComparisonSlugs();
  [
    'seedance-2-0-vs-veo-3-1',
    'kling-3-pro-vs-seedance-2-0',
    'seedance-2-0-vs-sora-2',
    'seedance-2-0-fast-vs-veo-3-1-fast',
    'ltx-2-3-fast-vs-seedance-2-0-fast',
  ].forEach((slug) => assert.ok(publishedComparisonSlugs.includes(slug), `Missing published comparison ${slug}`));

  const hubEngines = getHubEngines();
  assert.ok(hubEngines.some((engine) => engine.modelSlug === 'seedance-2-0'));
  assert.ok(hubEngines.some((engine) => engine.modelSlug === 'seedance-2-0-fast'));

  const esFastOverlayPath = path.join(process.cwd(), 'content/models/es/seedance-2-0-fast.json');
  assert.equal(fs.existsSync(esFastOverlayPath), true);

  const benchmarkPath = path.join(process.cwd(), 'data/benchmarks/engine-scores.v1.json');
  const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) as {
    scores?: Array<{ modelSlug?: string; fidelity?: number; speedStability?: number }>;
  };
  const fastScore = benchmarkData.scores?.find((entry) => entry.modelSlug === 'seedance-2-0-fast') ?? null;
  assert.ok(fastScore);
  assert.equal(typeof fastScore.fidelity, 'number');
  assert.equal(typeof fastScore.speedStability, 'number');
});

test('Seedance becomes the app and marketing priority family ahead of Sora', () => {
  const appEngineIds = getBaseEnginesByCategory('video').map((engine) => engine.id);
  assert.equal(appEngineIds[0], 'seedance-2-0');
  assert.equal(appEngineIds[1], 'seedance-2-0-fast');
  assert.ok(appEngineIds.indexOf('sora-2') > appEngineIds.indexOf('seedance-2-0'));

  assert.deepEqual(
    MARKETING_NAV_MODELS.slice(0, 6).map((item) => item.key),
    ['seedance-2-0', 'ltx-2-3-fast', 'veo-3-1', 'veo-3-1-lite', 'wan-2-6', 'kling-3-pro']
  );
  assert.deepEqual(
    MARKETING_NAV_COMPARE.map((item) => item.key),
    [
      'seedance-1-5-pro-vs-seedance-2-0',
      'ltx-2-vs-ltx-2-3-fast',
      'ltx-2-3-fast-vs-seedance-2-0',
      'ltx-2-3-fast-vs-veo-3-1',
      'kling-3-pro-vs-ltx-2-3-pro',
    ]
  );
  assert.deepEqual(MARKETING_NAV_EXAMPLES.map((item) => item.key), ['veo', 'seedance', 'ltx', 'kling', 'wan']);
  assert.deepEqual(MARKETING_FOOTER_EXAMPLES.map((item) => item.key), ['veo', 'seedance', 'ltx', 'kling', 'wan']);
});

test('Seedance 1.5 Pro stays accessible as legacy while Seedance 2.0 owns the primary alias and promoted slots', () => {
  const legacySeedance = listFalEngines().find((entry) => entry.id === 'seedance-1-5-pro');

  assert.ok(legacySeedance);
  assert.equal(legacySeedance.isLegacy, true);
  assert.equal(legacySeedance.surfaces.compare.includeInHub, false);
  assert.equal(normalizeEngineId('seedance'), 'seedance-2-0');
  assert.equal(MARKETING_NAV_MODELS.some((item) => item.key === 'seedance-1-5-pro'), false);
  assert.equal(getHubEngines().some((engine) => engine.modelSlug === 'seedance-1-5-pro'), false);
});

test('Header model menu keeps the Veo family expanded with a dedicated Lite slot', () => {
  assert.deepEqual(MARKETING_NAV_MODELS.map((item) => item.key), [
    'seedance-2-0',
    'ltx-2-3-fast',
    'veo-3-1',
    'veo-3-1-lite',
    'wan-2-6',
    'kling-3-pro',
  ]);
});

test('Examples hub family order follows the current business priority without reordering global families', () => {
  assert.deepEqual(orderExamplesHubFamilyIds(getExampleFamilyIds()), [
    'veo',
    'seedance',
    'ltx',
    'kling',
    'wan',
    'sora',
    'luma',
    'pika',
    'hailuo',
  ]);
});
