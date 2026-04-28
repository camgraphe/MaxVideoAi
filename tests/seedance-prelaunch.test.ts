import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { MARKETING_FOOTER_EXAMPLES, MARKETING_NAV_COMPARE, MARKETING_NAV_EXAMPLES, MARKETING_NAV_MODELS } from '../frontend/config/navigation.ts';
import { getModelFamilyDefinition } from '../frontend/config/model-families.ts';
import { getPublishedComparisonSlugs, getHubEngines } from '../frontend/lib/compare-hub/data.ts';
import { orderExamplesHubFamilyIds } from '../frontend/lib/examples/familyOrder.ts';
import { normalizeHomepageAdminPriceLabel } from '../frontend/lib/homepage-price-label.ts';
import { normalizeFalDurationValueForModel } from '../frontend/src/lib/fal.ts';
import { getVisibleAssetSlotCount, getVisibleAssetSlots } from '../frontend/lib/asset-slot-layout.ts';
import { getHappyHorseAssetState, getUnifiedHappyHorseMode } from '../frontend/lib/happy-horse-workflow.ts';
import { getSeedanceAssetState, getSeedanceFieldBlockKey, getUnifiedSeedanceMode } from '../frontend/lib/seedance-workflow.ts';
import { ENGINE_SELECT_FAMILY_PRIORITY, getEngineSelectFamilyRank } from '../frontend/src/lib/engine-family-priority.ts';
import {
  getExampleFamilyCurrentModelSlugs,
  getExampleFamilyIds,
  getExampleFamilyModelSlugs,
  getExampleNavFamilyIds,
  isIndexedExampleFamilyId,
  resolveExampleFamilyId,
} from '../frontend/lib/model-families.ts';
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
  assert.equal(seedanceFields.find((field) => field.id === 'image_url')?.label, 'Start image');
  assert.equal(seedanceFields.find((field) => field.id === 'end_image_url')?.label, 'End image');
  assert.equal(seedanceFields.find((field) => field.id === 'image_urls')?.label, 'Reference images (up to 9)');
  assert.equal(seedanceFields.find((field) => field.id === 'video_urls')?.label, 'Reference video clips (up to 3)');
  assert.equal(seedanceFields.find((field) => field.id === 'audio_urls')?.label, 'Reference audio clips (up to 3)');
  assert.equal(seedanceFields.some((field) => field.id === 'reference_image_urls' && field.modes?.includes('ref2v')), false);
  assert.ok(fastFields.some((field) => field.id === 'end_image_url' && field.modes?.includes('i2v')));
  assert.ok(fastFields.some((field) => field.id === 'image_urls' && field.modes?.includes('ref2v') && field.maxCount === 9));
  assert.ok(fastFields.some((field) => field.id === 'video_urls' && field.modes?.includes('ref2v') && field.maxCount === 3));
  assert.ok(fastFields.some((field) => field.id === 'audio_urls' && field.modes?.includes('ref2v') && field.maxCount === 3));
  assert.equal(fastFields.find((field) => field.id === 'image_url')?.label, 'Start image');
  assert.equal(fastFields.find((field) => field.id === 'end_image_url')?.label, 'End image');
  assert.equal(fastFields.find((field) => field.id === 'image_urls')?.label, 'Reference images (up to 9)');
  assert.equal(fastFields.find((field) => field.id === 'video_urls')?.label, 'Reference video clips (up to 3)');
  assert.equal(fastFields.find((field) => field.id === 'audio_urls')?.label, 'Reference audio clips (up to 3)');
  assert.equal(fastFields.some((field) => field.id === 'reference_image_urls' && field.modes?.includes('ref2v')), false);

  assert.equal(seedance.availability, 'available');
  assert.equal(fast.availability, 'available');
  assert.equal(seedance.surfaces.app.enabled, true);
  assert.equal(fast.surfaces.app.enabled, true);
  assert.equal(seedance.surfaces.pricing.includeInEstimator, true);
  assert.equal(fast.surfaces.pricing.includeInEstimator, true);
  assert.equal(seedance.surfaces.compare.includeInHub, true);
  assert.equal(fast.surfaces.compare.includeInHub, true);
  assert.equal(seedance.surfaces.modelPage.indexable, true);
  assert.equal(fast.surfaces.modelPage.indexable, true);
  assert.equal(seedance.surfaces.compare.publishedPairs.length, 22);
  assert.equal(fast.surfaces.compare.publishedPairs.length, 22);
  ['veo-3-1', 'kling-3-pro', 'sora-2', 'seedance-1-5-pro', 'seedance-2-0-fast'].forEach((slug) =>
    assert.ok(seedance.surfaces.compare.publishedPairs.includes(slug), `Seedance 2.0 missing published pair ${slug}`)
  );
  ['veo-3-1-fast', 'ltx-2-3-fast', 'seedance-1-5-pro', 'seedance-2-0', 'wan-2-6'].forEach((slug) =>
    assert.ok(fast.surfaces.compare.publishedPairs.includes(slug), `Seedance 2.0 Fast missing published pair ${slug}`)
  );
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
    'seedance-1-5-pro-vs-seedance-2-0-fast',
    'seedance-2-0-fast-vs-sora-2',
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

