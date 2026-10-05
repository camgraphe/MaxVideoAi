import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getBaseEngines, getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { getRuntimeModelById, resolveRuntimeEngineInput } from '../frontend/config/model-runtime';
import { isArchivedGenerationModel } from '../frontend/lib/model-generation-policy';
import { resolveMediaAwarePreflight } from '../frontend/app/api/preflight/_lib/media-aware-preflight';
import { resolveTrustedPaidGenerateRouteContext } from '../frontend/app/api/generate/_lib/route-context';
import { WORKSPACE_MODEL_CERTIFICATIONS } from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/models/workspace-model-certification';
import { buildModelArchiveMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-metadata';

const id = 'seedance-1-5-pro';

test('Seedance 1.5 is a published historical page, absent from new jobs and pricing', () => {
  const model = getRuntimeModelById(id)!;
  assert.equal(model.lifecycle, 'deep_legacy');
  assert.equal(model.successorId, null);
  assert.equal(model.publication.app.published, false);
  assert.equal(model.publication.pricing.published, false);
  assert.equal(model.publication.examples.current, false);
  assert.equal(model.publication.model.published, true);
  assert.equal(model.publication.model.indexable, true);
  assert.equal(model.publication.examples.published, true);
  assert.equal(model.publication.compare.published, true);
  assert.equal(model.publication.sitemap.published, true);
  assert.equal(getBaseEngines().some(engine => engine.id === id), false);
  assert.ok(getBaseEngineIncludingHidden(id), 'historical jobs keep their original engine identity');
  assert.equal(resolveRuntimeEngineInput('seedance-v1.5-pro')?.id, id);
  assert.equal(isArchivedGenerationModel('seedance-v1.5-pro'), true);
  assert.equal(WORKSPACE_MODEL_CERTIFICATIONS.some(item => item.modelId === id), false);
});

test('Seedance 1.5 preflight and paid generation stop before quote or charge', async () => {
  const engine = getBaseEngineIncludingHidden(id)!;
  const response = await resolveMediaAwarePreflight({
    request: {
      engine: id, mode: 't2v', durationSec: 5, resolution: '720p',
      aspectRatio: '16:9', fps: 24, user: { memberTier: 'Member' },
    },
  }, {
    getConfiguredEngineFn: async () => { throw new Error('Retired model must stop before pricing'); },
    computeConfiguredPreflightFn: async () => { throw new Error('Retired model must stop before quote'); },
  });
  assert.equal(response.ok, false);
  assert.equal(response.error?.code, 'ENGINE_RETIRED');

  const paid = resolveTrustedPaidGenerateRouteContext({ body: {}, engine, jobId: 'new-job', mode: 't2v' });
  assert.deepEqual(paid, { ok: false, status: 410, body: { ok: false, error: 'ENGINE_RETIRED' } });
});

for (const locale of ['en', 'fr', 'es']) {
  test(`${locale} Seedance 1.5 has a factual archive and three distinct current alternatives`, () => {
    const content = JSON.parse(readFileSync(`content/models/${locale}/${id}.json`, 'utf8'));
    assert.ok(content.archive?.title);
    assert.match(content.archive.intro, /2026/);
    assert.deepEqual(
      content.archive.alternatives.map((item: { modelId: string }) => item.modelId),
      ['seedance-2-0-mini', 'seedance-2-0-fast', 'seedance-2-5'],
    );
    assert.doesNotMatch(JSON.stringify(content.archive), /\/app\?engine=seedance-1-5-pro/);
  });
  test(`${locale} archive metadata stays indexable with a self canonical and hreflang`, () => {
    const model = getRuntimeModelById(id)!;
    const content = JSON.parse(readFileSync(`content/models/${locale}/${id}.json`, 'utf8'));
    const metadata = buildModelArchiveMetadata(model, content.archive, locale as 'en' | 'fr' | 'es');
    assert.equal(metadata.alternates?.canonical, metadata.alternates?.languages?.[locale]);
    assert.ok(String(metadata.alternates?.canonical).endsWith(id));
    assert.ok(metadata.alternates?.languages?.en);
    assert.ok(metadata.alternates?.languages?.fr);
    assert.ok(metadata.alternates?.languages?.es);
    assert.deepEqual(metadata.robots, { index: true, follow: true });
    assert.equal(metadata.openGraph?.type, 'article');
  });
}

test('historical comparison URLs and family examples remain discoverable', async () => {
  const hub = await import('../frontend/lib/compare-hub/data');
  const { getExamplesHref } = await import('../frontend/lib/examples-links');
  const { getPathname } = await import('../frontend/i18n/navigation');
  assert.ok(hub.isPublishedComparisonSlug('seedance-1-5-pro-vs-seedance-2-0'));
  assert.ok(hub.getHubEngines().every(engine => engine.modelSlug !== id));
  const href = getExamplesHref(id)!;
  assert.equal(getPathname({ locale: 'fr', href }), '/fr/galerie/seedance');
  assert.equal(getPathname({ locale: 'es', href }), '/es/galeria/seedance');
});
