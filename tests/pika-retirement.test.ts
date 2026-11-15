import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getRuntimeModelById } from '../frontend/config/model-runtime';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getBaseEngines, getBaseEngineIncludingHidden } from '../frontend/src/lib/engines';
import { getGenerationModelIdentity, isArchivedGenerationModel } from '../frontend/lib/model-generation-policy';
import { isDiscoverableExampleEngine } from '../frontend/lib/examples/discovery';
import { getHubEngines, getSuggestedOpponentSlugs, getHubComparisonSlugsForSitemap, isPublishedComparisonSlug } from '../frontend/lib/compare-hub/data';
import { listAgentModels, listPublicAgentGenerationEngines, type AgentModelCatalogDeps } from '../frontend/src/server/agent-api/model-catalog';
import { getAgentModelDetails } from '../frontend/src/server/agent-api/model-details';
import { recommendAgentModels } from '../frontend/src/server/agent-api/model-recommendations';
import { calculateAgentProjectBudget, createAgentProjectBudgetDependencies } from '../frontend/src/server/agent-api/project-budget';
import { compareGenerationPrices } from '../frontend/src/server/agent-api/generation-price-comparison';
import { parseModelArchiveContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-content';
import { buildModelArchiveMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-archive-metadata';

const id = 'pika-text-to-video';
const principal = { userId: 'pika-audit-owner', clientId: 'pika-audit-client', authMethod: 'oauth' as const, emailVerified: true };
// Intentionally no database override: an isolated environment must respect the authored closure.
const entries = listFalEngines();
const deps: AgentModelCatalogDeps = {
  listEngines: async () => entries.map(entry => entry.engine),
  getEngineIncludingHidden: async engineId => getBaseEngineIncludingHidden(engineId),
  surfaceByEngineId: engineId => entries.find(entry => entry.id === engineId)?.category === 'image' ? 'image' : 'video',
  isEngineExecutable: () => true,
  isModeExecutable: () => true,
};

test('Pika closure is portable without production overrides while historical identity stays readable', () => {
  const model = getRuntimeModelById(id)!;
  assert.equal(model.lifecycle, 'deep_legacy');
  assert.equal(model.publication.app.published, false);
  assert.equal(model.publication.pricing.published, false);
  assert.equal(model.publication.compare.published, true, 'historical comparison URLs remain readable');
  assert.equal(model.publication.model.published, true);
  assert.equal(getBaseEngines().some(engine => engine.id === id), false);
  assert.ok(getBaseEngineIncludingHidden(id));
  assert.equal(isDiscoverableExampleEngine(id), false);
  for (const alias of [id, 'pika-2-2', 'pika22', 'pika-image-to-video', 'pika-image-video']) {
    assert.equal(getGenerationModelIdentity(alias)?.id, id);
    assert.equal(isArchivedGenerationModel(alias), true);
  }
});

test('Pika cannot be discovered or recommended as a current model even by explicit preference', async () => {
  assert.equal((await listAgentModels({ limit: 50 }, deps)).some(model => model.id === id), false);
  for (const input of [{ id }, { preferredModelIds: [id] }]) {
    const result = await recommendAgentModels(input, deps);
    assert.equal(result.recommendations.some(item => item.model.id === id), false);
  }
  const details = await getAgentModelDetails(id, deps);
  assert.equal(details.lifecycle, 'deep_legacy');
  assert.equal(details.generationEnabled, false);
  assert.equal(details.recommendedByDefault, false);
  assert.equal((await listPublicAgentGenerationEngines(deps)).some(item => item.engine.id === id), false);
});

test('Pika has no current comparison, suggested opponent or price option', async () => {
  assert.equal(getHubEngines().some(engine => engine.modelSlug === id), false);
  assert.equal(getSuggestedOpponentSlugs('veo-3-1', 100).includes(id), false);
  assert.equal(getHubComparisonSlugsForSitemap().some(slug => slug.includes(id)), true, 'historical URLs retain their indexing contract');
  assert.equal(isPublishedComparisonSlug(`${id}-vs-veo-3-1`), true);
  await assert.rejects(compareGenerationPrices({ surface: 'video', mode: 't2v', prompt: 'A toy boat',
    settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' }, references: [], candidateModelIds: [id] }, principal, {
    listPublicEngines: () => listPublicAgentGenerationEngines(deps),
    resolveMembershipPricing: async () => ({ tier: 'member' } as never),
  }), (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'PARAMETER_INVALID'));

});

test('Pika project budget is rejected before any customer pricing', async () => {
  const dependencies = createAgentProjectBudgetDependencies(deps);
  dependencies.getMembershipStatus = async () => ({ pricing: { tier: 'member' } } as never);
  dependencies.priceGeneration = async () => { throw new Error('an archived model must not reach pricing'); };
  await assert.rejects(calculateAgentProjectBudget({ proposals: [{ name: 'Retired model', lines: [{ purpose: 'Historic style', engineId: id,
    mode: 't2v', settings: { durationSec: 5, resolution: '720p', aspectRatio: '16:9' }, clipCount: 1, attemptsPerClip: 1 }] }] }, principal, dependencies),
    (error: unknown) => Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENGINE_UNAVAILABLE'));
});

for (const locale of ['en', 'fr', 'es'] as const) test(`Pika ${locale} archive retains canonical and hreflang without provider-retirement claims`, () => {
  const document = JSON.parse(readFileSync(`content/models/${locale}/${id}.json`, 'utf8'));
  const archive = parseModelArchiveContent(document.archive);
  assert.equal(archive.source, undefined);
  assert.ok(archive.historyBody);
  assert.ok(archive.alternatives.every(alternative => getRuntimeModelById(alternative.modelId)?.publication.app.published));
  const metadata = buildModelArchiveMetadata(getRuntimeModelById(id)!, archive, locale);
  const path = { en: '/models/', fr: '/fr/modeles/', es: '/es/modelos/' }[locale];
  assert.equal(metadata.alternates?.canonical, `https://maxvideoai.com${path}${id}`);
  assert.equal(Object.keys(metadata.alternates?.languages ?? {}).length, 4);
  assert.deepEqual(metadata.robots, { index: true, follow: true });
});
