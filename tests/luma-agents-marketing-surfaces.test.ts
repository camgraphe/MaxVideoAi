import assert from 'node:assert/strict';
import test from 'node:test';

import scoresFile from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import keySpecsFile from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import { MODEL_FAMILIES } from '../frontend/config/model-families.ts';
import {
  getExampleFamilyCurrentModelSlugs,
  getExampleFamilyModelSlugs,
} from '../frontend/lib/model-families.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

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

function overall(entry: ReturnType<typeof score>) {
  const values = [entry.fidelity, entry.motion, entry.consistency].filter(
    (value): value is number => typeof value === 'number'
  );
  assert.ok(values.length, `${entry.modelSlug} should have at least one overall score input`);
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
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
  assert.ok((ray32.speedStability ?? 0) <= 7.2);
  assert.equal(ray32.lipsyncQuality, null);
});

test('Luma Agents specs keep Ray video-only and Uni image-only capabilities explicit', () => {
  const ray32 = keySpecs('luma-ray-3-2');

  assert.equal(ray32.textToVideo, 'Supported');
  assert.equal(ray32.imageToVideo, 'Supported');
  assert.equal(ray32.firstLastFrame, 'Not supported (not exposed in current MaxVideoAI route)');
  assert.equal(ray32.referenceImageStyle, 'Supported (multi reference stills)');
  assert.equal(ray32.maxResolution, '1080p');
  assert.equal(ray32.audioOutput, 'Not supported');
  assert.equal(ray32.nativeAudioGeneration, 'Not supported');
  assert.equal(ray32.lipSync, 'Not supported');
  assert.deepEqual(ray32.aspectRatios, [
    '3:1',
    '2:1',
    '21:9',
    '16:9',
    '4:3',
    '3:2',
    '1:1',
    '9:16',
    '3:4',
    '2:3',
    '1:2',
    '1:3',
  ]);

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
  assert.ok(lumaFamily.routeAliases?.includes('luma-ray-3-2'));
  assert.ok(lumaFamily.examplesPage?.publishedModelSlugs?.includes('luma-ray-3-2'));
  assert.deepEqual(lumaFamily.examplesPage?.currentModelSlugs, ['luma-ray-3-2']);
  assert.ok(getExampleFamilyModelSlugs('luma').includes('luma-ray-3-2'));
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('luma'), ['luma-ray-3-2']);
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

test('Luma Ray 3.2 discovery stays behind current video leaders', () => {
  const expectedPlacements: Record<string, string[]> = {
    'image-to-video': ['seedance-2-0', 'veo-3-1', 'kling-3-pro'],
    'cinematic-realism': ['seedance-2-0', 'kling-3-pro', 'veo-3-1'],
    'product-videos': ['ltx-2-3-pro', 'seedance-2-0', 'kling-3-pro'],
  };

  for (const [slug, leaders] of Object.entries(expectedPlacements)) {
    const picks = topPicks(slug);

    assert.equal(picks.includes('luma-ray-3-2'), true, `${slug} should include Luma Ray 3.2`);
    assert.deepEqual(picks.slice(0, leaders.length), leaders);
    assert.equal(picks.indexOf('luma-ray-3-2'), leaders.length);
  }

  for (const page of compareConfig.bestForPages) {
    if (Object.hasOwn(expectedPlacements, page.slug)) {
      continue;
    }

    assert.equal(page.topPicks.includes('luma-ray-3-2'), false, `${page.slug} should not include Luma Ray 3.2`);
  }
});
