import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import scoresFile from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import keySpecsFile from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import { MODEL_FAMILIES } from '../frontend/config/model-families.ts';
import {
  getExampleFamilyCurrentModelSlugs,
  getExampleFamilyModelSlugs,
} from '../frontend/lib/model-families.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { ENGINE_SELECT_FAMILY_PRIORITY } from '../frontend/src/lib/engine-family-priority.ts';

const modelPageLayoutSource = readFileSync(
  new URL('../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_components/MarketingModelPageLayout.tsx', import.meta.url),
  'utf8'
);
const modelsCatalogCardsSource = readFileSync(
  new URL('../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-cards.ts', import.meta.url),
  'utf8'
);
const modelsCatalogDecisionSource = readFileSync(
  new URL('../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-decision-data.ts', import.meta.url),
  'utf8'
);

function score(slug: string) {
  const entry = scoresFile.scores.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Missing score for ${slug}`);
  return entry;
}

function keySpecs(slug: string) {
  const entry = keySpecsFile.specs.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry?.keySpecs, `Missing specs for ${slug}`);
  return entry.keySpecs;
}

function topPicks(slug: string): string[] {
  const entry = compareConfig.bestForPages.find((candidate) => candidate.slug === slug);
  assert.ok(entry, `Missing best-for page ${slug}`);
  return entry.topPicks;
}

function catalogEntry(slug: string) {
  const entry = engineCatalog.find((candidate) => candidate.modelSlug === slug);
  assert.ok(entry, `Missing catalog entry for ${slug}`);
  return entry;
}

function overall(entry: ReturnType<typeof score>) {
  const values = [entry.fidelity, entry.motion, entry.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  assert.ok(values.length, `${entry.modelSlug} should have at least one overall score input`);
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function orderedSlugIndex(source: string, slug: string) {
  const index = source.indexOf(`'${slug}'`);
  assert.notEqual(index, -1, `Missing ${slug} in ordered source`);
  return index;
}

test('Luma Agents scores are conservative against current video leaders', () => {
  const ray32 = score('luma-ray-3-2');
  const seedance = score('seedance-2-0');
  const kling = score('kling-3-pro');

  assert.ok((ray32.motion ?? 0) <= (seedance.motion ?? 0));
  assert.ok((ray32.motion ?? 0) <= (kling.motion ?? 0));
  assert.ok((ray32.visualQuality ?? 0) <= (kling.visualQuality ?? 0));
  assert.ok(overall(ray32) <= overall(seedance));
  assert.ok(overall(ray32) <= overall(kling));
  assert.ok(overall(ray32) < overall(score('veo-3-1')));
  assert.ok((ray32.controllability ?? 0) >= 8.3);
  assert.ok((ray32.speedStability ?? 0) <= 6.8);
  assert.equal(ray32.lipsyncQuality, null);
});

test('Luma Agents specs keep Ray video-only and Uni image-only capabilities explicit', () => {
  const ray32 = keySpecs('luma-ray-3-2');

  assert.equal(ray32.textToVideo, 'Supported');
  assert.equal(ray32.imageToVideo, 'Supported');
  assert.equal(ray32.videoToVideo, 'Supported (Ray 3.2 Modify and Reframe source-video routes)');
  assert.equal(ray32.firstLastFrame, 'Supported (I2V end frame plus Modify guide/keyframes up to 64 anchors)');
  assert.equal(ray32.referenceImageStyle, 'Supported through guide frames and indexed Modify keyframes');
  assert.equal(ray32.referenceVideo, 'Supported for Modify and Reframe source-video workflows');
  assert.equal(ray32.maxResolution, '1080p');
  assert.equal(ray32.cameraMotionControls, 'Prompt, source-video preservation, guide frames and Modify keyframes');
  assert.equal(ray32.audioOutput, 'Not supported');
  assert.equal(ray32.nativeAudioGeneration, 'Not supported');
  assert.equal(ray32.lipSync, 'Not supported');
  assert.deepEqual(ray32.aspectRatios, ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9']);

  for (const slug of ['luma-uni-1', 'luma-uni-1-max']) {
    const specs = keySpecs(slug);
    const imageScore = score(slug);

    assert.equal(specs.textToImage, 'Supported');
    assert.equal(specs.imageToImage, 'Supported');
    assert.equal(specs.videoToVideo, 'Not supported');
    assert.equal(specs.audioOutput, 'Not supported');
    assert.deepEqual(specs.outputFormats, ['PNG', 'JPEG']);
    assert.equal(imageScore.motion, null);
    assert.equal(imageScore.lipsyncQuality, null);
  }
});

test('Luma Ray 3.2 best-for cards resolve through the existing Luma examples family', () => {
  const ray32 = listFalEngines().find((engine) => engine.modelSlug === 'luma-ray-3-2');
  assert.ok(ray32, 'Missing Luma Ray 3.2 engine');
  assert.equal(ray32.family, 'luma');

  const lumaFamily = MODEL_FAMILIES.find((family) => family.id === 'luma');
  assert.ok(lumaFamily, 'Missing Luma model family');
  assert.equal(lumaFamily.navLabel, 'Ray 3.2');
  assert.equal(lumaFamily.defaultModelSlug, 'luma-ray-3-2');
  assert.ok(lumaFamily.routeAliases?.includes('luma-ray-3-2'));
  assert.ok(lumaFamily.examplesPage?.publishedModelSlugs?.includes('luma-ray-3-2'));
  assert.deepEqual(lumaFamily.examplesPage?.currentModelSlugs, ['luma-ray-3-2']);
  assert.ok(getExampleFamilyModelSlugs('luma').includes('luma-ray-3-2'));
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('luma'), ['luma-ray-3-2']);
});

test('Luma Ray 2 routes stay indexable but move behind current Ray 3.2 discovery', () => {
  const engines = new Map(listFalEngines().map((engine) => [engine.modelSlug, engine]));
  const ray32 = engines.get('luma-ray-3-2');
  const ray2 = engines.get('luma-ray-2');
  const ray2Flash = engines.get('luma-ray-2-flash');

  assert.ok(ray32, 'Missing Luma Ray 3.2');
  assert.ok(ray2, 'Missing Luma Ray 2');
  assert.ok(ray2Flash, 'Missing Luma Ray 2 Flash');

  assert.equal(ray32.isLegacy, undefined);
  assert.equal(ray2.isLegacy, true);
  assert.equal(ray2Flash.isLegacy, true);
  assert.equal(ray2.seo.canonicalPath, '/models/luma-ray-2');
  assert.equal(ray2Flash.seo.canonicalPath, '/models/luma-ray-2-flash');
  assert.equal(ray2.surfaces.modelPage.indexable, true);
  assert.equal(ray2Flash.surfaces.modelPage.indexable, true);
  assert.match(ray2.seo.title, /Legacy/);
  assert.match(ray2Flash.seo.title, /Legacy/);
  assert.match(catalogEntry('luma-ray-2').bestFor ?? '', /Legacy Luma/i);
  assert.match(catalogEntry('luma-ray-2-flash').bestFor ?? '', /Legacy fast Luma/i);
  assert.equal(ray32.surfaces.app.enabled, true);
  assert.equal(ray2.surfaces.app.enabled, true);
  assert.equal(ray2Flash.surfaces.app.enabled, true);
  assert.equal((ENGINE_SELECT_FAMILY_PRIORITY as readonly string[]).includes('luma'), false);
});

test('Luma catalog placement exposes Ray 3.2 without dethroning current leaders', () => {
  for (const leader of ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'ltx-2-3-fast']) {
    assert.ok(
      orderedSlugIndex(modelsCatalogCardsSource, leader) < orderedSlugIndex(modelsCatalogCardsSource, 'luma-ray-3-2'),
      `${leader} should stay ahead of Luma Ray 3.2 in the model catalog order`
    );
    assert.ok(
      orderedSlugIndex(modelsCatalogDecisionSource, leader) < orderedSlugIndex(modelsCatalogDecisionSource, 'luma-ray-3-2'),
      `${leader} should stay ahead of Luma Ray 3.2 in recommended model cards`
    );
  }

  assert.match(modelsCatalogCardsSource, /'luma-ray-3-2': 'Best for current Luma Modify Video, Reframe/);
  assert.match(modelsCatalogCardsSource, /'luma-ray-2': 'Legacy Luma route/);
  assert.match(modelsCatalogCardsSource, /'luma-ray-2-flash': 'Legacy fast Luma route/);
  assert.ok(
    orderedSlugIndex(modelsCatalogCardsSource, 'luma-ray-3-2') < orderedSlugIndex(modelsCatalogCardsSource, 'luma-ray-2'),
    'Current Ray 3.2 should precede legacy Ray 2 in the model catalog order'
  );
  assert.equal(modelsCatalogDecisionSource.includes("'luma-ray-2'"), false);
  assert.equal(modelsCatalogDecisionSource.includes("'luma-ray-2-flash'"), false);
});

test('Luma Uni image models have specs but no compare pairs or video best-for placement', () => {
  const serializedCompareConfig = JSON.stringify(compareConfig);

  for (const slug of ['luma-uni-1', 'luma-uni-1-max']) {
    assert.ok(keySpecsFile.specs.find((entry) => entry.modelSlug === slug), `Missing specs for ${slug}`);
    assert.equal(serializedCompareConfig.includes(`${slug}-vs-`), false);
    assert.equal(serializedCompareConfig.includes(`-vs-${slug}`), false);

    for (const page of compareConfig.bestForPages) {
      assert.equal(page.topPicks.includes(slug), false, `${slug} should not appear in ${page.slug}`);
    }
  }
});

test('Luma Uni model pages use the image example fallback surface', () => {
  assert.match(modelPageLayoutSource, /engine\.modelSlug === 'luma-uni-1'/);
  assert.match(modelPageLayoutSource, /engine\.modelSlug === 'luma-uni-1-max'/);
});

test('Luma Ray 3.2 discovery stays behind current video leaders', () => {
  const expectedPlacements: Record<string, string[]> = {
    'image-to-video': ['seedance-2-0', 'kling-3-pro', 'veo-3-1'],
    'cinematic-realism': ['seedance-2-0', 'kling-3-pro', 'veo-3-1'],
    'reference-to-video': ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1'],
    'product-videos': ['seedance-2-0', 'kling-3-pro', 'veo-3-1', 'happy-horse-1-1'],
  };

  for (const [slug, leaders] of Object.entries(expectedPlacements)) {
    const picks = topPicks(slug);

    assert.equal(picks.includes('luma-ray-3-2'), true, `${slug} should include Luma Ray 3.2`);
    assert.deepEqual(picks.slice(0, leaders.length), leaders);
    assert.ok(picks.indexOf('luma-ray-3-2') >= leaders.length);
  }

  for (const page of compareConfig.bestForPages) {
    if (Object.hasOwn(expectedPlacements, page.slug)) {
      continue;
    }

    assert.equal(page.topPicks.includes('luma-ray-3-2'), false, `${page.slug} should not include Luma Ray 3.2`);
  }
});
