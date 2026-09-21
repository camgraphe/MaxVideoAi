import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getBaseEngines, getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { getRuntimeModelById, resolveRuntimeEngineInput } from '../frontend/config/model-runtime';

for (const id of ['sora-2', 'sora-2-pro']) {
  test(`${id} is historical, unavailable for new jobs, and keeps its identity`, () => {
    const model = getRuntimeModelById(id)!;
    assert.equal(model.lifecycle, 'deep_legacy');
    assert.equal(model.publication.app.published, false);
    assert.equal(model.publication.pricing.published, false);
    assert.equal(model.publication.model.published, true);
    assert.equal(getBaseEngines().some(engine => engine.id === id), false);
    assert.ok(getBaseEngineIncludingHidden(id));
    assert.equal(resolveRuntimeEngineInput(id)?.id, id);
  });
  for (const locale of ['en', 'fr', 'es']) {
    test(`${locale}/${id} has localized archive content with three explicit alternatives`, () => {
      const content = JSON.parse(readFileSync(`content/models/${locale}/${id}.json`, 'utf8'));
      assert.ok(content.archive?.title);
      assert.match(content.archive.intro, /24/);
      assert.deepEqual(content.archive.alternatives.map((item: { modelId: string }) => item.modelId), ['seedance-2-5', 'minimax-h3', 'wan-3']);
      assert.doesNotMatch(JSON.stringify(content.archive), /\/app\?engine=sora/);
    });
  }
}

test('public aliases retain their historical identity instead of redirecting generation', async () => {
  const { isArchivedGenerationModel, getGenerationModelIdentity } = await import('../frontend/lib/model-generation-policy');
  for (const id of ['openai-sora-2', 'openai-sora-2-pro', ' SORA-PRO ']) {
    assert.equal(isArchivedGenerationModel(id), true, id);
    assert.match(getGenerationModelIdentity(id)!.id, /^sora-2/);
  }
});

test('archived comparison sides have no generation CTA or purchasable price', async () => {
  const { CATALOG_BY_SLUG } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-config');
  const { isEngineGeneratable, resolvePricingDisplay } = await import('../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-pricing');
  for (const id of ['sora-2', 'sora-2-pro']) {
    const entry = CATALOG_BY_SLUG.get(id)!;
    assert.equal(isEngineGeneratable(entry), false);
    for (const locale of ['en', 'fr', 'es'] as const) {
      const price = await resolvePricingDisplay(entry, locale);
      assert.deepEqual(price.prices, []);
      assert.deepEqual(price.scorePrices, []);
    }
  }
  assert.equal(isEngineGeneratable(CATALOG_BY_SLUG.get('seedance-2-5')!), true);
});

test('archives retain published comparison URLs while leaving comparison recommendations', async () => {
  const hub = await import('../frontend/lib/compare-hub/data');
  assert.ok(hub.getHubComparisonSlugsForSitemap().includes('sora-2-vs-veo-3-1'));
  assert.ok(hub.isPublishedComparisonSlug('sora-2-vs-veo-3-1'));
  assert.ok(hub.getHubEngines().every(engine => !engine.modelSlug.startsWith('sora-2')));
  assert.ok(hub.getSuggestedOpponentSlugs('veo-3-1', 50).every(slug => !slug.startsWith('sora-2')));
});

test('archive links use the localized family examples route', async () => {
  const { getExamplesHref } = await import('../frontend/lib/examples-links');
  const { getPathname } = await import('../frontend/i18n/navigation');
  for (const id of ['sora-2', 'sora-2-pro']) {
    const href = getExamplesHref(id)!;
    assert.equal(getPathname({ locale: 'fr', href }), '/fr/galerie/sora');
    assert.equal(getPathname({ locale: 'es', href }), '/es/galeria/sora');
  }
});