test('Seedance benchmark specs stay aligned with the live Fal-facing product surface', () => {
  const benchmarkPath = path.join(process.cwd(), 'data/benchmarks/engine-key-specs.v1.json');
  const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) as {
    specs?: Array<{ modelSlug?: string; keySpecs?: Record<string, unknown> }>;
  };

  const standard = benchmarkData.specs?.find((entry) => entry.modelSlug === 'seedance-2-0') ?? null;
  const fast = benchmarkData.specs?.find((entry) => entry.modelSlug === 'seedance-2-0-fast') ?? null;

  assert.ok(standard);
  assert.ok(fast);

  [standard, fast].forEach((entry) => {
    assert.equal(entry?.keySpecs?.videoToVideo, 'Not supported');
    assert.equal(entry?.keySpecs?.firstLastFrame, 'Supported (start + end image in i2v)');
    assert.equal(entry?.keySpecs?.maxResolution, '720p');
    assert.equal(entry?.keySpecs?.maxDuration, '15s');
    assert.deepEqual(entry?.keySpecs?.aspectRatios, ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
    assert.deepEqual(entry?.keySpecs?.outputFormats, ['MP4']);
    assert.equal(entry?.keySpecs?.pricePerSecond ?? null, null);
    assert.equal(entry?.keySpecs?.releaseDate ?? null, null);
  });
});

test('Public marketing media fetchers stay visibility-safe for pinned and prompt-based Seedance surfaces', () => {
  const videosSource = fs.readFileSync(path.join(process.cwd(), 'frontend/server/videos.ts'), 'utf8');
  const compareSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/page.tsx'),
    'utf8'
  );
  const modelSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx'),
    'utf8'
  );
  const homepageSource = fs.readFileSync(path.join(process.cwd(), 'frontend/server/homepage.ts'), 'utf8');

  assert.match(videosSource, /export async function getPublicVideosByIds/);
  assert.match(videosSource, /export async function getLatestPublicVideoByPromptAndEngine/);
  assert.match(videosSource, /visibility = 'public'/);
  assert.match(videosSource, /COALESCE\(indexable, TRUE\)/);
  assert.match(compareSource, /getPublicVideosByIds/);
  assert.match(compareSource, /getLatestPublicVideoByPromptAndEngine/);
  assert.doesNotMatch(compareSource, /getLatestVideoByPromptAndEngine/);
  assert.match(modelSource, /getPublicVideosByIds/);
  assert.match(homepageSource, /getPublicVideosByIds/);
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

test('Seedance 1.5 Pro stays active while Seedance 2.0 keeps the primary alias and promoted slots', () => {
  const seedance15 = listFalEngines().find((entry) => entry.id === 'seedance-1-5-pro');

  assert.ok(seedance15);
  assert.equal(Boolean(seedance15.isLegacy), false);
  assert.equal(seedance15.surfaces.compare.includeInHub, true);
  assert.equal(getPublishedComparisonSlugs().includes('seedance-1-5-pro-vs-seedance-2-0-fast'), true);
  assert.equal(normalizeEngineId('seedance'), 'seedance-2-0');
  assert.equal(MARKETING_NAV_MODELS.some((item) => item.key === 'seedance-1-5-pro'), false);
  assert.equal(getHubEngines().some((engine) => engine.modelSlug === 'seedance-1-5-pro'), true);
});

test('Header model menu keeps the Veo family expanded with a dedicated Lite slot', () => {
  assert.deepEqual(MARKETING_NAV_MODELS.map((item) => item.key), [
    'seedance-2-0',
    'ltx-2-3-fast',
    'veo-3-1',
    'veo-3-1-lite',
    'wan-2-6',
    'kling-3-pro',
    'kling-3-4k',
  ]);
});

test('Examples hub family order follows the current business priority without reordering global families', () => {
  assert.deepEqual(orderExamplesHubFamilyIds(getExampleFamilyIds()), [
    'veo',
    'seedance',
    'ltx',
    'kling',
    'wan',
    'happy-horse',
    'sora',
    'luma',
    'pika',
    'hailuo',
  ]);
});

test('Happy Horse has a crawlable examples family and appears in example family selectors', () => {
  assert.equal(isIndexedExampleFamilyId('happy-horse'), true);
  assert.equal(resolveExampleFamilyId('happy-horse-1-0'), 'happy-horse');
  assert.deepEqual(getExampleFamilyModelSlugs('happy-horse'), ['happy-horse-1-0']);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('happy-horse'), ['happy-horse-1-0']);
  assert.equal(getExampleNavFamilyIds().includes('happy-horse'), true);
});

