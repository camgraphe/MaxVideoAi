import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import h3Content from '../content/models/en/minimax-h3.json' with { type: 'json' };
import h3MaxContent from '../content/models/en/minimax-h3-max.json' with { type: 'json' };
import compareHub from '../frontend/config/compare-hub.json' with { type: 'json' };
import {
  buildModelFamilyDefinitions,
} from '../frontend/config/model-families.ts';
import type { ModelLaunchReadinessEntry } from '../frontend/config/model-launch-readiness-schema.ts';
import {
  listRuntimeModels,
  type RuntimeModelEntry,
} from '../frontend/config/model-runtime.ts';
import {
  buildMarketingCompareMenu,
  buildMarketingModelMenu,
} from '../frontend/config/navigation.ts';
import {
  buildPublishedComparisonSlugsFromModels,
} from '../frontend/lib/compare-hub/data.ts';

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

const PAIRS_BY_ID: Record<string, string[]> = {
  'gemini-omni-flash': ['veo-3-1', 'veo-3-1-fast', 'sora-2', 'seedance-2-0', 'kling-3-turbo-pro'],
  'kling-3-turbo-pro': ['kling-3-turbo-standard', 'kling-3-pro', 'gemini-omni-flash'],
  'kling-3-turbo-standard': ['kling-3-turbo-pro'],
  'minimax-h3-max': ['minimax-h3'],
};

function publishedP1Models(): RuntimeModelEntry[] {
  return listRuntimeModels().map((model) => {
    if (!P1_MODEL_IDS.includes(model.id as (typeof P1_MODEL_IDS)[number])) return structuredClone(model);
    const cloned = structuredClone(model);
    return {
      ...cloned,
      publication: {
        ...cloned.publication,
        model: { published: true, indexable: true },
        examples: {
          ...cloned.publication.examples,
          published: true,
          includeInFamilyCopy: true,
          current: true,
        },
        compare: {
          published: true,
          indexed: true,
          suggestedOpponentIds: PAIRS_BY_ID[model.id] ?? [],
          publishedPairIds: PAIRS_BY_ID[model.id] ?? [],
        },
        app: { ...cloned.publication.app, published: true },
        pricing: { ...cloned.publication.pricing, published: true },
        sitemap: { published: true },
      },
    };
  });
}

const readiness: ModelLaunchReadinessEntry[] = [
  { waveId: 'p1', modelId: 'gemini-omni-flash', familyId: 'veo', acceptedAssetCount: 2, familyPlaylistSlug: 'family-veo', modelPlaylistSlug: 'examples-gemini-omni-flash' },
  { waveId: 'p1', modelId: 'kling-3-turbo-standard', familyId: 'kling', acceptedAssetCount: 2, familyPlaylistSlug: 'family-kling', modelPlaylistSlug: 'examples-kling-3-turbo-standard' },
  { waveId: 'p1', modelId: 'kling-3-turbo-pro', familyId: 'kling', acceptedAssetCount: 2, familyPlaylistSlug: 'family-kling', modelPlaylistSlug: 'examples-kling-3-turbo-pro' },
  { waveId: 'p1', modelId: 'minimax-h3-max', familyId: 'hailuo', acceptedAssetCount: 2, familyPlaylistSlug: 'family-hailuo', modelPlaylistSlug: 'examples-minimax-h3-max' },
];

test('the P1 model and comparison menus publish atomically without changing canonicals', () => {
  const models = publishedP1Models();
  const modelMenu = buildMarketingModelMenu(models);
  const compareMenu = buildMarketingCompareMenu(models);

  assert.ok(modelMenu.length <= 10);
  for (const id of NEW_MODEL_IDS) assert.ok(modelMenu.some(({ slug }) => slug === id), id);
  assert.ok(modelMenu.some(({ slug, label }) => slug === 'gemini-omni-flash' && label === 'Gemini Omni Flash 1.1'));
  assert.ok(modelMenu.some(({ slug }) => slug === 'minimax-h3'), 'generic H3 canonical stays visible');
  assert.equal(modelMenu.some(({ slug }) => slug === 'gemini-omni-flash-1-1'), false);

  assert.ok(compareMenu.length <= 10);
  for (const slug of P1_COMPARISONS) assert.ok(compareMenu.some((item) => item.slug === slug), slug);
});

test('P1 family and examples projections attach every model to the existing family routes', () => {
  const families = buildModelFamilyDefinitions(publishedP1Models(), readiness);
  const kling = families.find(({ id }) => id === 'kling');
  const hailuo = families.find(({ id }) => id === 'hailuo');
  const veo = families.find(({ id }) => id === 'veo');

  assert.deepEqual(kling?.examplesPage?.publishedModelSlugs?.slice(0, 2), [
    'kling-3-turbo-pro',
    'kling-3-turbo-standard',
  ]);
  assert.ok(hailuo?.examplesPage?.publishedModelSlugs?.includes('minimax-h3'));
  assert.ok(hailuo?.examplesPage?.publishedModelSlugs?.includes('minimax-h3-max'));
  assert.ok(veo?.examplesPage?.publishedModelSlugs?.includes('gemini-omni-flash'));
  assert.equal(kling?.id, 'kling');
  assert.equal(hailuo?.id, 'hailuo');

  const playlistSource = readFileSync('frontend/server/example-family-playlists.ts', 'utf8');
  assert.match(playlistSource, /getExampleFamilyModelSlugs/);
  assert.match(playlistSource, /getModelPlaylistSlug/);
});

test('the four scoreboards exist in the compare graph and keep H3 intent separated', () => {
  const publishedPairs = buildPublishedComparisonSlugsFromModels(publishedP1Models(), () => true);
  for (const slug of P1_COMPARISONS) {
    assert.ok(compareHub.popularComparisons.some(({ left, right }) =>
      [left, right].sort().join('-vs-') === slug), `${slug}:hub`);
    assert.ok(publishedPairs.includes(slug), `${slug}:published`);
  }

  const h3Links = JSON.stringify(h3Content);
  const h3MaxLinks = JSON.stringify(h3MaxContent);
  assert.equal((h3Links.match(/\/models\/minimax-h3-max/g) ?? []).length, 1);
  assert.equal((h3MaxLinks.match(/\/models\/minimax-h3/g) ?? []).length, 1);
  assert.doesNotMatch(h3Content.seo.title, /H3 Max/i);
  assert.match(h3MaxContent.seo.title, /MiniMax H3 Max/i);
});
