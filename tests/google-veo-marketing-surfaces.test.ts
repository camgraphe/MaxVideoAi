import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import keySpecsFile from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import { getHubEngines } from '../frontend/lib/compare-hub/data.ts';
import {
  buildSpecValues,
  formatMaxResolution,
} from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values.ts';

type EngineCatalogEntry = (typeof engineCatalog)[number];

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

test('Google Veo marketing cards and compare specs reflect 4K support by tier', () => {
  const standard = getCatalogEntry('veo-3-1');
  const fast = getCatalogEntry('veo-3-1-fast');
  const lite = getCatalogEntry('veo-3-1-lite');

  assert.equal(formatMaxResolution(standard), '4K');
  assert.equal(formatMaxResolution(fast), '4K');
  assert.equal(formatMaxResolution(lite), '1080p');

  const standardSpecs = buildSpecValues(standard, getKeySpecs('veo-3-1'));
  const fastSpecs = buildSpecValues(fast, getKeySpecs('veo-3-1-fast'));
  const liteSpecs = buildSpecValues(lite, getKeySpecs('veo-3-1-lite'));

  assert.equal(standardSpecs.maxResolution, '4K');
  assert.equal(fastSpecs.maxResolution, '4K');
  assert.equal(liteSpecs.maxResolution, '1080p');
  assert.equal(lite.engine.resolutions.includes('4k'), false);

  assert.equal(standardSpecs.aspectRatios, '16:9 / 9:16');
  assert.equal(fastSpecs.aspectRatios, '16:9 / 9:16');
  assert.equal(liteSpecs.aspectRatios, '16:9 / 9:16');

  assert.match(standardSpecs.referenceImageStyle, /1-3/);
  assert.match(fastSpecs.referenceImageStyle, /1-3/);
  assert.doesNotMatch(standardSpecs.referenceImageStyle, /1-4/);
  assert.doesNotMatch(fastSpecs.referenceImageStyle, /1-4/);

  const hubCards = new Map(getHubEngines().map((entry) => [entry.modelSlug, entry]));
  assert.equal(hubCards.get('veo-3-1')?.maxResolutionLabel, '4K');
  assert.equal(hubCards.get('veo-3-1-fast')?.maxResolutionLabel, '4K');
  assert.equal(hubCards.get('veo-3-1-lite')?.maxResolutionLabel, '1080p');
});

test('Google Veo compare specs expose lip sync consistently across all public tiers', () => {
  for (const slug of ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite']) {
    const entry = getCatalogEntry(slug);
    const specs = buildSpecValues(entry, getKeySpecs(slug));

    assert.equal(entry.features?.lipsync?.value, true, `${slug} should set the catalog lipsync feature`);
    assert.equal(specs.audioOutput, 'Supported');
    assert.equal(specs.nativeAudioGeneration, 'Supported');
    assert.equal(specs.lipSync, 'Supported');
  }
});