test('Examples family current model groups do not classify new delivery models as older', () => {
  assert.deepEqual(getExampleFamilyModelSlugs('kling'), [
    'kling-3-pro',
    'kling-3-standard',
    'kling-3-4k',
    'kling-2-6-pro',
    'kling-2-5-turbo',
  ]);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('kling'), ['kling-3-pro', 'kling-3-standard', 'kling-3-4k']);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('seedance'), ['seedance-2-0', 'seedance-2-0-fast']);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('ltx'), ['ltx-2-3-pro', 'ltx-2-3-fast']);
});

test('Engine select uses the same family priority as the examples hub', () => {
  assert.deepEqual(ENGINE_SELECT_FAMILY_PRIORITY, ['veo', 'seedance', 'ltx', 'kling', 'wan', 'happy-horse', 'sora']);
  const families = ['sora', 'ltx', 'seedance', 'veo', 'happy-horse', 'wan', 'kling'];
  const sorted = families
    .slice()
    .sort((a, b) => getEngineSelectFamilyRank({ family: a }) - getEngineSelectFamilyRank({ family: b }));
  assert.deepEqual(sorted, ['veo', 'seedance', 'ltx', 'kling', 'wan', 'happy-horse', 'sora']);
});

test('Homepage admin hero pricing labels preserve per-second suffixes', () => {
  assert.equal(normalizeHomepageAdminPriceLabel('from $0.18/s', 'en'), 'from $0.18/s');
  assert.equal(normalizeHomepageAdminPriceLabel('from $0.29 /s', 'en'), 'from $0.29/s');
  assert.equal(normalizeHomepageAdminPriceLabel('à partir de 0,18 EUR/s', 'fr'), 'à partir de 0,18 €/s');
  assert.equal(normalizeHomepageAdminPriceLabel('headline only', 'en'), null);
});

test('Unified Seedance workspace switches mode from attached assets and blocks the opposite family', () => {
  const startImageAssets = {
    image_url: [{ kind: 'image' as const }],
  };
  assert.equal(getUnifiedSeedanceMode(startImageAssets), 'i2v');
  assert.equal(getSeedanceFieldBlockKey('image_urls', startImageAssets), 'clearStartEnd');
  assert.equal(getSeedanceFieldBlockKey('image_url', startImageAssets, true), null);

  const referenceAssets = {
    image_urls: [{ kind: 'image' as const }],
    video_urls: [{ kind: 'video' as const }],
  };
  assert.equal(getUnifiedSeedanceMode(referenceAssets), 'ref2v');
  assert.equal(getSeedanceFieldBlockKey('image_url', referenceAssets), 'clearReferences');
  assert.equal(getSeedanceFieldBlockKey('video_urls', referenceAssets, true), null);

  const audioOnlyAssets = {
    audio_urls: [{ kind: 'audio' as const }],
  };
  assert.equal(getSeedanceAssetState(audioOnlyAssets).hasReferenceAudio, true);
  assert.equal(getSeedanceAssetState(audioOnlyAssets).hasReferenceMedia, false);
});

test('Progressive asset slots start at three and reveal the next slot when the visible limit is filled', () => {
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 0 }), 3);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 2 }), 3);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 3 }), 4);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 8 }), 9);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 3, filledCount: 0 }), 3);
  assert.deepEqual(
    getVisibleAssetSlots({ assets: [], maxCount: 9 }).map((slot) => slot.slotIndex),
    [0, 1, 2]
  );
  assert.deepEqual(
    getVisibleAssetSlots({ assets: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], maxCount: 9 }).map((slot) => slot.slotIndex),
    [0, 1, 2, 3]
  );
  assert.equal(getVisibleAssetSlots({ assets: Array.from({ length: 9 }, () => null), maxCount: 9 }).length, 3);
});

test('Unified Happy Horse workspace infers R2V and V2V from reference slots', () => {
  assert.equal(getUnifiedHappyHorseMode({}), 't2v');
  assert.equal(getUnifiedHappyHorseMode({ image_url: [{ kind: 'image' }] }), 'i2v');
  assert.equal(getUnifiedHappyHorseMode({ image_urls: [{ kind: 'image' }] }), 'ref2v');
  assert.equal(getUnifiedHappyHorseMode({ reference_image_urls: [{ kind: 'image' }] }), 'v2v');
  assert.equal(getUnifiedHappyHorseMode({ video_url: [{ kind: 'video' }] }), 'v2v');
  assert.equal(getHappyHorseAssetState({ image_urls: [{ kind: 'image' }] }).hasR2vReferenceImage, true);
});

test('Seedance Fal requests serialize numeric duration selections as string enum values', () => {
  assert.equal(
    normalizeFalDurationValueForModel('seedance-2-0', 'bytedance/seedance-2.0/text-to-video', 12),
    '12'
  );
  assert.equal(
    normalizeFalDurationValueForModel('seedance-2-0-fast', 'bytedance/seedance-2.0/fast/image-to-video', 4),
    '4'
  );
  assert.equal(
    normalizeFalDurationValueForModel('veo-3-1', 'fal-ai/veo3.1/text-to-video', 8),
    8
  );
});
