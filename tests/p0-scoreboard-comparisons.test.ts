import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import { getCanonicalCompareSlug } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-routing.ts';
import { buildCanonicalCompareSlug } from '../frontend/lib/compare-hub/data.ts';

const P0_IDS = [
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;

const SCORE_FIELDS = [
  'fidelity',
  'visualQuality',
  'motion',
  'consistency',
  'anatomy',
  'textRendering',
  'lipsyncQuality',
  'sequencingQuality',
  'controllability',
  'speedStability',
  'pricing',
] as const;

const PAIRS = [
  { leftId: 'ltx-2-3', leftSlug: 'ltx-2-3-pro', rightId: 'ltx-2-5-pro', rightSlug: 'ltx-2-5-pro' },
  { leftId: 'ltx-2-3-fast', leftSlug: 'ltx-2-3-fast', rightId: 'ltx-2-5-fast', rightSlug: 'ltx-2-5-fast' },
  { leftId: 'ltx-2-5-fast', leftSlug: 'ltx-2-5-fast', rightId: 'ltx-2-5-pro', rightSlug: 'ltx-2-5-pro' },
  { leftId: 'wan-2-6', leftSlug: 'wan-2-6', rightId: 'wan-3', rightSlug: 'wan-3' },
  { leftId: 'wan-3', leftSlug: 'wan-3', rightId: 'wan-3-prime', rightSlug: 'wan-3-prime' },
  { leftId: 'flux-3', leftSlug: 'flux-3', rightId: 'flux-3-draft', rightSlug: 'flux-3-draft' },
  { leftId: 'grok-imagine-video-1-5', leftSlug: 'grok-imagine-video-1-5', rightId: 'sora-2', rightSlug: 'sora-2' },
  { leftId: 'flux-3', leftSlug: 'flux-3', rightId: 'grok-imagine-video-1-5', rightSlug: 'grok-imagine-video-1-5' },
] as const;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

test('all P0 models have eleven reviewed numeric scores and a derived three-axis overall', () => {
  const document = JSON.parse(readFileSync('data/benchmarks/engine-scores.v1.json', 'utf8')) as {
    last_updated: string;
    scores: Array<Record<string, unknown> & { modelSlug: string }>;
  };
  assert.equal(document.last_updated, '2026-09-02');

  for (const modelId of P0_IDS) {
    const score = document.scores.find(({ modelSlug }) => modelSlug === modelId);
    assert.ok(score, modelId);
    assert.equal(Object.hasOwn(score, 'overall'), false, `${modelId} overall must stay derived`);
    for (const field of SCORE_FIELDS) {
      const value = score[field];
      assert.equal(typeof value, 'number', `${modelId}.${field}`);
      assert.ok(Number.isFinite(value as number), `${modelId}.${field}`);
      assert.ok((value as number) >= 0 && (value as number) <= 10, `${modelId}.${field}`);
      assert.equal(value, roundToOneDecimal(value as number), `${modelId}.${field}`);
    }
    assert.equal(score.last_updated, '2026-09-02');
    const overall = roundToOneDecimal(
      ((score.fidelity as number) + (score.motion as number) + (score.consistency as number)) / 3,
    );
    assert.ok(overall >= 0 && overall <= 10, `${modelId} overall`);
  }
});

test('all P0 models have complete sourced key specs', () => {
  const document = JSON.parse(readFileSync('data/benchmarks/engine-key-specs.v1.json', 'utf8')) as {
    last_updated: string;
    specs: Array<{ modelSlug: string; sources: string[]; keySpecs: Record<string, unknown> }>;
  };
  const required = [
    'textToVideo',
    'imageToVideo',
    'videoToVideo',
    'firstLastFrame',
    'referenceImageStyle',
    'referenceVideo',
    'maxResolution',
    'maxDuration',
    'aspectRatios',
    'fpsOptions',
    'outputFormats',
    'audioOutput',
    'nativeAudioGeneration',
    'lipSync',
    'cameraMotionControls',
    'watermark',
    'releaseDate',
  ];
  assert.equal(document.last_updated, '2026-09-02');
  for (const modelId of P0_IDS) {
    const row = document.specs.find(({ modelSlug }) => modelSlug === modelId);
    assert.ok(row, modelId);
    assert.ok(row.sources.length >= 2, modelId);
    assert.ok(row.sources.every((source) => source.startsWith('https://')), modelId);
    for (const field of required) assert.ok(Object.hasOwn(row.keySpecs, field), `${modelId}.${field}`);
  }
});

test('the eight canonical P0 comparison documents are localized and scoreboard-only', () => {
  const compareConfig = JSON.parse(readFileSync('frontend/config/compare-config.json', 'utf8')) as {
    scoreboardOnlyComparisons: string[];
    showdowns: Record<string, unknown>;
  };

  for (const pair of PAIRS) {
    const canonical = buildCanonicalCompareSlug(pair.leftSlug, pair.rightSlug);
    assert.equal(getCanonicalCompareSlug(canonical)?.canonicalSlug, canonical);
    assert.equal(
      getCanonicalCompareSlug(`${pair.rightSlug}-vs-${pair.leftSlug}`)?.canonicalSlug,
      canonical,
    );
    const file = `content/comparisons/${canonical}.json`;
    assert.equal(existsSync(file), true, file);
    const document = parseComparePageContentDocument(readFileSync(file, 'utf8'), canonical, file);
    for (const locale of ['en', 'fr', 'es'] as const) {
      assert.ok(document[locale].meta?.title);
      assert.ok(document[locale].meta?.description);
      assert.ok(document[locale].quickVerdict?.body);
      assert.ok((document[locale].primaryLinks?.length ?? 0) >= 2);
    }
    assert.ok(compareConfig.scoreboardOnlyComparisons.includes(canonical), canonical);
    assert.equal(compareConfig.showdowns[canonical], undefined, `${canonical} must not have face-to-face media`);
  }
});

test('hidden P0 models pre-author only the eight approved comparison edges', () => {
  const registry = JSON.parse(readFileSync('frontend/config/model-registry.json', 'utf8')) as {
    models: Array<{
      id: string;
      publication: {
        compare: {
          published: boolean;
          indexed: boolean;
          suggestedOpponentIds: string[];
          publishedPairIds: string[];
        };
      };
    }>;
  };
  const expected = new Map<string, Set<string>>(P0_IDS.map((id) => [id, new Set()]));
  for (const { leftId, rightId } of PAIRS) {
    if (expected.has(leftId)) expected.get(leftId)?.add(rightId);
    if (expected.has(rightId)) expected.get(rightId)?.add(leftId);
  }

  for (const modelId of P0_IDS) {
    const model = registry.models.find(({ id }) => id === modelId);
    assert.ok(model, modelId);
    assert.equal(model.publication.compare.published, false, modelId);
    assert.equal(model.publication.compare.indexed, false, modelId);
    assert.deepEqual(
      new Set(model.publication.compare.publishedPairIds),
      expected.get(modelId),
      modelId,
    );
    assert.ok(
      model.publication.compare.suggestedOpponentIds.every((id) => expected.get(modelId)?.has(id)),
      modelId,
    );
  }
});
