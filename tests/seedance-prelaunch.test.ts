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
import {
  FEATURED_EXAMPLE_MEDIA,
  PREFERRED_MEDIA,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts';
import { extractMaxDuration } from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-utils.ts';
import { parseMaxDurationNumber } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-score-utils.ts';

const DEFAULT_MAXVIDEOAI_MARGIN_FACTOR = 1.3;

function targetCustomerUnitPriceUsdPer1kTokens(unitPriceUsdPer1kTokens: number | undefined): number | null {
  if (typeof unitPriceUsdPer1kTokens !== 'number') return null;
  return Number((unitPriceUsdPer1kTokens * DEFAULT_MAXVIDEOAI_MARGIN_FACTOR).toFixed(6));
}

function collectPublicCopy(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectPublicCopy);
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap(collectPublicCopy);
}

test('Seedance 2 registry centralizes provisional Fal IDs and keeps both launch surfaces aligned', () => {
  const seedance = listFalEngines().find((entry) => entry.id === 'seedance-2-0');
  const fast = listFalEngines().find((entry) => entry.id === 'seedance-2-0-fast');
  const mini = listFalEngines().find((entry) => entry.id === 'seedance-2-0-mini');

  assert.ok(seedance);
  assert.ok(fast);
  assert.ok(mini);

  assert.equal(seedance.defaultFalModelId, 'bytedance/seedance-2.0/text-to-video');
  assert.equal(seedance.engine.providerMeta?.modelSlug, 'bytedance/seedance-2.0/text-to-video');
  assert.equal(fast.defaultFalModelId, 'bytedance/seedance-2.0/fast/text-to-video');
  assert.equal(fast.engine.providerMeta?.modelSlug, 'bytedance/seedance-2.0/fast/text-to-video');
  assert.equal(seedance.engine.status, 'live');
  assert.equal(fast.engine.status, 'live');
  assert.deepEqual(seedance.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.deepEqual(fast.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.equal(seedance.engine.extend, true);
  assert.equal(fast.engine.extend, true);
  assert.equal(seedance.modes.some((mode) => mode.mode === 'ref2v'), true);
  assert.equal(fast.modes.some((mode) => mode.mode === 'ref2v'), true);
  assert.equal(seedance.modes.some((mode) => mode.mode === 'v2v'), true);
  assert.equal(seedance.modes.some((mode) => mode.mode === 'extend'), true);
  assert.equal(fast.modes.some((mode) => mode.mode === 'v2v'), true);
  assert.equal(fast.modes.some((mode) => mode.mode === 'extend'), true);
  assert.deepEqual(seedance.engine.resolutions, ['480p', '720p', '1080p', '4k']);
  assert.deepEqual(fast.engine.resolutions, ['480p', '720p']);
  assert.deepEqual(seedance.engine.aspectRatios, ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(fast.engine.aspectRatios, ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(seedance.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokens), 0.0175);
  assert.equal(
    targetCustomerUnitPriceUsdPer1kTokens(
      seedance.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokensByResolution?.['1080p']
    ),
    0.01925
  );
  assert.equal(
    targetCustomerUnitPriceUsdPer1kTokens(
      seedance.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokensByResolution?.['4k']
    ),
    0.01
  );
  assert.equal(fast.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokensByInputType, undefined);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(fast.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokens), 0.014);
  assert.equal(seedance.engine.pricingDetails?.tokenPricing?.defaultAspectRatio, '16:9');
  assert.equal(fast.engine.pricingDetails?.tokenPricing?.defaultAspectRatio, '16:9');
  assert.equal(mini.defaultFalModelId, 'byteplus/dreamina-seedance-2.0-mini/text-to-video');
  assert.equal(mini.engine.providerMeta?.provider, 'byteplus_modelark');
  assert.equal(mini.engine.providerMeta?.modelSlug, 'dreamina-seedance-2-0-mini-260615');
  assert.deepEqual(mini.engine.modes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
  assert.deepEqual(mini.engine.resolutions, ['480p', '720p']);
  assert.deepEqual(mini.engine.fps, [24]);
  assert.equal(mini.engine.audio, true);
  assert.equal(targetCustomerUnitPriceUsdPer1kTokens(mini.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokens), 0.00875);
  assert.equal(mini.engine.pricingDetails?.tokenPricing?.unitPriceUsdPer1kTokensByInputType, undefined);
  assert.equal(mini.engine.pricingDetails?.tokenPricing?.pricingSource, 'byteplus_seedance_2_0_mini_flat_markup');
  assert.deepEqual(Object.keys(mini.engine.pricingDetails?.tokenPricing?.dimensions ?? {}), ['480p', '720p']);

  const seedanceI2v = seedance.modes.find((mode) => mode.mode === 'i2v');
  const seedanceRef2v = seedance.modes.find((mode) => mode.mode === 'ref2v');
  const fastRef2v = fast.modes.find((mode) => mode.mode === 'ref2v');
  assert.ok(seedanceI2v);
  assert.ok(seedanceRef2v);
  assert.ok(fastRef2v);
  assert.deepEqual(seedanceI2v.ui.duration, { options: ['auto', 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 'auto' });
  assert.deepEqual(seedanceI2v.ui.resolution, ['480p', '720p', '1080p', '4k']);
  assert.deepEqual(seedanceI2v.ui.aspectRatio, ['auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(seedanceRef2v.ui.resolution, ['480p', '720p', '1080p', '4k']);
  assert.deepEqual(fastRef2v.ui.resolution, ['480p', '720p']);
  const miniV2v = mini.modes.find((mode) => mode.mode === 'v2v');
  assert.ok(miniV2v);
  assert.deepEqual(miniV2v.ui.duration, { options: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], default: 5 });
  assert.deepEqual(miniV2v.ui.resolution, ['480p', '720p']);
  assert.equal(mini.modes.find((mode) => mode.mode === 't2v')?.ui.maxUploadMB, undefined);
  assert.equal(mini.modes.find((mode) => mode.mode === 'i2v')?.ui.maxUploadMB, 30);
  assert.equal(mini.modes.find((mode) => mode.mode === 'ref2v')?.ui.maxUploadMB, 50);
  assert.equal(mini.modes.find((mode) => mode.mode === 'v2v')?.ui.maxUploadMB, 50);
  assert.equal(mini.modes.find((mode) => mode.mode === 'extend')?.ui.maxUploadMB, 50);

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
  const seedanceVideoField = seedanceFields.find((field) => field.id === 'video_urls');
  assert.equal(seedanceVideoField?.minDurationSec, 2);
  assert.equal(seedanceVideoField?.maxDurationSec, 15);
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
  const fastVideoField = fastFields.find((field) => field.id === 'video_urls');
  assert.equal(fastVideoField?.minDurationSec, 2);
  assert.equal(fastVideoField?.maxDurationSec, 15);
  assert.equal(fastFields.some((field) => field.id === 'reference_image_urls' && field.modes?.includes('ref2v')), false);
  const miniFields = [...(mini.engine.inputSchema?.required ?? []), ...(mini.engine.inputSchema?.optional ?? [])];
  const miniSourceVideoField = miniFields.find((field) => field.id === 'video_url');
  const miniReferenceVideoField = miniFields.find((field) => field.id === 'video_urls');
  const miniExtensionVideoField = miniFields.find((field) => field.id === 'extension_source_videos');
  const miniReferenceAudioField = miniFields.find((field) => field.id === 'audio_urls');
  assert.ok(miniSourceVideoField);
  assert.equal(miniSourceVideoField.type, 'video');
  assert.equal(miniSourceVideoField.label, 'Source video');
  assert.deepEqual(miniSourceVideoField.modes, ['v2v']);
  assert.deepEqual(miniSourceVideoField.requiredInModes, ['v2v']);
  assert.equal(miniSourceVideoField.maxCount, 1);
  assert.ok(miniReferenceVideoField);
  assert.deepEqual(miniReferenceVideoField.modes, ['ref2v']);
  assert.equal(miniReferenceVideoField.maxCount, 3);
  assert.ok(miniExtensionVideoField);
  assert.equal(miniExtensionVideoField.type, 'video');
  assert.equal(miniExtensionVideoField.label, 'Source clips to extend (up to 3)');
  assert.deepEqual(miniExtensionVideoField.modes, ['extend']);
  assert.deepEqual(miniExtensionVideoField.requiredInModes, ['extend']);
  assert.equal(miniExtensionVideoField.minCount, 1);
  assert.equal(miniExtensionVideoField.maxCount, 3);
  assert.equal(miniExtensionVideoField.slotLabelPattern, 'Source clip {n}');
  assert.ok(miniReferenceAudioField);
  assert.deepEqual(miniReferenceAudioField.modes, ['ref2v', 'v2v']);
  assert.ok(miniFields.some((field) => field.id === 'image_urls' && field.modes?.includes('v2v')));

  assert.equal(seedance.availability, 'available');
  assert.equal(fast.availability, 'available');
  assert.equal(mini.availability, 'available');
  assert.equal(mini.engine.availability, 'available');
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
  assert.equal(mini.surfaces.app.enabled, true);
  assert.equal(mini.surfaces.modelPage.indexable, true);
  assert.equal(mini.surfaces.examples.includeInFamilyResolver, true);
  assert.equal(mini.surfaces.pricing.includeInEstimator, true);
  assert.equal(mini.surfaces.compare.includeInHub, true);
  assert.deepEqual(mini.surfaces.compare.publishedPairs, [
    'seedance-2-0',
    'seedance-2-0-fast',
    'ltx-2-3-fast',
    'veo-3-1-fast',
    'luma-ray-3-2',
  ]);
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
  assert.deepEqual(family.routeAliases, ['seedance-1-5-pro', 'seedance-2-0', 'seedance-2-0-fast', 'dreamina-seedance-2-0-mini']);
  assert.deepEqual(family.examplesPage?.publishedModelSlugs, [
    'seedance-2-0',
    'seedance-2-0-fast',
    'dreamina-seedance-2-0-mini',
    'seedance-1-5-pro',
  ]);

  const publishedComparisonSlugs = getPublishedComparisonSlugs();
  [
    'seedance-2-0-vs-veo-3-1',
    'kling-3-pro-vs-seedance-2-0',
    'seedance-2-0-vs-sora-2',
    'seedance-2-0-fast-vs-veo-3-1-fast',
    'ltx-2-3-fast-vs-seedance-2-0-fast',
    'seedance-1-5-pro-vs-seedance-2-0-fast',
    'seedance-2-0-fast-vs-sora-2',
    'dreamina-seedance-2-0-mini-vs-seedance-2-0',
    'dreamina-seedance-2-0-mini-vs-seedance-2-0-fast',
    'dreamina-seedance-2-0-mini-vs-ltx-2-3-fast',
    'dreamina-seedance-2-0-mini-vs-veo-3-1-fast',
    'dreamina-seedance-2-0-mini-vs-luma-ray-3-2',
  ].forEach((slug) => assert.ok(publishedComparisonSlugs.includes(slug), `Missing published comparison ${slug}`));

  const hubEngines = getHubEngines();
  assert.ok(hubEngines.some((engine) => engine.modelSlug === 'seedance-2-0'));
  assert.ok(hubEngines.some((engine) => engine.modelSlug === 'seedance-2-0-fast'));
  assert.equal(hubEngines.some((engine) => engine.modelSlug === 'dreamina-seedance-2-0-mini'), true);
  assert.equal(getBaseEnginesByCategory('video').some((engine) => engine.id === 'seedance-2-0-mini'), true);

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

test('Seedance benchmark specs stay aligned with the live MaxVideoAI product surface', () => {
  const benchmarkPath = path.join(process.cwd(), 'data/benchmarks/engine-key-specs.v1.json');
  const benchmarkData = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8')) as {
    specs?: Array<{ modelSlug?: string; keySpecs?: Record<string, unknown> }>;
  };

  const standard = benchmarkData.specs?.find((entry) => entry.modelSlug === 'seedance-2-0') ?? null;
  const fast = benchmarkData.specs?.find((entry) => entry.modelSlug === 'seedance-2-0-fast') ?? null;
  const mini = benchmarkData.specs?.find((entry) => entry.modelSlug === 'dreamina-seedance-2-0-mini') ?? null;

  assert.ok(standard);
  assert.ok(fast);
  assert.ok(mini);

  assert.equal(standard.keySpecs?.videoToVideo, 'Supported (video edit and extend)');
  assert.equal(standard.keySpecs?.firstLastFrame, 'Supported (1 start image + optional end image in i2v)');
  assert.equal(standard.keySpecs?.referenceVideo, 'Supported (up to 3 video references, video edit, or extension clips)');
  assert.equal(
    standard.keySpecs?.maxResolution,
    '4K on the standard Dreamina Seedance 2.0 route'
  );
  assert.equal(standard.keySpecs?.maxDuration, '15s');
  assert.deepEqual(standard.keySpecs?.aspectRatios, ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(standard.keySpecs?.outputFormats, ['MP4']);
  assert.equal(standard.keySpecs?.pricePerSecond ?? null, null);
  assert.equal(standard.keySpecs?.releaseDate ?? null, null);

  assert.equal(fast.keySpecs?.videoToVideo, 'Supported (video edit and extend)');
  assert.equal(fast.keySpecs?.firstLastFrame, 'Supported (1 start image + optional end image in i2v)');
  assert.equal(fast.keySpecs?.referenceVideo, 'Supported (up to 3 video references, video edit, or extension clips)');
  assert.equal(fast.keySpecs?.maxResolution, '720p');
  assert.equal(fast.keySpecs?.maxDuration, '15s');
  assert.deepEqual(fast.keySpecs?.aspectRatios, ['Auto', '21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);
  assert.deepEqual(fast.keySpecs?.outputFormats, ['MP4']);
  assert.equal(fast.keySpecs?.pricePerSecond ?? null, null);
  assert.equal(fast.keySpecs?.releaseDate ?? null, null);

  assert.equal(mini.keySpecs?.maxResolution, '480p / 720p');
  assert.equal(mini.keySpecs?.maxDuration, '4-15s');
  assert.equal(mini.keySpecs?.videoToVideo, 'Supported (video edit and extend)');
  assert.equal(mini.keySpecs?.referenceVideo, 'Supported (up to 3 video references, video edit, or extension clips)');
  assert.equal(mini.keySpecs?.audioOutput, 'Supported');
  assert.equal(mini.keySpecs?.nativeAudioGeneration, 'Supported');
  assert.equal(mini.keySpecs?.lipSync, 'Supported');
  assert.deepEqual(extractMaxDuration(String(mini.keySpecs?.maxDuration), null), { label: '15s', value: 15 });
  assert.equal(parseMaxDurationNumber(String(mini.keySpecs?.maxDuration)), 15);
  assert.deepEqual(extractMaxDuration('15s output (3-60s source for video edit)', null), { label: '15s', value: 15 });
});

test('Seedance public copy does not name implementation providers', () => {
  const providerPattern = /BytePlus|byteplus|fal\.ai|\bFal\b/;
  ['seedance-2-0', 'seedance-2-0-fast', 'seedance-2-0-mini'].forEach((engineId) => {
    const entry = listFalEngines().find((engine) => engine.id === engineId);
    assert.ok(entry, `Missing engine ${engineId}`);
    const publicCopy = collectPublicCopy({
      marketingName: entry.marketingName,
      label: entry.engine.label,
      description: entry.engine.description,
      seo: entry.engine.seo,
      faq: entry.engine.faq,
      promptHints: entry.engine.promptHints,
      surfaces: entry.surfaces,
    }).join('\n');
    assert.doesNotMatch(publicCopy, providerPattern, `${engineId} public copy should hide implementation providers`);
  });
});

test('Seedance 2 marketing copy distinguishes standard 4K from Fast 720p', () => {
  const locales = ['en', 'fr', 'es'] as const;

  locales.forEach((locale) => {
    const standardPath = path.join(process.cwd(), `content/models/${locale}/seedance-2-0.json`);
    const fastPath = path.join(process.cwd(), `content/models/${locale}/seedance-2-0-fast.json`);
    const standard = JSON.parse(fs.readFileSync(standardPath, 'utf8')) as {
      hero?: { badge?: string };
      custom?: { specSections?: Array<{ items?: string[] }> };
    };
    const fast = JSON.parse(fs.readFileSync(fastPath, 'utf8')) as {
      hero?: { badge?: string };
      custom?: { specSections?: Array<{ items?: string[] }> };
    };

    const standardCopy = JSON.stringify([standard.hero?.badge, standard.custom?.specSections]);
    const fastCopy = JSON.stringify([fast.hero?.badge, fast.custom?.specSections]);

    assert.match(standardCopy, /1080p/i, `${locale} standard Seedance copy should mention 1080p`);
    assert.match(standardCopy, /4K/i, `${locale} standard Seedance copy should mention 4K`);
    assert.doesNotMatch(fastCopy, /1080p/i, `${locale} fast Seedance copy should stay capped at 720p`);
    assert.doesNotMatch(fastCopy, /4K/i, `${locale} fast Seedance copy should not claim 4K`);
  });
});

test('Public marketing media fetchers stay visibility-safe for pinned and prompt-based Seedance surfaces', () => {
  const videosSource = fs.readFileSync(path.join(process.cwd(), 'frontend/server/videos.ts'), 'utf8');
  const compareSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-showdowns.ts'),
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
  assert.deepEqual(PREFERRED_MEDIA['dreamina-seedance-2-0-mini'], {
    hero: 'job_d9481a70-db5c-4072-8ab7-adc82a8a5100',
    demo: 'job_d63d5269-6200-47d6-814d-9992b9a720be',
  });
  assert.deepEqual(FEATURED_EXAMPLE_MEDIA['dreamina-seedance-2-0-mini'], [
    'job_f2605150-0d2a-48ad-b1a9-bba8891d568b',
    'job_f9e077a0-2568-464e-a4e6-962537320dec',
    'job_2581d0af-23fc-46dd-a1df-049cac1824c1',
  ]);
});

test('Seedance becomes the app and marketing priority family ahead of Sora', () => {
  const appEngineIds = getBaseEnginesByCategory('video').map((engine) => engine.id);
  assert.equal(appEngineIds[0], 'seedance-2-0');
  assert.equal(appEngineIds[1], 'seedance-2-0-fast');
  assert.ok(appEngineIds.indexOf('sora-2') > appEngineIds.indexOf('seedance-2-0'));

  assert.deepEqual(
    MARKETING_NAV_MODELS.map((item) => item.key),
    ['seedance-2-0', 'seedance-2-0-fast', 'ltx-2-3-fast', 'veo-3-1', 'veo-3-1-lite', 'kling-o3-pro', 'kling-o3-4k']
  );
  assert.deepEqual(
    MARKETING_NAV_COMPARE.map((item) => item.key),
    [
      'seedance-2-0-vs-veo-3-1',
      'kling-3-pro-vs-kling-o3-pro',
      'ltx-2-3-pro-vs-veo-3-1',
      'seedance-2-0-vs-seedance-2-0-fast',
      'ltx-2-3-fast-vs-ltx-2-3-pro',
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

test('Header model menu promotes Seedance Fast while keeping the Veo family expanded', () => {
  assert.deepEqual(MARKETING_NAV_MODELS.map((item) => item.key), [
    'seedance-2-0',
    'seedance-2-0-fast',
    'ltx-2-3-fast',
    'veo-3-1',
    'veo-3-1-lite',
    'kling-o3-pro',
    'kling-o3-4k',
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
  assert.equal(resolveExampleFamilyId('happy-horse-1-1'), 'happy-horse');
  assert.equal(resolveExampleFamilyId('happy-horse-1-0'), 'happy-horse');
  assert.deepEqual(getExampleFamilyModelSlugs('happy-horse'), ['happy-horse-1-1', 'happy-horse-1-0']);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('happy-horse'), ['happy-horse-1-1']);
  assert.equal(getExampleNavFamilyIds().includes('happy-horse'), true);
});

test('Examples family current model groups do not classify new delivery models as older', () => {
  assert.deepEqual(getExampleFamilyModelSlugs('kling'), [
    'kling-o3-pro',
    'kling-o3-standard',
    'kling-o3-4k',
    'kling-3-pro',
    'kling-3-standard',
    'kling-3-4k',
    'kling-2-6-pro',
    'kling-2-5-turbo',
  ]);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('kling'), [
    'kling-o3-pro',
    'kling-o3-standard',
    'kling-o3-4k',
    'kling-3-pro',
    'kling-3-standard',
    'kling-3-4k',
  ]);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('seedance'), ['seedance-2-0', 'seedance-2-0-fast', 'dreamina-seedance-2-0-mini']);
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

  const videoOnlyReferenceAssets = {
    video_urls: [{ kind: 'video' as const }],
  };
  assert.equal(getUnifiedSeedanceMode(videoOnlyReferenceAssets), 'ref2v');
  assert.equal(getSeedanceFieldBlockKey('image_url', videoOnlyReferenceAssets), 'clearReferences');

  const audioOnlyAssets = {
    audio_urls: [{ kind: 'audio' as const }],
  };
  assert.equal(getSeedanceAssetState(audioOnlyAssets).hasReferenceAudio, true);
  assert.equal(getSeedanceAssetState(audioOnlyAssets).hasReferenceMedia, false);
});

test('Progressive asset slots show existing assets plus one empty slot', () => {
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 0 }), 1);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 2 }), 3);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 3 }), 4);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 9, filledCount: 8 }), 9);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 1, filledCount: 0 }), 1);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 1, filledCount: 1 }), 1);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 3, filledCount: 0 }), 1);
  assert.equal(getVisibleAssetSlotCount({ maxCount: 3, minCount: 2, filledCount: 0 }), 2);
  assert.deepEqual(
    getVisibleAssetSlots({ assets: [], maxCount: 9 }).map((slot) => slot.slotIndex),
    [0]
  );
  assert.deepEqual(
    getVisibleAssetSlots({ assets: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], maxCount: 9 }).map((slot) => slot.slotIndex),
    [0, 1, 2, 3]
  );
  assert.equal(getVisibleAssetSlots({ assets: Array.from({ length: 9 }, () => null), maxCount: 9 }).length, 1);
});

