import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import compareConfig from '../frontend/config/compare-config.json' with { type: 'json' };
import { MODEL_FAMILIES } from '../frontend/config/model-families.ts';
import {
  MODEL_LAUNCH_READY_MODELS,
  P0_VIDEO_EXAMPLE_MODEL_IDS,
} from '../frontend/config/model-launch-readiness.ts';
import { listRuntimeModels } from '../frontend/config/model-runtime.ts';
import {
  MARKETING_NAV_EXAMPLES,
  MARKETING_NAV_MODELS,
} from '../frontend/config/navigation.ts';
import { buildLlmsModelDiscoveryProjection } from '../frontend/lib/seo/llms-text.ts';
import { listFalEngines } from '../frontend/src/config/falEngines.ts';

const P0 = P0_VIDEO_EXAMPLE_MODEL_IDS;
const EXPECTED_MODES = new Map<string, readonly string[]>([
  ['wan-3', ['t2v', 'i2v', 'ref2v']],
  ['wan-3-prime', ['t2v', 'i2v', 'ref2v']],
  ['ltx-2-5-fast', ['t2v', 'i2v', 'a2v']],
  ['ltx-2-5-pro', ['t2v', 'i2v', 'a2v']],
  ['grok-imagine-video-1-5', ['t2v', 'i2v', 'ref2v']],
  ['flux-3', ['t2v', 'i2v', 'fl2v', 'extend']],
  ['flux-3-draft', ['t2v', 'i2v', 'fl2v', 'extend']],
]);
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
  'ltx-2-3-pro-vs-ltx-2-5-pro',
  'ltx-2-3-fast-vs-ltx-2-5-fast',
  'ltx-2-5-fast-vs-ltx-2-5-pro',
  'wan-2-6-vs-wan-3',
  'wan-3-vs-wan-3-prime',
  'flux-3-vs-flux-3-draft',
  'grok-imagine-video-1-5-vs-sora-2',
  'flux-3-vs-grok-imagine-video-1-5',
] as const;

test('every non-publication P0 launch prerequisite is complete', () => {
  const runtimeById = new Map(listRuntimeModels().map((model) => [model.id, model]));
  const engineById = new Map(listFalEngines().map((entry) => [entry.id, entry]));
  const readinessById = new Map(MODEL_LAUNCH_READY_MODELS.map((entry) => [entry.modelId, entry]));
  const scores = JSON.parse(readFileSync('data/benchmarks/engine-scores.v1.json', 'utf8')).scores as Array<Record<string, unknown>>;
  const specs = JSON.parse(readFileSync('data/benchmarks/engine-key-specs.v1.json', 'utf8')).specs as Array<Record<string, unknown>>;

  for (const id of P0) {
    const model = runtimeById.get(id);
    const engine = engineById.get(id);
    const readiness = readinessById.get(id);
    assert.equal(model?.lifecycle, 'current', id);
    assert.equal(engine?.availability, 'available', id);
    assert.equal(engine?.engine.status, 'live', id);
    assert.deepEqual(engine?.engine.modes, EXPECTED_MODES.get(id), id);
    assert.ok(engine?.engine.pricingDetails, `${id} pricing`);
    assert.equal(readiness?.acceptedAssetCount, 2, `${id} accepted assets`);
    assert.equal(readiness?.waveId, 'p0', `${id} launch wave`);
    assert.equal(readiness?.modelPlaylistSlug, `examples-${id}`);
    for (const locale of ['en', 'fr', 'es']) {
      assert.equal(existsSync(`content/models/${locale}/${model?.slug}.json`), true, `${locale}:${id}`);
    }
    const score = scores.find((row) => row.modelSlug === id);
    assert.ok(score, `${id} scores`);
    for (const field of SCORE_FIELDS) assert.equal(typeof score[field], 'number', `${id}.${field}`);
    const spec = specs.find((row) => row.modelSlug === id) as { sources?: unknown[] } | undefined;
    assert.ok((spec?.sources?.length ?? 0) >= 2, `${id} specs`);
  }

  for (const slug of PAIRS) {
    assert.equal(existsSync(`content/comparisons/${slug}.json`), true, slug);
    assert.ok(compareConfig.scoreboardOnlyComparisons.includes(slug), slug);
    assert.equal(compareConfig.showdowns?.[slug as keyof typeof compareConfig.showdowns], undefined, slug);
  }
});

test('the complete P0 graph publishes atomically across public discovery surfaces', () => {
  const runtimeById = new Map(listRuntimeModels().map((model) => [model.id, model]));
  const engineById = new Map(listFalEngines().map((entry) => [entry.id, entry]));

  for (const id of P0) {
    const publication = runtimeById.get(id)?.publication;
    assert.deepEqual(publication, {
      model: { published: true, indexable: true },
      examples: {
        published: true,
        includeInFamilyCopy: true,
        current: true,
        familyRank: id === 'wan-3-prime' || id === 'ltx-2-5-pro' || id === 'grok-imagine-video-1-5' || id === 'flux-3' ? 0 : 1,
      },
      compare: publication?.compare,
      app: { published: true },
      pricing: { published: true },
      sitemap: { published: true },
    }, id);
    assert.equal(publication?.compare.published, true, `${id} compare`);
    assert.equal(publication?.compare.indexed, true, `${id} compare indexation`);
    const surfaces = engineById.get(id)?.surfaces;
    assert.deepEqual(surfaces?.modelPage, { indexable: true, includeInSitemap: true }, id);
    assert.equal(surfaces?.examples.includeInFamilyResolver, true, id);
    assert.equal(surfaces?.compare.includeInHub, true, id);
    assert.equal(surfaces?.app.enabled, true, id);
    assert.equal(surfaces?.pricing.includeInEstimator, true, id);
  }

  assert.deepEqual(
    MARKETING_NAV_MODELS.filter(({ key }) => P0.includes(key as (typeof P0)[number])).map(({ key }) => key),
    ['ltx-2-5-pro', 'wan-3-prime', 'grok-imagine-video-1-5', 'flux-3'],
  );
  for (const familyId of ['wan', 'ltx', 'grok', 'flux']) {
    const family = MODEL_FAMILIES.find(({ id }) => id === familyId);
    assert.equal(family?.examplesPage?.stage, 'indexed', familyId);
    assert.ok(MARKETING_NAV_EXAMPLES.some(({ key }) => key === familyId), familyId);
  }

  const discovery = buildLlmsModelDiscoveryProjection();
  assert.deepEqual(discovery.currentModels.map(({ id }) => id).sort(), [...P0].sort());
  assert.deepEqual(discovery.families.map(({ id }) => id).sort(), ['flux', 'grok', 'ltx', 'wan']);
  assert.deepEqual(discovery.primaryComparisons.map(({ slug }) => slug).sort(), [...PAIRS].sort());
});
