import assert from 'node:assert/strict';
import test from 'node:test';
import { getModelFamilyDefinition, buildModelFamilyDefinitions } from '../frontend/config/model-families';
import { listRuntimeModels } from '../frontend/config/model-runtime';
import { MARKETING_NAV_DROPDOWNS, MARKETING_FOOTER_EXAMPLES, buildMarketingModelMenu } from '../frontend/config/navigation';
import { getExampleFamilyCurrentModelSlugs, getExampleFamilyModelSlugs, getExampleNavFamilyIds, isIndexedExampleFamilyId } from '../frontend/lib/model-families';
import { buildExamplesEngineFilterState, buildExamplesModelLinks } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-data';
import { selectLocalPublicExamples, type PublicExamplesSnapshot } from '../frontend/server/local-public-examples-data';

test('archived Sora remains indexed with historical membership but no current models or menu promotion', () => {
  assert.equal(isIndexedExampleFamilyId('sora'), true);
  assert.equal(getExampleFamilyModelSlugs('sora').length, 2);
  assert.deepEqual(getExampleFamilyCurrentModelSlugs('sora'), []);
  assert.equal(getModelFamilyDefinition('sora')?.examplesPage?.showInNav, false);
  assert.equal(getExampleNavFamilyIds().includes('sora'), false);
  for (const dropdown of Object.values(MARKETING_NAV_DROPDOWNS)) {
    for (const item of [...dropdown!.items, ...(dropdown!.sections ?? []).flatMap(section => section.items)]) {
      assert.doesNotMatch(JSON.stringify(item), /sora/i);
    }
  }
  assert(!MARKETING_FOOTER_EXAMPLES.some(item => item.key === 'sora'));
});

test('retirement removes other families from discovery through registry policy, without deleting their routes', () => {
  const models = listRuntimeModels().map(model => model.family === 'veo' ? {
    ...model, lifecycle: 'deep_legacy' as const,
    publication: { ...model.publication, app: { ...model.publication.app, published: false }, examples: { ...model.publication.examples, current: false } },
  } : model);
  const family = buildModelFamilyDefinitions(models).find(item => item.id === 'veo')!;
  assert.equal(family.examplesPage?.stage, 'indexed');
  assert.equal(family.examplesPage?.showInNav, false);
  assert.deepEqual(family.examplesPage?.currentModelSlugs, []);
  assert(!buildMarketingModelMenu(models).some(item => item.slug === 'veo-3-1'));
});

test('general example selectors omit Sora while direct archive entry retains its selection and model links', () => {
  const hub = buildExamplesEngineFilterState({ allVideos: [], collapsedEngineParam: '' });
  assert(!hub.engineFilterOptions.some(option => option.id === 'sora'));
  const archive = buildExamplesEngineFilterState({ allVideos: [], collapsedEngineParam: 'sora' });
  assert.equal(archive.selectedEngine, 'sora');
  assert.equal(archive.selectedOption?.label, 'Sora');
  assert.equal(buildExamplesModelLinks({ locale: 'fr', selectedEngine: 'sora', usesCurrentAndSupportedBlocks: false }).modelLinks.length, 2);
});

test('local public gallery removes archives before sorting and pagination while keeping the archive feed', () => {
  const cards = Object.fromEntries(['sora-2', 'seedance-2-5', 'sora-2-pro', 'minimax-h3', 'wan-3'].map(id => [id, {
    id, engineIconId: id, engineLabel: id, prompt: 'Example', durationSec: 5, hasAudio: true,
  }]));
  const ids = Object.keys(cards);
  const snapshot: PublicExamplesSnapshot = { version: 1, source: 'https://maxvideoai.com/api/examples', capturedAt: '', cards, feeds: {
    '': { playlist: ids, 'date-desc': ids },
    sora: { playlist: ['sora-2', 'sora-2-pro'], 'date-desc': ['sora-2', 'sora-2-pro'] },
  } };
  const first = selectLocalPublicExamples(snapshot, '', 'playlist', 2, 0);
  assert.deepEqual(first.items.map(item => item.id), ['seedance-2-5', 'minimax-h3']);
  assert.equal(first.total, 3);
  assert.equal(first.hasMore, true);
  assert.deepEqual(selectLocalPublicExamples(snapshot, '', 'playlist', 2, 2).items.map(item => item.id), ['wan-3']);
  assert.equal(selectLocalPublicExamples(snapshot, 'sora', 'playlist', 2, 0).items.length, 2);
});

test('homepage fallback content cannot promote an archived engine even when media is missing', async () => {
  const { assembleHomepageExampleCards } = await import('../frontend/app/(localized)/[locale]/(marketing)/(home)/_lib/home-route-data/examples');
  const messages = JSON.parse((await import('node:fs')).readFileSync('frontend/messages/en.json', 'utf8'));
  const content = messages.home.redesign;
  content.examples.fallbackCards = [
    { ...content.examples.fallbackCards[0], id: 'old-sora', engineId: 'sora-2', modelSlug: 'sora-2', examplesSlug: undefined },
    { ...content.examples.fallbackCards[0], id: 'current', engineId: 'seedance-2-5', modelSlug: 'seedance-2-5', examplesSlug: undefined },
  ];
  const cards = assembleHomepageExampleCards({ locale: 'en', content, globalCandidates: [], familyVideos: new Map(), readiness: [] });
  assert(!cards.some(card => card.engineId === 'sora-2'));
  assert(cards.some(card => card.engineId === 'seedance-2-5'));
});

test('historical family onward links direct EN FR ES visitors to the three available alternatives', async () => {
  const { buildExamplesNextStepLinks } = await import('../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy');
  for (const locale of ['en', 'fr', 'es'] as const) {
    const links = buildExamplesNextStepLinks({ appLocale: locale, locale, familySlug: 'sora', isKlingLanding: false, isLtxLanding: false, isSeedanceLanding: false, isVeoLanding: false, pricingPath: '/pricing' });
    for (const model of ['seedance-2-5', 'minimax-h3', 'wan-3']) assert(links.some(link => link.href.endsWith('/'+model)), `${locale}/${model}`);
  }
});
