import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModelFamilyDefinitions } from '../frontend/config/model-families';
import { MODEL_LAUNCH_READY_MODELS } from '../frontend/config/model-launch-readiness';
import { listRuntimeModels, getRuntimeModelById, resolveRuntimePublicSlug } from '../frontend/config/model-runtime';
import { getExamplesHref } from '../frontend/lib/examples-links';
import { getExampleFamilyPrimaryModelSlug } from '../frontend/lib/model-families';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding';
import { buildExamplesVersionLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-version-links';
import { buildExamplesPaginationHref } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-hrefs';
import { getExamplesPaginationSeo, withExamplesPaginationMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-pagination-seo';

const models = ['flux-3-max', 'flux-3', 'flux-3-draft'];
test('Max adds a separate identity without redirecting or retiring Standard and Draft', () => {
  for (const id of models) {
    const model = getRuntimeModelById(id)!;
    assert.equal(resolveRuntimePublicSlug(id)?.id, id);
    assert.equal(model.successorId, null);
    assert.equal(model.lifecycle, 'current');
    assert.equal(model.publication.model.indexable, true);
    assert.equal(model.publication.sitemap.published, true);
    assert.deepEqual(getExamplesHref(id), { pathname: '/examples/[model]', params: { model: 'flux' } });
  }
});

test('Max readiness adds membership and never removes the two existing versions', () => {
  const prior = MODEL_LAUNCH_READY_MODELS.filter(item => item.modelId !== 'flux-3-max');
  const before = buildModelFamilyDefinitions(listRuntimeModels(), prior).find(family => family.id === 'flux')!;
  assert.deepEqual(before.examplesPage?.publishedModelSlugs, ['flux-3', 'flux-3-draft']);
  const after = buildModelFamilyDefinitions(listRuntimeModels(), [...prior, { waveId: 'flux-3-max', modelId: 'flux-3-max', familyId: 'flux', acceptedAssetCount: 2, familyPlaylistSlug: 'family-flux', modelPlaylistSlug: 'examples-flux-3-max' }]).find(family => family.id === 'flux')!;
  assert.deepEqual(after.examplesPage?.publishedModelSlugs, models);
  assert.deepEqual(after.examplesPage?.currentModelSlugs, models);
  // The configured default does not activate an unready model in the family action.
  assert.equal(getExampleFamilyPrimaryModelSlug('flux'), MODEL_LAUNCH_READY_MODELS.some(item => item.modelId === 'flux-3-max') ? 'flux-3-max' : 'flux-3');
});

test('full-catalog version samples preserve original model labels and watch destinations', () => {
  const versions = models.map(slug => ({ slug, engineId: slug, label: { 'flux-3-max': 'FLUX 3 Max', 'flux-3': 'FLUX 3', 'flux-3-draft': 'FLUX 3 Draft' }[slug]! }));
  const old = [{ engineId: 'flux-3', videoId: 'standard-beyond-page-1' }, { engineId: 'flux-3-draft', videoId: 'draft-beyond-page-1' }];
  const before = buildExamplesVersionLinks(versions, old, models);
  assert.deepEqual(before.map(link => link.href), ['/video/standard-beyond-page-1', '/video/draft-beyond-page-1']);
  const after = buildExamplesVersionLinks(versions, [{ engineId: 'flux-3-max', videoId: 'max-new' }, ...old], models);
  assert.deepEqual(after.slice(1), before);
  assert.ok(after.every(link => link.current), 'previous release is not automatically historical');
});

for (const [locale, base, title] of [
  ['en', '/examples', 'FLUX 3 & FLUX 3 Draft examples'],
  ['fr', '/fr/galerie', 'Exemples FLUX 3 et FLUX 3 Draft'],
  ['es', '/es/galeria', 'Ejemplos de FLUX 3 y FLUX 3 Draft'],
] as const) test(`${locale}: family identity, pagination and query-indexing policy survive the new model`, () => {
  const landing = getExampleModelLanding(locale, 'flux')!;
  assert.equal(landing.heroTitle, title);
  assert.match(landing.intro, /FLUX 3 Max/);
  assert.match(landing.intro, /Extend/);
  const href = buildExamplesPaginationHref({ engineFromPath: 'flux', modelLandingSlug: 'flux', galleryBasePath: base, selectedEngine: 'flux', sort: 'playlist', targetPage: 2 });
  assert.equal(href, `${base}/flux?page=2`);
  const metadata = withExamplesPaginationMetadata({}, locale, '/examples/flux', 2);
  assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com${base}/flux?page=2`);
  assert.equal(metadata.alternates?.languages?.en, 'https://maxvideoai.com/examples/flux?page=2');
  assert.deepEqual(getExamplesPaginationSeo({ page: '2' }), { index: true, canonicalPage: 2 });
  for (const engine of models) assert.deepEqual(getExamplesPaginationSeo({ engine }), { index: false, canonicalPage: 1 });
});
