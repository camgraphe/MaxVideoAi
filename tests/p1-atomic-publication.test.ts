import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import scores from '../data/benchmarks/engine-scores.v1.json' with { type: 'json' };
import specs from '../data/benchmarks/engine-key-specs.v1.json' with { type: 'json' };
import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import readiness from '../frontend/config/model-launch-readiness.generated.json' with { type: 'json' };
import registry from '../frontend/config/model-registry.json' with { type: 'json' };
import roster from '../frontend/config/model-roster.json' with { type: 'json' };
import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { UNPUBLISHED_FAL_ENGINE_REGISTRY } from '../frontend/src/config/fal-engines/registry.ts';
import { getPrivateRuntimeEngineById } from '../frontend/src/server/video-generation/private-engine-registry.ts';

const NEW_MODEL_IDS = [
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;
const P1_MODEL_IDS = ['gemini-omni-flash', ...NEW_MODEL_IDS] as const;
const P1_COMPARISONS = [
  'minimax-h3-vs-minimax-h3-max',
  'kling-3-turbo-pro-vs-kling-3-turbo-standard',
  'kling-3-pro-vs-kling-3-turbo-pro',
  'gemini-omni-flash-vs-kling-3-turbo-pro',
] as const;

const SCORE_KEYS = [
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

test('the three new P1 identities publish atomically on every product surface', () => {
  const models = NEW_MODEL_IDS.map((id) => registry.models.find((model) => model.id === id));
  assert.equal(models.every(Boolean), true);
  const atomicStates = models.map((model) => model?.publication.model.published);
  assert.equal(new Set(atomicStates).size, 1, 'mixed P1 publication is forbidden');
  assert.deepEqual(atomicStates, [true, true, true]);

  for (const model of models) {
    assert.ok(model);
    assert.deepEqual(model.publication.model, { published: true, indexable: true }, model.id);
    assert.equal(model.publication.examples.published, true, model.id);
    assert.equal(model.publication.examples.includeInFamilyCopy, true, model.id);
    assert.equal(model.publication.examples.current, true, model.id);
    assert.equal(model.publication.compare.published, true, model.id);
    assert.equal(model.publication.compare.indexed, true, model.id);
    assert.equal(model.publication.compare.publishedPairIds.length > 0, true, model.id);
    assert.equal(model.publication.app.published, true, model.id);
    assert.equal(model.publication.pricing.published, true, model.id);
    assert.deepEqual(model.publication.sitemap, { published: true }, model.id);
  }
});

test('atomic publication is backed by launch media, scores, specs, content, comparisons and executable engines', () => {
  const readinessById = new Map(readiness.models.map((entry) => [entry.modelId, entry]));
  const scoresBySlug = new Map(scores.scores.map((entry) => [entry.modelSlug, entry]));
  const specsBySlug = new Map(specs.specs.map((entry) => [entry.modelSlug, entry]));
  const catalogIds = new Set(engineCatalog.map(({ engineId }) => engineId));
  const publicEngineIds = new Set(listFalEngines().map(({ id }) => id));
  const rosterIds = new Set(roster.map(({ engineId }) => engineId));

  for (const id of P1_MODEL_IDS) {
    const launch = readinessById.get(id);
    assert.equal(launch?.waveId, 'p1', `${id}: readiness wave`);
    assert.equal(launch?.acceptedAssetCount, 2, `${id}: accepted videos`);
    const score = scoresBySlug.get(id);
    assert.ok(score, `${id}: score row`);
    for (const key of SCORE_KEYS) assert.equal(Number.isFinite(score[key]), true, `${id}.${key}`);
    assert.ok(specsBySlug.get(id)?.sources.length, `${id}: sourced key specs`);
    for (const locale of ['en', 'fr', 'es']) {
      assert.equal(existsSync(`content/models/${locale}/${id}.json`), true, `${id}.${locale}`);
    }
    assert.equal(catalogIds.has(id), true, `${id}: executable catalog`);
  }

  for (const id of NEW_MODEL_IDS) {
    assert.equal(publicEngineIds.has(id), true, `${id}: workspace/MCP public engine`);
    assert.equal(rosterIds.has(id), true, `${id}: published roster`);
    assert.equal(
      UNPUBLISHED_FAL_ENGINE_REGISTRY.some((entry) => entry.id === id),
      false,
      `${id}: unpublished build registry`,
    );
    assert.equal(getPrivateRuntimeEngineById(id), undefined, `${id}: private runtime registry`);
  }
  for (const slug of P1_COMPARISONS) {
    assert.equal(compareConfig.scoreboardOnlyComparisons.includes(slug), true, slug);
    assert.equal(existsSync(`content/comparisons/${slug}.json`), true, slug);
  }
});

test('provider and video-indexing release gates remain explicit at publication', () => {
  const evidence = readFileSync('docs/model-launch/p1-video-model-refresh-evidence.md', 'utf8');
  const review = readFileSync('docs/model-launch/p1-video-example-review.md', 'utf8');
  const editorial = [
    readFileSync('frontend/config/video-seo-editorial.ts', 'utf8'),
    readFileSync('frontend/config/video-seo-watchlist.ts', 'utf8'),
  ].join('\n');
  const pack = JSON.parse(readFileSync('docs/model-launch/p1-video-example-pack.json', 'utf8')) as {
    assets: Array<{ jobId: string; watchPageCandidate: boolean }>;
  };

  assert.match(evidence, /Google direct provider contract \| proven/i);
  assert.match(evidence, /Kling direct provider contract \| proven/i);
  assert.match(evidence, /depleted-balance Fal fallback/i);
  assert.match(review, /published on site/i);
  assert.match(review, /admin SEO workflow/i);
  assert.match(review, /zero Video SEO pages/i);
  for (const asset of pack.assets) {
    assert.equal(asset.watchPageCandidate, false, asset.jobId);
    assert.doesNotMatch(editorial, new RegExp(asset.jobId));
  }
});