test('Unified Happy Horse workspace infers current 1.1 modes and legacy V2V mode from reference slots', () => {
  assert.equal(getUnifiedHappyHorseMode({}), 't2v');
  assert.equal(getUnifiedHappyHorseMode({ image_url: [{ kind: 'image' }] }), 'i2v');
  assert.equal(getUnifiedHappyHorseMode({ image_urls: [{ kind: 'image' }] }), 'ref2v');
  assert.equal(
    getUnifiedHappyHorseMode({ reference_image_urls: [{ kind: 'image' }] }, { supportsVideoEdit: true }),
    'v2v'
  );
  assert.equal(getUnifiedHappyHorseMode({ video_url: [{ kind: 'video' }] }, { supportsVideoEdit: true }), 'v2v');
  assert.equal(getUnifiedHappyHorseMode({ video_url: [{ kind: 'video' }] }), 't2v');
  assert.equal(getHappyHorseAssetState({ image_urls: [{ kind: 'image' }] }).hasR2vReferenceImage, true);
});

test('Fal requests serialize numeric duration selections as string enum values where required', () => {
  assert.equal(
    normalizeFalDurationValueForModel('seedance-2-0', 'bytedance/seedance-2.0/text-to-video', 12),
    '12'
  );
  assert.equal(
    normalizeFalDurationValueForModel('seedance-2-0-fast', 'bytedance/seedance-2.0/fast/image-to-video', 4),
    '4'
  );
  assert.equal(
    normalizeFalDurationValueForModel('wan-2-6', 'wan/v2.6/text-to-video', 5),
    '5'
  );
  assert.equal(
    normalizeFalDurationValueForModel('wan-2-6', 'wan/v2.6/image-to-video', 10),
    '10'
  );
  assert.equal(
    normalizeFalDurationValueForModel('wan-2-6', 'wan/v2.6/reference-to-video', 15),
    '15'
  );
  assert.equal(
    normalizeFalDurationValueForModel('kling-3-pro', 'fal-ai/kling-video/v3/pro/text-to-video', '9s'),
    '9'
  );
  assert.equal(
    normalizeFalDurationValueForModel('kling-3-4k', 'fal-ai/kling-video/v3/4k/text-to-video', 9),
    '9'
  );
  assert.equal(
    normalizeFalDurationValueForModel('veo-3-1', 'fal-ai/veo3.1/text-to-video', 8),
    8
  );
});
