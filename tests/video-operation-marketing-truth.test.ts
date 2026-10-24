import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import catalog from '../frontend/config/engine-catalog.json';
import specs from '../data/benchmarks/engine-key-specs.v1.json';
import { buildSpecValues as modelSpecs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-values';
import { buildSpecValues as compareSpecs, localizeSpecDetailValue } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-spec-values';
import { buildModelPageSpecProjection } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-projection';
import { extractMaxResolution } from '../frontend/app/(localized)/[locale]/(marketing)/models/_lib/models-catalog-utils';
import { localizeSpecStatus } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-spec-status';

for (const [id, expected] of [
  ['minimax-h3-max', /Recast.*Relight/], ['flux-3', /FAST Edit/],
  ['flux-3-draft', /Enhance Draft/], ['kling-o3-standard', /Reference.*Edit/],
  ['kling-o3-pro', /Reference.*Edit/], ['kling-o3-4k', /Reference.*Edit/],
] as const) test(`${id}: model and comparison facts name exact source operations instead of generic editing`, () => {
  const engine = getFalEngineById(id)!;
  const authored = specs.specs.find(row => row.modelSlug === engine.modelSlug)!.keySpecs;
  const model = modelSpecs(engine, authored);
  const comparison = compareSpecs(catalog.find(row => row.engineId === id)!, authored);
  assert.match(model.videoToVideo, expected);
  assert.equal(comparison.videoToVideo, model.videoToVideo);
  for (const locale of ['en', 'fr', 'es'] as const) {
    const value = localizeSpecStatus(model.videoToVideo, locale);
    assert.match(value, expected);
    assert.equal(localizeSpecDetailValue(comparison.videoToVideo, locale, { pending: 'pending', supported: 'supported', notSupported: 'no' }).includes('Supported ('), false);
    if (locale !== 'en') assert.doesNotMatch(value, /specialized source tools|owned Draft|timing and framing/);
  }
});

test('first/end frames are accurately exposed for the exact older Kling routes without a video source claim', () => {
  for (const id of ['kling-2-5-turbo', 'kling-2-6-pro']) {
    const engine = getFalEngineById(id)!;
    const authored = specs.specs.find(row => row.modelSlug === engine.modelSlug)!.keySpecs;
    for (const facts of [modelSpecs(engine, authored), compareSpecs(catalog.find(row => row.engineId === id)!, authored)]) {
      assert.match(facts.firstLastFrame, /end image/i);
      assert.equal(facts.referenceVideo, 'Not supported');
    }
  }
});

test('generic source editing remains available without acquiring specialized operations', () => {
  const engine = getFalEngineById('seedance-2-5')!;
  assert.equal(modelSpecs(engine, undefined).videoToVideo, 'Supported');
  assert.equal(compareSpecs(catalog.find(row => row.engineId === engine.id)!, undefined).videoToVideo, 'Supported');
});

test('localized content preserves native operations, source eligibility and pending H3 tools', () => {
  for (const locale of ['en', 'fr', 'es']) {
    const load = (slug: string) => JSON.parse(readFileSync(`content/models/${locale}/${slug}.json`, 'utf8'));
    const h3Document = load('minimax-h3-max');
    const pending = h3Document.decision.referenceWorkflows.find((workflow: { title: string }) => workflow.title === 'Extend / Insert / Reframe');
    assert.match(pending.body, /pending|en attente|pendientes/);
    assert.equal(getFalEngineById('minimax-h3-max')!.engine.modes.includes('extend'), false);
    const h3 = JSON.stringify(h3Document);
    assert.match(h3, /Recast/); assert.match(h3, /Relight/); assert.match(h3, /Extend.*Insert.*Reframe/);
    const draft = JSON.stringify(load('flux-3-draft'));
    assert.match(draft, /Enhance/); assert.match(draft, /21/); assert.match(draft, /Extend/);
    const luma = JSON.stringify(load('luma-ray-3-2'));
    assert.match(luma, /Extend/); assert.match(luma, /5/);
    const flux = JSON.stringify(load('flux-3'));
    assert.match(flux, /FAST/); assert.match(flux, /1–10/);
    const kling = load('kling-o3-4k');
    assert.doesNotMatch(JSON.stringify(kling.decision.referenceWorkflows), /No source video|Pas de vid[eé]o source|Sin video fuente/);
  }
});

test('rendered Draft resolution keeps its native versus Enhance qualification', () => {
  const engine = getFalEngineById('flux-3-draft')!;
  const keySpecs = specs.specs.find(row => row.modelSlug === engine.modelSlug)!.keySpecs;
  const projection = buildModelPageSpecProjection({ engine, locale: 'en', isImageEngine: false, showPriceInSpecs: false, keySpecs });
  const resolution = projection.keySpecRows.find(row => row.key === 'maxResolution')!.value;
  assert.match(resolution, /720p.*native Draft.*1080p.*Enhance/);
});

test('catalogue keeps valid higher image-generation resolutions across scoped clauses', () => {
  assert.deepEqual(extractMaxResolution('T2V: 480p/720p; I2V: 480p/720p/1080p', ['480p', '720p']), { label: '1080p', value: 1080 });
});
