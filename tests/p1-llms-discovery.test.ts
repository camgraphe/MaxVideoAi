import assert from 'node:assert/strict';
import test from 'node:test';

import engineCatalog from '../frontend/config/engine-catalog.json' with { type: 'json' };
import mcpPublication from '../frontend/config/mcp-publication.json' with { type: 'json' };
import { buildModelFamilyDefinitions } from '../frontend/config/model-families.ts';
import type { ModelLaunchReadinessEntry } from '../frontend/config/model-launch-readiness-schema.ts';
import { listRuntimeModels, type RuntimeModelEntry } from '../frontend/config/model-runtime.ts';
import {
  buildLlmsModelDiscoveryProjection,
  buildLlmsText,
  P1_PRIMARY_COMPARISONS,
} from '../frontend/lib/seo/llms-text.ts';

const P1_IDS = [
  'gemini-omni-flash',
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;

const PAIRS_BY_ID: Record<string, string[]> = {
  'gemini-omni-flash': ['kling-3-turbo-pro'],
  'kling-3-turbo-standard': ['kling-3-turbo-pro'],
  'kling-3-turbo-pro': ['kling-3-turbo-standard', 'kling-3-pro', 'gemini-omni-flash'],
  'minimax-h3-max': ['minimax-h3'],
};

function publishedP1Models(): RuntimeModelEntry[] {
  return listRuntimeModels().map((model) => {
    if (!P1_IDS.includes(model.id as (typeof P1_IDS)[number])) return structuredClone(model);
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

test('P1 LLM discovery exposes current names, canonical URLs, families, and scoreboards', () => {
  const models = publishedP1Models();
  const projection = buildLlmsModelDiscoveryProjection({
    models,
    catalog: engineCatalog,
    families: buildModelFamilyDefinitions(models, readiness),
    candidateModelIds: P1_IDS,
    primaryComparisons: P1_PRIMARY_COMPARISONS,
    isLocalizedScoreboardComplete: () => true,
  });
  const text = buildLlmsText(mcpPublication, projection);
  const expectedLabels = {
    'gemini-omni-flash': 'Gemini Omni Flash 1.1',
    'kling-3-turbo-standard': 'Kling 3.0 Turbo Standard',
    'kling-3-turbo-pro': 'Kling 3.0 Turbo Pro',
    'minimax-h3-max': 'MiniMax H3 Max',
  } as const;

  assert.deepEqual(projection.currentModels.map(({ id }) => id).sort(), [...P1_IDS].sort());
  for (const id of P1_IDS) {
    const model = projection.currentModels.find((candidate) => candidate.id === id);
    assert.equal(model?.label, expectedLabels[id]);
    assert.equal(model?.href, `https://maxvideoai.com/models/${id}`);
    assert.equal(text.split(`](https://maxvideoai.com/models/${id})`).length - 1, 1, id);
  }
  assert.deepEqual(projection.families.map(({ id }) => id).sort(), ['hailuo', 'kling', 'veo']);
  assert.deepEqual(
    projection.primaryComparisons.map(({ slug }) => slug).sort(),
    P1_PRIMARY_COMPARISONS.map(({ slug }) => slug).sort(),
  );
  assert.doesNotMatch(text, /gemini-omni-flash-1-1\)/);
  assert.doesNotMatch(text, /fal(?:\.ai)?/i);
});

test('published P1 identities remain present in default LLM discovery', () => {
  const projection = buildLlmsModelDiscoveryProjection();
  for (const id of ['kling-3-turbo-standard', 'kling-3-turbo-pro', 'minimax-h3-max']) {
    assert.equal(projection.currentModels.some((model) => model.id === id), true, id);
  }
});
